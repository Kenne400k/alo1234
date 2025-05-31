const axios = require('axios');
const BASE_URL = 'http://dongdev.click/api/down/media';

exports.config = {
  name: "autodown",
  version: "1.0.1",
  hasPermssion: 2,
  credits: "DongDev",
  description: "Autodown Facebook, Tiktok, YouTube, Instagram, Bilibili, Douyin, Capcut, Threads",
  commandCategory: "Tiện ích",
  usages: "[]",
  cooldowns: 5
};

exports.handleEvent = async ({ api, event }) => {
  if (event.senderID == api.getCurrentUserID() || !event.args || !Array.isArray(event.args)) return;

  const send = (msg) => api.sendMessage(msg, event.threadID, event.messageID);
  const head = (app) => `[ 𝐀𝐔𝐓𝐎𝐃𝐎𝐖𝐍 ${app} ]\n────────────────`;

  // Helper for streaming media
  async function stream(url, ext = 'jpg') {
    try {
      const res = await axios.get(url, { responseType: 'stream' });
      res.data.path = `tmp.${ext}`;
      return res.data;
    } catch (e) {
      return null;
    }
  }

  for (const url of event.args) {
    // Facebook
    if (/(^https:\/\/)(\w+\.|m\.)?(facebook|fb)\.(com|watch)\//.test(url)) {
      try {
        const res = (await axios.get(`${BASE_URL}?url=${encodeURIComponent(url)}`)).data;
        if (res.attachments && res.attachments.length > 0) {
          let attachment = [];
          if (res.queryStorieID) {
            const match = res.attachments.find(item => item.id == res.queryStorieID);
            if (match) {
              if (match.type === 'Video') {
                const videoUrl = match.url.hd || match.url.sd || match.url;
                if (videoUrl) attachment.push(await stream(videoUrl, 'mp4'));
              } else if (match.type === 'Photo') {
                if (match.url) attachment.push(await stream(match.url, 'jpg'));
              }
            }
          } else {
            for (const attachmentItem of res.attachments) {
              if (attachmentItem.type === 'Video') {
                const videoUrl = attachmentItem.url.hd || attachmentItem.url.sd || attachmentItem.url;
                if (videoUrl) attachment.push(await stream(videoUrl, 'mp4'));
              } else if (attachmentItem.type === 'Photo') {
                if (attachmentItem.url) attachment.push(await stream(attachmentItem.url, 'jpg'));
              }
            }
          }
          send({
            body: `${head('𝐅𝐀𝐂𝐄𝐁𝐎𝐎𝐊')}\n⩺ Tiêu đề: ${res.message || "Không có tiêu đề"}\n${res.like ? `⩺ Lượt thích: ${res.like}\n` : ''}${res.comment ? `⩺ Bình luận: ${res.comment}\n` : ''}${res.share ? `⩺ Chia sẻ: ${res.share}\n` : ''}⩺ Tác giả: ${res.author || "unknown"}`,
            attachment
          });
        }
      } catch (err) {
        send({ body: "Lỗi tải Facebook: " + err.message });
      }
    }
    // Other platforms
    else if (/^(https:\/\/)(www\.|wt\.|vm\.|m\.|web\.|v\.|mobile\.)?(tiktok\.com|t\.co|twitter\.com|youtube\.com|instagram\.com|bilibili\.com|douyin\.com|capcut\.com|threads\.net)\//.test(url)) {
      try {
        const platform =
          /tiktok\.com/.test(url) ? '𝐓𝐈𝐊𝐓𝐎𝐊' :
          /twitter\.com|t\.co/.test(url) ? '𝐓𝐖𝐈𝐓𝐓𝐄𝐑' :
          /youtube\.com/.test(url) ? '𝐘𝐎𝐔𝐓𝐔𝐁𝐄' :
          /instagram\.com/.test(url) ? '𝐈𝐍𝐒𝐓𝐀𝐆𝐑𝐀𝐌' :
          /bilibili\.com/.test(url) ? '𝐁𝐈𝐋𝐈𝐁𝐈𝐋𝐈' :
          /douyin\.com/.test(url) ? '𝐃𝐎𝐔𝐘𝐈𝐍' :
          /threads\.net/.test(url) ? '𝐓𝐇𝐑𝐄𝐀𝐃𝐒' :
          /capcut\.com/.test(url) ? '𝐂𝐀𝐏𝐂𝐔𝐓' : 'UNKNOWN';

        const res = (await axios.get(`${BASE_URL}?url=${encodeURIComponent(url)}`)).data;
        let attachments = [];
        if (res.attachments && res.attachments.length > 0) {
          for (const at of res.attachments) {
            if (at.type === 'Video') {
              if (at.url) attachments.push(await stream(at.url, 'mp4'));
            } else if (at.type === 'Photo') {
              if (at.url) attachments.push(await stream(at.url, 'jpg'));
            } else if (at.type === 'Audio') {
              if (at.url) attachments.push(await stream(at.url, 'mp3'));
            }
          }
          send({
            body: `${head(platform)}\n⩺ Tiêu đề: ${res.message || "Không có tiêu đề"}`,
            attachment: attachments
          });
        }
      } catch (err) {
        send({ body: `Lỗi tải ${url}: ` + err.message });
      }
    }
  }
};

exports.run = async () => {};