const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const crypto = require('crypto');
const cron = require('node-cron');
const { createCanvas, registerFont } = require("canvas"); // Giữ lại nếu vẫn dùng canvas cho menu/info

const DATA_DIR = path.join(__dirname, 'cache', 'data_rentbot_pro');
const RENT_DATA_PATH = path.join(DATA_DIR, 'thuebot_pro.json');
const RENT_KEY_PATH = path.join(DATA_DIR, 'keys_pro.json');
// const setNameCheckPath = path.join(DATA_DIR, 'setnamecheck_pro.json'); // Không thấy dùng, có thể bỏ
const TIMEZONE = 'Asia/Ho_Chi_Minh';
const CANVAS_DIR = path.join(DATA_DIR, 'rent_canvas_pro');

[DATA_DIR, CANVAS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

module.exports.config = {
    name: 'rent',
    version: '4.1.0', // Hoặc version mới nhất của bạn
    hasPermssion: 3, // Hoặc quyền bạn muốn set
    credits: 'Pcoder (Enhanced by User & Gemini)',
    description: "Quản lý thuê bot chuyên nghiệp với canvas xịn, key kích hoạt, gia hạn và nhiều tính năng tự động.",
    commandCategory: 'Quản Trị Viên',
    // usePrefix: false, // Mirai gốc thường không có key này, hoặc nếu có thì đảm bảo framework của bạn hỗ trợ
    usages: '[add | list | info | newkey | check | usekey <key> | del <STT|GroupID> | delkey <key_name>]', // Cập nhật usages
    cooldowns: 2,
};

// --- HÀM TIỆN ÍCH ĐỌC/GHI JSON (giữ nguyên) ---
function safeReadJSON(file, defaultValue) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify(defaultValue, null, 4), 'utf8');
            return defaultValue;
        }
        const raw = fs.readFileSync(file, 'utf8');
        try {
            return JSON.parse(raw);
        } catch (err) {
            console.error(`[RENTBOT_PRO] Lỗi parse JSON, tạo file mặc định: ${file}`, err);
            fs.writeFileSync(file, JSON.stringify(defaultValue, null, 4), 'utf8');
            return defaultValue;
        }
    } catch (e) {
        console.error(`[RENTBOT_PRO] Lỗi đọc file JSON: ${file}`, e);
        return defaultValue;
    }
}
function safeWriteJSON(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 4), 'utf8');
    } catch (e) {
        console.error(`[RENTBOT_PRO] Lỗi ghi file JSON: ${file}`, e);
    }
}

let data = safeReadJSON(RENT_DATA_PATH, []);
let keys = safeReadJSON(RENT_KEY_PATH, {});

const saveData = () => safeWriteJSON(RENT_DATA_PATH, data);
const saveKeys = () => safeWriteJSON(RENT_KEY_PATH, keys);

const isInvalidDate = dateStr => { /* Giữ nguyên hàm này */
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) return true;
    const parts = dateStr.split("/");
    const day = parseInt(parts[0], 10); const month = parseInt(parts[1], 10); const year = parseInt(parts[2], 10);
    if(year < 2000 || year > 3000 || month === 0 || month > 12) return true;
    const monthLength = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if(year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)) monthLength[1] = 29;
    return day === 0 || day > monthLength[month - 1];
};

const generateKey = () => { /* Giữ nguyên hàm này */
    const randomString = crypto.randomBytes(8).toString('hex').slice(0, 8);
    return `pcoder_pro_${randomString}_${new Date().getFullYear()}`.toLowerCase();
};

// --- HÀM MỚI: hsdText ---
function hsdText(endDateStr, fullFormat = false) {
    const now = moment().tz(TIMEZONE).startOf('day');
    const endDate = moment(endDateStr, 'DD/MM/YYYY').endOf('day'); // So sánh đến cuối ngày hết hạn
    const daysDiff = endDate.diff(now, 'days');

    const formattedEndDate = endDate.format('DD/MM/YYYY');

    if (daysDiff > 0) {
        return `còn ${daysDiff} ngày${fullFormat ? ` (đến ${formattedEndDate})` : ''}`;
    } else if (daysDiff === 0) {
        // Nếu ngày hiện tại là ngày cuối cùng của endDate (do .endOf('day'))
        if (moment().tz(TIMEZONE).isSame(endDate, 'day')) {
             return `hết hạn hôm nay${fullFormat ? ` (${formattedEndDate})` : ''}`;
        } else { // Trường hợp endDate đã qua nhưng diff là 0 do startOf/endOf
             return `đã hết hạn${fullFormat ? ` (từ ${formattedEndDate})` : ''}`; // Hoặc logic cụ thể hơn
        }
    } else { // daysDiff < 0
        return `đã hết hạn ${Math.abs(daysDiff)} ngày${fullFormat ? ` (từ ${formattedEndDate})` : ''}`;
    }
}

// --- CANVAS FUNCTIONS (Cập nhật drawRentInfoCanvas) ---
function roundedRect(ctx, x, y, width, height, radius) { /* Giữ nguyên */
    if (typeof radius === 'number') { radius = { tl: radius, tr: radius, br: radius, bl: radius };
    } else { const defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 }; for (const side in defaultRadius) { radius[side] = radius[side] || defaultRadius[side]; } }
    ctx.beginPath(); ctx.moveTo(x + radius.tl, y); ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr); ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height); ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl); ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y); ctx.closePath();
}

