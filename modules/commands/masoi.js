const { randomUUID } = require('crypto');
const ROLES = [
    { name: "Sói", emoji: "🐺", team: "sói", desc: "Giết dân mỗi đêm" },
    { name: "Tiên tri", emoji: "🔮", team: "dân", desc: "Mỗi đêm soi 1 người" },
    { name: "Bảo vệ", emoji: "🛡️", team: "dân", desc: "Bảo vệ 1 người/đêm" },
    { name: "Thợ săn", emoji: "🏹", team: "dân", desc: "Chết có thể kéo 1 người chết theo" },
    { name: "Dân làng", emoji: "👨‍🌾", team: "dân", desc: "Không có kỹ năng" }
];
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } }
function getRoleList(n) {
    let roles = ["Sói", "Tiên tri", "Bảo vệ"];
    for (let i = 3; i < n; i++) roles.push("Dân làng");
    return roles;
}
function roleInfo(role) { return ROLES.find(r => r.name == role); }
function getName(id, Users) { return Users && Users.getNameUser ? Users.getNameUser(id) : id; }

class MaSoiGame {
    constructor(threadID, hostID, playerIDs, Users, api) {
        this.id = randomUUID();
        this.threadID = threadID;
        this.hostID = hostID;
        this.playerIDs = playerIDs.slice();
        this.Users = Users;
        this.api = api;
        this.state = "waiting";
        this.roles = {};
        this.alive = playerIDs.slice();
        this.stage = 0;
        this.night = 0;
        this.vote = {};
        this.log = [];
        this.action = {};
        this.lastGuard = null;
        this.hunterDying = false;
        this.init();
    }

    async send(msg, at) {
        try { await this.api.sendMessage(msg, this.threadID, at); } catch (e) { }
    }

    async sendPM(id, msg) {
        try { await this.api.sendMessage(msg, id); } catch (e) { }
    }

    async init() {
        shuffle(this.playerIDs);
        const roles = getRoleList(this.playerIDs.length);
        shuffle(roles);
        this.playerIDs.forEach((id, i) => { this.roles[id] = roles[i]; });
        for (const id of this.playerIDs) {
            const ri = roleInfo(this.roles[id]);
            await this.sendPM(id, `Bạn là ${ri.emoji} ${ri.name} - ${ri.desc}\nGiữ bí mật vai trò của mình!`);
        }
        this.state = "night";
        this.night = 1;
        await this.send(`Bắt đầu game Ma Sói! Đêm 1 bắt đầu...`);
        this.nextNight();
    }

    async nextNight() {
        this.stage = 0;
        this.vote = {};
        this.action = {};
        this.hunterDying = false;
        await this.send(`🌒 Đêm ${this.night} bắt đầu...`);
        // Sói chọn giết
        const wolfIDs = this.alive.filter(id => this.roles[id] == "Sói");
        if (wolfIDs.length > 0) {
            for (const id of wolfIDs) {
                await this.sendPM(id, `Chọn người để giết: reply số thứ tự\n` +
                    this.alive
                        .filter(uid => uid != id)
                        .map((uid, i) => `${i + 1}. ${getName(uid, this.Users)}`).join('\n'));
            }
        }
        // Bảo vệ chọn bảo vệ
        const guardID = this.alive.find(id => this.roles[id] == "Bảo vệ");
        if (guardID) {
            await this.sendPM(guardID, `Chọn người để bảo vệ: reply số thứ tự\n` +
                this.alive.map((uid, i) => `${i + 1}. ${getName(uid, this.Users)}`).join('\n') +
                `\n(Không được bảo vệ 2 lần liên tiếp 1 người)`);
        }
        // Tiên tri soi
        const seerID = this.alive.find(id => this.roles[id] == "Tiên tri");
        if (seerID) {
            await this.sendPM(seerID, `Chọn người để soi: reply số thứ tự\n` +
                this.alive.map((uid, i) => `${i + 1}. ${getName(uid, this.Users)}`).join('\n'));
        }
        this.state = "night";
    }

