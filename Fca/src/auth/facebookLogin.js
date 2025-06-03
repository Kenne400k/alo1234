const fca = require('fca-unofficial');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const CheckpointHandler = require('./checkpointHandler');

class FacebookLogin {
    constructor() {
        this.checkpointHandler = new CheckpointHandler();
        this.maxRetries = 3;
        this.currentRetry = 0;
    }

    async performLogin(credentials) {
        logger.info('Bắt đầu quá trình đăng nhập Facebook...');
        
        // Skip AppState and go straight to credentials since AppState is causing issues
        const strategies = [
            () => this.loginWithAdvancedCredentials(credentials),
            () => this.loginWithMobileSimulation(credentials),
            () => this.loginWithLegacyMode(credentials),
            () => this.loginWithAppState()  // Try AppState last as fallback
        ];

        for (let i = 0; i < strategies.length; i++) {
            try {
                logger.info(`Thử chiến lược ${i + 1}/${strategies.length}...`);
                const api = await strategies[i]();
                if (api) {
                    logger.info(`Đăng nhập thành công với chiến lược ${i + 1}!`);
                    this.saveAppState(api);
                    return api;
                }
            } catch (error) {
                logger.warn(`Chiến lược ${i + 1} thất bại:`, error.message);
                
                // Handle specific errors
                if (this.isCheckpointError(error)) {
                    return this.handleCheckpointError(error, credentials);
                }
                
                if (this.isCredentialError(error)) {
                    continue; // Try next strategy
                }
                
                // Add delay between strategies
                if (i < strategies.length - 1) {
                    await this.sleep(3000 + Math.random() * 2000);
                }
            }
        }

        throw new Error('Tất cả chiến lược đăng nhập đều thất bại');
    }