async function drawRentInfoCanvas({ // Cập nhật để sử dụng hsdText
    groupName, userName, groupId, userId,
    timeStart, timeEnd, /*daysLeft, status,*/ key, index, // Bỏ daysLeft, status vì sẽ dùng hsdText
    canDel = false, canGiaHan = false,
}) {
    const width = 900; const height = 580; const radius = 30;
    const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1C1E2D'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    for (let i = 0; i < width; i += 25) { for (let j = 0; j < height; j += 25) { ctx.beginPath(); ctx.arc(i, j, 0.8, 0, Math.PI * 2); ctx.fill(); }}
    const padding = 30;
    ctx.fillStyle = 'rgba(35, 41, 60, 0.88)'; ctx.strokeStyle = 'rgba(75, 190, 240, 0.55)';
    ctx.lineWidth = 1.5; roundedRect(ctx, padding, padding, width - padding * 2, height - padding * 2, radius);
    ctx.fill(); ctx.stroke();

    ctx.font = "bold 40px Arial, 'Helvetica Neue', sans-serif"; ctx.fillStyle = "#FFB74D";
    ctx.textAlign = "center"; ctx.fillText("THÔNG TIN THUÊ BOT", width / 2, padding + 60);
    ctx.font = "24px Arial, 'Helvetica Neue', sans-serif"; ctx.fillStyle = "#B0BEC5";
    ctx.fillText(groupName || "Không rõ tên nhóm", width / 2, padding + 100);

    ctx.beginPath(); ctx.moveTo(padding + 30, padding + 130);
    ctx.lineTo(width - padding - 30, padding + 130);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)"; ctx.stroke();

    const contentX = padding + 45; let currentY = padding + 170; const lineHeight = 38;
    const labelColor = "#90A4AE"; const valueColor = "#ECEFF1"; const linkColor = "#64B5F6";
    ctx.textAlign = "left";

    function drawInfoRow(label, value, valueColorOverride, options = {}) {
        ctx.font = `21px Arial, 'Helvetica Neue', sans-serif`; ctx.fillStyle = labelColor;
        ctx.fillText(label, contentX, currentY);
        ctx.font = `bold 21px Arial, 'Helvetica Neue', sans-serif`; ctx.fillStyle = valueColorOverride || valueColor;
        const valueX = contentX + (options.labelWidth || 190);
        ctx.fillText(value || "N/A", valueX, currentY); currentY += lineHeight;
    }
    drawInfoRow("Người thuê:", userName); drawInfoRow("User ID:", userId);
    drawInfoRow("Facebook:", `fb.com/${userId}`, linkColor); drawInfoRow("Group ID:", groupId);
    drawInfoRow("Ngày thuê:", timeStart); drawInfoRow("Ngày hết hạn:", timeEnd);

    const hsdString = hsdText(timeEnd, true); // Sử dụng hsdText
    let hsdColor;
    if (hsdString.includes("còn")) {
        const daysMatch = hsdString.match(/còn (\d+) ngày/);
        hsdColor = (daysMatch && parseInt(daysMatch[1]) <= 3) ? "#FFD54F" : "#81C784"; // Vàng nếu <=3 ngày, xanh nếu >3
    } else hsdColor = "#E57373"; // Đỏ nếu hết hạn
    drawInfoRow("Tình trạng HSD:", hsdString, hsdColor);
    currentY += 5;

    // Status Box (vẫn có thể giữ lại nếu muốn, dựa trên hsdString)
    let generalStatus = "Còn hạn";
    if (hsdString.includes("hết hạn hôm nay")) generalStatus = "Hết hạn hôm nay";
    else if (hsdString.includes("đã hết hạn")) generalStatus = "Đã hết hạn";
    else if (hsdString.includes("còn") && hsdString.match(/còn (\d+) ngày/) && parseInt(hsdString.match(/còn (\d+) ngày/)[1]) <= 3) generalStatus = "Sắp hết hạn";

    ctx.font = "bold 22px Arial, 'Helvetica Neue', sans-serif";
    const statusDisplay = `Trạng thái chung: ${generalStatus.toUpperCase()}`;
    const statusTextWidth = ctx.measureText(statusDisplay).width;
    const statusBoxPadding = 10;
    const statusBoxColor = generalStatus === "Đã hết hạn" || generalStatus === "Hết hạn hôm nay" ? "rgba(229, 115, 115, 0.2)" : (generalStatus === "Sắp hết hạn" ? "rgba(255, 213, 79, 0.2)" : "rgba(129, 199, 132, 0.2)");
    ctx.fillStyle = statusBoxColor;
    roundedRect(ctx, contentX, currentY - 28, statusTextWidth + statusBoxPadding * 2, 38, 8);
    ctx.fill();
    ctx.fillStyle = hsdColor; // Dùng màu của hsd cho text status
    ctx.fillText(statusDisplay, contentX + statusBoxPadding, currentY);
    currentY += lineHeight + 5;

    drawInfoRow("Mã kích hoạt:", key, (key && key.length > 6 ? valueColor : "#78909C"), {labelWidth: 190});
    const footerY = height - padding - 15; ctx.textAlign = "center";
    ctx.font = "italic 17px Arial, 'Helvetica Neue', sans-serif"; ctx.fillStyle = "#90A4AE";
    if (canDel || canGiaHan) {
        ctx.fillText(`Reply tin nhắn này với: "del ${index}" (xóa) | "giahan ${index} DD/MM/YYYY" (gia hạn)`, width / 2, footerY - 22);
    }
    ctx.fillText(`STT: ${index} | Canvas by Pcoder Bot System`, width / 2, footerY);

    const imgPath = path.join(CANVAS_DIR, `rentinfo_pro_${Date.now()}_${index}.png`);
    await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(imgPath);
        const stream = canvas.createPNGStream({ compressionLevel: 5, filters: canvas.PNG_ALL_FILTERS });
        stream.pipe(out);
        out.on('finish', resolve); out.on('error', (err) => { console.error("Lỗi khi tạo stream PNG cho rent info:", err); reject(err); });
    });
    return imgPath;
}