    async onReply(event) {
        const { senderID, body } = event;
        if (!this.alive.includes(senderID)) return;
        let num = parseInt(body);
        if (isNaN(num) || num < 1 || num > this.alive.length) return;
        const targetID = this.alive[num - 1];
        if (this.state == "night") {
            if (this.roles[senderID] == "Sói") {
                this.action[senderID] = targetID;
                await this.sendPM(senderID, `Đã chọn giết ${getName(targetID, this.Users)}`);
            } else if (this.roles[senderID] == "Bảo vệ") {
                if (this.lastGuard == targetID) {
                    await this.sendPM(senderID, "Không thể bảo vệ 2 đêm liên tiếp 1 người!");
                } else {
                    this.action.guard = targetID;
                    await this.sendPM(senderID, `Đã chọn bảo vệ ${getName(targetID, this.Users)}`);
                }
            } else if (this.roles[senderID] == "Tiên tri") {
                this.action.seer = targetID;
                await this.sendPM(senderID, `Kết quả soi: ${getName(targetID, this.Users)} là ${roleInfo(this.roles[targetID]).emoji} ${roleInfo(this.roles[targetID]).name}`);
            }
            // Nếu mọi người chọn xong
            if (
                this.alive.filter(x => this.roles[x] == "Sói").every(x => this.action[x]) &&
                (!this.alive.some(x => this.roles[x] == "Bảo vệ") || this.action.guard) &&
                (!this.alive.some(x => this.roles[x] == "Tiên tri") || this.action.seer)
            ) {
                setTimeout(() => this.nextDay(), 1000);
            }
        }
        if (this.hunterDying && this.roles[senderID] == "Thợ săn") {
            this.action.hunter_shot = targetID;
            this.hunterDying = false;
            this.kill(targetID, "Bị thợ săn kéo chết");
            setTimeout(() => this.checkWin(), 1000);
        }
    }

    wolfVote() {
        let votes = {};
        for (const id of this.alive.filter(i => this.roles[i] == "Sói")) {
            const target = this.action[id];
            if (target) votes[target] = (votes[target] || 0) + 1;
        }
        let max = 0, maxID = null;
        for (const k in votes) if (votes[k] > max) { max = votes[k]; maxID = k; }
        return maxID;
    }

    async nextDay() {
        this.night++;
        this.state = "day";
        let killID = this.wolfVote();
        if (killID && this.action.guard == killID && this.lastGuard != killID) {
            await this.send(`💤 Đêm qua, có người bị sói tấn công nhưng đã được bảo vệ!`);
            this.lastGuard = this.action.guard;
        } else if (killID && this.alive.includes(killID)) {
            this.alive = this.alive.filter(id => id != killID);
            await this.send(`🌅 Sáng nay phát hiện xác của ${getName(killID, this.Users)} (${roleInfo(this.roles[killID]).emoji} ${roleInfo(this.roles[killID]).name})!`);
            if (this.roles[killID] == "Thợ săn") {
                this.hunterDying = true;
                await this.sendPM(killID, "Bạn là Thợ săn, hãy chọn người để kéo chết theo: reply số thứ tự\n" +
                    this.alive.map((uid, i) => `${i + 1}. ${getName(uid, this.Users)}`).join('\n'));
                return;
            }
            this.lastGuard = this.action.guard;
        } else {
            await this.send("Không ai bị chết đêm qua.");
            this.lastGuard = this.action.guard;
        }
        await this.checkWin();
        if (this.state == "ended") return;
        await this.voteDay();
    }

    async voteDay() {
        this.state = "voteday";
        this.vote = {};
        await this.send(`Bắt đầu bỏ phiếu treo cổ người tình nghi:\n` +
            this.alive.map((uid, i) => `${i + 1}. ${getName(uid, this.Users)}`).join('\n') +
            `\nReply số để bỏ phiếu.`);
    }

