const fs = require("fs");
const path = require("path");

const APPSTATE_DIR_NAME = "appstate";
const NOTES_FILENAME = "notes.json";

// Helper functions
const ensureAppstateDirExists = (projectHome) => {
  const appstateDir = path.join(projectHome, APPSTATE_DIR_NAME);
  if (!fs.existsSync(appstateDir)) {
    fs.mkdirSync(appstateDir, { recursive: true });
    return { appstateDir, created: true };
  }
  return { appstateDir, created: false };
};

const copyInitialAppstate = (appstateDir) => {
  const rootAppstatePath = path.resolve(appstateDir, `../../appstate.json`); // Path to project root's appstate.json
  const targetAppstatePath = path.join(appstateDir, "appstate.json"); // Default name in appstate dir
  let msgs = [];
  if (fs.existsSync(rootAppstatePath)) {
    if (!fs.existsSync(targetAppstatePath)) { // Only copy if target doesn't exist
      try {
        fs.copyFileSync(rootAppstatePath, targetAppstatePath);
        msgs.push(`📝 Đã tự động sao chép file appstate.json gốc vào ${APPSTATE_DIR_NAME}/appstate.json!`);
      } catch (err) {
        msgs.push(`⚠️ Không thể sao chép file appstate.json gốc: ${err.message}`);
      }
    } else {
      msgs.push(`ℹ️ File ${APPSTATE_DIR_NAME}/appstate.json đã tồn tại, không sao chép file gốc.`);
    }
  } else {
    msgs.push(`⚠️ Không tìm thấy file ../../appstate.json để tự động sao chép.`);
  }
  return msgs;
};

const readNotes = (appstateDir) => {
  const notesPath = path.join(appstateDir, NOTES_FILENAME);
  if (fs.existsSync(notesPath)) {
    try {
      return JSON.parse(fs.readFileSync(notesPath, "utf8"));
    } catch (e) {
      console.error(`Lỗi đọc hoặc phân tích ${NOTES_FILENAME}:`, e);
      return {};
    }
  }
  return {};
};

const writeNotes = (appstateDir, notes) => {
  const notesPath = path.join(appstateDir, NOTES_FILENAME);
  try {
    fs.writeFileSync(notesPath, JSON.stringify(notes, null, 2), "utf8");
  } catch (e) {
    console.error(`Lỗi ghi ${NOTES_FILENAME}:`, e);
  }
};

const getAccList = (appstateDir) => {
  if (!fs.existsSync(appstateDir)) return [];
  let files = fs.readdirSync(appstateDir).filter((file) => file.endsWith(".json") && file !== NOTES_FILENAME);
  let notes = readNotes(appstateDir);
  return files.map((file, idx) => ({
    stt: idx + 1,
    file,
    note: notes[file] || "",
  }));
};

const generateCookieString = (appstateArray) => {
  if (!Array.isArray(appstateArray)) return "";
  const seenKeys = new Set();
  return appstateArray
    .filter(item => item && typeof item.key === 'string' && typeof item.value === 'string')
    .filter(item => { // Keep last occurrence for unique keys in cookie
      if (seenKeys.has(item.key)) return false;
      seenKeys.add(item.key);
      return true;
    })
    .map(c => `${c.key}=${c.value}`)
    .join("; ");
};

const saveAppstateAndCookie = (appstateArray, targetFilename, appstateDir) => {
  try {
    const appstatePath = path.join(appstateDir, targetFilename);
    fs.writeFileSync(appstatePath, JSON.stringify(appstateArray, null, 2), "utf8");

    const cookieString = generateCookieString(appstateArray);
    const cookieFile = targetFilename.replace(/\.json$/, ".cookie.txt");
    fs.writeFileSync(path.join(appstateDir, cookieFile), cookieString, "utf8");
    return { appstatePath, cookiePath: path.join(appstateDir, cookieFile) };
  } catch (e) {
    console.error(`Lỗi lưu appstate/cookie cho ${targetFilename}:`, e);
    return null;
  }
};

const findAccount = (identifier, accList) => {
  if (!identifier) return null;
  let account = null;
  if (/^\d+$/.test(String(identifier))) {
    const stt = parseInt(identifier);
    account = accList.find(acc => acc.stt === stt);
  } else {
    const fileName = String(identifier).endsWith(".json") ? String(identifier) : String(identifier) + ".json";
    account = accList.find(acc => acc.file === fileName);
  }
  return account;
};

