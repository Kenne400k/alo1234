const moment = require('moment-timezone');
const weather = require('weather-js');

module.exports.config = {
  name: 'thoitiet',
  version: '13.1',
  hasPermission: 0,
  credits: 'pcoder',
  description: 'Tự động gửi thời tiết + lời chúc/thính theo từng khung giờ đã định dạng! Gõ "thời tiết" không cần prefix cũng nhận.',
  commandCategory: 'Tiện ích & Admin',
  usages: '[tỉnh/thành phố] (bỏ trống: random)',
  cooldowns: 3,
};

const provinces = [
  "Bắc Ninh", "Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ", "Hải Dương", "Hà Nội",
  "Quảng Ninh", "Thái Bình", "Nam Định", "Ninh Bình", "Thái Nguyên", "Phú Thọ", "Vĩnh Phúc",
  "Bắc Giang", "Lạng Sơn", "Quảng Bình", "Quảng Trị", "Thừa Thiên Huế", "Quảng Nam", "Quảng Ngãi",
  "Bình Định", "Phú Yên", "Khánh Hòa", "Ninh Thuận", "Bình Thuận", "Kon Tum", "Gia Lai", "Đắk Lắk",
  "Đắk Nông", "Lâm Đồng", "Bình Phước", "Tây Ninh", "Bình Dương", "Đồng Nai", "Long An", "Đồng Tháp",
  "Tiền Giang", "An Giang", "Bà Rịa - Vũng Tàu", "Bến Tre", "Bạc Liêu", "Cà Mau", "Hậu Giang",
  "Kiên Giang", "Sóc Trăng", "Trà Vinh", "Vĩnh Long", "Thanh Hóa"
];

const weatherEmoji = {
  Nắng: "☀️",
  Mây: "⛅",
  "Mây một phần": "🌤️",
  "Mây rất nhiều": "🌥️",
  Mưa: "🌧️",
  "Mưa nhẹ": "🌦️",
  Bão: "⛈️",
  Tuyết: "❄️",
  "Sương mù": "🌫️",
  "Trời trong": "🌄",
  "Trời trong rất nhiều": "🌄"
};

const randomMsg = [
  "🌞 Chúc các bạn một ngày mới tràn đầy năng lượng!",
  "💧 Uống nước và bảo vệ sức khoẻ nhé!",
  "💡 Đừng quên nghỉ ngơi hợp lý giữa các giờ làm việc nhé!",
  "🌤️ Chúc mọi người luôn bình an và gặp nhiều may mắn!",
  "☘️ Hãy tận hưởng từng khoảnh khắc của cuộc sống!",
  "🍀 Chúc mọi người có một ngày tuyệt vời!",
  "🌈 Đừng quên mỉm cười bạn nhé!"
];

function skytextToVN(sky) {
  const dic = {
    "Cloudy": "Mây",
    "Sunny": "Nắng",
    "Partly Cloudy": "Mây một phần",
    "Mostly Cloudy": "Mây rất nhiều",
    "Rain": "Mưa",
    "Thunderstorm": "Bão",
    "Snow": "Tuyết",
    "Fog": "Sương mù",
    "Haze": "Sương mù",
    "Clear": "Trời trong",
    "Light Rain": "Mưa nhẹ",
    "Mostly Clear": "Trời trong rất nhiều"
  };
  return dic[sky] || sky;
}
function windToVN(wind) {
  const dic = {
    "Northeast": "Hướng Đông Bắc",
    "Northwest": "Hướng Tây Bắc",
    "Southeast": "Hướng Đông Nam",
    "Southwest": "Hướng Tây Nam",
    "East": "Hướng Đông",
    "West": "Hướng Tây",
    "North": "Hướng Bắc",
    "South": "Hướng Nam"
  };
  return dic[wind] || wind;
}
function dayToVN(day) {
  const dic = {
    "Friday": "Thứ 6",
    "Saturday": "Thứ 7",
    "Sunday": "Chủ nhật",
    "Monday": "Thứ 2",
    "Tuesday": "Thứ 3",
    "Wednesday": "Thứ 4",
    "Thursday": "Thứ 5"
  };
  return dic[day] || day;
}
function formatDate(date) {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return `Ngày ${d}-${m}-${y}`;
}

