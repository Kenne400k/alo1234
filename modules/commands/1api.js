const fs = require("fs");
const path = require("path");
const axios = require("axios");

const pathApi = path.join(__dirname, "../../pdata/data_dongdev/datajson/");

module.exports.config = {
  name: "api",
  version: "4.1.0",
  hasPermssion: 3,
  credits: "pcoder, Kenne400k (UI ngắn gọn, dễ nhìn)",
  description: "Quản lý kho file API (ảnh, video, audio, link): kiểm tra link sống/chết, thêm, xóa, xem info, chia sẻ, tạo mới.",
  commandCategory: "Admin",
  usages: "api [list|add|cr|rm|gf|info|checklive|checkdie] [file]",
  cooldowns: 1,
  usePrefix: false,
};

function countLinks(filePath) {
  try {
    const arr = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

function listApiFiles() {
  if (!fs.existsSync(pathApi)) fs.mkdirSync(pathApi, { recursive: true });
  return fs.readdirSync(pathApi).filter((file) => file.endsWith(".json"));
}

function fileStats(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const size = fs.statSync(filePath).size;
  let arr = [];
  try {
    arr = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!Array.isArray(arr)) arr = [];
  } catch { arr = []; }
  return {
    size,
    count: arr.length,
  };
}

module.exports.run = async function ({ api, event, args }) {
  try {
    const sendShortMenu = async () => {
      const files = listApiFiles();
      let totalLinks = 0;
      let shortList = files.length
        ? files
            .map((file, idx) => {
              const stats = fileStats(path.join(pathApi, file));
              totalLinks += stats.count;
              return `${idx + 1}. ${file.replace(/\.json$/, "")} (${stats.count} link, ${(stats.size / 1024).toFixed(2)}KB)`;
            })
            .join("\n")
        : "Không có file nào!";
      const msg =
`𝗔𝗣𝗜 𝗠𝗘𝗡𝗨
list | add | cr | rm | gf | info | checklive | checkdie

${shortList}

File: ${files.length}  |  Tổng link: ${totalLinks}
Reply: rm/cr/gf/checklive/checkdie/info + số thứ tự
`;
      api.setMessageReaction("✅", event.messageID, () => {}, true);
      api.sendMessage(msg, event.threadID, (err, info) => {
        if (!err) {
          global.client.handleReply.push({
            name: module.exports.config.name,
            messageID: info.messageID,
            author: event.senderID,
            type: "api",
            fileListArray: files.map((file, idx) => ({
              index: idx + 1,
              fileName: path.basename(file, ".json"),
              filePath: path.join(pathApi, file),
            })),
          });
        }
      });
    };

    if (!args[0]) return sendShortMenu();

    const subCmd = args[0].toLowerCase();

    // Danh sách file
    if (subCmd === "list") return sendShortMenu();

    // Info chi tiết
    if (subCmd === "info") {
      if (!args[1]) return api.sendMessage("Nhập tên file!", event.threadID);
      const fileName = args[1].toLowerCase() + ".json";
      const filePath = path.join(pathApi, fileName);
      if (!fs.existsSync(filePath)) return api.sendMessage(`File ${fileName} không tồn tại!`, event.threadID);
      const stats = fileStats(filePath);
      let arr = [];
      try {
        arr = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        if (!Array.isArray(arr)) arr = [];
      } catch { arr = []; }
      const msg =
`[${fileName}]
Số link: ${stats.count}
Dung lượng: ${(stats.size / 1024).toFixed(2)} KB
Top 3 link:
${arr.slice(0, 3).map((l, i) => `${i + 1}. ${l}`).join("\n") || "Không có link!"}
Đường dẫn: ${filePath}`;
      api.setMessageReaction("🔎", event.messageID, () => {}, true);
      return api.sendMessage(msg, event.threadID);
    }

    // Check link sống
    if (subCmd === "checklive") {
      if (!args[1]) return api.sendMessage("Nhập tên file!", event.threadID);
      const fileName = args[1].toLowerCase() + ".json";
      const filePath = path.join(pathApi, fileName);
      if (!fs.existsSync(filePath)) return api.sendMessage(`File ${fileName} không tồn tại!`, event.threadID);

      api.setMessageReaction("⌛", event.messageID, () => {}, true);
      let arr = [];
      try {
        arr = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        if (!Array.isArray(arr)) arr = [];
      } catch { arr = []; }
      let live = [];
      for (const link of arr) {
        try {
          const response = await axios.head(link);
          if (response && response.status !== 404) live.push(link);
        } catch {}
      }
      api.setMessageReaction("✅", event.messageID, () => {}, true);
      api.sendMessage(
        `Link sống: ${live.length}/${arr.length}\n${live.slice(0, 5).join("\n")}${live.length > 5 ? `\n...` : ""}`,
        event.threadID
      );
      return;
    }

    // Check link die
    if (subCmd === "checkdie") {
      if (!args[1]) return api.sendMessage("Nhập tên file!", event.threadID);
      const fileName = args[1].toLowerCase() + ".json";
      const filePath = path.join(pathApi, fileName);
      if (!fs.existsSync(filePath)) return api.sendMessage(`File ${fileName} không tồn tại!`, event.threadID);

      api.setMessageReaction("⌛", event.messageID, () => {}, true);
      let arr = [];
      try {
        arr = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        if (!Array.isArray(arr)) arr = [];
      } catch { arr = []; }
      let die = [];
      for (const link of arr) {
        try {
          const response = await axios.head(link);
          if (response.status === 404) die.push(link);
        } catch { die.push(link); }
      }
      api.setMessageReaction("✅", event.messageID, () => {}, true);
      api.sendMessage(
        `Link die: ${die.length}/${arr.length}\n${die.slice(0, 5).join("\n")}${die.length > 5 ? `\n...` : ""}\nThả cảm xúc để xóa link die`,
        event.threadID,
        (err, info) => {
          if (!err && die.length) {
            global.client.handleReaction.push({
              name: module.exports.config.name,
              messageID: info.messageID,
              author: event.senderID,
              type: "checkdie",
              linkk: die,
              filePath,
            });
          }
        }
      );
      return;
    }

    // Thêm link
    if (subCmd === "add") {
      api.setMessageReaction("⌛", event.messageID, () => {}, true);
      const replyMessage = event.messageReply;
      let fileName = args[1] ? args.slice(1).join("_") + ".json" : "api.json";
      const filePath = path.join(pathApi, fileName);
      if (!replyMessage)
        return api.sendMessage("Reply ảnh/video/audio để thêm!", event.threadID);
      if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "[]", "utf-8");
      let msg = [];
      for (let i of replyMessage.attachments) {
        try {
          const { data } = await axios.get(
            `https://catbox-mnib.onrender.com/upload?url=${encodeURIComponent(i.url)}`
          );
          msg.push(data.url);
        } catch {}
      }
      let arr = [];
      try {
        arr = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        if (!Array.isArray(arr)) arr = [];
      } catch { arr = []; }
      const newData = Array.from(new Set([...arr, ...msg]));
      fs.writeFileSync(filePath, JSON.stringify(newData, null, 2), "utf-8");
      api.setMessageReaction("✅", event.messageID, () => {}, true);
      return api.sendMessage(`Đã thêm vào ${fileName} (${newData.length} link)`, event.threadID);
    }

    // Tạo file mới
    if (subCmd === "cr") {
      if (!args[1]) {
        api.setMessageReaction("❎", event.messageID, () => {}, true);
        return api.sendMessage("Nhập tên file!", event.threadID);
      }
      let fileName = args.slice(1).join("_") + ".json";
      const filePath = path.join(pathApi, fileName);
      if (fs.existsSync(filePath)) return api.sendMessage(`File ${fileName} đã tồn tại`, event.threadID);
      fs.writeFileSync(filePath, "[]", "utf-8");
      api.setMessageReaction("✅", event.messageID, () => {}, true);
      return api.sendMessage(`Đã tạo file ${fileName}`, event.threadID);
    }

    // Xóa file
    if (subCmd === "rm") {
      if (!args[1]) {
        api.setMessageReaction("❎", event.messageID, () => {}, true);
        return api.sendMessage("Nhập tên file!", event.threadID);
      }
      let fileName = args.slice(1).join("_") + ".json";
      const filePath = path.join(pathApi, fileName);
      if (!fs.existsSync(filePath)) return api.sendMessage(`File ${fileName} không tồn tại`, event.threadID);
      fs.unlinkSync(filePath);
      api.setMessageReaction("✅", event.messageID, () => {}, true);
      return api.sendMessage(`Đã xóa file ${fileName}`, event.threadID);
    }

    // Share file
    if (subCmd === "gf") {
      if (!args[1]) {
        api.setMessageReaction("❎", event.messageID, () => {}, true);
        return api.sendMessage("Nhập tên file!", event.threadID);
      }
      const fileName = args[1].toLowerCase() + ".json";
      const filePath = path.join(pathApi, fileName);
      if (!fs.existsSync(filePath)) return api.sendMessage(`File ${fileName} không tồn tại!`, event.threadID);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      try {
        const response = await axios.post(
          "https://api.mocky.io/api/mock",
          {
            status: 200,
            content: fileContent,
            content_type: "application/json",
            charset: "UTF-8",
            secret: "NguyenMinhHuy",
            expiration: "never",
          }
        );
        api.setMessageReaction("✅", event.messageID, () => {}, true);
        return api.sendMessage(`${fileName}: ${response.data.link}`, event.threadID);
      } catch {
        api.setMessageReaction("❎", event.messageID, () => {}, true);
        return api.sendMessage("Lỗi chia sẻ file!", event.threadID);
      }
    }

    return sendShortMenu();
  } catch (error) {
    api.setMessageReaction("❎", event.messageID, () => {}, true);
    return api.sendMessage(`Đã xảy ra lỗi không mong muốn khi thực thi api: ${error}`, event.threadID);
  }
};

