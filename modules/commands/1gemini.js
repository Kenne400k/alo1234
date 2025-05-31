const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "gemini",
  version: "2.0.0",
  hasPermssion: 0,
  credits: "Kenne400k",
  description: "Hỏi Gemini AI Google (flash API), hỗ trợ cả ảnh và phân tích hình ảnh.",
  commandCategory: "AI",
  usages: "[câu hỏi] hoặc reply ảnh + [câu hỏi]\nVí dụ: gemini Phân tích ảnh này là gì?",
  cooldowns: 4,
};

const GEMINI_API_KEY = "AIzaSyBRS5q0W9czyKuquLZ9-Ls-zZTVPaqR0qg";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

function imageToBase64(filePath) {
  return fs.readFileSync(filePath, { encoding: "base64" });
}

function getImageMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if ([".jpg", ".jpeg"].includes(ext)) return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function geminiVisionRequest({ prompt, imagePath }) {
  const mimeType = getImageMimeType(imagePath);
  const imgBase64 = imageToBase64(imagePath);
  const reqBody = {
    contents: [
      {
        parts: [
          { text: prompt || "Phân tích nội dung ảnh này." },
          {
            inline_data: {
              mime_type: mimeType,
              data: imgBase64
            }
          }
        ]
      }
    ]
  };
  const { data } = await axios.post(GEMINI_API_URL, reqBody, {
    headers: { "Content-Type": "application/json" }
  });
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "[Gemini] Không nhận được phản hồi phân tích ảnh.";
}

async function geminiTextRequest(prompt) {
  const reqBody = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ]
  };
  const { data } = await axios.post(GEMINI_API_URL, reqBody, {
    headers: { "Content-Type": "application/json" }
  });
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "[Gemini] Không có phản hồi từ AI.";
}

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, messageReply, senderID } = event;
  const prompt = args.join(" ") || "";

  // Nếu reply ảnh thì lấy ảnh đó, nếu không thì chỉ text
  let imgUrl = null;
  if (
    messageReply &&
    messageReply.attachments &&
    messageReply.attachments.length > 0 &&
    messageReply.attachments[0].type === "photo"
  ) {
    imgUrl = messageReply.attachments[0].url;
  }

  if (imgUrl) {
    // Download ảnh về cache
    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    const imgPath = path.join(cacheDir, `${Date.now()}-${senderID}.jpg`);
    try {
      const res = await axios.get(imgUrl, { responseType: "arraybuffer" });
      fs.writeFileSync(imgPath, res.data);

      // Gửi trạng thái chờ
      api.sendMessage("🖼️ Đang gửi ảnh lên Gemini AI để phân tích...", threadID, async (err, info) => {
        try {
          const result = await geminiVisionRequest({ prompt: prompt || "Phân tích nội dung ảnh này.", imagePath: imgPath });
          api.sendMessage(`🤖 Gemini trả lời:\n${result}`, threadID, () => {
            try { fs.unlinkSync(imgPath); } catch (e) {}
          }, messageID);
        } catch (e) {
          api.sendMessage("[Gemini] Lỗi khi gửi ảnh tới AI: " + e.message, threadID, messageID);
        }
      }, messageID);
    } catch (e) {
      return api.sendMessage("[Gemini] Không thể tải ảnh về: " + e.message, threadID, messageID);
    }
  } else if (prompt.length > 0) {
    // Chỉ hỏi text Gemini
    api.sendMessage("🤖 Đang hỏi Gemini AI...", threadID, async (err, info) => {
      try {
        const result = await geminiTextRequest(prompt);
        api.sendMessage(`🤖 Gemini trả lời:\n${result}`, threadID, messageID);
      } catch (e) {
        api.sendMessage("[Gemini] Lỗi khi hỏi AI: " + e.message, threadID, messageID);
      }
    }, messageID);
  } else {
    api.sendMessage(
      "💡 Dùng:\n- gemini <nội dung câu hỏi>\n- Hoặc reply ảnh + gemini <câu hỏi muốn phân tích ảnh>\nVí dụ: gemini Phân tích ảnh này là gì?",
      threadID,
      messageID
    );
  }
};