module.exports.config = {
    name: 'instagram',
    version: '1.1.2',
    hasPermssion: 0,
    credits: '',
    description: 'Tiện ích về Instagram',
    commandCategory: 'ADMIN',
    usages: '<info|image|video|post|music> [link hoặc username]',
    cooldowns: 2,
    dependencies: {
        'image-downloader': '',
        'axios': '',
        'fs-extra': '',
        'request': ''
    }
};

const axios = require("axios");
const fs = require("fs-extra");
const request = require("request");
const downloader = require('image-downloader');

module.exports.run = async function({ api, event, args }) {
  try {
    const { threadID, messageID, senderID, body } = event;
    const cmd = (args[0] || '').toLowerCase();

    switch (cmd) {
      case "info":
      case "i": {
        const username = args[1];
        if (!username) return api.sendMessage("Vui lòng nhập username Instagram.", threadID, messageID);

        const res = await axios.get(`https://nguyenlienmanh.com/instagram/info?username=${encodeURIComponent(username)}`);
        if (!res.data || !res.data.data) return api.sendMessage("Không tìm thấy thông tin hoặc API lỗi!", threadID, messageID);

        const picUrl = res.data.data.picture;
        const filePath = __dirname + "/cache/ins.png";
        const callback = () => api.sendMessage({
          body: `📸 Name: ${res.data.data.fullname}\n👤 Username: ${res.data.data.username}\n🔒 Trang riêng tư: ${res.data.data.private}\n🆔 ID: ${res.data.data.id}\n👥 Followers: ${res.data.data.followers}\n👣 Đang theo dõi: ${res.data.data.following}\n📷 Bài đăng: ${res.data.data.post_cout}\n🌐 Web: ${res.data.data.website}\n📝 Bio: ${res.data.data.bio}`,
          attachment: fs.createReadStream(filePath)
        }, threadID, () => fs.unlinkSync(filePath), messageID);

        request(encodeURI(`${picUrl}`)).pipe(fs.createWriteStream(filePath)).on('close', callback);
        break;
      }

      case "post":
      case "p": {
        const link = args[1];
        if (!link) return api.sendMessage("Vui lòng nhập link bài post.", threadID, messageID);

        const res = await axios.get(`https://nguyenlienmanh.com/instagram/videodl?url=${encodeURIComponent(link)}`);
        if (!res.data || !res.data.images) return api.sendMessage("Không tìm thấy ảnh hoặc API lỗi!", threadID, messageID);
        const url = res.data.images[0].image_versions2.candidates[0].url;
        const filePath = __dirname + "/cache/insta.png";
        const callback = () => api.sendMessage({
          body: `Tên: ${res.data.user_full_name} ( ${res.data.username} )\nTiêu đề: ${res.data.title}\nCMT: ${res.data.comment_count}\nLIKE: ${res.data.like_count}\nAuthor: ${res.data.author}`,
          attachment: fs.createReadStream(filePath)
        }, threadID, () => fs.unlinkSync(filePath), messageID);

        request(encodeURI(`${url}`)).pipe(fs.createWriteStream(filePath)).on('close', callback);
        break;
      }

      case "video":
      case "v": {
        const link_video = args[1];
        if (!link_video) return api.sendMessage("Vui lòng nhập link video Instagram.", threadID, messageID);

        const data = (await axios.get(`https://nguyenlienmanh.com/instagram/videodl?url=${encodeURIComponent(link_video)}`)).data;
        if (!data.video_versions) return api.sendMessage("Không lấy được video!", threadID, messageID);
        const buffer = (await axios.get(data.video_versions[0].url, { responseType: 'arraybuffer' })).data;
        const path = __dirname + '/cache/insta.mp4';

        fs.writeFileSync(path, buffer);
        api.sendMessage({
          body: `🎬 Video Instagram của bạn đây:`,
          attachment: fs.createReadStream(path)
        }, threadID, () => fs.unlinkSync(path), messageID);
        break;
      }

      case "music":
      case "a":
      case "m": {
        const link_video = args[1];
        if (!link_video) return api.sendMessage("Vui lòng nhập link video Instagram.", threadID, messageID);

        const data = (await axios.get(`https://nguyenlienmanh.com/instagram/videodl?url=${encodeURIComponent(link_video)}`)).data;
        if (!data.music_metadata || !data.music_metadata.original_sound_info || !data.music_metadata.original_sound_info.progressive_download_url)
          return api.sendMessage("Không lấy được link audio!", threadID, messageID);

        const buffer = (await axios.get(data.music_metadata.original_sound_info.progressive_download_url, { responseType: 'arraybuffer' })).data;
        const path = __dirname + '/cache/insta.mp3';

        fs.writeFileSync(path, buffer);
        api.sendMessage({
          body: `🎵 Audio Instagram`,
          attachment: fs.createReadStream(path)
        }, threadID, () => fs.unlinkSync(path), messageID);
        break;
      }

      case "basil": {
        const link_post = args[1];
        if (!link_post || !link_post.startsWith('https://www.instagram.com/p/'))
          return api.sendMessage('Link bài đăng không hợp lệ', threadID, messageID);

        axios.get(`https://nguyenlienmanh.com/instagram/videodl?url=${encodeURIComponent(link_post)}`)
          .then(async success => {
            const info = success.data;
            const body = `Tên: ${info.user_full_name} ( ${info.username} )\nTiêu Đề: ${info.title}\nCMT: ${info.comment_count} bình luận\nLIKE: ${info.like_count} lượt\nTổng ảnh của bài viết: ${info.carousel_media_count} ảnh`;
            const allImage = info.images.map(el => el.image_versions2.candidates[0].url);
            let attachment = [];
            for (let i = 0; i < allImage.length; i++) {
              const url = allImage[i];
              const path = `${__dirname}/${i}.jpg`;
              const buffer = (await axios.get(url, { responseType: 'arraybuffer' })).data;
              fs.writeFileSync(path, buffer);
              attachment.push(fs.createReadStream(path));
            }
            api.sendMessage({ body, attachment }, threadID, () => {
              for (let i = 0; i < allImage.length; i++) {
                const path = `${__dirname}/${i}.jpg`;
                if (fs.existsSync(path)) fs.unlinkSync(path);
              }
            });
          })
          .catch(error => {
            console.log(error);
            api.sendMessage("Không lấy được thông tin ảnh!", threadID, messageID);
          });
        break;
      }

      default:
        api.sendMessage(
`==== INSTAGRAM TOOL ====
• info/i [username]: Lấy info user.
• post/p [link]: Ảnh bài post.
• video/v [link]: Tải video.
• music/a/m [link]: Nhạc từ video.
• basil [link IG post]: Toàn bộ ảnh bài post.
VD: instagram info username
VD: instagram video https://...
`, threadID, messageID);
    }
  } catch (e) {
    api.sendMessage(`Đã xảy ra lỗi: ${e.message || e}`, event.threadID, event.messageID);
  }
};