async function drawMenuCanvas(prefix) { /* Giữ nguyên hàm này */
    const width = 800; const height = 750; // Tăng chiều cao để thêm lệnh del/delkey
    const radius = 32; const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1A1C2A'; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)"; ctx.lineWidth = 0.5;
    for (let i = -width; i < width; i += 20) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i + height, height); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i + height, 0); ctx.lineTo(i, height); ctx.stroke(); }
    const padding = 30; ctx.fillStyle = 'rgba(30, 35, 52, 0.92)'; ctx.strokeStyle = 'rgba(75, 180, 230, 0.6)';
    ctx.lineWidth = 1.5; roundedRect(ctx, padding, padding, width - padding * 2, height - padding * 2, radius);
    ctx.fill(); ctx.stroke();
    ctx.font = "bold 38px Arial, 'Helvetica Neue', sans-serif"; ctx.fillStyle = "#FFB74D";
    ctx.textAlign = "center"; ctx.fillText("BOT COMMAND MENU", width / 2, padding + 65);
    ctx.font = "19px Arial, 'Helvetica Neue', sans-serif"; ctx.fillStyle = "#B0BEC5";
    ctx.fillText("Hệ thống quản lý thuê bot chuyên nghiệp", width / 2, padding + 98);
    ctx.beginPath(); ctx.moveTo(padding + 40, padding + 128); ctx.lineTo(width - padding - 40, padding + 128);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)"; ctx.stroke();
    const menuX = padding + 55; let currentY = padding + 170; const itemSpacing = 68; // Điều chỉnh spacing
    const commandColor = "#E0E0E0"; const descColor = "#90A4AE"; const prefixColor = "#FFB74D";
    const commands = [
        { syntax: `${prefix}rent`, desc: "Hiển thị menu lệnh này" },
        { syntax: `${prefix}rent add <DD/MM/YYYY> [@tag/UID] [threadID?]`, desc: "Thêm nhóm thuê (Admin)" },
        { syntax: `${prefix}rent usekey <Mã_Key>`, desc: "Kích hoạt thuê bot cho nhóm này" },
        { syntax: `${prefix}rent info`, desc: "Xem thông tin thuê của nhóm hiện tại" },
        { syntax: `${prefix}rent list`, desc: "Danh sách nhóm đang thuê (Admin)" },
        { syntax: `${prefix}rent newkey <số_ngày>`, desc: "Tạo key thuê bot mới (Admin)" },
        { syntax: `${prefix}rent check`, desc: "Kiểm tra danh sách key (Admin)" },
        { syntax: `${prefix}rent del <STT | GroupID>`, desc: "Xóa nhóm thuê (Admin)" },
        { syntax: `${prefix}rent delkey <Tên_Key>`, desc: "Xóa key vĩnh viễn (Admin)" }
    ];
    commands.forEach(cmd => {
        ctx.textAlign = "left"; const fullCommand = cmd.syntax; let currentX = menuX;
        ctx.font = "bold 21px 'Consolas', 'Courier New', monospace"; ctx.fillStyle = prefixColor;
        const prefixWidth = ctx.measureText(prefix).width; ctx.fillText(prefix, currentX, currentY);
        currentX += prefixWidth; ctx.fillStyle = commandColor;
        ctx.fillText(fullCommand.substring(prefix.length), currentX, currentY);
        ctx.font = "italic 17px Arial, 'Helvetica Neue', sans-serif"; ctx.fillStyle = descColor;
        ctx.fillText(`↳ ${cmd.desc}`, menuX + 10, currentY + 25); currentY += itemSpacing;
    });
    ctx.textAlign = "center"; ctx.font = "italic 17px Arial, 'Helvetica Neue', sans-serif";
    ctx.fillStyle = "#78909C"; ctx.fillText("Developed by Pcoder | Enhanced Version Pro", width / 2, height - padding - 25);
    const imgPath = path.join(CANVAS_DIR, `rentmenu_pro_${Date.now()}.png`);
    await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(imgPath); const stream = canvas.createPNGStream({ compressionLevel: 5 }); stream.pipe(out);
        out.on('finish', resolve); out.on('error', (err) => { console.error("Lỗi khi tạo stream PNG cho menu:", err); reject(err); });
    });
    return imgPath;
}

// --- CẬP NHẬT HÀM ĐỔI NICKNAME ---
async function changeBotNicknameInGroup(threadID, time_end) {
    if (!global.config || !global.client || !global.client.api) {
        console.warn("[RENT BOT] global.config hoặc global.client.api không khả dụng, không thể đổi nickname."); return;
    }
    const hsdStatus = hsdText(time_end); // Ví dụ: "còn X ngày", "hết hạn hôm nay", "đã hết hạn X ngày"
    let botName;
    const prefix = global.config.PREFIX || "!";
    const baseBotName = global.config.BOTNAME || "MyBot";

    if (hsdStatus.includes("đã hết hạn") || hsdStatus.includes("hết hạn hôm nay")) {
        botName = `『 ${prefix} 』 ${baseBotName} | Hết Hạn`;
    } else if (hsdStatus.startsWith("còn")) {
        const daysMatch = hsdStatus.match(/còn (\d+) ngày/);
        // Hiển thị "còn X ngày" nếu <= 7 ngày, ngược lại hiển thị HSD đầy đủ
        if (daysMatch && parseInt(daysMatch[1]) <= 7) {
             botName = `『 ${prefix} 』 ${baseBotName} | ${hsdStatus.split(' (')[0]}`; // Chỉ lấy "còn X ngày"
        } else {
             botName = `『 ${prefix} 』 ${baseBotName} | HSD: ${time_end}`;
        }
    } else { // Trường hợp khác hoặc lỗi từ hsdText (không nên xảy ra)
        botName = `『 ${prefix} 』 ${baseBotName}`;
    }
    botName = botName.substring(0, 50); // Giới hạn độ dài nickname

    try {
        const botUserID = global.client.api.getCurrentUserID();
        if (botUserID) await global.client.api.changeNickname(botName, threadID, botUserID);
        else console.warn(`[RENT BOT] Không lấy được Bot UserID, không đổi nickname cho nhóm ${threadID}.`);
    } catch (e) { console.warn(`[RENT BOT] Lỗi đổi nickname cho nhóm ${threadID}:`, e.message); }
}

