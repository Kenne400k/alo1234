module.exports.config = {
  name: "console",
  version: "2.0.1",
  hasPermssion: 3,
  credits: "pcoder",
  description: "Console đẹp, hiện đại, chống spam lag console",
  commandCategory: "Admin",
  usages: "console",
  cooldowns: 30
};

const chalk = require("chalk");
const moment = require("moment-timezone");

module.exports.handleEvent = async function ({ api, Users, event }) {
  try {
    const { threadID, senderID, body } = event;

    // Không log chính bot
    if (senderID == global.data.botID) return;

    // Không log nếu thread đã tắt console
    const threadSetting = global.data.threadData.get(threadID) || {};
    if (typeof threadSetting.console !== "undefined" && threadSetting.console === true) return;

    // Lấy thông tin nhóm, người dùng
    let threadName = "Không xác định";
    let userName = "Người lạ";
    try {
      const threadInfo = await api.getThreadInfo(threadID);
      threadName = threadInfo.threadName || "Không xác định";
      userName = await Users.getNameUser(senderID);
    } catch { /* bỏ qua lỗi */ }

    const content = body && typeof body === "string" && body.length < 300
      ? body
      : chalk.italic("(Ảnh, video hoặc kí tự đặc biệt)");

    const timeString = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss - DD/MM/YYYY");

    // LOG ĐẸP, HIỆN ĐẠI
    console.log(
      chalk.hex("#FF66FF")("┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓") + "\n" +
      chalk.hex("#CC66FF")(`┣➤ 👥 Tên nhóm: ${threadName}`) + "\n" +
      chalk.hex("#9966FF")(`┣➤ 🆔 ID nhóm: ${threadID}`) + "\n" +
      chalk.hex("#6666FF")(`┣➤ 👤 Người dùng: ${userName}`) + "\n" +
      chalk.hex("#3366FF")(`┣➤ 🆔 ID user: ${senderID}`) + "\n" +
      chalk.hex("#0066FF")(`┣➤ 💬 Nội dung: ${content}`) + "\n" +
      chalk.hex("#0033FF")(`┣➤ 🕒 Thời gian: ${timeString}`) + "\n" +
      chalk.hex("#0000FF")("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛")
    );

  } catch (err) {
    console.log(chalk.bgRed.white("Lỗi console: "), err);
  }
};

module.exports.run = async function () {};