const buildMenu = (accs, appstateDir) => {
  let menu = "🔐 Quản lý tài khoản Bot (doiacc):\n\n";
  menu += "📄 list — Xem danh sách tài khoản\n\n";
  menu += "🔁 <STT> hoặc <TênFile> — Chuyển sang tài khoản đó\n\n";
  menu += "⏭️ next (hoặc để trống) — Chuyển tài khoản kế tiếp\n\n";
  menu += "➕ addnew <TênFile> {AppstateJSON} — Thêm và dùng tài khoản mới\n";
  menu += "   ↪️ Ví dụ: `addnew acc_moi [{...}]`\n\n";
  menu += "📝 addnote <STT|TênFile> <Ghi chú> — Ghi chú cho tài khoản\n\n";
  menu += "🗑️ rm <STT|TênFile> — Xóa tài khoản (cần xác nhận \n\n";
  menu += "ℹ️ info <STT|TênFile> — Xem thông tin chi tiết tài khoản\n\n";
  menu += "🔄 reload — Làm mới appstate & cookie của tài khoản đang dùng\n";

  if (!accs || accs.length === 0) {
    const dir = path.relative(process.cwd(), appstateDir);
    menu += `\n⚠️ Chưa có tài khoản nào trong thư mục \`./${dir}\`\n`;
    menu += "📥 Để thêm tài khoản đầu tiên, reply theo cú pháp:\n";
    menu += "`{TênFile} {AppstateJSON}`\n";
    menu += "🔸 Ví dụ: `clone123 [{...appstate...}]`";
  }

  return menu.trim();
};


module.exports.config = {
  name: "doiacc",
  version: "3.0.0",
  hasPermission: 2,
  credits: "pcoder",
  description: "Quản lý và chuyển đổi tài khoản bot (appstate), tự động tạo cookie, quản lý ghi chú.",
  commandCategory: "Admin",
  usages: "[list|info <stt|name>|reload|addnote <stt|name> <note>|rm <stt|name>|<stt>|<name>|next|addnew <name> {appstate_json}]",
  cooldowns: 0,
};

