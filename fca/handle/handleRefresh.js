const fs = require('fs-extra');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

module.exports = function ({ api, models, Users, Threads, Currencies }) {
    const logger = require("../../utils/log.js");

    const getName = async (uid) => {
        try {
            const userInfo = await Users.getData(uid);
            return userInfo?.name || uid;
        } catch {
            return uid;
        }
    };

    const getThreadName = async (tid) => {
        try {
            const threadInfo = await Threads.getData(tid);
            return threadInfo?.threadInfo?.threadName || tid;
        } catch {
            return tid;
        }
    };

    return async function ({ event }) {
        const { threadID, logMessageType, logMessageData } = event;
        const { setData, getData, delData } = Threads;
        try {
            const threadData = await getData(threadID);
            if (!threadData) {
                logger(`Không tìm thấy dữ liệu của nhóm ${threadID}`, '[ERROR]');
                return;
            }

            let dataThread = threadData.threadInfo || {};
            if (!dataThread.participantIDs) dataThread.participantIDs = [];
            if (!dataThread.adminIDs) dataThread.adminIDs = [];
            if (!dataThread.nicknames) dataThread.nicknames = {};

            switch (logMessageType) {
                case "log:thread-admins": {
                    if (logMessageData.ADMIN_EVENT == "add_admin" || logMessageData.ADMIN_EVENT == "remove_admin") {
                        try {
                            const threadInfo = await api.getThreadInfo(threadID);
                            if (threadInfo && threadInfo.adminIDs) {
                                dataThread.adminIDs = threadInfo.adminIDs;
                                await setData(threadID, { threadInfo: dataThread });
                                const threadName = await getThreadName(threadID);
                                logger(`Đã cập nhật danh sách admin cho nhóm: ${threadName}`, '[UPDATE ADMIN LIST]');
                            }
                        } catch (e) {
                            console.error(`Lỗi khi cập nhật admin cho nhóm ${await getThreadName(threadID)}:`, e);
                        }
                    }
                    break;
                }

                case "log:thread-name": {
                    dataThread.threadName = event.logMessageData.name || "Không tên";
                    await setData(threadID, { threadInfo: dataThread });
                    logger(`Nhóm ${await getThreadName(threadID)} đã đổi tên thành: ${dataThread.threadName}`, '[UPDATE THREAD NAME]');
                    break;
                }

                case "log:subscribe": {
                    if (event.logMessageData.addedParticipants && 
                        event.logMessageData.addedParticipants.some(i => i.userFbId == api.getCurrentUserID())) {
                        await setData(threadID, { threadInfo: dataThread });
                        logger(`Bot đã được thêm vào nhóm: ${await getThreadName(threadID)}`, '[BOT JOIN]');
                    }

                    const newParticipants = event.logMessageData.addedParticipants || [];
                    for (const participant of newParticipants) {
                        const userID = participant.userFbId;
                        try {
                            await Users.createData(userID);
                            await Currencies.createData(userID);
                            logger(`Đã tạo data cho thành viên mới: ${await getName(userID)} trong nhóm: ${await getThreadName(threadID)}`, '[CREATE USER DATA]');
                        } catch (e) {
                            console.error(`Lỗi khi tạo data cho thành viên ${await getName(userID)}:`, e);
                        }
                    }
                    break;
                }

                case 'log:unsubscribe': {
                    const leftParticipantFbId = logMessageData.leftParticipantFbId;
                    if (!leftParticipantFbId) {
                        logger(`Không tìm thấy ID người rời nhóm`, '[ERROR]');
                        return;
                    }

                    const threadName = await getThreadName(threadID);
                    const userName = await getName(leftParticipantFbId);
                    
                    if (leftParticipantFbId == api.getCurrentUserID()) {
                        logger(`Bot đã rời khỏi nhóm: ${threadName}`, '[BOT LEAVE]');
                        
                        if (global.data.allThreadID) {
                            const index = global.data.allThreadID.findIndex(item => item == threadID);
                            if (index > -1) global.data.allThreadID.splice(index, 1);
                        }
                        
                        await delData(threadID);

                        const checkttFilePath = path.join(__dirname, '..', '..', 'modules', 'commands', '_checktt', `${threadID}.json`);
                        if (fs.existsSync(checkttFilePath)) {
                            fs.unlinkSync(checkttFilePath);
                            logger(`Đã xóa file checktt của nhóm: ${threadName}`, '[DELETE CHECKTT]');
                        }

                        const dbPath = path.join(__dirname, '..', 'data.sqlite');
                        const db = new sqlite3.Database(dbPath);
                        db.run(`DELETE FROM Threads WHERE threadID = ?`, [threadID], function(err) {
                            if (err) console.error(`Lỗi khi xóa nhóm ${threadName} từ database:`, err);
                            else logger(`Đã xóa nhóm ${threadName} từ database`, '[DELETE THREAD]');
                        });
                        db.close();

                    } else {
                        logger(`Thành viên ${userName} đã rời khỏi nhóm: ${threadName}`, '[USER LEAVE]');

                        if (Array.isArray(dataThread.participantIDs)) {
                            const participantIndex = dataThread.participantIDs.findIndex(item => item == leftParticipantFbId);
                            if (participantIndex > -1) {
                                dataThread.participantIDs.splice(participantIndex, 1);
                            }
                        }

                        if (Array.isArray(dataThread.adminIDs)) {
                            dataThread.adminIDs = dataThread.adminIDs.filter(item => item?.id != leftParticipantFbId);
                        }

                        await setData(threadID, { threadInfo: dataThread });

                        try {
                            let userStillExists = false;
                            const allThreads = await Threads.getAll();
                            if (Array.isArray(allThreads)) {
                                for (const thread of allThreads) {
                                    if (thread.threadID !== threadID && 
                                        Array.isArray(thread?.threadInfo?.participantIDs) &&
                                        thread.threadInfo.participantIDs.includes(leftParticipantFbId)) {
                                        userStillExists = true;
                                        break;
                                    }
                                }
                            }

                            if (!userStillExists) {
                                logger(`Thành viên ${userName} không còn trong nhóm nào, tiến hành xóa data`, '[DELETE USER DATA]');
                                
                                const dbPath = path.join(__dirname, '..', 'data.sqlite');
                                const db = new sqlite3.Database(dbPath);

                                db.run(`DELETE FROM Users WHERE userID = ?`, [leftParticipantFbId], function(err) {
                                    if (err) console.error(`Lỗi khi xóa thành viên ${userName} từ Users:`, err);
                                    else logger(`Đã xóa thành viên ${userName} từ Users`, '[DELETE USER]');
                                });

                                db.run(`DELETE FROM Currencies WHERE userID = ?`, [leftParticipantFbId], function(err) {
                                    if (err) console.error(`Lỗi khi xóa thành viên ${userName} từ Currencies:`, err);
                                    else logger(`Đã xóa thành viên ${userName} từ Currencies`, '[DELETE CURRENCY]');
                                });

                                db.close();

                                if (global.data.allUserID) {
                                    const userIndex = global.data.allUserID.findIndex(item => item == leftParticipantFbId);
                                    if (userIndex > -1) global.data.allUserID.splice(userIndex, 1);
                                }
                            }
                        } catch (e) {
                            console.error(`Lỗi khi kiểm tra và xóa data user ${userName}:`, e);
                        }
                    }
                    break;
                }

                case 'log:thread-icon': {
                    dataThread.threadIcon = event.logMessageData.thread_icon || "👍";
                    await setData(threadID, { threadInfo: dataThread });
                    logger(`Đã cập nhật icon cho nhóm: ${await getThreadName(threadID)}`, '[UPDATE THREAD ICON]');
                    break;
                }

                case 'log:thread-color': {
                    if (event.logMessageData.theme_color) {
                        dataThread.threadColor = `#${event.logMessageData.theme_color}`;
                        dataThread.threadTheme = {
                            themeID: event.logMessageData.theme_id,
                            gradientColors: event.logMessageData.gradient ? JSON.parse(event.logMessageData.gradient) : [],
                            name: event.logMessageData.theme_name_with_subtitle || '',
                            emoji: event.logMessageData.theme_emoji || ''
                        };
                        await setData(threadID, { threadInfo: dataThread });
                        logger(`Đã cập nhật màu chủ đề cho nhóm: ${await getThreadName(threadID)}`, '[UPDATE THREAD COLOR]');
                    }
                    break;
                }

                case 'change_thread_image': {
                    if (event.image?.url) {
                        dataThread.imageUrl = event.image.url;
                        await setData(threadID, { threadInfo: dataThread });
                        logger(`Đã cập nhật ảnh nhóm cho: ${await getThreadName(threadID)}`, '[UPDATE GROUP IMAGE]');
                    }
                    break;
                }

                case 'log:user-nickname': {
                    const { participant_id, nickname } = event.logMessageData;
                    if (!dataThread.nicknames) dataThread.nicknames = {};
                    if (participant_id) {
                        dataThread.nicknames[participant_id] = nickname || "";
                        await setData(threadID, { threadInfo: dataThread });
                        logger(`Đã cập nhật biệt danh cho thành viên ${await getName(participant_id)} trong nhóm: ${await getThreadName(threadID)}`, '[UPDATE NICKNAME]');
                    }
                    break;
                }

                case 'log:thread-call': {
                    const callData = event.logMessageData;
                    if (callData) {
                        logger(`Cuộc gọi trong nhóm: ${await getThreadName(threadID)}\n${JSON.stringify(callData, null, 2)}`, '[THREAD CALL]');
                    }
                    break;
                }

                case 'log:thread-approval-mode': {
                    try {
                        if (event.logMessageData.hasOwnProperty('APPROVAL_MODE')) {
                            dataThread.approvalMode = event.logMessageData.APPROVAL_MODE == 1;
                            await setData(threadID, { threadInfo: dataThread });
                            logger(`Đã cập nhật chế độ phê duyệt cho nhóm: ${await getThreadName(threadID)}`, '[UPDATE APPROVAL MODE]');
                        }
                    } catch (e) {
                        console.error(`Lỗi khi cập nhật chế độ phê duyệt cho nhóm ${await getThreadName(threadID)}:`, e);
                    }
                    break;
                }
            }
        } catch (e) {
            console.error('Đã xảy ra lỗi khi update data:', e);
        }
    };
};