const scheduleTimes = [
  "00:00:00","00:30:00","01:00:00","01:30:00","02:00:00","02:30:00","03:00:00","03:30:00",
  "04:00:00","04:30:00","05:00:00","05:30:00","06:00:00","06:30:00","07:00:00","07:30:00",
  "08:00:00","08:30:00","09:00:00","09:30:00","10:00:00","10:30:00","11:00:00","11:30:00",
  "12:00:00","12:30:00","13:00:00","13:30:00","14:00:00","14:30:00","15:00:00","15:30:00",
  "16:00:00","16:30:00","17:00:00","17:30:00","18:00:00","18:30:00","19:00:00","19:30:00",
  "20:00:00","20:30:00","21:00:00","21:30:00","22:00:00","22:30:00","23:00:00","23:30:00"
];

const findWeather = (city, degreeType = 'C') => {
  return new Promise((resolve, reject) => {
    weather.find({ search: city, degreeType }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

async function getWeatherMsg(city) {
  let thoitiet = "";
  try {
    const result = await findWeather(city);
    if (!result || !result[0] || !result[0].current) throw new Error("Không lấy được thời tiết");
    const cur = result[0].current;
    const loc = result[0].location;
    const sky = skytextToVN(cur.skytext);
    const eIcon = weatherEmoji[sky] || "🌈";
    const wind = windToVN(cur.winddisplay.split(" ")[2] || "");
    const dayVN = dayToVN(cur.day);
    const dateVN = formatDate(cur.date);
    const gio = moment().tz("Asia/Ho_Chi_Minh").format("HH:mm:ss || DD/MM/YYYY");
    thoitiet = `${eIcon} 𝗨𝗽𝘁𝗶𝗺𝗲: ${gio}
──────────────────
🗺️ Địa điểm: ${loc.name}
🌡 Nhiệt độ: ${cur.temperature}°${loc.degreetype}
🛰  Mô tả: ${sky}
♒ Độ ẩm: ${cur.humidity}%
💨 Gió: ${cur.windspeed} ${wind}
⏰ Ghi nhận vào: ${cur.observationtime}
🗺️ Trạm: ${cur.observationpoint}
📅 ${dayVN} - ${dateVN}
──────────────────
🔄 Đây là tin nhắn tự động cập nhật thời tiết!`;
  } catch (e) {
    thoitiet = "❌ Không lấy được thông tin thời tiết mới nhất!";
  }
  // Thêm chúc random
  const msgChuc = randomMsg[Math.floor(Math.random() * randomMsg.length)];
  return `${thoitiet}\n${msgChuc}`;
}

// Tự động gửi thời tiết theo lịch
module.exports.onLoad = ({ api }) => {
  let lastSentTime = "";
  setInterval(async () => {
    const now = moment().tz('Asia/Ho_Chi_Minh');
    const timeStr = now.format('HH:mm:ss');
    if (scheduleTimes.includes(timeStr) && lastSentTime !== timeStr) {
      lastSentTime = timeStr;
      const allThreads = global.data.allThreadID || [];
      if (!Array.isArray(allThreads) || allThreads.length === 0) return;
      const city = provinces[Math.floor(Math.random() * provinces.length)];
      const msgText = await getWeatherMsg(city);

      for (const tid of allThreads) {
        try {
          await api.sendMessage({ body: msgText }, tid);
        } catch (e) {}
      }
    }
  }, 1000);
};

// Lệnh prefix: thoitiet [tỉnh/thành phố]
module.exports.run = async ({ api, event, args }) => {
  let city = args.join(" ").trim();
  if (!city) city = provinces[Math.floor(Math.random() * provinces.length)];
  const msgText = await getWeatherMsg(city);
  return api.sendMessage(msgText, event.threadID, event.messageID);
};

// Nhận: "thời tiết [tỉnh/thành phố]" hoặc chỉ "thời tiết"
module.exports.handleEvent = async ({ api, event }) => {
  const { body, threadID, messageID, senderID } = event;
  if (!body || senderID == api.getCurrentUserID()) return;
  const text = body.toLowerCase().trim();
  if (text.startsWith("thời tiết ") || text.startsWith("thoi tiet ")) {
    let city = body.substring(text.indexOf(" ") + 1).trim();
    if (!city) city = provinces[Math.floor(Math.random() * provinces.length)];
    const msgText = await getWeatherMsg(city);
    return api.sendMessage(msgText, threadID, messageID);
  }
  if (text === "thời tiết" || text === "thoi tiet") {
    let city = provinces[Math.floor(Math.random() * provinces.length)];
    const msgText = await getWeatherMsg(city);
    return api.sendMessage(msgText, threadID, messageID);
  }
};