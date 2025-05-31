const fs = require("fs-extra");
const path = require("path");

// ==== CẤU HÌNH MODULE ==== //
module.exports.config = {
  name: "admin",
  version: "2.5.1",
  hasPermssion: 0,
  credits: "Mirai Team, pcoder, Kenne400k",
  description: "🚀 Siêu trung tâm điều khiển Admin & DEV đa năng, giao diện tân tiến!",
  commandCategory: "Hệ thống",
  usages: "admin [add|rm|sp|resp|list|qtvonly|ibrieng|devadd|devrm|devonly|help|info]",
  cooldowns: 0,
  dependencies: {
    "fs-extra": ""
  }
};

// ==== NGÔN NGỮ ==== //
module.exports.languages = {
  "vi": {
    "listAdmin": `🌟 𝗔𝗗𝗠𝗜𝗡 𝗣𝗥𝗘𝗠𝗜𝗨𝗠 🌟\n━━━━━━━━━━━━━━━━━━\n%1\n━━━━━━━━━━━━━━━━━━`,
    "listNDH": `✨ 𝗡𝗴𝘂̛𝗼̛̀𝗶 𝗧𝗵𝘂𝗲̂ 𝗕𝗼𝘁 ✨\n━━━━━━━━━━━━━━━━━━\n%1\n━━━━━━━━━━━━━━━━━━`,
    "listDEV": `⚜️ 𝗡𝗵𝗮̀ 𝗣𝗵𝗮́𝘁 𝗧𝗿𝗶𝗲̂̉𝗻 𝗕𝗼𝘁 ⚜️\n━━━━━━━━━━━━━━━━━━\n%1\n━━━━━━━━━━━━━━━━━━`,
    "notHavePermssion": '🚫 Bạn không đủ thẩm quyền để thực thi lệnh "%1".',
    "devOnlyCommand": "⚠️ Lệnh này chỉ dành cho Nhà Phát Triển Bot (DEV).",
    "targetRequired": "❌ Vui lòng chỉ định mục tiêu (tag, reply, hoặc UID).",
    "userAlready": "ℹ️ Người dùng [%1] đã có vai trò này rồi.",
    "userNot": "ℹ️ Người dùng [%1] không có trong danh sách này.",
    "addedNewAdmin": '✅ Đã phong %1 người dùng làm 𝗔𝗗𝗠𝗜𝗡 𝗣𝗥𝗘𝗠𝗜𝗨𝗠:\n%2',
    "removedAdmin": '✅ Đã hạ bệ %1 𝗔𝗗𝗠𝗜𝗡 𝗣𝗥𝗘𝗠𝗜𝗨𝗠:\n%2',
    "addedNewNDH": '✅ Đã thêm %1 người dùng làm 𝗡𝗴𝘂̛𝗼̛̀𝗶 𝗧𝗵𝘂𝗲̂ 𝗕𝗼𝘁:\n%2',
    "removedNDH": '✅ Đã gỡ %1 𝗡𝗴𝘂̛𝗼̛̀𝗶 𝗧𝗵𝘂𝗲̂ 𝗕𝗼𝘁:\n%2',
    "addedNewDEV": '👑 Đã bổ nhiệm %1 Nhà Phát Triển Bot mới:\n%2',
    "removedDEV": '👋 Đã miễn nhiệm %1 Nhà Phát Triển Bot:\n%2',
    "modeOn": "🔒 Chế độ Chỉ Admin & QTV: BẬT\nChỉ quản trị viên nhóm và Admin bot mới có thể sử dụng bot.",
    "modeOff": "🔓 Chế độ Chỉ Admin & QTV: TẮT\nMọi thành viên đều có thể sử dụng bot.",
    "adminPaseOnlyOn": "🔒 Chế độ riêng tư: BẬT\nChỉ Admin bot mới có thể chat riêng với bot.",
    "adminPaseOnlyOff": "🔓 Chế độ riêng tư: TẮT\nMọi người đều có thể chat riêng với bot.",
    "devModeOn": "🛠️ Chế độ Nhà Phát Triển: BẬT\nChỉ Nhà Phát Triển Bot (DEV) mới có thể sử dụng bot.",
    "devModeOff": "⚙️ Chế độ Nhà Phát Triển: TẮT\nTất cả người dùng (theo cấu hình nhóm) đều có thể sử dụng bot.",
    "errorReadingConfig": "❌ Lỗi nghiêm trọng khi đọc file config. Vui lòng kiểm tra lại!",
    "info": `💡 𝙏𝙝𝙤̂𝙣𝙜 𝙩𝙞𝙣 𝙗𝙤𝙩 & 𝙖𝙙𝙢𝙞𝙣:
━━━━━━━━━━━━━━━━━━
👑 𝗔𝗗𝗠𝗜𝗡: %ADMIN_NAME%
📘 Facebook: %FACEBOOK_ADMIN%
🐙 Github: %GITHUB%
▶️ Youtube: %YOUTUBE%
✉️ Gmail: %GMAIL%
📲 Zalo: %ZALO_ADMIN%
━━━━━━━━━━━━━━━━━━
`
    ,
    "help": `💎======= 𝗔𝗗𝗠𝗜𝗡 𝗖𝗢𝗡𝗧𝗥𝗢𝗟 𝗣𝗔𝗡𝗘𝗟 =======💎

✨ 𝗤𝘂𝗮̉𝗻 𝗟𝘆́ 𝗩𝗮𝗶 𝗧𝗿𝗼̀ ✨
  • admin add <uid/tag/reply>  : Thêm Admin Premium.
  • admin rm <uid/tag/reply>   : Gỡ Admin Premium.
  • admin sp <uid/tag/reply>     : Thêm Người Thuê Bot.
  • admin resp <uid/tag/reply>   : Gỡ Người Thuê Bot.

⚜️ 𝗗𝗮̀𝗻𝗵 𝗰𝗵𝗼 𝗡𝗵𝗮̀ 𝗣𝗵𝗮́𝘁 𝗧𝗿𝗶𝗲̂̉𝗻 (𝗗𝗘𝗩) ⚜️
  • admin devadd <uid/tag/reply> : Thêm DEV Bot.
  • admin devrm <uid/tag/reply>  : Gỡ DEV Bot.

📜 𝗗𝗮𝗻𝗵 𝗦𝗮́𝗰𝗵 📜
  • admin list                   : Xem danh sách Admin, NDH & DEV.

⚙️ 𝗖𝗮̀𝗶 Đ𝗮̣̆𝘁 𝗛𝗲̣̂ 𝗧𝗵𝗼̂́𝗻𝗴 ⚙️
  • admin qtvonly                : Bật/tắt chế độ chỉ QTV/Admin dùng bot trong nhóm.
  • admin ibrieng                : Bật/tắt chỉ Admin được nhắn riêng với bot.
  • admin devonly                : Bật/tắt chế độ chỉ DEV được dùng bot (toàn cục).

💡 admin info                     : Thông tin admin và bot.
💡 admin help                     : Hiển thị bảng trợ giúp này.
━━━━━━━━━━━━━━━━━━━━━━━━━━
🕹️ Sử dụng: admin <lệnh> [tham số nếu có]`
  }
};