module.exports.run = async function ({ api, event, args }) {
  const { configPath } = global.client;
  const currentBotConfig = require(configPath);
  const projectHome = path.resolve("./pdata"); // Assumes command is run from bot's root directory

  const { appstateDir, created: dirCreated } = ensureAppstateDirExists(projectHome);
  let initialMessages = [];

  if (dirCreated) {
    initialMessages.push(`🔔 Đã tự động tạo thư mục ${APPSTATE_DIR_NAME} tại: ${appstateDir}`);
    const copyMsgs = copyInitialAppstate(appstateDir);
    initialMessages = initialMessages.concat(copyMsgs);
  }

  let accs = getAccList(appstateDir);

  if (initialMessages.length > 0) {
    initialMessages.push("\n" + buildMenu(accs, appstateDir));
    return api.sendMessage(initialMessages.join("\n"), event.threadID, (err, info) => {
      if (err) console.error(err);
      if (accs.length === 0 && info) { // Check info to ensure message was sent
        global.client.handleReply.push({
          name: module.exports.config.name,
          author: event.senderID,
          messageID: info.messageID,
          type: "addfirst",
          appstateDir: appstateDir
        });
      }
    });
  }
  
  const command = args[0]?.toLowerCase();

  // LIST ACCOUNTS
  if (command === "list" || (!command && accs.length > 0)) { // Show list if 'list' or no command and accounts exist
    const currentAppstateFile = path.basename(currentBotConfig.APPSTATEPATH);
    let msg = "📑 **Danh sách Appstate:**\n";
    if (accs.length > 0) {
      accs.forEach(acc => {
        msg += `${acc.stt}. ${acc.file}${acc.note ? ` — "${acc.note}"` : ""}${acc.file === currentAppstateFile ? " (Đang dùng)" : ""}\n`;
      });
    } else {
      msg += "(Trống)\n";
    }
    msg += "\n" + buildMenu(accs, appstateDir);
    return api.sendMessage(msg, event.threadID, (err, info) => {
      if (err) console.error(err);
      if (accs.length === 0 && info) { // Check info to ensure message was sent
        global.client.handleReply.push({
          name: module.exports.config.name,
          author: event.senderID,
          messageID: info.messageID,
          type: "addfirst",
          appstateDir: appstateDir
        });
      }
    });
  }
  
  // If no accounts and not 'list' or 'addnew', show menu and prompt for addfirst
  // This condition ensures that 'addnew' can proceed even if accs.length is 0
  if (accs.length === 0 && command !== "addnew") {
     if (event.type === "message_reply" && handleReply && handleReply.type === "addfirst") {
        // Already in a reply context for addfirst, do nothing here to let handleReply manage it.
     } else {
        return api.sendMessage(buildMenu(accs, appstateDir), event.threadID, (err, info) => {
            if (err) console.error(err);
             if (info) {
                global.client.handleReply.push({
                    name: module.exports.config.name,
                    author: event.senderID,
                    messageID: info.messageID,
                    type: "addfirst",
                    appstateDir: appstateDir
                });
             }
        });
    }
  }


  // ADD NEW ACCOUNT
  if (command === "addnew") {
    if (args.length < 3) return api.sendMessage(`Sai cú pháp! Dùng: doiacc addnew <TênFile_Không_Json> {AppstateJSON}\nVí dụ: doiacc addnew acc_moi [{"key": "c_user", ...}]`, event.threadID);
    const newFileNameBase = args[1];
    if (newFileNameBase.includes(".") || newFileNameBase.includes("/")) return api.sendMessage("Tên file không được chứa dấu chấm hoặc gạch chéo.", event.threadID);
    const newFileName = newFileNameBase + ".json";
    const appstateRaw = args.slice(2).join(" ");
    try {
      const appstateObj = JSON.parse(appstateRaw);
      if (!Array.isArray(appstateObj)) throw new Error("Appstate phải là một JSON array.");

      const saveResult = saveAppstateAndCookie(appstateObj, newFileName, appstateDir);
      if (!saveResult) throw new Error("Không thể lưu appstate/cookie.");

      currentBotConfig.APPSTATEPATH = path.join(APPSTATE_DIR_NAME, newFileName);
      fs.writeFileSync(configPath, JSON.stringify(currentBotConfig, null, 2), "utf8");
      return api.sendMessage(`✅ Đã lưu và đổi sang tài khoản: ${newFileName}\n🍪 Cookie đã được tạo: ${newFileName.replace(/\.json$/, ".cookie.txt")}\nBot sẽ tự khởi động lại...`, event.threadID, () => process.exit(1));
    } catch (e) {
      return api.sendMessage(`❌ Lỗi khi thêm tài khoản mới: ${e.message}\nAppstate nhập vào phải là JSON array hợp lệ.`, event.threadID);
    }
  }

  // ADD NOTE
  if (command === "addnote") {
    if (args.length < 3) return api.sendMessage("Sai cú pháp! Dùng: doiacc addnote <STT|TênFile> <Nội dung ghi chú>", event.threadID);
    const identifier = args[1];
    const noteContent = args.slice(2).join(" ");
    const account = findAccount(identifier, accs);
    if (!account) return api.sendMessage(`❌ Không tìm thấy tài khoản "${identifier}".\n\n${buildMenu(accs, appstateDir)}`, event.threadID);
    
    let notes = readNotes(appstateDir);
    notes[account.file] = noteContent;
    writeNotes(appstateDir, notes);
    return api.sendMessage(`✅ Đã cập nhật ghi chú cho ${account.file}: "${noteContent}"`, event.threadID);
  }

  // REMOVE ACCOUNT
  if (command === "rm") {
    if (args.length < 2) return api.sendMessage("Sai cú pháp! Dùng: doiacc rm <STT|TênFile>", event.threadID);
    const identifier = args[1];
    const account = findAccount(identifier, accs);
    if (!account) return api.sendMessage(`❌ Không tìm thấy tài khoản "${identifier}".\n\n${buildMenu(accs, appstateDir)}`, event.threadID);
    if (path.join(APPSTATE_DIR_NAME, account.file) === currentBotConfig.APPSTATEPATH) {
      return api.sendMessage(`❌ Không thể xóa tài khoản đang sử dụng (${account.file}). Vui lòng chuyển sang tài khoản khác trước.`, event.threadID);
    }

    return api.sendMessage(`Bạn có chắc muốn xóa tài khoản "${account.file}" (STT: ${account.stt}) không?\nReply "yes" để xác nhận.`, event.threadID, (err, info) => {
      if (err) console.error(err);
      if (info) {
        global.client.handleReply.push({
          name: module.exports.config.name,
          author: event.senderID,
          messageID: info.messageID,
          type: "confirm_remove",
          accountToRemove: account,
          appstateDir: appstateDir
        });
      }
    });
  }

  // ACCOUNT INFO
  if (command === "info") {
    if (args.length < 2) return api.sendMessage("Sai cú pháp! Dùng: doiacc info <STT|TênFile>", event.threadID);
    const identifier = args[1];
    const account = findAccount(identifier, accs);
    if (!account) return api.sendMessage(`❌ Không tìm thấy tài khoản "${identifier}".\n\n${buildMenu(accs, appstateDir)}`, event.threadID);

    const filePath = path.join(appstateDir, account.file);
    let fileInfo = `**Thông tin tài khoản: ${account.file} (STT: ${account.stt})**\n`;
    fileInfo += `📝 Ghi chú: ${account.note || "(Không có)"}\n`;
    try {
      const stats = fs.statSync(filePath);
      fileInfo += `📅 Sửa đổi lần cuối: ${new Date(stats.mtime).toLocaleString("vi-VN")}\n`;
      const appstateContent = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const cUserEntry = appstateContent.find(item => item.key === "c_user");
      if (cUserEntry) fileInfo += `👤 User ID: ${cUserEntry.value}\n`;
      const cookiePath = filePath.replace(/\.json$/, ".cookie.txt");
      if (fs.existsSync(cookiePath)) fileInfo += `🍪 Có file cookie: ${path.basename(cookiePath)}\n`;
      else fileInfo += `🍪 Không tìm thấy file cookie.\n`;
    } catch (e) {
      fileInfo += `⚠️ Không thể đọc thông tin chi tiết file: ${e.message}\n`;
    }
    return api.sendMessage(fileInfo, event.threadID);
  }

  // RELOAD CURRENT ACCOUNT
  if (command === "reload") {
    const currentAppstateFilename = path.basename(currentBotConfig.APPSTATEPATH);
    const fullAppstatePath = path.join(projectHome, currentBotConfig.APPSTATEPATH);

    if (!fs.existsSync(fullAppstatePath)) {
        return api.sendMessage(`❌ Không tìm thấy file appstate hiện tại: ${currentBotConfig.APPSTATEPATH}. Có thể đã bị xoá hoặc cấu hình sai.`, event.threadID);
    }
    
    try {
      const liveAppstate = api.getAppState(); // Get live appstate from current session
      const saveResult = saveAppstateAndCookie(liveAppstate, currentAppstateFilename, appstateDir);
      if (!saveResult) throw new Error("Không thể lưu appstate/cookie.");
      return api.sendMessage(`✅ Đã làm mới appstate và cookie cho tài khoản đang dùng: ${currentAppstateFilename}\nAppstate đã được lưu tại: ${saveResult.appstatePath}\nCookie đã được lưu tại: ${saveResult.cookiePath}`, event.threadID);
    } catch (e) {
      return api.sendMessage(`❌ Lỗi khi làm mới tài khoản: ${e.message}`, event.threadID);
    }
  }

  // SWITCH ACCOUNT (by STT, Name, or "next")
  let targetAccountFile;
  if (command === "next" || !command) { // Default to 'next' if no specific command recognized yet
    if (!accs.length) return api.sendMessage(buildMenu(accs, appstateDir), event.threadID); // Should be caught earlier if not addnew
    const currentIndex = accs.findIndex(acc => path.join(APPSTATE_DIR_NAME, acc.file) === currentBotConfig.APPSTATEPATH);
    const nextIndex = (currentIndex + 1) % accs.length;
    targetAccountFile = accs[nextIndex].file;
  } else { // Attempt to switch by STT or Name if 'command' is not one of the above
    const accountToSwitch = findAccount(command, accs); // 'command' here is the first argument (stt or name)
    if (!accountToSwitch) {
        // If not found, and it's not a known command, show menu
        return api.sendMessage(`❓ Lệnh không hợp lệ hoặc không tìm thấy tài khoản "${command}".\n\n${buildMenu(accs, appstateDir)}`, event.threadID);
    }
    targetAccountFile = accountToSwitch.file;
  }

  if (!targetAccountFile) { // Should not happen if logic above is correct
    return api.sendMessage(`Lỗi không xác định được tài khoản đích.\n\n${buildMenu(accs, appstateDir)}`, event.threadID);
  }

  const newAppstatePath = path.join(APPSTATE_DIR_NAME, targetAccountFile);
  if (newAppstatePath === currentBotConfig.APPSTATEPATH) {
    return api.sendMessage(`⛔ Tài khoản ${targetAccountFile} đang được sử dụng rồi!`, event.threadID);
  }

  currentBotConfig.APPSTATEPATH = newAppstatePath;
  fs.writeFileSync(configPath, JSON.stringify(currentBotConfig, null, 2), "utf8");
  const targetAccDetails = accs.find(a => a.file === targetAccountFile);
  return api.sendMessage(`✅ Đã chuyển sang tài khoản: ${targetAccountFile}${targetAccDetails?.note ? ` ("${targetAccDetails.note}")` : ""}\nBot sẽ tự khởi động lại...`, event.threadID, () => process.exit(1));
};