module.exports.onLoad = async function (o) { // Thêm async cho hàm onLoad
    // Cron job sẽ chạy hàm changeBotNicknameInGroup, nên hàm đó cần 'api' hoặc global.client.api
    cron.schedule('5 0 * * *', async () => { // Chạy vào 00:05 mỗi ngày
        console.log('[RENT BOT CRON] Bắt đầu kiểm tra hàng ngày và cập nhật nickname...');
        const adminIDs = global.config.ADMINBOT || [];
        let expiredGroupsMsg = [];
        let expiringSoonGroupsMsg = [];

        // Cần tải lại data mới nhất trong cron job
        const currentRentData = safeReadJSON(RENT_DATA_PATH, []);


        for (const entry of currentRentData) {
            await changeBotNicknameInGroup(entry.t_id, entry.t_end || entry.time_end); // Sửa t_end nếu có
            const hsdInfo = hsdText(entry.t_end || entry.time_end, true); // Lấy thông tin HSD đầy đủ
            const groupName = (global.data.threadInfo.get(entry.t_id) || {}).threadName || `Nhóm ID ${entry.t_id}`;
            const userName = (global.data.userName.get(entry.id) || {}).name || `User ID ${entry.id}`;

            if (hsdInfo.includes("đã hết hạn") || hsdInfo.includes("hết hạn hôm nay")) {
                expiredGroupsMsg.push(`- Nhóm "${groupName}" (Người thuê: ${userName}) ${hsdInfo}.`);
            } else if (hsdInfo.startsWith("còn")) {
                const daysMatch = hsdInfo.match(/còn (\d+) ngày/);
                if (daysMatch && parseInt(daysMatch[1]) <= 3) { // Cảnh báo nếu còn 3 ngày hoặc ít hơn
                    expiringSoonGroupsMsg.push(`- Nhóm "${groupName}" (Người thuê: ${userName}) ${hsdInfo}.`);
                }
            }
        }

        if (global.client && global.client.api && adminIDs.length > 0) {
            if (expiringSoonGroupsMsg.length > 0) {
                global.client.api.sendMessage(`[CẢNH BÁO THUÊ BOT - SẮP HẾT HẠN]\n${expiringSoonGroupsMsg.join('\n')}\n\nVui lòng gia hạn cho các nhóm này!`, adminIDs);
            }
            if (expiredGroupsMsg.length > 0) {
                global.client.api.sendMessage(`[THÔNG BÁO THUÊ BOT - ĐÃ HẾT HẠN]\n${expiredGroupsMsg.join('\n')}\n\nCác nhóm này không còn sử dụng được bot (nếu chưa gia hạn).`, adminIDs);
            }
        } else {
            if (!global.client || !global.client.api) console.warn("[RENT BOT CRON] global.client.api không khả dụng, không thể gửi thông báo cho Admin.");
            if (adminIDs.length === 0) console.warn("[RENT BOT CRON] Không có ADMINBOT nào được cấu hình để nhận thông báo.");
        }
        console.log('[RENT BOT CRON] Kiểm tra hàng ngày hoàn tất.');
    }, { timezone: TIMEZONE });
     console.log("[RENT BOT] Cron job đã được thiết lập để kiểm tra HSD hàng ngày.");
};


module.exports.handleEvent = async function(o) {
    // Có thể thêm logic xử lý event nếu cần, ví dụ tự động xóa nhóm hết hạn sau X ngày nếu không gia hạn
}