    async loginWithAppState() {
        return new Promise((resolve, reject) => {
            try {
                const appstatePath = path.join(process.cwd(), 'appstate.json');
                if (!fs.existsSync(appstatePath)) {
                    throw new Error('Không có appstate file');
                }

                const appstate = JSON.parse(fs.readFileSync(appstatePath, 'utf8'));
                if (!appstate || !Array.isArray(appstate) || appstate.length === 0) {
                    throw new Error('AppState không hợp lệ');
                }

                logger.info('Thử đăng nhập với AppState...');

                const options = {
                    logLevel: 'silent',
                    forceLogin: false,
                    updatePresence: false,
                    selfListen: false,
                    listenEvents: false,
                    autoMarkDelivery: false,
                    autoMarkRead: false,
                    online: false
                };

                fca({ appState: appstate }, options, (err, api) => {
                    if (err) {
                        reject(new Error(`AppState login failed: ${err.error || err.message}`));
                    } else {
                        logger.info('AppState login thành công');
                        resolve(api);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async loginWithAdvancedCredentials(credentials) {
        return new Promise(async (resolve, reject) => {
            logger.info('Đăng nhập với advanced credentials...');
            
            // Randomize timing to appear more human
            await this.sleep(1000 + Math.random() * 2000);

            const loginData = {
                email: credentials.email,
                password: credentials.password
            };

            const options = this.generateAdvancedOptions();

            fca(loginData, options, (err, api) => {
                if (err) {
                    this.handleLoginError(err, credentials, resolve, reject);
                } else {
                    logger.info('Advanced credentials login thành công');
                    resolve(api);
                }
            });
        });
    }

    async loginWithMobileSimulation(credentials) {
        return new Promise(async (resolve, reject) => {
            logger.info('Đăng nhập như mobile device...');
            
            await this.sleep(2000 + Math.random() * 1500);

            const loginData = {
                email: credentials.email,
                password: credentials.password
            };

            const mobileOptions = {
                logLevel: 'silent',
                forceLogin: false,
                updatePresence: false,
                selfListen: false,
                listenEvents: false,
                autoMarkDelivery: false,
                autoMarkRead: false,
                online: false,
                userAgent: this.getRandomMobileUserAgent(),
                pauseLog: true
            };

            fca(loginData, mobileOptions, (err, api) => {
                if (err) {
                    this.handleLoginError(err, credentials, resolve, reject);
                } else {
                    logger.info('Mobile simulation login thành công');
                    resolve(api);
                }
            });
        });
    }

    async loginWithLegacyMode(credentials) {
        return new Promise(async (resolve, reject) => {
            logger.info('Thử legacy mode login...');
            
            await this.sleep(1500);

            const loginData = {
                email: credentials.email,
                password: credentials.password
            };

            const legacyOptions = {
                logLevel: 'silent',
                forceLogin: true, // Only use force as last resort
                updatePresence: true,
                selfListen: true,
                listenEvents: true,
                userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0'
            };

            fca(loginData, legacyOptions, (err, api) => {
                if (err) {
                    this.handleLoginError(err, credentials, resolve, reject);
                } else {
                    logger.info('Legacy mode login thành công');
                    resolve(api);
                }
            });
        });
    }

    handleLoginError(err, credentials, resolve, reject) {
        // Check for checkpoint/verification errors
        if (this.isCheckpointError(err)) {
            return this.handleCheckpointError(err, credentials, resolve, reject);
        }

        // Check for credential errors
        if (this.isCredentialError(err)) {
            reject(new Error('Thông tin đăng nhập không chính xác'));
            return;
        }

        // Check for rate limiting
        if (this.isRateLimitError(err)) {
            reject(new Error('Facebook đã giới hạn tần suất đăng nhập'));
            return;
        }

        // Generic error
        reject(new Error(`Login failed: ${err.error || err.message}`));
    }

    async handleCheckpointError(err, credentials, resolve, reject) {
        logger.warn('Phát hiện checkpoint, đang xử lý...');
        
        try {
            await this.checkpointHandler.handleCheckpoint(err, credentials, null, resolve, reject);
        } catch (checkpointError) {
            reject(checkpointError);
        }
    }

    generateAdvancedOptions() {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
        ];

        return {
            logLevel: 'silent',
            forceLogin: true,  // Force login to override any cached issues
            updatePresence: true,
            selfListen: false,
            listenEvents: false,
            autoMarkDelivery: false,
            autoMarkRead: false,
            online: true,
            userAgent: userAgents[Math.floor(Math.random() * userAgents.length)]
        };
    }

    getRandomMobileUserAgent() {
        const mobileUserAgents = [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
            'Mozilla/5.0 (Linux; Android 12; SM-A525F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'
        ];
        
        return mobileUserAgents[Math.floor(Math.random() * mobileUserAgents.length)];
    }

    isCheckpointError(err) {
        if (!err) return false;
        
        const checkpointIndicators = [
            'login-approval',
            'checkpoint',
            'verification',
            'security check',
            'verify',
            'approval'
        ];

        const errorStr = (err.error || err.message || '').toLowerCase();
        return checkpointIndicators.some(indicator => errorStr.includes(indicator));
    }

    isCredentialError(err) {
        if (!err) return false;
        
        const credentialErrors = [
            'wrong username/password',
            'incorrect password',
            'invalid credentials',
            'login failed'
        ];

        const errorStr = (err.error || err.message || '').toLowerCase();
        return credentialErrors.some(error => errorStr.includes(error));
    }

    isRateLimitError(err) {
        if (!err) return false;
        
        const rateLimitIndicators = [
            'rate limit',
            'too many requests',
            'temporarily blocked',
            'please try again later'
        ];

        const errorStr = (err.error || err.message || '').toLowerCase();
        return rateLimitIndicators.some(indicator => errorStr.includes(indicator));
    }

    saveAppState(api) {
        try {
            if (api && typeof api.getAppState === 'function') {
                const appState = api.getAppState();
                fs.writeFileSync(path.join(process.cwd(), 'appstate.json'), JSON.stringify(appState, null, 2));
                logger.info('AppState đã được lưu thành công');
            }
        } catch (error) {
            logger.warn('Không thể lưu AppState:', error.message);
        }
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    cleanup() {
        if (this.checkpointHandler) {
            this.checkpointHandler.cleanup();
        }
    }
}

module.exports = FacebookLogin;