    async onVote(event) {
        const { senderID, body } = event;
        if (!this.alive.includes(senderID)) return;
        if (this.state != "voteday") return;
        let num = parseInt(body);
        if (isNaN(num) || num < 1 || num > this.alive.length) return;
        const targetID = this.alive[num - 1];
        this.vote[senderID] = targetID;
        await this.sendPM(senderID, `Bạn đã bỏ phiếu cho ${getName(targetID, this.Users)}`);
        if (Object.keys(this.vote).length == this.alive.length) {
            let votes = {};
            for (const v of Object.values(this.vote)) votes[v] = (votes[v] || 0) + 1;
            let max = 0, maxID = null;
            for (const k in votes) if (votes[k] > max) { max = votes[k]; maxID = k; }
            // Treo cổ
            if (maxID) {
                this.alive = this.alive.filter(id => id != maxID);
                await this.send(`☠️ ${getName(maxID, this.Users)} đã bị treo cổ! (${roleInfo(this.roles[maxID]).emoji} ${roleInfo(this.roles[maxID]).name})`);
                if (this.roles[maxID] == "Thợ săn") {
                    this.hunterDying = true;
                    await this.sendPM(maxID, "Bạn là Thợ săn, hãy chọn người để kéo chết theo: reply số thứ tự\n" +
                        this.alive.map((uid, i) => `${i + 1}. ${getName(uid, this.Users)}`).join('\n'));
                    return;
                }
            }
            await this.checkWin();
            if (this.state != "ended") {
                setTimeout(() => this.nextNight(), 1000);
            }
        }
    }

    kill(id, reason) {
        this.alive = this.alive.filter(i => i != id);
        this.send(`☠️ ${getName(id, this.Users)} đã chết (${reason})!`);
    }

    async checkWin() {
        const wolves = this.alive.filter(id => this.roles[id] == "Sói");
        const others = this.alive.filter(id => this.roles[id] != "Sói");
        if (wolves.length == 0) {
            await this.send("🎉 Dân làng đã chiến thắng!");
            this.state = "ended";
        } else if (wolves.length >= others.length) {
            await this.send("🐺 Sói đã chiến thắng!");
            this.state = "ended";
        }
    }
}

const games = {};

module.exports.config = {
    name: "masoi",
    version: "2.0.0",
    hasPermssion: 0,
    credits: "pcoder",
    description: "Ma Sói messenger real",
    commandCategory: "Game",
    usages: "[tag nhiều người]",
    cooldowns: 3
};

module.exports.onLoad = () => {};

module.exports.handleEvent = async function({ api, event, Users }) {
    if (!event || !event.threadID) return;
    const gid = event.threadID;
    if (games[gid]) {
        const game = games[gid];
        // Reply ban đêm
        if (game.state == "night") {
            if (game.alive.includes(event.senderID) &&
                ["Sói", "Bảo vệ", "Tiên tri"].includes(game.roles[event.senderID])) {
                await game.onReply(event);
            }
        }
        // Thợ săn khi chết
        if (game.hunterDying && game.roles[event.senderID] == "Thợ săn") {
            await game.onReply(event);
        }
        // Vote ban ngày
        if (game.state == "voteday" && game.alive.includes(event.senderID)) {
            await game.onVote(event);
        }
    }
};

module.exports.run = async function({ api, event, Users }) {
    const threadID = event.threadID;
    if (games[threadID]) {
        return api.sendMessage("Đang có game Ma Sói trong nhóm này!", threadID);
    }
    let playerIDs = [];
    if (event.mentions && Object.keys(event.mentions).length >= 4) {
        playerIDs = Object.keys(event.mentions);
        if (!playerIDs.includes(event.senderID))
            playerIDs.unshift(event.senderID);
    } else {
        return api.sendMessage("Tag ít nhất 4 người chơi để bắt đầu!", threadID);
    }
    if (playerIDs.length < 4) return api.sendMessage("Phải có ít nhất 4 người!", threadID);
    const game = new MaSoiGame(threadID, event.senderID, playerIDs, Users, api);
    games[threadID] = game;
    api.sendMessage(
        `Bắt đầu game Ma Sói với ${playerIDs.length} người!\nVai trò: Sói, Tiên tri, Bảo vệ, Thợ săn, Dân làng.\nTin nhắn riêng sẽ báo vai trò cho từng người.\nGame chạy hoàn toàn qua reply tin nhắn nhóm và tin nhắn riêng.`, threadID
    );
};