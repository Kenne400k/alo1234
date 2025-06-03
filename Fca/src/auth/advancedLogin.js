const fca = require('fca-unofficial');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class AdvancedLogin {
    constructor() {
        this.maxRetries = 5;
        this.baseDelay = 5000;
    }

    async smartLogin(credentials) {
        logger.info('Bắt đầu smart login với nhiều phương pháp...');
        
        const methods = [
            () => this.methodAppState(),
            () => this.methodSlowHuman(credentials),
            () => this.methodMobileFirst(credentials),
            () => this.methodRandomDelay(credentials),
            () => this.methodLegacyMode(credentials)
        ];

        for (let i = 0; i < methods.length; i++) {
            try {
                logger.info(`Thử phương pháp ${i + 1}/${methods.length}...`);
                const api = await methods[i]();
                if (api) {
                    logger.info(`Thành công với phương pháp ${i + 1}!`);
                    return api;
                }
            } catch (error) {
                logger.warn(`Phương pháp ${i + 1} thất bại: ${error.message}`);
                
                // Delay tăng dần giữa các phương pháp
                if (i < methods.length - 1) {
                    const delay = this.baseDelay * (i + 1);
                    logger.info(`Chờ ${delay/1000}s trước khi thử phương pháp tiếp theo...`);
                    await this.sleep(delay);
                }
            }
        }

        throw new Error('Tất cả phương pháp đều thất bại');
    }

    async methodAppState() {
        return new Promise((resolve, reject) => {
            try {
                const appstatePath = path.join(process.cwd(), 'appstate.json');
                if (!fs.existsSync(appstatePath)) {
                    throw new Error('Không có appstate');
                }

                const appstate = JSON.parse(fs.readFileSync(appstatePath, 'utf8'));
                
                fca({ appState: appstate }, {
                    logLevel: 'silent',
                    forceLogin: false,
                    updatePresence: false,
                    selfListen: false
                }, (err, api) => {
                    if (err) reject(err);
                    else resolve(api);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async methodSlowHuman(credentials) {
        // Mô phỏng người dùng thật đang gõ chậm
        logger.info('Mô phỏng hành vi người dùng chậm rãi...');
        
        return new Promise(async (resolve, reject) => {
            // Delay như người thật đang suy nghĩ
            await this.sleep(2000 + Math.random() * 3000);
            
            const humanOptions = {
                logLevel: 'silent',
                forceLogin: false,
                updatePresence: false,
                selfListen: false,
                listenEvents: false,
                autoMarkDelivery: false,
                autoMarkRead: false,
                online: false,
                userAgent: this.getRandomDesktopUA(),
                pauseLog: true
            };

            fca({
                email: credentials.email,
                password: credentials.password
            }, humanOptions, (err, api) => {
                if (err) reject(err);
                else {
                    this.saveAppState(api);
                    resolve(api);
                }
            });
        });
    }

    async methodMobileFirst(credentials) {
        logger.info('Thử đăng nhập như mobile device...');
        
        return new Promise(async (resolve, reject) => {
            await this.sleep(1000 + Math.random() * 2000);
            
            const mobileOptions = {
                logLevel: 'silent',
                forceLogin: false,
                updatePresence: false,
                selfListen: false,
                listenEvents: false,
                autoMarkDelivery: false,
                autoMarkRead: false,
                online: false,
                userAgent: this.getRandomMobileUA(),
                pauseLog: true
            };

            fca({
                email: credentials.email,
                password: credentials.password
            }, mobileOptions, (err, api) => {
                if (err) reject(err);
                else {
                    this.saveAppState(api);
                    resolve(api);
                }
            });
        });
    }

    async methodRandomDelay(credentials) {
        logger.info('Thử với delay ngẫu nhiên...');
        
        return new Promise(async (resolve, reject) => {
            // Delay ngẫu nhiên từ 3-8 giây
            await this.sleep(3000 + Math.random() * 5000);
            
            const randomOptions = {
                logLevel: 'silent',
                forceLogin: false,
                updatePresence: Math.random() > 0.7, // Random presence
                selfListen: false,
                listenEvents: false,
                autoMarkDelivery: false,
                autoMarkRead: false,
                online: Math.random() > 0.5, // Random online status
                userAgent: this.getRandomUA(),
                pauseLog: true
            };

            fca({
                email: credentials.email,
                password: credentials.password
            }, randomOptions, (err, api) => {
                if (err) reject(err);
                else {
                    this.saveAppState(api);
                    resolve(api);
                }
            });
        });
    }

    async methodLegacyMode(credentials) {
        logger.info('Thử với chế độ legacy...');
        
        return new Promise(async (resolve, reject) => {
            await this.sleep(2000);
            
            const legacyOptions = {
                logLevel: 'silent',
                forceLogin: true, // Cuối cùng mới thử force
                updatePresence: true,
                selfListen: true,
                listenEvents: true,
                userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0' // UA cũ
            };

            fca({
                email: credentials.email,
                password: credentials.password
            }, legacyOptions, (err, api) => {
                if (err) reject(err);
                else {
                    this.saveAppState(api);
                    resolve(api);
                }
            });
        });
    }

    getRandomDesktopUA() {
        const desktopUAs = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
        ];
        return desktopUAs[Math.floor(Math.random() * desktopUAs.length)];
    }

    getRandomMobileUA() {
        const mobileUAs = [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
        ];
        return mobileUAs[Math.floor(Math.random() * mobileUAs.length)];
    }

    getRandomUA() {
        return Math.random() > 0.5 ? this.getRandomDesktopUA() : this.getRandomMobileUA();
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    saveAppState(api) {
        try {
            const appState = api.getAppState();
            fs.writeFileSync(path.join(process.cwd(), 'appstate.json'), JSON.stringify(appState, null, 2));
            logger.info('AppState đã được lưu');
        } catch (error) {
            logger.warn('Không thể lưu AppState:', error.message);
        }
    }
}

module.exports = AdvancedLogin;