module.exports.handleReply = async function({ api, event, handleReply }) {
  const { author, messageID, type, appstateDir } = handleReply;
  if (event.senderID !== author) return;

  if (type === "addfirst") {
    const match = event.body.match(/^([^\s{]+)\s+([\s\S]+)$/); // TênFile (không .json) {AppstateJSON}
    if (!match) return api.sendMessage("Sai cú pháp! Vui lòng nhập:\n{TênFile_Không_Json} {AppstateJSON}\nVí dụ: clone123 [{...appstate...}]", event.threadID, event.messageID);

    const fileNameBase = match[1];
    if (fileNameBase.includes(".") || fileNameBase.includes("/")) return api.sendMessage("Tên file không được chứa dấu chấm hoặc gạch chéo.", event.threadID, event.messageID);
    const fileName = fileNameBase + ".json";
    const appstateRaw = match[2];

    try {
      const appstateObj = JSON.parse(appstateRaw);
      if (!Array.isArray(appstateObj)) throw new Error("Appstate phải là một JSON array.");

      const saveResult = saveAppstateAndCookie(appstateObj, fileName, appstateDir);
      if (!saveResult) throw new Error("Không thể lưu appstate/cookie.");
      
      api.unsendMessage(messageID); // Gỡ tin nhắn hướng dẫn cũ

      const { configPath } = global.client;
      const currentBotConfig = require(configPath);
      currentBotConfig.APPSTATEPATH = path.join(APPSTATE_DIR_NAME, fileName);
      fs.writeFileSync(configPath, JSON.stringify(currentBotConfig, null, 2), "utf8");

      return api.sendMessage(`✅ Đã lưu và đổi sang tài khoản đầu tiên: ${fileName}\n🍪 Cookie đã được tạo: ${fileName.replace(/\.json$/, ".cookie.txt")}\nBot sẽ tự khởi động lại...`, event.threadID, () => process.exit(1));
    } catch (e) {
      return api.sendMessage(`❌ Lỗi khi thêm tài khoản đầu tiên: ${e.message}\nAppstate nhập vào phải là JSON array hợp lệ.`, event.threadID, event.messageID);
    }
  }

  if (type === "confirm_remove") {
    if (event.body.toLowerCase() !== "yes") {
      api.unsendMessage(messageID);
      return api.sendMessage("Hủy bỏ thao tác xóa tài khoản.", event.threadID);
    }
    const { accountToRemove } = handleReply;
    try {
      const filePath = path.join(appstateDir, accountToRemove.file);
      const cookiePath = filePath.replace(/\.json$/, ".cookie.txt");
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (fs.existsSync(cookiePath)) fs.unlinkSync(cookiePath);

      let notes = readNotes(appstateDir);
      if (notes[accountToRemove.file]) {
        delete notes[accountToRemove.file];
        writeNotes(appstateDir, notes);
      }
      api.unsendMessage(messageID);
      return api.sendMessage(`✅ Đã xóa thành công tài khoản: ${accountToRemove.file}`, event.threadID);
    } catch (e) {
      return api.sendMessage(`❌ Lỗi khi xóa tài khoản: ${e.message}`, event.threadID);
    }
  }
};