// ==== KHỞI TẠO DATA BOX ==== //
module.exports.onLoad = function() {
  const { writeFileSync, existsSync, ensureDirSync } = require('fs-extra');
  const fpath = path.resolve(__dirname, 'hethong', 'data.json');
  if (!existsSync(fpath)) {
    ensureDirSync(path.dirname(fpath));
    writeFileSync(fpath, JSON.stringify({ adminbox: {} }, null, 4));
  } else {
    try {
      const data = require(fpath);
      if (!data.hasOwnProperty('adminbox')) data.adminbox = {};
      writeFileSync(fpath, JSON.stringify(data, null, 4));
    } catch (e) {
      console.error("Lỗi khi tải hoặc sửa data.json cho module admin:", e);
      writeFileSync(fpath, JSON.stringify({ adminbox: {} }, null, 4));
    }
  }
};

// ==== HELPER FUNCTIONS ==== //
async function getTargetIDs(event, args) {
  const { mentions, type, messageReply } = event;
  let targetIDs = [];
  if (type == "message_reply" && messageReply && messageReply.senderID) {
    targetIDs.push(messageReply.senderID.toString());
  }
  if (mentions && Object.keys(mentions).length > 0) {
    targetIDs.push(...Object.keys(mentions));
  }
  const potentialUIDs = args.slice(1);
  for (const uid of potentialUIDs) {
    if (/^\d+$/.test(uid) && !targetIDs.includes(uid)) {
      targetIDs.push(uid);
    }
  }
  return [...new Set(targetIDs)];
}
function isDeveloper(senderID, config) {
  return config.DEVELOPERS && config.DEVELOPERS.includes(senderID.toString());
}
async function processUserOperation({ api, event, args, Users, getText, config, configPath, operationType, listType }) {
  const { threadID, messageID, senderID } = event;
  if (!isDeveloper(senderID, config) && listType !== "qtvonly") {
    if (listType === "ADMINBOT" || listType === "NDH" || listType === "DEVELOPERS") {
      return api.sendMessage(getText("devOnlyCommand"), threadID, messageID);
    }
  }
  const targetIDs = await getTargetIDs(event, args);
  if (targetIDs.length === 0) {
    return api.sendMessage(getText("targetRequired"), threadID, messageID);
  }
  let successList = [];
  let currentList;
  let successTextKey;
  let alreadyTextKey = "userAlready";
  let notInListTextKey = "userNot";
  switch (listType) {
    case "ADMINBOT":
      currentList = config.ADMINBOT;
      successTextKey = operationType === "add" ? "addedNewAdmin" : "removedAdmin";
      break;
    case "NDH":
      currentList = config.NDH;
      successTextKey = operationType === "add" ? "addedNewNDH" : "removedNDH";
      break;
    case "DEVELOPERS":
      currentList = config.DEVELOPERS;
      successTextKey = operationType === "add" ? "addedNewDEV" : "removedDEV";
      if (!config.DEVELOPERS || senderID.toString() !== config.DEVELOPERS[0]) {
        return api.sendMessage(getText("devOnlyCommand") + "\nChỉ DEV chính (người đầu tiên trong DEVELOPERS) mới có quyền này.", threadID, messageID);
      }
      break;
    default:
      return api.sendMessage("Lỗi: Loại danh sách không hợp lệ.", threadID, messageID);
  }
  for (const id of targetIDs) {
    const userName = (await Users.getData(id)).name || `UID ${id}`;
    if (operationType === "add") {
      if (!currentList.includes(id)) {
        currentList.push(id);
        successList.push(`[${id}] → ${userName}`);
      } else {
        api.sendMessage(getText(alreadyTextKey, userName), threadID);
      }
    } else {
      const index = currentList.findIndex(item => item.toString() === id.toString());
      if (index > -1) {
        if (listType === "DEVELOPERS" && currentList.length === 1 && currentList[0] === id) {
          api.sendMessage(`⚠️ Không thể gỡ bỏ Nhà Phát Triển cuối cùng (${userName}) bằng lệnh. Vui lòng sửa trực tiếp file config.`, threadID, messageID);
          continue;
        }
        if (listType === "DEVELOPERS" && id.toString() === config.DEVELOPERS[0] && senderID.toString() !== config.DEVELOPERS[0]) {
          api.sendMessage(`🚫 Bạn không thể gỡ bỏ Nhà Phát Triển chính (${userName}).`, threadID, messageID);
          continue;
        }
        currentList.splice(index, 1);
        successList.push(`[${id}] → ${userName}`);
      } else {
        api.sendMessage(getText(notInListTextKey, userName), threadID);
      }
    }
  }
  if (successList.length > 0) {
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');
      return api.sendMessage(getText(successTextKey, successList.length, successList.join("\n")), threadID, messageID);
    } catch (e) {
      console.error("Lỗi khi ghi file config:", e);
      return api.sendMessage(getText("errorReadingConfig"), threadID, messageID);
    }
  }
}