module.exports.run = async function(o) {
    const { api, event, args, message } = o;
    const send = async (msgBody, attachmentPath, callback) => { // Thêm async
        const options = { body: msgBody };
        if (attachmentPath) {
            try {
                options.attachment = fs.createReadStream(attachmentPath);
            } catch (e) { console.error("[RENTBOT_PRO] Lỗi tạo stream cho attachment:", e); /* có thể gửi tin nhắn lỗi thay vì crash */ }
        }
        try {
            const sentMessage = await api.sendMessage(options, event.threadID, callback || event.messageID); // Nếu có callback thì dùng, không thì reply msg hiện tại
             if (attachmentPath) { // Lên lịch xóa file ảnh sau khi gửi
                setTimeout(() => {
                    try { if (fs.existsSync(attachmentPath)) fs.unlinkSync(attachmentPath); }
                    catch (e) { console.error(`[RENTBOT_PRO] Lỗi xóa file tạm: ${attachmentPath}`, e); }
                }, 20000); // Xóa sau 20 giây
            }
            return sentMessage;
        } catch (e) {
            console.error("[RENTBOT_PRO] Lỗi gửi tin nhắn:", e);
            // Có thể gửi lại tin nhắn lỗi cho người dùng nếu cần
            // api.sendMessage("Đã có lỗi xảy ra khi gửi tin nhắn, vui lòng thử lại.", event.threadID);
            return null; // Trả về null nếu gửi lỗi
        }
    };


    const prefix = global.config.PREFIX || "!";
    const isAdmin = (global.config.ADMINBOT || []).includes(event.senderID) || (global.config.NDH || []).includes(event.senderID);
    const command = args[0] ? args[0].toLowerCase() : '';
    const adminSubCommands = ['add', 'list', 'newkey', 'check', 'del', 'giahan', 'delkey'];

    if (adminSubCommands.includes(command) && !isAdmin && command !== '') {
        return send("Bạn không có quyền sử dụng lệnh con này. Chỉ Admin mới có thể thực hiện.");
    }

    switch (command) {
        case 'add': { /* Giữ nguyên logic add, không thay đổi */
            if (args.length < 2) return send(`Sai cú pháp!\nVí dụ:\n1. ${prefix}rent add DD/MM/YYYY (cho nhóm hiện tại, người thuê là bạn)\n2. ${prefix}rent add DD/MM/YYYY @tag (cho nhóm hiện tại, người thuê là người được tag)\n3. ${prefix}rent add DD/MM/YYYY UserID (cho nhóm hiện tại, người thuê là UserID)\n4. ${prefix}rent add DD/MM/YYYY UserID ThreadID (cho nhóm và người dùng cụ thể)`);
            let userIdToAdd = event.senderID; let threadIdToAdd = event.threadID; let endDateStr = args[1];
            if (isInvalidDate(endDateStr)) { // Ngày không hợp lệ ở vị trí đầu tiên, hoặc là UserID/Tag
                if (args.length < 3) return send("Ngày hết hạn không hợp lệ hoặc thiếu. Định dạng: DD/MM/YYYY");
                endDateStr = args[2]; // Giả sử ngày ở vị trí thứ 2
                if (isInvalidDate(endDateStr)) return send(`Ngày hết hạn "${endDateStr}" không hợp lệ. Định dạng: DD/MM/YYYY`);
                // Xử lý userID/threadID từ args[1] và args[3] (nếu có)
                if (Object.keys(event.mentions).length > 0 && Object.keys(event.mentions)[0] === args[1].replace('@','')) { // Được tag
                    userIdToAdd = Object.keys(event.mentions)[0];
                    if (args.length === 4 && !isNaN(parseInt(args[3]))) threadIdToAdd = args[3];
                } else if (!isNaN(parseInt(args[1]))) { // Là UserID
                    userIdToAdd = args[1];
                    if (args.length === 4 && !isNaN(parseInt(args[3]))) threadIdToAdd = args[3];
                } else return send("Không xác định được người thuê. Vui lòng tag hoặc cung cấp UserID hợp lệ ở vị trí đầu tiên sau 'add'.");
            } else { // Ngày hợp lệ ở vị trí đầu tiên (sau add)
                if (event.messageReply && args.length === 2) userIdToAdd = event.messageReply.senderID; // Reply và chỉ có ngày
                else if (Object.keys(event.mentions).length > 0 && args.length >= 2) { // Tag và có ngày
                    userIdToAdd = Object.keys(event.mentions)[0]; // Lấy UID từ tag đầu tiên
                     // Nếu args[2] là threadID
                    if (args.length === 3 && !isNaN(parseInt(args[2]))) threadIdToAdd = args[2];
                } else if (args.length === 3 && !isNaN(parseInt(args[2]))) userIdToAdd = args[2]; // Ngày + UserID
                else if (args.length === 4 && !isNaN(parseInt(args[2])) && !isNaN(parseInt(args[3]))) { userIdToAdd = args[2]; threadIdToAdd = args[3]; } // Ngày + UserID + ThreadID
            }
            if (isNaN(parseInt(userIdToAdd)) || isNaN(parseInt(threadIdToAdd))) return send(`UserID (${userIdToAdd}) hoặc ThreadID (${threadIdToAdd}) không hợp lệ.`);
            const existingData = data.find(entry => entry.t_id === threadIdToAdd);
            if (existingData) { const groupNameInfo = (global.data.threadInfo.get(threadIdToAdd) || {}).threadName || threadIdToAdd; return send(`Nhóm "${groupNameInfo}" này đã có dữ liệu thuê bot! Dùng lệnh gia hạn nếu cần.`);}
            let time_start = moment.tz(TIMEZONE).format('DD/MM/YYYY');
            data.push({ t_id: threadIdToAdd, id: userIdToAdd, time_start, time_end: endDateStr }); saveData();
            await changeBotNicknameInGroup(threadIdToAdd, endDateStr);
            const groupName = (global.data.threadInfo.get(threadIdToAdd) || {}).threadName || "Nhóm";
            const userName = (global.data.userName.get(userIdToAdd) || {}).name || userIdToAdd;
            const keyEntry = Object.entries(keys).find(([k, keyInfo]) => keyInfo.groupId === threadIdToAdd); const currentKey = keyEntry ? keyEntry[0] : "";
            const imgPath = await drawRentInfoCanvas({ groupName, userName, groupId: threadIdToAdd, userId: userIdToAdd, timeStart: time_start, timeEnd: endDateStr, key: currentKey, index: data.findIndex(e => e.t_id === threadIdToAdd) + 1, canDel: isAdmin, canGiaHan: isAdmin });
            send(`Đã thêm nhóm "${groupName}" vào danh sách thuê bot.\nNgười thuê: ${userName}\n${hsdText(endDateStr, true)}.`, imgPath);
            break;
        }
        case 'list': { // Cập nhật list để dùng hsdText
            if (data.length === 0) return send('Chưa có nhóm nào đang thuê bot!');
            let fullListMessage = `📝 DANH SÁCH NHÓM ĐANG THUÊ BOT (${data.length}) 📝\n\n`;
            const messageChunks = []; const MAX_CHUNK_LENGTH = 1900;

            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                const groupName = (global.data.threadInfo.get(item.t_id) || {}).threadName || `Nhóm ID ${item.t_id}`;
                const userName = (global.data.userName.get(item.id) || {}).name || `ID ${item.id}`;
                const hsdInfo = hsdText(item.time_end, true); // Sử dụng hsdText

                const entryText =
                    `┏ STT: ${i + 1}\n` +
                    `┣ 👥 Nhóm: ${groupName}\n` +
                    `┣ 👤 Người thuê: ${userName}\n` +
                    `┣ 🆔 UserID: ${item.id}\n` +
                    `┣ 🗓 Ngày thuê: ${item.time_start}\n` +
                    `┣ ⏰ HSD: ${item.time_end}\n` +
                    `┣ ⏳ Tình trạng: ${hsdInfo}\n` +
                    `┣ 🔑 GroupID: ${item.t_id}\n` +
                    `┗------------------------------------\n`;

                if (fullListMessage.length + entryText.length > MAX_CHUNK_LENGTH) {
                    messageChunks.push(fullListMessage); fullListMessage = "";
                }
                fullListMessage += entryText;
            }
            if (fullListMessage.length > 0) { messageChunks.push(fullListMessage); }

            const replyInstructions = `\n👉 Để quản lý, hãy reply vào một trong các tin nhắn danh sách này với:\n • "del <STT>" để xóa.\n • "giahan <STT> <DD/MM/YYYY>" để gia hạn.`;
            for (let j = 0; j < messageChunks.length; j++) {
                let messageToSend = messageChunks[j];
                if (j === messageChunks.length - 1) { messageToSend += replyInstructions; }
                try {
                    await send(messageToSend.trim());
                    if (messageChunks.length > 1) await new Promise(resolve => setTimeout(resolve, 350));
                } catch (error) { console.error("Lỗi khi gửi chunk tin nhắn list:", error); message.reply("Có lỗi xảy ra khi gửi danh sách."); break; }
            }
            break;
        }
        case 'info': { /* Cập nhật info để dùng hsdText */
            const rentInfo = data.find(entry => entry.t_id === event.threadID);
            if (!rentInfo) return send(`Không có dữ liệu thuê bot cho nhóm này. Dùng ${prefix}rent usekey <Mã_Key> để kích hoạt (nếu có key).`);
            const groupName = (global.data.threadInfo.get(rentInfo.t_id) || {}).threadName || "Nhóm";
            const userName = (global.data.userName.get(rentInfo.id) || {}).name || rentInfo.id;
            const keyEntry = Object.entries(keys).find(([k, keyInfo]) => keyInfo.groupId === rentInfo.t_id); const currentKey = keyEntry ? keyEntry[0] : "";
            const indexInFullList = data.findIndex(e => e.t_id === rentInfo.t_id) + 1;
            const imgPath = await drawRentInfoCanvas({ groupName, userName, groupId: rentInfo.t_id, userId: rentInfo.id, timeStart: rentInfo.time_start, timeEnd: rentInfo.time_end, key: currentKey, index: indexInFullList, canDel: isAdmin, canGiaHan: isAdmin });
            send(``, imgPath);
            break;
        }
        case 'newkey': { /* Giữ nguyên */
            const days = parseInt(args[1], 10);
            if (isNaN(days) || days <= 0) return send(`Số ngày không hợp lệ! Phải là một số dương. Ví dụ: ${prefix}rent newkey 30`);
            if (days > 365 * 5) return send("Số ngày quá lớn, tối đa là 5 năm (1825 ngày).");
            const generatedKey = generateKey();
            keys[generatedKey] = { days: days, used: false, groupId: null, createdBy: event.senderID, createdAt: moment.tz(TIMEZONE).format('DD/MM/YYYY HH:mm:ss') };
            saveKeys(); send(`Đã tạo key mới thành công!\nKey: ${generatedKey}\nThời hạn sử dụng: ${days} ngày\nTrạng thái: Chưa sử dụng\n\nGửi key này cho người cần thuê.`);
            break;
        }
        case 'check': { /* Giữ nguyên */
            if (Object.keys(keys).length === 0) return send('Không có key nào được tạo!');
            let msg = `🔑 DANH SÁCH KEY (${Object.keys(keys).length}) 🔑\n\n`; let keyCount = 0;
            Object.entries(keys).forEach(([key, info]) => {
                keyCount++; msg += `${keyCount}. Key: ${key}\n`; msg += `    - Thời hạn: ${info.days} ngày\n`;
                msg += `    - Trạng thái: ${info.used ? '✅ Đã sử dụng' : '⏳ Chưa sử dụng'}\n`;
                if (info.used && info.groupId) {
                    const groupName = (global.data.threadInfo.get(info.groupId) || {}).threadName || info.groupId; msg += `    - Nhóm sử dụng: ${groupName}\n`;
                    if(info.activatedBy) { const activatorName = (global.data.userName.get(info.activatedBy) || {}).name || info.activatedBy; msg += `    - Kích hoạt bởi: ${activatorName}\n`;}
                    if(info.activationDate) msg += `    - Ngày kích hoạt: ${info.activationDate}\n`;
                }
                msg += `    - Tạo bởi: ${(global.data.userName.get(info.createdBy) || {}).name || info.createdBy} lúc ${info.createdAt}\n\n`;
            });
            if (msg.length > 4000) send("Số lượng key quá lớn. Kiểm tra file keys_pro.json trong cache."); else send(msg.trim());
            break;
        }
        case 'usekey': { /* Cập nhật usekey để dùng hsdText */
            if (!args[1]) return send(`Sai cú pháp! Dùng: ${prefix}rent usekey <MÃ_KEY>`);
            const keyToUse = args[1].toLowerCase();
            if (!keys[keyToUse]) return send('Mã key không tồn tại hoặc đã bị xóa!');
            if (keys[keyToUse].used) {
                const usedByGroup = keys[keyToUse].groupId; let groupNameInfo = `nhóm ID ${usedByGroup}`;
                if (usedByGroup && global.data.threadInfo && global.data.threadInfo.get(usedByGroup)) groupNameInfo = `nhóm "${global.data.threadInfo.get(usedByGroup).threadName}" (ID: ${usedByGroup})`;
                return send(`Mã key này đã được sử dụng cho ${groupNameInfo} vào lúc ${keys[keyToUse].activationDate || 'không rõ'}.`);
            }
            const threadIDCurrent = event.threadID; const existingData = data.find(entry => entry.t_id === threadIDCurrent);
            if (existingData) {
                const hsdExisting = hsdText(existingData.time_end);
                if (!hsdExisting.includes("hết hạn")) return send(`Nhóm này đã được thuê bot và ${hsdExisting} (HSD: ${existingData.time_end}).\nNếu muốn gia hạn bằng key khác, vui lòng liên hệ Admin.`);
                else { const indexToRemove = data.findIndex(entry => entry.t_id === threadIDCurrent); if(indexToRemove > -1) data.splice(indexToRemove, 1); }
            }
            const senderId = event.senderID; const keyInfo = keys[keyToUse]; const rentDays = keyInfo.days;
            const time_start = moment.tz(TIMEZONE).format('DD/MM/YYYY'); const time_end = moment.tz(TIMEZONE).add(rentDays, 'days').format('DD/MM/YYYY');
            data.push({ t_id: threadIDCurrent, id: senderId, time_start, time_end });
            keys[keyToUse].used = true; keys[keyToUse].groupId = threadIDCurrent; keys[keyToUse].activatedBy = senderId; keys[keyToUse].activationDate = moment.tz(TIMEZONE).format('DD/MM/YYYY HH:mm:ss');
            saveData(); saveKeys(); await changeBotNicknameInGroup(threadIDCurrent, time_end);
            const groupName = (global.data.threadInfo.get(threadIDCurrent) || {}).threadName || "Nhóm";
            const userName = (global.data.userName.get(senderId) || {}).name || senderId;
            const imgPath = await drawRentInfoCanvas({ groupName, userName, groupId: threadIDCurrent, userId: senderId, timeStart: time_start, timeEnd: time_end, key: keyToUse, index: data.findIndex(e => e.t_id === threadIDCurrent) + 1, canDel: false, canGiaHan: false });
            send(`Bot đã được kích hoạt thành công cho nhóm này!\nThời hạn sử dụng: ${rentDays} ngày (đến ${time_end}).`, imgPath);
            const adminIDs = global.config.ADMINBOT || [];
            adminIDs.forEach(adminID => { if (adminID) api.sendMessage(`🔔 Key "${keyToUse}" vừa được kích hoạt bởi "${userName}" (ID: ${senderId}) cho nhóm "${groupName}" (ID: ${threadIDCurrent}).\nThời hạn: ${rentDays} ngày.`, adminID); });
            break;
        }
        // --- LỆNH MỚI: del ---
        case 'del': {
            if (args.length < 2) return send(`Sai cú pháp! Dùng: ${prefix}rent del <STT_trong_list | GroupID>`);
            const identifier = args[1];
            let rentInfoIndex = -1;
            let targetRentInfo = null;

            if (!isNaN(parseInt(identifier))) { // Nếu là STT
                const stt = parseInt(identifier);
                if (stt < 1 || stt > data.length) return send('STT không hợp lệ hoặc không tìm thấy!');
                rentInfoIndex = stt - 1;
                targetRentInfo = data[rentInfoIndex];
            } else { // Nếu là GroupID
                targetRentInfo = data.find(entry => entry.t_id === identifier);
                if (!targetRentInfo) return send(`Không tìm thấy nhóm nào có GroupID: ${identifier}`);
                rentInfoIndex = data.findIndex(entry => entry.t_id === identifier);
            }

            if (!targetRentInfo) return send("Không tìm thấy thông tin thuê bot tương ứng."); // Nên không xảy ra nếu logic trên đúng

            const groupNameDel = (global.data.threadInfo.get(targetRentInfo.t_id) || {}).threadName || targetRentInfo.t_id;
            const originalThreadID = targetRentInfo.t_id; // Lưu lại t_id trước khi xóa

            data.splice(rentInfoIndex, 1); // Xóa khỏi mảng data
            saveData();

            // Reset key nếu có
            const keyEntry = Object.entries(keys).find(([key, keyInfo]) => keyInfo.groupId === originalThreadID);
            if (keyEntry) {
                const [keyNameToReset] = keyEntry;
                keys[keyNameToReset].used = false;
                keys[keyNameToReset].groupId = null;
                keys[keyNameToReset].activatedBy = null;
                keys[keyNameToReset].activationDate = null;
                saveKeys();
                 send(`Đã xóa thành công nhóm "${groupNameDel}" (STT ${rentInfoIndex + 1} / GroupID ${originalThreadID}) khỏi danh sách thuê.\nKey "${keyNameToReset}" đã được giải phóng và có thể tái sử dụng.`);
            } else {
                 send(`Đã xóa thành công nhóm "${groupNameDel}" (STT ${rentInfoIndex + 1} / GroupID ${originalThreadID}) khỏi danh sách thuê.`);
            }

            // Reset nickname bot
            try {
                const botUserID = global.client.api.getCurrentUserID();
                const defaultBotName = `『 ${global.config.PREFIX || "!"} 』 ${global.config.BOTNAME || "MyBot"}`;
                if (botUserID) await global.client.api.changeNickname(defaultBotName.substring(0,50), originalThreadID, botUserID);
            } catch (e) { console.warn(`[RENT BOT] Lỗi reset nickname cho nhóm ${originalThreadID} sau khi xóa:`, e.message); }
            break;
        }
        // --- LỆNH MỚI: delkey ---
        case 'delkey': {
            if (args.length < 2) return send(`Sai cú pháp! Dùng: ${prefix}rent delkey <Tên_Key>`);
            const keyToDelete = args[1].toLowerCase();
            if (!keys[keyToDelete]) return send(`Key "${keyToDelete}" không tồn tại!`);
            if (keys[keyToDelete].used) {
                const usedByGroup = keys[keyToDelete].groupId;
                let groupNameInfo = `nhóm ID ${usedByGroup}`;
                 if (usedByGroup && global.data.threadInfo && global.data.threadInfo.get(usedByGroup)) {
                    groupNameInfo = `nhóm "${global.data.threadInfo.get(usedByGroup).threadName}" (ID: ${usedByGroup})`;
                }
                return send(`Key "${keyToDelete}" đang được sử dụng bởi ${groupNameInfo}. Không thể xóa trực tiếp.\nHãy xóa nhóm thuê đang dùng key này trước (lệnh ${prefix}rent del <GroupID>) hoặc liên hệ Pcoder để được hỗ trợ.`);
            }
            delete keys[keyToDelete];
            saveKeys();
            send(`Đã xóa vĩnh viễn key "${keyToDelete}" khỏi hệ thống.`);
            break;
        }
        default: {
            const imgPath = await drawMenuCanvas(prefix);
            send("🌟 MENU QUẢN LÝ THUÊ BOT 🌟\nCác chức năng và cú pháp sử dụng được hiển thị trong ảnh:", imgPath);
        }
    }
};

