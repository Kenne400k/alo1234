const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Lấy danh sách video từ file JSON
const urls = require(path.join(__dirname, "../../pdata/data_dongdev/datajson/vdanime.json"));

// Tạo thư mục cache nếu chưa có
const cacheDir = path.join(__dirname, "cache");
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

class Command {
    constructor(config) {
        this.config = config;

        // Khởi tạo global.khanhdayr (cấu trúc cũ) nếu chưa có, để "cho đỡ lỗi" với các module khác có thể còn dùng
        if (!global.khanhdayr) {
            global.khanhdayr = [];
        }

        // Khởi tạo global.pcoder nếu chưa có, sau đó khởi tạo khanhdayr bên trong nó (cấu trúc mới)
        if (!global.pcoder) {
            global.pcoder = {};
        }
        if (!global.pcoder.khanhdayr) {
            global.pcoder.khanhdayr = [];
        }

        this.status = false;
        this.uploadInterval = null;
    }

    async onLoad(o) {
        // Tránh setInterval nhiều lần
        if (this.uploadInterval) return;
        this.uploadInterval = setInterval(async () => {
            // Sử dụng global.pcoder.khanhdayr cho logic của lệnh này
            if (this.status || (global.pcoder && global.pcoder.khanhdayr && global.pcoder.khanhdayr.length > 10)) return;
            this.status = true;
            try {
                // Upload 5 random video lên Facebook CDN mỗi 5s
                const jobs = [];
                for (let i = 0; i < 5; i++) {
                    const randUrl = urls[Math.floor(Math.random() * urls.length)];
                    jobs.push(this.upload(randUrl, o));
                }
                const results = await Promise.all(jobs);
                // Đẩy kết quả vào global.pcoder.khanhdayr
                if (global.pcoder && global.pcoder.khanhdayr) {
                    global.pcoder.khanhdayr.push(...results.filter(Boolean));
                }
            } catch (e) {
                console.error("Upload video lỗi:", e);
            }
            this.status = false;
        }, 1000 * 5);
    }

    async streamURL(url, type = "mp4") {
        // Lấy stream từ URL và xóa file sau 1 phút
        const res = await axios.get(url, { responseType: "arraybuffer" });
        const filePath = path.join(cacheDir, `${Date.now()}_${Math.floor(Math.random() * 9999)}.${type}`);
        fs.writeFileSync(filePath, res.data);
        setTimeout(() => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }, 1000 * 60);
        return fs.createReadStream(filePath);
    }

    async upload(url, o) {
        try {
            const stream = await this.streamURL(url, "mp4");
            const response = await o.api.httpPostFormData(
                "https://upload.facebook.com/ajax/mercury/upload.php",
                { upload_1024: stream }
            );
            const json = JSON.parse(response.replace("for (;;);", ""));
            const meta = json.payload?.metadata?.[0];
            if (!meta) return null;
            const [[, value]] = Object.entries(meta);
            return value;
        } catch (e) {
            // console.error("Lỗi khi upload video:", e); // Có thể bật lại nếu cần debug
            return null;
        }
    }

    async run(o) {
        // Lấy random "thính" từ API
        let thinhMsg = "Không lấy được thính!";
        try {
            const response = await axios.get('https://raw.githubusercontent.com/Sang070801/api/main/thinh1.json');
            const data = response.data;
            if (data && typeof data.data === 'object' && data.data !== null) {
                const thinhArray = Object.values(data.data);
                 if (thinhArray.length > 0) {
                    thinhMsg = thinhArray[Math.floor(Math.random() * thinhArray.length)] || thinhMsg;
                }
            }
        } catch (e) {
            console.error("Lỗi khi lấy thính:", e);
        }

        // Tính uptime
        const t = process.uptime();
        const h = Math.floor(t / 3600);
        const p = Math.floor((t % 3600) / 60);
        const s = Math.floor(t % 60);

        // Lấy video random đã up từ global.pcoder.khanhdayr
        let attachment = [];
        if (global.pcoder && global.pcoder.khanhdayr && global.pcoder.khanhdayr.length > 0) {
            // Lấy URL từ cache CDN và tạo stream để gửi
            const cdnUrl = global.pcoder.khanhdayr.shift();
             if (cdnUrl) { // Đảm bảo cdnUrl không phải undefined
                try {
                    attachment.push(await this.streamURL(cdnUrl));
                } catch (streamError) {
                    console.error("Lỗi tạo stream từ CDN URL đã cache:", streamError, "URL:", cdnUrl);
                    // Nếu lỗi, thử lấy video mới bên dưới
                }
            }
        }
        
        // Nếu không có attachment nào (do cache rỗng hoặc lỗi stream từ cache), thử lấy 1 video mới
        if (attachment.length === 0) {
            try {
                const randUrl = urls[Math.floor(Math.random() * urls.length)];
                if (randUrl) {
                    attachment.push(await this.streamURL(randUrl));
                }
            } catch (e) {
                console.error("Lỗi khi lấy video dự phòng:", e);
            }
        }
        
        const body = `⏰ Thời gian hoạt động: ${h.toString().padStart(2, "0")}:${p.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}\n💌 Thính: ${thinhMsg}`;
        
        try {
            if (attachment.length > 0) {
                await o.api.sendMessage({ body, attachment }, o.event.threadID, o.event.messageID);
            } else {
                // Nếu vẫn không có attachment nào, chỉ gửi body
                await o.api.sendMessage({ body }, o.event.threadID, o.event.messageID);
                console.log("Không có video nào để gửi, đã gửi tin nhắn chỉ có body.");
            }
        } catch (sendMessageError) {
            console.error("Lỗi khi gửi tin nhắn:", sendMessageError);
            // Thử gửi lại chỉ body nếu gửi kèm attachment lỗi
            try {
                await o.api.sendMessage({ body }, o.event.threadID, o.event.messageID);
            } catch (fallbackError) {
                console.error("Lỗi khi gửi tin nhắn fallback (chỉ body):", fallbackError);
            }
        }
    }
}

module.exports = new Command({
    name: "global",
    version: "1.1.2", // Tăng version
    hasPermssion: 2,
    credits: "DC-Nam (fix/cải tiến bởi Kenne401k và bạn)",
    description: "Gửi uptime và random video + thính. Khởi tạo cả global.khanhdayr và global.pcoder.khanhdayr.",
    commandCategory: "Tiện ích",
    usages: "[]",
    cooldowns: 5,
});