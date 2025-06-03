const fs = require("fs");
const path = require("path");
const axios = require("axios");

// ==== CONSTANTS ====
const UA_KIWI = [/* ... (bản rút gọn, như trên) ... */];
const UA_VIA = [/* ... (bản rút gọn, như trên) ... */];
const USER_AGENTS = UA_KIWI.concat(UA_VIA);

const DATA_DIR = path.resolve(__dirname, "../../pdata/spamfbdata");
const ACC_DIR = path.join(DATA_DIR, "accounts");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
const TXT_DIR = path.join(DATA_DIR, "txt");

function ensureDirAndFile() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(ACC_DIR)) fs.mkdirSync(ACC_DIR, { recursive: true });
    if (!fs.existsSync(TXT_DIR)) fs.mkdirSync(TXT_DIR, { recursive: true });
    if (!fs.existsSync(TASKS_FILE)) fs.writeFileSync(TASKS_FILE, "[]", "utf8");
}
ensureDirAndFile();

function loadTasks() {
    ensureDirAndFile();
    try {
        let raw = fs.readFileSync(TASKS_FILE, "utf8");
        return JSON.parse(raw);
    } catch (e) {
        console.log("[SPAMFB] Lỗi loadTasks:", e);
        return [];
    }
}
function saveTasks(tasks) {
    try {
        fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf8");
    } catch (e) {
        console.log("[SPAMFB] Lỗi saveTasks:", e);
    }
}
function getAllAccs() {
    ensureDirAndFile();
    let files = fs.readdirSync(ACC_DIR).filter(f => f.endsWith(".json"));
    return files.map(f => {
        try {
            let acc = JSON.parse(fs.readFileSync(path.join(ACC_DIR, f), "utf8"));
            acc._file = f;
            return acc;
        } catch (e) {
            console.log("[SPAMFB] Lỗi đọc acc", f, e);
            return null;
        }
    }).filter(Boolean);
}
function saveAcc(acc, file) {
    try {
        fs.writeFileSync(path.join(ACC_DIR, file), JSON.stringify(acc, null, 2), "utf8");
    } catch (e) {
        console.log("[SPAMFB] Lỗi saveAcc:", e);
    }
}
function ensureTxtFile(name) {
    let file = path.join(TXT_DIR, name + ".txt");
    if (!fs.existsSync(file)) fs.writeFileSync(file, "", "utf8");
    return file;
}
function formatDuration(seconds) {
    let m = Math.floor(seconds / 60);
    let s = Math.floor(seconds % 60);
    let h = Math.floor(m / 60);
    m = m % 60;
    let d = Math.floor(h / 24);
    h = h % 24;
    let parts = [];
    if (d) parts.push(`${d} ngày`);
    if (h) parts.push(`${h} giờ`);
    if (m) parts.push(`${m} phút`);
    if (s || !parts.length) parts.push(`${s} giây`);
    return parts.join(" ");
}
async function sendViaCookie({idbox, cookie, message}) {
    let c_user = (cookie.match(/c_user=(\d+)/) || [])[1];
    if (!c_user) return {success: false, error: "Cookie không hợp lệ"};
    let user_agent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    let headers = {
        'Cookie': cookie,
        'User-Agent': user_agent,
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    try {
        let res = await axios.get('https://mbasic.facebook.com', {headers});
        let fb_dtsg = (res.data.match(/name="fb_dtsg" value="(.*?)"/) || [])[1];
        if (!fb_dtsg) return {success: false, error: "Không lấy được fb_dtsg"};
        let data = new URLSearchParams({'fb_dtsg': fb_dtsg,'body': message,'send': 'Gửi',});
        await axios.post(`https://mbasic.facebook.com/messages/send/?icm=1&refid=12`, data, {headers});
        return {success: true};
    } catch (e) {
        return {success: false, error: e.message};
    }
}

// ===== State for spam running in RAM ======
let spamRunners = {}; // { [accFile_idbox_type]: intervalId }

function startSpamTask(task) {
    let key = `${task.accFile}_${task.idbox}_${task.type}`;
    if (spamRunners[key]) clearInterval(spamRunners[key]);
    let acc;
    try {
        acc = JSON.parse(fs.readFileSync(path.join(ACC_DIR, task.accFile), "utf8"));
    } catch (e) {
        console.log(`[SPAMFB] Không đọc được acc: ${task.accFile}`);
        return;
    }
    let cookie = acc.cookie;
    let msg = task.msg || "Treo spam!";
    let lines = null;
    if (["nhay","chui","codelag","ngonmess","ngontop"].includes(task.type)) {
        let file = ensureTxtFile(task.type);
        lines = fs.readFileSync(file, "utf8").split("\n").filter(x=>x);
        if (!lines.length) {
            console.log(`[SPAMFB] File ${task.type}.txt rỗng!`);
        }
    }
    let index = 0;
    spamRunners[key] = setInterval(async () => {
        let sendMsg = msg;
        if (lines && lines.length) {
            sendMsg = lines[index % lines.length];
            index++;
        }
        const sendResult = await sendViaCookie({idbox: task.idbox, cookie, message: sendMsg});
        if (sendResult.success) {
            console.log(`[SPAMFB] [${task.type}] ${task.accFile} -> Nhóm ${task.idbox}: OK`);
        } else {
            console.log(`[SPAMFB] [${task.type}] ${task.accFile} -> Nhóm ${task.idbox}: ${sendResult.error}`);
        }
    }, (task.delay || 3) * 1000);
}
function stopSpamTask(accFile, idbox, type) {
    let key = `${accFile}_${idbox}_${type}`;
    if (spamRunners[key]) {
        clearInterval(spamRunners[key]);
        delete spamRunners[key];
    }
}
function stopAllAccTask(accFile) {
    for (let k in spamRunners) {
        if (k.startsWith(accFile+"_")) {
            clearInterval(spamRunners[k]);
            delete spamRunners[k];
        }
    }
}
(function autoRestartAllTask() {
    let tasks = loadTasks();
    for (const task of tasks) {
        if (task.running) startSpamTask(task);
    }
    console.log(`[SPAMFB] Đã tự động khởi động lại tất cả task đang chạy (${tasks.filter(t=>t.running).length})`);
})();

module.exports.config = {
    name: "spamfb",
    version: "3.1.0",
    hasPermission: 2,
    credits: "Kenne400k & Copilot",
    description: "Spam fb đa acc đa nhóm, lưu trạng thái, auto khởi động lại task, menu đầy đủ.",
    commandCategory: "Tiện ích",
    usages: "spamfb [newacc|list|treo|true|stop|delacc|setngonmess|ngonmess|stopngonmess|xemngonmes|tabngonmess|reo|stopreo|nhay|stopnhay|tabnhay|codelag|stopcodelag|tabcodelag|nhaytop|stopnhaytop|tabnhaytop|setngontop|ngontop|stopngontop|tabngontop|menu]",
    cooldowns: 5
};

module.exports.run = async function({ api, event, args }) {
    ensureDirAndFile();
    const { threadID, messageID } = event;
    const type = (args[0] || "").toLowerCase();
    function sendErr(msg) {
        api.sendMessage(msg, threadID, messageID);
        console.log("[SPAMFB] " + msg);
    }

    // ===== MENU =====
    if (!type || type === "menu" || type === "help") {
        return api.sendMessage(
`==== MENU SPAMFB ====
🔹 spamfb newacc {cookie}   → Thêm acc mới (cookie)
🔹 spamfb list              → Xem acc và nhóm đang chạy
🔹 spamfb treo <sttacc> <idbox> <delay> <msg>
🔹 spamfb true <sttacc> <sttnhom> → Bật lại chạy nhóm cho acc
🔹 spamfb stop <sttacc> <sttnhom> → Dừng task nhóm acc 
🔹 spamfb delacc <sttacc>         → Xóa acc và các task
...
Lưu ý: Đa acc, đa nhóm, tắt bot mở lại vẫn chạy tiếp!
`, threadID, messageID);
    }

    // ===== NEW ACC =====
    if (type === "newacc") {
        let cookie = args.slice(1).join(" ").trim();
        if (!cookie.includes("c_user=")) return sendErr("Cookie không hợp lệ!");
        let c_user = (cookie.match(/c_user=(\d+)/) || [])[1];
        let name = `acc_${c_user}`;
        let accFile = name + ".json";
        let acc = {name, cookie, c_user};
        saveAcc(acc, accFile);
        sendErr(`✅ Đã lưu acc với c_user=${c_user}\nBạn có thể dùng lệnh spamfb treo ... hoặc spamfb list để xem acc.`);
        return;
    }

    // ===== LIST =====
    if (type === "list") {
        let accs = getAllAccs();
        let tasks = loadTasks();
        let msg = "📋 Danh sách acc và nhóm đang chạy:\n";
        if (!accs.length) msg += "(Chưa có acc nào, hãy dùng spamfb newacc {cookie})\n";
        accs.forEach((acc, i) => {
            msg += `#${i+1} ${acc.name} (c_user: ${acc.c_user})\n`;
            let tsk = tasks.filter(t=>t.accFile===acc._file);
            if (!tsk.length) msg += "   - Không có nhóm nào.\n";
            tsk.forEach((t, j) => {
                msg += `   + [${j+1}] Nhóm: ${t.idbox} | running: ${t.running?"✅":"❌"} | type: ${t.type}\n`;
            });
        });
        msg += "\nReply: true {sttacc} {sttnhom} để bật lại, stop {sttacc} {sttnhom} để dừng.";
        api.sendMessage(msg, threadID, messageID);
        console.log("[SPAMFB] Đã gửi danh sách acc/nhóm.");
        return;
    }

    // ===== TREO =====
    if (type === "treo") {
        let sttacc = parseInt(args[1])-1;
        let idbox = args[2];
        let delay = parseInt(args[3]) || 3;
        let msgtxt = args.slice(4).join(" ") || "Treo spam!";
        let accs = getAllAccs();
        if (!accs[sttacc]) return sendErr("Không tìm thấy acc này.");
        let acc = accs[sttacc];
        let tasks = loadTasks();
        let tsk = tasks.find(t=>t.accFile===acc._file && t.idbox===idbox && t.type==="treo");
        if (tsk) {
            if (tsk.running) return sendErr("Nhóm này đã chạy rồi!");
            tsk.running = true;
            tsk.delay = delay;
            tsk.msg = msgtxt;
        } else {
            tsk = {accFile: acc._file, idbox, running: true, type: "treo", delay, msg: msgtxt, last: Date.now()};
            tasks.push(tsk);
        }
        saveTasks(tasks);
        startSpamTask(tsk);
        sendErr(`Bắt đầu treo acc ${acc.name} vào nhóm ${idbox} (delay ${delay}s).`);
        return;
    }

    // ===== TRUE (bật lại nhóm) =====
    if (type === "true") {
        let sttacc = parseInt(args[1])-1;
        let sttnhom = parseInt(args[2])-1;
        let accs = getAllAccs();
        if (!accs[sttacc]) return sendErr("Không tìm thấy acc này.");
        let acc = accs[sttacc];
        let tasks = loadTasks();
        let tskarr = tasks.filter(t=>t.accFile===acc._file);
        if (!tskarr[sttnhom]) return sendErr("Không tìm thấy nhóm!");
        let tsk = tskarr[sttnhom];
        if (tsk.running) return sendErr("Nhóm này đã đang chạy!");
        tsk.running = true;
        saveTasks(tasks);
        startSpamTask(tsk);
        sendErr(`Đã bật lại nhóm ${tsk.idbox} cho acc ${acc.name}.`);
        return;
    }

    // ===== STOP =====
    if (type === "stop") {
        let sttacc = parseInt(args[1])-1;
        let sttnhom = parseInt(args[2])-1;
        let accs = getAllAccs();
        if (!accs[sttacc]) return sendErr("Không tìm thấy acc này.");
        let acc = accs[sttacc];
        let tasks = loadTasks();
        let tskarr = tasks.filter(t=>t.accFile===acc._file);
        if (!tskarr[sttnhom]) return sendErr("Không tìm thấy nhóm!");
        let tsk = tskarr[sttnhom];
        tsk.running = false;
        saveTasks(tasks);
        stopSpamTask(tsk.accFile, tsk.idbox, tsk.type);
        sendErr(`Đã dừng nhóm ${tsk.idbox} của acc ${acc.name}.`);
        return;
    }

    // ===== DELACC =====
    if (type === "delacc") {
        let sttacc = parseInt(args[1])-1;
        let accs = getAllAccs();
        if (!accs[sttacc]) return sendErr("Không tìm thấy acc này.");
        let file = accs[sttacc]._file;
        let tasks = loadTasks().filter(t=>t.accFile!==file);
        saveTasks(tasks);
        stopAllAccTask(file);
        try { fs.unlinkSync(path.join(ACC_DIR, file)); } catch{}
        sendErr("Đã xóa acc và toàn bộ task liên quan!");
        return;
    }

    // ===== Nếu reply true/stop =====
    if (event.type === "message_reply" && event.messageReply && event.messageReply.body && event.body) {
        let match = event.body.match(/^(true|stop)\s+(\d+)\s+(\d+)/i);
        if (match) {
            let cmd = match[1].toLowerCase();
            let sttacc = parseInt(match[2])-1;
            let sttnhom = parseInt(match[3])-1;
            let accs = getAllAccs();
            if (!accs[sttacc]) return sendErr("Không tìm thấy acc này.");
            let acc = accs[sttacc];
            let tasks = loadTasks();
            let tskarr = tasks.filter(t=>t.accFile===acc._file);
            if (!tskarr[sttnhom]) return sendErr("Không tìm thấy nhóm!");
            let tsk = tskarr[sttnhom];
            if (cmd === "true") {
                if (tsk.running) return sendErr("Nhóm này đã đang chạy!");
                tsk.running = true;
                saveTasks(tasks);
                startSpamTask(tsk);
                sendErr(`Đã bật lại nhóm ${tsk.idbox} cho acc ${acc.name}.`);
                return;
            } else if (cmd === "stop") {
                tsk.running = false;
                saveTasks(tasks);
                stopSpamTask(tsk.accFile, tsk.idbox, tsk.type);
                sendErr(`Đã dừng nhóm ${tsk.idbox} của acc ${acc.name}.`);
                return;
            }
        }
    }

    // ===== Nếu không khớp lệnh nào =====
    sendErr("Sai cú pháp, gõ spamfb menu để xem hướng dẫn!");
};