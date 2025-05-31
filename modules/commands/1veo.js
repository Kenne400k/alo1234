const fs = require("fs-extra");
const axios = require("axios");
const path = require("path");

module.exports.config = {
  name: "veo",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "pcoder", // Giữ nguyên hoặc cập nhật nếu cần
  description: "Tạo video AI bằng Gemini Veo (Google)", // Sửa "Veo2" thành "Veo" nếu đó là tên chính thức, hoặc giữ nguyên nếu đúng
  commandCategory: "ai",
  usages: "veo [prompt]",
  cooldowns: 15, // Thời gian chờ giữa các lần sử dụng lệnh
  dependencies: {
    "axios": "",
    "fs-extra": ""
  }
};

// Hàm tiện ích để thêm số 0 vào trước số có một chữ số (ví dụ: 7 -> 07)
function pad(num) {
  return num < 10 ? '0' + num : num;
}

module.exports.run = async ({ api, event, args }) => {
  const apikey = ""; // <--- QUAN TRỌNG: THAY API KEY CỦA BẠN Ở ĐÂY
  const prompt = args.join(" ").trim();

  if (!prompt) {
    return api.sendMessage("📝 Vui lòng nhập prompt mô tả video AI muốn tạo.\nVí dụ: veo một chú mèo đang nhảy múa trên cỏ", event.threadID, event.messageID);
  }

  const cacheDir = path.join(__dirname, "cache");
  await fs.ensureDir(cacheDir); // Đảm bảo thư mục 'cache' tồn tại, nếu không thì tạo nó

  const timeStart = Date.now();
  let filePath;
  let waitMsg; // Khai báo waitMsg ở đây để có thể truy cập trong catch block nếu cần

  try {
    waitMsg = await api.sendMessage("🤖 Đang tạo video AI bằng Gemini Veo, vui lòng chờ trong giây lát...", event.threadID);

    // **LƯU Ý QUAN TRỌNG VỀ API GEMINI VEO:**
    // 1. Endpoint URL: 'https://generativelanguage.googleapis.com/v1beta/models/veo:generateVideo'
    //    Cần xác minh lại endpoint chính xác từ tài liệu chính thức của Google cho Gemini Veo.
    //    "veo2" có thể chưa chính xác hoặc là một phiên bản cụ thể.
    // 2. Cấu trúc Request Body:
    //    { prompt: prompt, resolution: "720p", duration_seconds: 8 }
    //    Cấu trúc này có thể cần điều chỉnh theo tài liệu API (ví dụ: các tham số có thể nằm trong một object 'parameters' hoặc 'input').
    // 3. Xác thực: Header 'x-goog-api-key' là phổ biến, nhưng hãy kiểm tra kỹ.
    // 4. Cơ chế hoạt động: API tạo video có thể hoạt động bất đồng bộ (asynchronous).
    //    Tức là, yêu cầu đầu tiên có thể trả về một ID tác vụ (operation ID).
    //    Sau đó, bạn cần dùng ID này để kiểm tra (poll) trạng thái hoàn thành và lấy URL video.
    //    Đoạn code hiện tại giả định API trả về URL video trực tiếp và đồng bộ. Nếu không phải vậy, logic cần thay đổi đáng kể.

    const res = await axios.post("https://generativelanguage.googleapis.com/v1beta/models/veo:generateVideo", { // Giả sử 'veo' là model ID
      prompt: prompt,
      // Các tham số khác có thể cần điều chỉnh dựa trên tài liệu API của Gemini Veo
      // ví dụ:
      // generation_config: {
      //   resolution: "720p",
      //   duration_seconds: 8
      // }
      // Hoặc tương tự
    }, {
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apikey
      },
      timeout: 180000 // Tăng timeout lên 3 phút, tạo video có thể mất thời gian
    });

    // **LƯU Ý VỀ PHẢN HỒI TỪ API:**
    // Cần kiểm tra cấu trúc `res.data` thực tế mà API Gemini Veo trả về.
    // `res.data.videoUrl` là một phỏng đoán. Nó có thể là `res.data.generatedVideo.url`,
    // `res.data.outputs[0].video.url` hoặc một cấu trúc khác.
    if (!res.data || !res.data.videoUrl) { // Cần điều chỉnh dựa trên cấu trúc response thực tế
      if (waitMsg) api.unsendMessage(waitMsg.messageID);
      api.sendMessage("❌ Không nhận được kết quả video từ Gemini. Vui lòng thử lại hoặc kiểm tra API key/quota và cấu trúc phản hồi của API.", event.threadID, event.messageID);
      return;
    }
    const videoUrl = res.data.videoUrl; // Điều chỉnh nếu cần

    // Tải video về
    const fileName = `gemini-veo-${Date.now()}.mp4`;
    filePath = path.join(cacheDir, fileName);
    const writer = fs.createWriteStream(filePath);

    const videoRes = await axios({
      url: videoUrl,
      method: "GET",
      responseType: "stream"
    });

    videoRes.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', (err) => {
        if (waitMsg) api.unsendMessage(waitMsg.messageID);
        reject(err);
      });
    });

    const now = new Date();
    const h = pad(now.getHours());
    const p = pad(now.getMinutes());
    const s = pad(now.getSeconds());
    const gio = now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });


    const body = `🎬 Video AI Gemini Veo ✨
📝 Prompt: ${prompt}
⏰ Thời gian tạo: ${h} giờ ${p} phút ${s} giây
📅 Ngày: ${gio}
⏱️ Xử lý trong: ${(Date.now() - timeStart) / 1000} giây
🤖 Powered by Gemini (Google AI Video)`;

    api.sendMessage({
      body,
      attachment: fs.createReadStream(filePath)
    }, event.threadID, () => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath); // Xóa file sau khi gửi
      }
      if (waitMsg) api.unsendMessage(waitMsg.messageID); // Xóa tin nhắn chờ
    }, event.messageID);

  } catch (e) {
    console.error("Lỗi khi tạo video AI Gemini:", e);
    if (waitMsg) api.unsendMessage(waitMsg.messageID);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // Xóa file tạm nếu có lỗi
    }
    let errMsg = "❌ Đã xảy ra lỗi khi tạo video AI Gemini.";
    if (e.response) {
        // Lỗi từ API của Google
        console.error("API Error Data:", e.response.data);
        console.error("API Error Status:", e.response.status);
        const googleError = e.response.data?.error?.message || "Không có thông điệp lỗi cụ thể từ API.";
        errMsg += `\nLỗi API: ${googleError} (Status: ${e.response.status})`;
        if (e.response.status === 403) {
            errMsg += "\nKiểm tra lại API Key và quyền truy cập Google Cloud Project của bạn.";
        } else if (e.response.status === 400) {
            errMsg += "\nCó thể prompt hoặc các tham số không hợp lệ. Kiểm tra lại tài liệu API.";
        } else if (e.response.status === 429) {
            errMsg += "\nĐã vượt quá giới hạn quota của API. Vui lòng thử lại sau.";
        }
    } else if (e.request) {
        // Yêu cầu đã được thực hiện nhưng không nhận được phản hồi
        errMsg += "\nKhông nhận được phản hồi từ máy chủ API. Kiểm tra kết nối mạng hoặc URL API.";
    } else {
        // Lỗi khác
        errMsg += `\nChi tiết: ${e.message}`;
    }
    api.sendMessage(errMsg, event.threadID, event.messageID);
  }
};