module.exports.handleReply = async function(o) { // Cập nhật handleReply
    const { api, event, messageReply } = o; // Sửa lại: messageReply đã là object, không cần .messageReply nữa
    const send = async (msgBody, attachmentPath) => { // Thêm async
        const options = { body: msgBody };
        if (attachmentPath) options.attachment = fs.createReadStream(attachmentPath);
        try {
           const sentMessage = await api.sendMessage(options, event.threadID, null, event.messageID);
            if (attachmentPath) { setTimeout(() => { try { if (fs.existsSync(attachmentPath)) fs.unlinkSync(attachmentPath); } catch (e) { console.error(`[RENTBOT_PRO] Lỗi xóa file tạm (reply): ${attachmentPath}`, e);}}, 20000); }
            return sentMessage;
        } catch(e) { console.error("[RENTBOT_PRO] Lỗi gửi tin nhắn (reply):", e); return null; }
    };

    const isAdmin = (global.config.ADMINBOT || []).includes(event.senderID) || (global.config.NDH || []).includes(event.senderID);
    if (!isAdmin) return send("Chỉ Admin mới có thể thực hiện thao tác này qua reply.");

    const args = event.body.split(' ');
    const command = args.shift().toLowerCase();
    const rawIndex = args[0];

    if (!rawIndex) return send('Vui lòng cung cấp STT. Ví dụ: "del 1" hoặc "giahan 1 DD/MM/YYYY"');
    const index = parseInt(rawIndex);

    // Tải lại data mới nhất trước khi thao tác
    const currentRentDataForReply = safeReadJSON(RENT_DATA_PATH, []);
    if (isNaN(index) || index < 1 || index > currentRentDataForReply.length) return send('STT không hợp lệ hoặc không tìm thấy trong danh sách!');
    const targetRentInfo = currentRentDataForReply[index - 1];
    if (!targetRentInfo) return send(`Không tìm thấy dữ liệu cho STT ${index}.`);

    switch (command) {
        case 'del': {
            const groupNameDel = (global.data.threadInfo.get(targetRentInfo.t_id) || {}).threadName || targetRentInfo.t_id;
            const originalThreadIDReply = targetRentInfo.t_id;

            currentRentDataForReply.splice(index - 1, 1); // Xóa khỏi bản copy hiện tại
            data = currentRentDataForReply; // Gán lại data global
            saveData(); // Lưu data global đã cập nhật

            // Reset key nếu có
            const currentKeysForReply = safeReadJSON(RENT_KEY_PATH, {}); // Đọc keys mới nhất
            const keyEntryReply = Object.entries(currentKeysForReply).find(([k, v]) => v.groupId === originalThreadIDReply);
            if (keyEntryReply) {
                const [keyNameToResetReply] = keyEntryReply;
                currentKeysForReply[keyNameToResetReply].used = false;
                currentKeysForReply[keyNameToResetReply].groupId = null;
                currentKeysForReply[keyNameToResetReply].activatedBy = null;
                currentKeysForReply[keyNameToResetReply].activationDate = null;
                keys = currentKeysForReply; // Gán lại keys global
                saveKeys(); // Lưu keys global
                send(`Đã xóa thành công nhóm "${groupNameDel}" (STT ${index}) khỏi danh sách thuê.\nKey "${keyNameToResetReply}" đã được giải phóng.`);
            } else {
                send(`Đã xóa thành công nhóm "${groupNameDel}" (STT ${index}) khỏi danh sách thuê.`);
            }

            try {
                const botUserID = global.client.api.getCurrentUserID();
                const defaultBotNameReply = `『 ${global.config.PREFIX || "!"} 』 ${global.config.BOTNAME || "MyBot"}`;
                if (botUserID) await global.client.api.changeNickname(defaultBotNameReply.substring(0,50), originalThreadIDReply, botUserID);
            } catch (e) { console.warn(`[RENT BOT] Lỗi reset nickname cho nhóm ${originalThreadIDReply} (reply):`, e.message); }
            break;
        }
        case 'giahan': {
            const newDateStr = args[1];
            if (!newDateStr || isInvalidDate(newDateStr)) return send('Ngày gia hạn không hợp lệ! Định dạng: DD/MM/YYYY. Ví dụ: giahan 1 31/12/2025');

            currentRentDataForReply[index - 1].time_end = newDateStr;
            data = currentRentDataForReply; // Gán lại data global
            saveData();
            await changeBotNicknameInGroup(data[index - 1].t_id, newDateStr);

            const rentInfoUpdated = data[index - 1]; // Lấy từ data global đã update
            const groupNameGH = (global.data.threadInfo.get(rentInfoUpdated.t_id) || {}).threadName || "Nhóm";
            const userNameGH = (global.data.userName.get(rentInfoUpdated.id) || {}).name || rentInfoUpdated.id;

            const currentKeysForReplyGiaHan = safeReadJSON(RENT_KEY_PATH, {});
            const keyEntryGH = Object.entries(currentKeysForReplyGiaHan).find(([k, ki]) => ki.groupId === rentInfoUpdated.t_id);
            const currentKeyGH = keyEntryGH ? keyEntryGH[0] : "";

            const imgPath = await drawRentInfoCanvas({ groupName: groupNameGH, userName: userNameGH, groupId: rentInfoUpdated.t_id, userId: rentInfoUpdated.id, timeStart: rentInfoUpdated.time_start, timeEnd: rentInfoUpdated.time_end, key: currentKeyGH, index, canDel: true, canGiaHan: true });
            send(`Đã gia hạn nhóm STT ${index} ("${groupNameGH}") đến ${newDateStr}!`, imgPath);
            break;
        }
        default: send('Lệnh reply không hợp lệ. Dùng: "del <STT>" hoặc "giahan <STT> <DD/MM/YYYY>"');
    }
};