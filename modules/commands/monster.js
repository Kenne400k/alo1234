const axios = require("axios");

module.exports.config = {
  name: "monster",
  version: "2.5.1",
  hasPermssion: 0,
  credits: "pcoder",
  description: "Monster Hunter cho messenger",
  commandCategory: "game",
  usages: "[tag]",
  cooldowns: 0
};

const monsterData = {
  store: [
    { id: 1, name: "Vũ khí🗡", price: 100 },
    { id: 2, name: "Thức ăn🍗", price: 50 },
    { id: 3, name: "Bán quái vật💵", price: 200 }
  ],
  locations: [
    { id: 1, name: "Rừng Sâu" },
    { id: 2, name: "Hang Động" },
    { id: 3, name: "Đồng Cỏ" }
  ]
};

// Giả lập "database" nhân vật và túi đồ
const playerData = {};
const bagData = {};

function getUserData(uid) {
  if (!playerData[uid]) {
    playerData[uid] = {
      name: uid,
      level: 1,
      hp: 100,
      atk: 10,
      defense: 5,
      weapon: "Gậy Gỗ",
      durability: 100,
      gold: 300
    };
  }
  return playerData[uid];
}
function getBag(uid) {
  if (!bagData[uid]) bagData[uid] = [];
  return bagData[uid];
}

module.exports.onLoad = () => {};

module.exports.run = async function({ api, event, args, Users }) {
  try {
    const { threadID, senderID, messageID } = event;
    const userData = getUserData(senderID);

    switch ((args[0] || "").toLowerCase()) {
      case "create":
        if (userData && userData.level > 1)
          return api.sendMessage("Bạn đã có nhân vật rồi!", threadID, messageID);
        playerData[senderID] = {
          name: Users.getNameUser ? await Users.getNameUser(senderID) : senderID,
          level: 1,
          hp: 100,
          atk: 10,
          defense: 5,
          weapon: "Gậy Gỗ",
          durability: 100,
          gold: 300
        };
        return api.sendMessage("Tạo nhân vật thành công!\nSử dụng `/monster info` để xem thông tin.", threadID, messageID);

      case "info":
        return api.sendMessage(
          `《 THÔNG SỐ NHÂN VẬT 》\nTên: ${userData.name}\nLevel: ${userData.level}\nHP: ${userData.hp}\nTấn công: ${userData.atk}\nPhòng thủ: ${userData.defense}\nVũ khí: ${userData.weapon} (${userData.durability}/100)\nGold: ${userData.gold}`,
          threadID, messageID);

      case "bag":
        const bag = getBag(senderID);
        return api.sendMessage(`Túi đồ của bạn:\n${bag.length ? bag.map((x, i) => `${i + 1}. ${x}`).join("\n") : "Không có vật phẩm nào."}`, threadID, messageID);

      case "shop":
        return api.sendMessage(
          "《 𝐀𝐒𝐓𝐄𝐑𝐀 》\n\n1. Mua vũ khí🗡\n2. Mua thức ăn🍗\n3. Bán quái vật💵\n\n✨Reply theo STT để chọn✨",
          threadID, (err, info) => {
            global.client.handleReply.push({
              name: 'monster',
              messageID: info.messageID,
              author: senderID,
              type: "listItem"
            });
          }, messageID);

      case "fix":
        if (userData.durability == 100)
          return api.sendMessage("Vũ khí đã full độ bền!", threadID, messageID);
        userData.durability = 100;
        return api.sendMessage("Đã sửa vũ khí về 100/100.", threadID, messageID);

      case "match":
      case "fight":
      case "pvp":
        // Đơn giản hóa: random quái, tấn công trừ máu, cộng EXP/vàng
        const monster = { name: "Slime", hp: 50, atk: 5, gold: 40 };
        let log = `Bạn gặp ${monster.name}!\n`;
        let userDmg = Math.max(userData.atk - 2, 1);
        let monDmg = Math.max(monster.atk - userData.defense, 0);
        monster.hp -= userDmg;
        log += `Bạn đánh gây ${userDmg} sát thương.\n`;
        if (monster.hp > 0) {
          userData.hp -= monDmg;
          log += `Quái đánh trả gây ${monDmg} sát thương.\n`;
        }
        if (monster.hp <= 0) {
          userData.gold += monster.gold;
          log += `Bạn đã hạ quái và nhận ${monster.gold} vàng!\n`;
        }
        if (userData.hp <= 0) {
          userData.hp = 100;
          log += "Bạn bị đánh gục, hồi HP về 100!\n";
        }
        return api.sendMessage(log, threadID, messageID);

      case "location":
        return api.sendMessage("Các bãi săn:\n" +
          monsterData.locations.map(x => `${x.id}. ${x.name}`).join("\n"),
          threadID, messageID);

      default:
        return api.sendMessage(
          "《𝐌𝐎𝐍𝐒𝐓𝐄𝐑 𝐇𝐔𝐍𝐓𝐄𝐑》\nCác tag:\n1. Create: tạo nhân vật\n2. Info: xem thông số nhân vật\n3. Shop: mở cửa hàng\n4. Bag: mở túi đồ\n5. Fix: sửa trang bị\n6. Match/pvp/fight: săn quái\n7. Location: chọn bãi săn\n",
          threadID, messageID);
    }
  } catch (e) {
    console.log(e);
  }
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
  try {
    if (handleReply.author != event.senderID) return;

    const userData = getUserData(event.senderID);

    if (handleReply.type == "listItem") {
      const itemID = parseInt(event.body.trim());
      if (isNaN(itemID) || itemID < 1 || itemID > monsterData.store.length)
        return api.sendMessage("Không hợp lệ!", event.threadID, event.messageID);
      const item = monsterData.store[itemID - 1];
      if (userData.gold < item.price)
        return api.sendMessage("Bạn không đủ vàng để mua!", event.threadID, event.messageID);
      userData.gold -= item.price;
      getBag(event.senderID).push(item.name);
      return api.sendMessage(`Đã mua ${item.name}!`, event.threadID, event.messageID);
    }
  } catch (e) { console.log(e); }
};