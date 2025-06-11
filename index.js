// Xóa sạch terminal (tương thích đa nền tảng)
process.stdout.write('\x1Bc');

/**
 * Auto-sync & update script for Kenne400k/alo1234
 * Version: 6.0.0
 */
const LOCAL_VERSION = "6.0.0";

const fs = require("fs");
const path = require("path");
const CFonts = require('cfonts');
const chalk = require('chalk');
const axios = require("axios");
const semver = require("semver");
const moment = require("moment-timezone");

const CACHE_SUFFIX = ".sync-cache.json";
const IGNORED_FILE = ".sync-ignore-list.json";

const GITHUB_REPO = "Kenne400k/alo1234";
const GITHUB_BRANCH = "main";
const RAW_PREFIX = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/files/`;
const API_PREFIX = `https://api.github.com/repos/${GITHUB_REPO}/contents/files`;

function readCache(cacheFile) {
  if (!fs.existsSync(cacheFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  } catch (e) {
    return [];
  }
}

function writeCache(cacheFile, files) {
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(files), "utf8");
  } catch (e) {}
}

function readIgnoreList() {
  if (!fs.existsSync(IGNORED_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(IGNORED_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function writeIgnoreList(files) {
  try {
    fs.writeFileSync(IGNORED_FILE, JSON.stringify(files), "utf8");
  } catch (e) {}
}

async function downloadAndSave(remoteFile, RAW_PREFIX, localDir) {
  try {
    const { data: remoteContent } = await axios.get(RAW_PREFIX + remoteFile.name, { responseType: 'arraybuffer' });
    fs.writeFileSync(path.join(localDir, remoteFile.name), Buffer.from(remoteContent));
    console.log(chalk.greenBright(`[SYNC] Đã thêm mới: ${remoteFile.name}`));
  } catch (e) {
    console.log(chalk.redBright(`[SYNC] Lỗi tải file ${remoteFile.name}: ${e.message}`));
  }
}

async function syncOnlyAddNew(localDir, githubDir) {
  const REMOTE_LIST_URL = `${API_PREFIX}/${githubDir}`;
  const RAW_PREFIX_DIR = `${RAW_PREFIX}${githubDir}/`;
  const cacheFile = path.join(localDir, CACHE_SUFFIX);

  let ignoreList = readIgnoreList();

  try {
    console.log(chalk.cyanBright(`[SYNC] Đang kiểm tra và đồng bộ file mới từ GitHub: ${githubDir}`));
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

    const { data: remoteFiles } = await axios.get(REMOTE_LIST_URL, {
      headers: { 'User-Agent': 'mirai-bot-syncmodules' }
    });
    const remoteJsFiles = remoteFiles.filter(f => f.type === "file" && /\.(js|json|ts|cjs|mjs)$/i.test(f.name));
    const localFiles = fs.readdirSync(localDir).filter(f => /\.(js|json|ts|cjs|mjs)$/i.test(f));
    const cachedFiles = readCache(cacheFile);

    const missingFiles = remoteJsFiles.filter(f => !localFiles.includes(f.name));
    const newFiles = missingFiles.filter(f => !cachedFiles.includes(f.name));
    let deletedFiles = missingFiles.filter(f => cachedFiles.includes(f.name));
    deletedFiles = deletedFiles.filter(f => !ignoreList.includes(f.name));

    if (missingFiles.length > 10) {
      console.log(chalk.yellowBright(`[SYNC] Có ${missingFiles.length} lệnh mới (bao gồm ${deletedFiles.length} lệnh đã từng có và ${newFiles.length} lệnh hoàn toàn mới). Bạn có muốn tải về không? (y/n)`));
      process.stdin.setEncoding('utf8');
      await new Promise(resolve => {
        process.stdin.once('data', async (answer) => {
          if (answer.trim().toLowerCase() === 'y') {
            for (const remoteFile of missingFiles) {
              await downloadAndSave(remoteFile, RAW_PREFIX_DIR, localDir);
            }
            console.log(chalk.greenBright(`[SYNC] Đã đồng bộ xong ${missingFiles.length} file mới từ ${githubDir}.`));
          } else {
            console.log(chalk.yellowBright(`[SYNC] Bỏ qua việc tải lệnh mới.`));
          }
          resolve();
        });
      });
    } else {
      for (const remoteFile of newFiles) {
        await downloadAndSave(remoteFile, RAW_PREFIX_DIR, localDir);
      }
      for (const remoteFile of deletedFiles) {
        console.log(
          chalk.yellowBright(`[SYNC] File "${remoteFile.name}" đã từng có ở local nhưng bạn đã xóa. Bạn có muốn tải lại không? (y/n, nhập "nn" để không bao giờ hỏi lại lệnh này)`));
        console.log(
          chalk.yellowBright('[SYNC] Nếu bạn không muốn bị hỏi tải lại lệnh đã xóa, hãy nhập ') +
          chalk.magenta('nn') +
          chalk.yellowBright(' để không tải xuống và không hỏi lại nữa!')
        );
        process.stdin.setEncoding('utf8');
        await new Promise(resolve => {
          process.stdin.once('data', async (answer) => {
            const ans = answer.trim().toLowerCase();
            if (ans === 'y') {
              await downloadAndSave(remoteFile, RAW_PREFIX_DIR, localDir);
            } else if (ans === 'nn') {
              ignoreList.push(remoteFile.name);
              writeIgnoreList(ignoreList);
              console.log(chalk.gray(`[SYNC] File "${remoteFile.name}" đã được thêm vào danh sách không hỏi lại.`));
            } else {
              console.log(chalk.yellowBright(`[SYNC] Bỏ qua: ${remoteFile.name}`));
            }
            resolve();
          });
        });
      }
      if (missingFiles.length === 0) {
        console.log(chalk.yellowBright(`[SYNC] Không có file mới nào trong ${githubDir}.`));
      } else {
        console.log(chalk.greenBright(`[SYNC] Đã đồng bộ xong ${newFiles.length} file mới từ ${githubDir}.`));
      }
    }

    writeCache(cacheFile, Array.from(new Set([...localFiles, ...missingFiles.map(f => f.name)])));

  } catch (err) {
    console.log(chalk.redBright(`[SYNC] Lỗi đồng bộ ${githubDir}: ${err.message}`));
  }
}

async function syncModulesAndEventsWithPrompt() {
  process.stdin.setEncoding('utf8');
  console.log(chalk.cyanBright(`[SYNC] Bạn có muốn đồng bộ thư mục modules/commands và modules/events từ GitHub không? (y/n)`));
  return new Promise((resolve) => {
    process.stdin.once('data', async (answer) => {
      const ans = answer.trim().toLowerCase();
      if (ans === 'y') {
        await syncOnlyAddNew(path.join(__dirname, "modules", "commands"), "modules/commands");
        await syncOnlyAddNew(path.join(__dirname, "modules", "events"), "modules/events");
        resolve(true);
      } else {
        console.log(chalk.yellowBright(`[SYNC] Đã bỏ qua đồng bộ modules/commands và modules/events.`));
        resolve(false);
      }
    });
  });
}

// BANNER THÔNG BÁO UPDATE
async function showUpdatingBanner(type, oldVer, newVer, fileName) {
  const boxen = (await import('boxen')).default;
  const CFonts = require('cfonts');
  let color = '#00c3ff', icon = '⬆️', label = 'CẬP NHẬT';
  if (type === 'main') { color = '#ff8800'; icon = '🛠️'; label = 'UPDATE MAIN.JS'; }
  if (type === 'index') { color = '#ff00cc'; icon = '✨'; label = 'UPDATE INDEX.JS'; }
  if (type === 'version') { color = '#ffd700'; icon = '🚀'; label = 'ĐỒNG BỘ PHIÊN BẢN'; }

  if (type === 'index') {
    CFonts.say('UPDATE', {
      font: 'block',
      align: 'center',
      colors: ['magenta', 'cyan'],
      background: 'transparent'
    });
  }
  const banner =
    chalk.hex(color)(`
${icon}  ${label}
─────────────────────────────
${chalk.white('Tệp: ')}${chalk.yellow.bold(fileName)}
${chalk.white('Phiên bản cũ: ')}${chalk.redBright(oldVer)}
${chalk.white('Phiên bản mới: ')}${chalk.greenBright(newVer)}
─────────────────────────────
${chalk.cyanBright('Đang tiến hành cập nhật, vui lòng chờ...')}
`);
  console.log(
    boxen(banner, {
      padding: 1,
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
      borderStyle: 'doubleSingle',
      borderColor: color,
      backgroundColor: '#1a1a1a',
      title: chalk.bgHex(color).white.bold(`  ${label.toUpperCase()}  `),
      titleAlignment: 'center'
    })
  );
  await new Promise(r => setTimeout(r, 5000));
}

// TỰ ĐỘNG ĐỒNG BỘ FILE PHIÊN BẢN (version.json) VÀ TOÀN BỘ CODE (TRỪ MODULES)
async function autoUpdateByVersionJson() {
  try {
    const GITHUB_VERSION_URL = `${RAW_PREFIX}version.json`;
    const LOCAL_VERSION_FILE = path.join(__dirname, "version.json");
    const { data: remoteVerJson } = await axios.get(GITHUB_VERSION_URL, { timeout: 7000 });
    let localVerJson = {};
    if (fs.existsSync(LOCAL_VERSION_FILE)) {
      localVerJson = JSON.parse(fs.readFileSync(LOCAL_VERSION_FILE, 'utf8'));
    }
    if (JSON.stringify(remoteVerJson) !== JSON.stringify(localVerJson)) {
      await showUpdatingBanner('version', JSON.stringify(localVerJson), JSON.stringify(remoteVerJson), 'version.json');
      const { data: rootFiles } = await axios.get(API_PREFIX);
      for (const f of rootFiles) {
        if (f.type === "file" && !/^modules\//.test(f.name) && !/^modules$/.test(f.name)) {
          const content = await axios.get(RAW_PREFIX + f.name, { responseType: 'arraybuffer' }).then(r => r.data).catch(() => null);
          if (content) fs.writeFileSync(path.join(__dirname, f.name), Buffer.from(content));
        }
        if (f.type === "dir" && !/^modules$/.test(f.name)) {
          const { data: subFiles } = await axios.get(`${API_PREFIX}/${f.name}`);
          for (const sub of subFiles) {
            if (sub.type === "file") {
              const content = await axios.get(RAW_PREFIX + f.name + "/" + sub.name, { responseType: 'arraybuffer' }).then(r => r.data).catch(() => null);
              if (content) {
                const dir = path.join(__dirname, f.name);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(path.join(dir, sub.name), Buffer.from(content));
              }
            }
          }
        }
      }
      fs.writeFileSync(LOCAL_VERSION_FILE, JSON.stringify(remoteVerJson, null, 2));
      console.log(chalk.bgGreen.white(`[SYNC-ALL] Hoàn thành replace toàn bộ file.`));
    }
  } catch (err) {
    console.log(chalk.redBright(`[SYNC-ALL] Lỗi kiểm tra version tổng thể: ${err.message}`));
  }
}

// TỰ ĐỘNG KIỂM TRA & UPDATE main.js
async function autoUpdateMainJs() {
  const MAIN_LOCAL_VERSION = "1.0.0"; // Version main.js bạn yêu cầu
  const GITHUB_MAIN_RAW_URL = `${RAW_PREFIX}main.js`;
  try {
    const { data: remoteSource } = await axios.get(GITHUB_MAIN_RAW_URL, { timeout: 7000 });
    const m = remoteSource.match(/LOCAL_VERSION\s*=\s*["'`](\d+\.\d+\.\d+)["'`]/i) || remoteSource.match(/version\s*=\s*["'`](\d+\.\d+\.\d+)["'`]/i);
    const remoteVersion = m && m[1] ? m[1] : null;
    if (!remoteVersion) {
      console.log(chalk.yellowBright('[UPDATE] Không xác định được version main.js remote, tiếp tục chạy bản local.'));
    } else if (semver.eq(MAIN_LOCAL_VERSION, remoteVersion)) {
      console.log(chalk.greenBright(`[CHECK] main.js là mới nhất: ${MAIN_LOCAL_VERSION}`));
    } else if (semver.lt(MAIN_LOCAL_VERSION, remoteVersion)) {
      await showUpdatingBanner('main', MAIN_LOCAL_VERSION, remoteVersion, 'main.js');
      fs.writeFileSync(path.join(__dirname, "main.js"), remoteSource, 'utf8');
      console.log(chalk.bgGreen.black(`[THÀNH CÔNG] Đã cập nhật main.js lên bản mới: ${remoteVersion}`));
      const { spawn } = require("child_process");
      spawn(process.argv[0], [path.join(__dirname, "main.js"), ...process.argv.slice(2)], { stdio: "inherit" });
      process.exit(0);
    } else {
      console.log(chalk.yellowBright(`[INFO] main.js local mới hơn remote. Tiếp tục chạy bản local.`));
    }
  } catch (e) {
    console.log(chalk.redBright(`[ERROR] Không thể kiểm tra/cập nhật main.js mới: ${e.message}`));
  }
}

(async () => {
  const boxen = (await import('boxen')).default;
  const chalkAnimation = await import('chalk-animation');

  // Animation khởi động
  const anim = chalkAnimation.default.rainbow('>>> MIRAI đang khởi động... <<<');
  await new Promise(r => setTimeout(r, 3000));
  anim.stop();

  CFonts.say('MIRAI BOT', {
    font: 'block',
    align: 'left',
    colors: ['cyan', 'magenta', 'yellow', 'white', 'blue'],
    background: 'transparent',
    letterSpacing: 2,
    lineHeight: 1,
    space: true,
    maxLength: '0'
  });

  const fb = chalk.hex('#00acee').underline.bold('https://fb.com/pcoder090');
  const zalo = chalk.hex('#25d366').underline.bold('https://zalo.me/0786888655');
  const banner =
    chalk.hex('#FFD700').bold('⚡ MUA FILE BOT - LIÊN HỆ NGAY! ⚡\n') +
    chalk.white('Facebook: ') + fb +
    chalk.hex('#FFD700').bold(' | ') +
    chalk.white('Zalo: ') + zalo +
    ' ' + chalk.redBright('🔥');
  console.log(
    boxen(banner, {
      padding: 1,
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: 'yellow',
      backgroundColor: '#111',
      title: chalk.bgYellow.black('  QUẢNG CÁO  '),
      titleAlignment: 'center'
    })
  );

  // ====== TỰ ĐỘNG ĐỒNG BỘ VERSION (CẬP NHẬT TOÀN BỘ CODE) ======
  await autoUpdateByVersionJson();

  // ====== TỰ ĐỘNG KIỂM TRA & UPDATE main.js ======
  await autoUpdateMainJs();

  // ====== TỰ ĐỘNG KIỂM TRA & UPDATE index.js chính nó ======
  const GITHUB_RAW_URL = `${RAW_PREFIX}index.js`;
  try {
    const { data: remoteSource } = await axios.get(GITHUB_RAW_URL, { timeout: 7000 });
    const m = remoteSource.match(/LOCAL_VERSION\s*=\s*["'`](\d+\.\d+\.\d+)["'`]/i);
    const remoteVersion = m && m[1] ? m[1] : null;
    if (!remoteVersion) {
      console.log(chalk.yellowBright('[UPDATE] Không xác định được version index.js remote, tiếp tục chạy bản local.'));
    } else if (semver.eq(LOCAL_VERSION, remoteVersion)) {
      console.log(chalk.greenBright(`[CHECK] Phiên bản index.js đang dùng là mới nhất: ${LOCAL_VERSION}`));
    } else if (semver.lt(LOCAL_VERSION, remoteVersion)) {
      await showUpdatingBanner('index', LOCAL_VERSION, remoteVersion, 'index.js');
      fs.writeFileSync(__filename, remoteSource, 'utf8');
      console.log(chalk.bgGreen.black(`[THÀNH CÔNG] Đã cập nhật index.js lên bản mới: ${remoteVersion}`));
      const { spawn } = require("child_process");
      spawn(process.argv[0], [__filename, ...process.argv.slice(2)], { stdio: "inherit" });
      process.exit(0);
    } else {
      console.log(chalk.yellowBright(`[INFO] index.js local mới hơn remote. Tiếp tục chạy bản local.`));
    }
  } catch (e) {
    console.log(chalk.redBright(`[ERROR] Không thể kiểm tra/cập nhật index.js mới: ${e.message}`));
  }

  // ---- HỎI NGƯỜI DÙNG ĐỒNG BỘ MODULES ----
  await syncModulesAndEventsWithPrompt();

  // ================= LOGO & INFO =================
  const now = moment().format("YYYY-MM-DD HH:mm:ss");
  console.log(
    chalk.bgRed.white.bold(`  ${now}  `) +
    chalk.bgBlue.white.bold(`  Theme: MIRAI  `) +
    chalk.bgGreen.white.bold(`  Version: ${LOCAL_VERSION}  `) +
    chalk.bgYellow.black.bold(`  PID: ${process.pid}  `)
  );
  console.log(chalk.hex('#FFD700')('='.repeat(50)));
  console.log(chalk.hex('#ff00cc').italic('MiraiBot | PCODER | Chúc bạn một ngày chạy bot vui vẻ!'));
  console.log(chalk.hex('#FFD700')('='.repeat(50)));

  // ========== CHECK PACKAGE & MODULES ==========
  const fancyLog = (type, msg, tag = "") => {
    let icons = { success: '✔', warn: '⚠', error: '✖', info: 'ℹ' };
    let colors = {
      success: chalk.greenBright, warn: chalk.yellowBright,
      error: chalk.redBright, info: chalk.cyanBright
    };
    let icon = colors[type] ? colors[type](icons[type]) : icons.info;
    let tagStr = tag ? chalk.bgHex("#333").white.bold(` ${tag} `) : "";
    let t = chalk.gray(`[${moment().format("HH:mm:ss")}]`);
    if (type === "error")
      console.log(t, icon, tagStr, chalk.red.underline.bold(msg));
    else
      console.log(t, icon, tagStr, colors[type] ? colors[type](msg) : msg);
  };
  fs.readFile('package.json', 'utf8', (err, data) => {
    if (!err) {
      try {
        const packageJson = JSON.parse(data);
        const dependencies = packageJson.dependencies || {};
        const totalDependencies = Object.keys(dependencies).length;
        fancyLog("success", `Tổng package: ${totalDependencies}`, "PACKAGE");
      } catch (_) {}
    }
    try {
      var files = fs.readdirSync('./modules/commands');
      files.forEach(file => { if (file.endsWith('.js')) require(`./modules/commands/${file}`); });
      fancyLog("success", 'Tiến hành check lỗi', 'AUTO-CHECK');
      fancyLog("success", 'Không phát hiện lỗi ở modules', 'AUTO-CHECK');
    } catch (error) {
      fancyLog("error", 'Lỗi ở lệnh:', 'AUTO-CHECK');
      console.log(error);
    }
  });

  // Tiếp tục khởi động bot như cũ
  const { spawn } = require("child_process");
  function startBot(message) {
    if (message) fancyLog("info", message, "BẮT ĐẦU");
    const child = spawn("node", ["--trace-warnings", "--async-stack-traces", "main.js"], {
      cwd: __dirname,
      stdio: "inherit",
      shell: true
    });
    child.on("close", (codeExit) => {
      if (codeExit != 0 || (global.countRestart && global.countRestart < 5)) {
        startBot("Mirai Loading - Đang khởi động lại...");
        global.countRestart = (global.countRestart || 0) + 1;
        return;
      }
    });
    child.on("error", function (error) {
      fancyLog("error", "Lỗi: " + JSON.stringify(error), "BẮT ĐẦU");
    });
  }

  // Đăng nhập Facebook token và các hàm login như cũ...
  // (Giữ nguyên phần đăng nhập của bạn ở đây)
  // ...
})();
