module.exports = function ({ Users, Threads, Currencies }) {
    const logger =require("../../utils/log.js");
    return async function ({ event }) {
        const { allUserID, allCurrenciesID, allThreadID, userName, threadInfo } = global.data; 
        const { autoCreateDB } = global.config;
        if (autoCreateDB == ![]) return;
        var { senderID, threadID } = event;
        senderID = String(senderID);
        var threadID = String(threadID);
        try {
            if (!allThreadID.includes(threadID) && event.isGroup == !![]) {
                const threadIn4 = await Threads.getInfo(threadID);
                const setting = {};
                setting.threadName = threadIn4.threadName;
                setting.adminIDs = threadIn4.adminIDs;
                setting.nicknames = threadIn4.nicknames;
                // Thêm theme box và image box
                setting.theme = threadIn4.theme || "default";
                setting.imageUrl = threadIn4.imageUrl || "";
                // Thêm các cờ bảo vệ
                setting.nameProtect = false;
                setting.imageProtect = false;
                setting.nicknameProtect = false;
                setting.themeProtect = false;
                setting.antiOut = false;
                
                const dataThread = setting;
                allThreadID.push(threadID);
                threadInfo.set(threadID, dataThread);
                const setting2 = {};
                setting2.threadInfo = dataThread;
                setting2.data = {};
                // Lưu theme và image URL vào data thread
                setting2.data.theme = setting.theme;
                setting2.data.imageUrl = setting.imageUrl;

                await Threads.setData(threadID, setting2);
                for (singleData of threadIn4.userInfo) {
                    userName.set(String(singleData.id), singleData.name);
                    try {
                        global.data.allUserID.includes(String(singleData.id)) ? (await Users.setData(String(singleData.id), 
                        {
                            'name': singleData.name
                        }), 
                        global.data.allUserID.push(singleData.id)) : (await Users.createData(singleData.id, 
                        {
                            'name': singleData.name,
                            'data': {}
                        }), 
                        global.data.allUserID.push(String(singleData.id)), 
                        logger(global.getText('handleCreateDatabase', 'newUser', singleData.id), '[ DATABASE ]'));
                    } catch(e) { console.log(e) };
                }
                logger(global.getText('handleCreateDatabase', 'newThread', threadID), '[ DATABASE ]');
            }
            if (!allUserID.includes(senderID) || !userName.has(senderID)) {
                const infoUsers = await Users.getInfo(senderID),
                    setting3 = {};
                setting3.name = infoUsers.name;
                await Users.createData(senderID, setting3);
                allUserID.push(senderID);
                userName.set(senderID, infoUsers.name);
                logger(global.getText('handleCreateDatabase', 'newUser', senderID), '[ DATABASE ]');
            }
            if (!allCurrenciesID.includes(senderID)) {
                const setting4 = {};
                setting4.data = {};
                await Currencies.createData(senderID, setting4);
                allCurrenciesID.push(senderID);
            }
            return;
        } catch (err) {
            return console.log(err);
        }
    };
}