module.exports.handleReply = async ({ api, handleReply, event }) => {
  try {
    const { threadID, body, messageID } = event;
    const { fileListArray, type } = handleReply;
    const args = body.split(" ").filter(Boolean);

    const getPath = (fileName) => path.join(pathApi, fileName + ".json");
    const send = (message) => api.sendMessage(message, threadID);

    if (!args[0]) return;
    // Xoá file
    if (args[0].toLowerCase() === "rm") {
      for (const idx of args.slice(1).map(Number)) {
        if (idx >= 1 && idx <= fileListArray.length) {
          const fileName = fileListArray[idx - 1].fileName;
          const filePath = getPath(fileName);
          if (fs.existsSync(filePath)) {
            fs.unlink(filePath, err => { if (err) console.error(err); });
            api.setMessageReaction("✅", messageID, () => {}, true);
            send(`Đã xóa file ${fileName}`);
          }
        }
      }
    }
    // Tạo file
    else if (args[0].toLowerCase() === "cr") {
      if (!args[1]) {
        api.setMessageReaction("❎", messageID, () => {}, true);
        return send("Nhập tên file!");
      }
      const fileName = args.slice(1).join("_") + ".json";
      const filePath = path.join(pathApi, fileName);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, "[]", "utf-8");
        api.setMessageReaction("✅", messageID, () => {}, true);
        send(`Đã tạo file ${fileName}`);
      } else {
        api.setMessageReaction("❎", messageID, () => {}, true);
        send(`File ${fileName} đã tồn tại`);
      }
    }
    // Share file
    else if (args[0].toLowerCase() === "gf") {
      for (const idx of args.slice(1).map(Number)) {
        if (idx >= 1 && idx <= fileListArray.length) {
          const fileName = fileListArray[idx - 1].fileName;
          const filePath = getPath(fileName);
          if (fs.existsSync(filePath)) {
            try {
              const fileContent = fs.readFileSync(filePath, "utf-8");
              const response = await axios.post(
                "https://api.mocky.io/api/mock",
                {
                  status: 200,
                  content: fileContent,
                  content_type: "application/json",
                  charset: "UTF-8",
                  secret: "NguyenMinhHuy",
                  expiration: "never",
                }
              );
              api.setMessageReaction("✅", messageID, () => {}, true);
              send(`${fileName}: ${response.data.link}`);
            } catch {
              api.setMessageReaction("❎", messageID, () => {}, true);
              send("Lỗi chia sẻ file!");
            }
          }
        }
      }
    }
    // Info
    else if (args[0].toLowerCase() === "info") {
      for (const idx of args.slice(1).map(Number)) {
        if (idx >= 1 && idx <= fileListArray.length) {
          const fileName = fileListArray[idx - 1].fileName;
          const filePath = getPath(fileName);
          if (fs.existsSync(filePath)) {
            const stats = fileStats(filePath);
            let arr = [];
            try {
              arr = JSON.parse(fs.readFileSync(filePath, "utf-8"));
              if (!Array.isArray(arr)) arr = [];
            } catch { arr = []; }
            const msg = `[${fileName}.json]\nSố link: ${stats.count}\nDung lượng: ${(stats.size / 1024).toFixed(2)} KB\nTop 3 link:\n${arr.slice(0, 3).map((l, i) => `${i + 1}. ${l}`).join("\n") || "Không có link!"}\nĐường dẫn: ${filePath}`;
            api.setMessageReaction("🔎", messageID, () => {}, true);
            send(msg);
          }
        }
      }
    }
    // Checklive
    else if (args[0].toLowerCase() === "checklive") {
      for (const idx of args.slice(1).map(Number)) {
        if (idx >= 1 && idx <= fileListArray.length) {
          const fileName = fileListArray[idx - 1].fileName;
          const filePath = getPath(fileName);
          if (fs.existsSync(filePath)) {
            api.setMessageReaction("⌛", messageID, () => {}, true);
            let arr = [];
            try {
              arr = JSON.parse(fs.readFileSync(filePath, "utf-8"));
              if (!Array.isArray(arr)) arr = [];
            } catch { arr = []; }
            let live = [];
            for (const link of arr) {
              try {
                const response = await axios.head(link);
                if (response && response.status !== 404) live.push(link);
              } catch {}
            }
            api.setMessageReaction("✅", messageID, () => {}, true);
            send(`Link sống: ${live.length}/${arr.length}\n${live.slice(0, 5).join("\n")}${live.length > 5 ? `\n...` : ""}`);
          }
        }
      }
    }
    // Checkdie
    else if (args[0].toLowerCase() === "checkdie") {
      for (const idx of args.slice(1).map(Number)) {
        if (idx >= 1 && idx <= fileListArray.length) {
          const fileName = fileListArray[idx - 1].fileName;
          const filePath = getPath(fileName);
          if (fs.existsSync(filePath)) {
            api.setMessageReaction("⌛", messageID, () => {}, true);
            let arr = [];
            try {
              arr = JSON.parse(fs.readFileSync(filePath, "utf-8"));
              if (!Array.isArray(arr)) arr = [];
            } catch { arr = []; }
            let die = [];
            for (const link of arr) {
              try {
                const response = await axios.head(link);
                if (response.status === 404) die.push(link);
              } catch { die.push(link); }
            }
            api.setMessageReaction("✅", messageID, () => {}, true);
            send(`Link die: ${die.length}/${arr.length}\n${die.slice(0, 5).join("\n")}${die.length > 5 ? `\n...` : ""}\nThả cảm xúc để xóa link die`);
            if (die.length) {
              global.client.handleReaction.push({
                name: module.exports.config.name,
                messageID,
                author: event.senderID,
                type: "checkdie",
                linkk: die,
                filePath,
              });
            }
          }
        }
      }
    }
  } catch (err) {
    api.setMessageReaction("❎", event.messageID, () => {}, true);
    send(`Đã xảy ra lỗi khi thực thi menu api, lỗi: ${err}`);
  }
};

module.exports.handleReaction = async function ({ api, event, handleReaction }) {
  if (event.userID != handleReaction.author) return;
  try {
    const { filePath, linkk } = handleReaction;
    if (filePath && Array.isArray(linkk) && linkk.length > 0) {
      let arr = [];
      try {
        arr = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        if (!Array.isArray(arr)) arr = [];
      } catch { arr = []; }
      const before = arr.length;
      arr = arr.filter((link) => !linkk.includes(link));
      fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), "utf-8");
      const deleted = before - arr.length;
      api.sendMessage(`Đã xóa ${deleted} link die`, event.threadID);
    }
  } catch (err) {
    api.sendMessage(`Lỗi khi xóa link die: ${err}`, event.threadID);
  }
};