// ==== CHẠY LỆNH ==== //
module.exports.run = async function({ api, event, args, Users, permssion: botPermssion, getText }) {
  const { threadID, messageID, senderID } = event;
  const { configPath } = global.client;
  delete require.cache[require.resolve(configPath)];
  let config;
  try {
    config = require(configPath);
  } catch (e) {
    return api.sendMessage(getText("errorReadingConfig"), threadID, messageID);
  }
  const fpath = path.resolve(__dirname, 'hethong', 'data.json');
  const randomIcons = ["🛡️", "👑", "🎩", "🦾", "🚀", "🔥", "🌐", "✨", "🔮", "🎯", "🧩", "🌟", "💡", "⚙️", "💎"];
  const getRandomIcon = () => randomIcons[Math.floor(Math.random() * randomIcons.length)];
  const command = args[0] ? args[0].toLowerCase() : "help";
  const isDev = isDeveloper(senderID, config);
  const isBotAdmin = config.ADMINBOT && config.ADMINBOT.includes(senderID.toString());
  if (config.developerOnlyMode === true && !isDev && !["devonly", "list", "help", "info"].includes(command)) {
    return api.sendMessage("🛠️ Bot hiện đang trong chế độ bảo trì (DEV ONLY). Vui lòng thử lại sau.", threadID, messageID);
  }
  switch (command) {
    case "help":
      return api.sendMessage(getText("help"), threadID, messageID);
    case "info": {
      let info = getText("info")
        .replace("%ADMIN_NAME%", config.ADMIN_NAME || "Chưa cấu hình")
        .replace("%FACEBOOK_ADMIN%", config.FACEBOOK_ADMIN || "Chưa cấu hình")
        .replace("%GITHUB%", config.GITHUB || "Chưa cấu hình")
        .replace("%YOUTUBE%", config.YOUTUBE || "Chưa cấu hình")
        .replace("%GMAIL%", config.GMAIL || "Chưa cấu hình")
        .replace("%ZALO_ADMIN%", config.ZALO_ADMIN || "Chưa cấu hình");
      return api.sendMessage(info.trim(), threadID, messageID);
    }
    case "list": {
      let msg = [], msg1 = [], msgDev = [];
      const devList = config.DEVELOPERS || [];
      for (const id of devList) {
        if (parseInt(id)) {
          const name = (await Users.getData(id)).name || `UID ${id}`;
          msgDev.push(`${getRandomIcon()} ${name}\n🔗 fb.me/${id}`);
        }
      }
      const adminList = config.ADMINBOT || [];
      for (const id of adminList) {
        if (parseInt(id) && !devList.includes(id)) {
          const name = (await Users.getData(id)).name || `UID ${id}`;
          msg.push(`${getRandomIcon()} ${name}\n🔗 fb.me/${id}`);
        }
      }
      const ndhList = config.NDH || [];
      for (const id of ndhList) {
        if (parseInt(id)) {
          const name = (await Users.getData(id)).name || `UID ${id}`;
          msg1.push(`${getRandomIcon()} ${name}\n🔗 fb.me/${id}`);
        }
      }
      let finalMsg = "";
      if (msgDev.length > 0) finalMsg += getText("listDEV", msgDev.join("\n")) + "\n\n";
      if (msg.length > 0) finalMsg += getText("listAdmin", msg.join("\n")) + "\n\n";
      if (msg1.length > 0) finalMsg += getText("listNDH", msg1.join("\n"));
      if(finalMsg.length === 0) finalMsg = "ℹ️ Hiện tại chưa có ai trong các danh sách.";
      return api.sendMessage(finalMsg.trim(), threadID, messageID);
    }
    case "add":
    case "a":
      if (!isDev) return api.sendMessage(getText("devOnlyCommand"), threadID, messageID);
      return processUserOperation({ api, event, args, Users, getText, config, configPath, operationType: "add", listType: "ADMINBOT" });
    case "remove":
    case "rm":
    case "delete":
      if (!isDev) return api.sendMessage(getText("devOnlyCommand"), threadID, messageID);
      return processUserOperation({ api, event, args, Users, getText, config, configPath, operationType: "remove", listType: "ADMINBOT" });
    case "sp":
      if (!isDev) return api.sendMessage(getText("devOnlyCommand"), threadID, messageID);
      return processUserOperation({ api, event, args, Users, getText, config, configPath, operationType: "add", listType: "NDH" });
    case "resp":
      if (!isDev) return api.sendMessage(getText("devOnlyCommand"), threadID, messageID);
      return processUserOperation({ api, event, args, Users, getText, config, configPath, operationType: "remove", listType: "NDH" });
    case "devadd":
      if (!isDev) return api.sendMessage(getText("devOnlyCommand"), threadID, messageID);
      return processUserOperation({ api, event, args, Users, getText, config, configPath, operationType: "add", listType: "DEVELOPERS" });
    case "devrm":
      if (!isDev) return api.sendMessage(getText("devOnlyCommand"), threadID, messageID);
      return processUserOperation({ api, event, args, Users, getText, config, configPath, operationType: "remove", listType: "DEVELOPERS" });
    case "ibrieng": {
      if (!isDev) return api.sendMessage(getText("devOnlyCommand"), threadID, messageID);
      config.adminPaseOnly = !config.adminPaseOnly;
      try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');
        api.sendMessage(config.adminPaseOnly ? getText("adminPaseOnlyOn") : getText("adminPaseOnlyOff"), threadID, messageID);
      } catch (e) {
        api.sendMessage(getText("errorReadingConfig"), threadID, messageID);
      }
      break;
    }
    case "devonly": {
      if (!isDev) return api.sendMessage(getText("devOnlyCommand"), threadID, messageID);
      config.developerOnlyMode = !config.developerOnlyMode;
      try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');
        api.sendMessage(config.developerOnlyMode ? getText("devModeOn") : getText("devModeOff"), threadID, messageID);
      } catch (e) {
        api.sendMessage(getText("errorReadingConfig"), threadID, messageID);
      }
      break;
    }
    case "qtvonly":
    case "boxonly":
    case "box": {
      const threadInfo = await api.getThreadInfo(threadID);
      const isThreadAdmin = threadInfo.adminIDs && threadInfo.adminIDs.some(admin => admin.id === senderID);
      if (!isThreadAdmin && !isBotAdmin && !isDev) {
        return api.sendMessage(getText("notHavePermssion", "qtvonly"), threadID, messageID);
      }
      if (!fs.existsSync(fpath)) {
        fs.ensureDirSync(path.dirname(fpath));
        fs.writeFileSync(fpath, JSON.stringify({ adminbox: {} }, null, 4));
      }
      try {
        const database = JSON.parse(fs.readFileSync(fpath, 'utf-8'));
        if (!database.adminbox) database.adminbox = {};
        database.adminbox[threadID] = !database.adminbox[threadID];
        fs.writeFileSync(fpath, JSON.stringify(database, null, 4));
        api.sendMessage(database.adminbox[threadID] ? getText("modeOn") : getText("modeOff"), threadID, messageID);
      } catch (e) {
        console.error("Lỗi khi thao tác với data.json cho qtvonly:", e);
        api.sendMessage("Đã có lỗi xảy ra với file cấu hình của nhóm.", threadID, messageID);
      }
      break;
    }
    default: {
      return api.sendMessage(getRandomIcon() + ` Lệnh không hợp lệ. Sử dụng "admin help" để xem các lệnh có sẵn.\n${getText("help")}`, threadID, messageID);
    }
  }
};