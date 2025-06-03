const fs = require('fs');
const path = require('path');
const fca = require('fca-unofficial');
const logger = require('../utils/logger');
const storage = require('../utils/storage');
const config = require('../config/config');
const errorHandler = require('../handlers/errorHandler');

class LoginManager {
    constructor() {
        this.appstatePath = './appstate.json';
        this.loginOptions = {
            logLevel: 'silent',
            forceLogin: true,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };
    }

    async loginWithAppstate() {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(this.appstatePath)) {
                reject(new Error('Appstate file not found'));
                return;
            }

            let appState;
            try {
                const appStateData = fs.readFileSync(this.appstatePath, 'utf8');
                appState = JSON.parse(appStateData);
                
                if (!Array.isArray(appState) || appState.length === 0) {
                    logger.warn('Appstate file is empty or invalid, will try credential login');
                    reject(new Error('Appstate is empty - credential login required'));
                    return;
                }
                
                // Validate appstate structure
                if (!this.validateAppstate(appState)) {
                    logger.warn('Appstate format is invalid, will try credential login');
                    reject(new Error('Invalid appstate format - credential login required'));
                    return;
                }
            } catch (error) {
                reject(new Error(`Failed to read appstate: ${error.message}`));
                return;
            }

            logger.info('Attempting login with saved appstate...');

            fca({ appState: appState }, this.loginOptions, (err, api) => {
                if (err) {
                    logger.error('Appstate login failed:', err);
                    
                    // Handle specific error cases
                    if (err.error === 'login-approval' || err.error === 'login') {
                        logger.warn('Appstate expired or invalid, removing file');
                        this.removeAppstate();
                        reject(new Error('Appstate expired - credential login required'));
                    } else {
                        reject(errorHandler.handleLoginError(err));
                    }
                    return;
                }

                logger.info('Appstate login successful');
                this.updateAppstate(api);
                resolve(api);
            });
        });
    }

    async loginWithAppPassword(credentials) {
        return new Promise((resolve, reject) => {
            if (!credentials || !credentials.email || !credentials.appPassword) {
                logger.error('Missing app password credentials:', { email: !!credentials?.email, appPassword: !!credentials?.appPassword });
                reject(new Error('Email và App Password là bắt buộc'));
                return;
            }

            logger.info(`Đang thử đăng nhập với App Password cho: ${credentials.email}`);

            const loginData = {
                email: credentials.email,
                password: credentials.appPassword
            };

            const appPasswordOptions = {
                logLevel: 'silent',
                forceLogin: true,
                updatePresence: false,
                selfListen: false,
                listenEvents: false,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };

            fca(loginData, appPasswordOptions, (err, api) => {
                if (err) {
                    logger.error('App Password login failed:', err);
                    reject(errorHandler.handleLoginError(err));
                    return;
                }

                logger.info('Đăng nhập với App Password thành công!');
                this.saveAppstate(api);
                resolve(api);
            });
        });
    }

    async loginWithCookies(cookiesData) {
        return new Promise((resolve, reject) => {
            if (!cookiesData || !Array.isArray(cookiesData) || cookiesData.length === 0) {
                reject(new Error('Dữ liệu cookies không hợp lệ'));
                return;
            }

            logger.info('Đang thử đăng nhập với cookies từ trình duyệt...');

            const cookieOptions = {
                logLevel: 'silent',
                forceLogin: false,
                updatePresence: false,
                selfListen: false,
                listenEvents: false,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };

            fca({ appState: cookiesData }, cookieOptions, (err, api) => {
                if (err) {
                    logger.error('Cookie login failed:', err);
                    reject(errorHandler.handleLoginError(err));
                    return;
                }

                logger.info('Đăng nhập với cookies thành công!');
                this.saveAppstate(api);
                resolve(api);
            });
        });
    }

    async loginWithCredentials(credentials) {
        return new Promise((resolve, reject) => {
            if (!credentials || !credentials.email || !credentials.password) {
                logger.error('Missing credentials:', { email: !!credentials?.email, password: !!credentials?.password });
                reject(new Error('Email and password are required'));
                return;
            }

            logger.info(`Attempting login with credentials for: ${credentials.email}`);

            const loginData = {
                email: credentials.email,
                password: credentials.password
            };

            // Giả lập hành vi người dùng thật
            const realUserOptions = this.generateRealUserOptions();

            fca(loginData, realUserOptions, (err, api) => {
                if (err) {
                    logger.error('Credential login failed:', err);
                    
                    // Xử lý các trường hợp đặc biệt
                    if (err.error === 'login-approval') {
                        logger.warn('📧 Facebook yêu cầu xác minh email!');
                        logger.info('📮 Mã xác minh đã được gửi đến email của bạn');
                        logger.info('🔗 Link xác minh: ' + (err.continue || 'Kiểm tra email'));
                        logger.info('⏳ Hệ thống đang chờ bạn nhập mã xác minh...');
                        
                        // Gọi hàm xử lý email verification
                        this.handleEmailVerification(err, credentials, resolve, reject);
                        return;
                    } else if (err.error === 'checkpoint') {
                        logger.warn('Facebook phát hiện hoạt động bất thường!');
                        logger.info('Đang thử xử lý checkpoint tự động...');
                        
                        // Thử xử lý checkpoint
                        if (err.continue && typeof err.continue === 'function') {
                            logger.info('Đang xử lý checkpoint...');
                            err.continue((checkpointErr, api) => {
                                if (checkpointErr) {
                                    logger.error('Xử lý checkpoint thất bại:', checkpointErr.message);
                                    reject(new Error('Cần xác minh bảo mật - Vui lòng đăng nhập qua web trước'));
                                } else {
                                    logger.info('Xử lý checkpoint thành công!');
                                    this.saveAppstate(api);
                                    this.saveCookies(api);
                                    resolve(api);
                                }
                            });
                        } else {
                            reject(new Error('Cần xác minh bảo mật - Vui lòng đăng nhập qua web trước'));
                        }
                    } else if (err.error === 'Wrong username/password.') {
                        logger.warn('Sai thông tin đăng nhập!');
                        logger.info('Đang thử các phương pháp khác...');
                        
                        // Thử delay và login lại với headers khác
                        setTimeout(() => {
                            this.retryWithDifferentMethod(credentials, resolve, reject);
                        }, 5000);
                        
                        return;
                    } else {
                        reject(errorHandler.handleLoginError(err));
                    }
                    return;
                }

                logger.info('✅ Đăng nhập thành công!');
                this.saveAppstate(api);
                resolve(api);
            });
        });
    }

    generateRealUserOptions() {
        // Danh sách user agent thực từ các trình duyệt phổ biến
        const realUserAgents = [
            // Chrome Windows
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            // Firefox Windows
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            // Chrome Mac
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            // Safari Mac
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
            // Edge Windows
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
        ];

        const randomUserAgent = realUserAgents[Math.floor(Math.random() * realUserAgents.length)];
        
        return {
            logLevel: 'silent',
            forceLogin: false, // Quan trọng: không force để tránh detection
            updatePresence: false,
            selfListen: false,
            listenEvents: false,
            autoMarkDelivery: false,
            autoMarkRead: false,
            online: false, // Offline mode để ít bị phát hiện
            userAgent: randomUserAgent,
            // Thêm delay tự nhiên
            pauseLog: true,
            // Simulation options
            pageID: null
        };
    }

    async retryWithDifferentMethod(credentials, resolve, reject) {
        logger.info('Thử với phương pháp mô phỏng browser thật...');
        
        // Delay để mô phỏng thời gian người dùng thật
        await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
        
        const browserSimOptions = this.generateBrowserSimulationOptions();
        
        const loginData = {
            email: credentials.email,
            password: credentials.password
        };

        fca(loginData, browserSimOptions, (err, api) => {
            if (err) {
                logger.error('Browser simulation thất bại:', err.error || err.message);
                
                // Thử với mobile simulation
                this.tryMobileSimulation(credentials, resolve, reject);
            } else {
                logger.info('Đăng nhập thành công với browser simulation!');
                this.saveAppstate(api);
                this.saveCookies(api);
                resolve(api);
            }
        });
    }

    generateBrowserSimulationOptions() {
        // Mô phỏng Chrome trên Windows với fingerprint thật
        return {
            logLevel: 'silent',
            forceLogin: false,
            updatePresence: false,
            selfListen: false,
            listenEvents: false,
            autoMarkDelivery: false,
            autoMarkRead: false,
            online: false,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            // Thêm headers mô phỏng browser thật
            pageID: null,
            pauseLog: true
        };
    }

    async tryMobileSimulation(credentials, resolve, reject) {
        logger.info('Thử với mobile browser simulation...');
        
        // Delay khác để mô phỏng retry thật
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1500));
        
        const mobileOptions = {
            logLevel: 'silent',
            forceLogin: false,
            updatePresence: false,
            selfListen: false,
            listenEvents: false,
            autoMarkDelivery: false,
            autoMarkRead: false,
            online: false,
            // Mobile user agent thật
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
            pageID: null,
            pauseLog: true
        };

        const loginData = {
            email: credentials.email,
            password: credentials.password
        };

        fca(loginData, mobileOptions, (err, api) => {
            if (err) {
                logger.error('Mobile simulation thất bại:', err.error || err.message);
                reject(new Error('Tất cả phương pháp đều thất bại - có thể cần xác minh qua browser'));
            } else {
                logger.info('Đăng nhập thành công với mobile simulation!');
                this.saveAppstate(api);
                this.saveCookies(api);
                resolve(api);
            }
        });
    }

    handleEmailVerification(err, credentials, resolve, reject) {
        logger.info('Đang khởi tạo quá trình xác minh email...');
        
        // Tạo readline interface để nhận input từ user
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        logger.info('Vui lòng kiểm tra email và nhập mã xác minh:');
        logger.info('Link xác minh: ' + (err.continue || 'Kiểm tra email của bạn'));
        
        rl.question('Nhập mã xác minh từ email: ', (verificationCode) => {
            rl.close();
            
            if (!verificationCode || verificationCode.trim().length === 0) {
                logger.error('Mã xác minh không được để trống');
                reject(new Error('Mã xác minh không hợp lệ'));
                return;
            }

            logger.info('Đang xác minh mã: ' + verificationCode.trim());
            
            // Sử dụng callback từ fca-unofficial để xác minh
            if (err.continue && typeof err.continue === 'function') {
                // FCA mới hỗ trợ callback cho email verification
                err.continue(verificationCode.trim(), (continueErr, api) => {
                    if (continueErr) {
                        logger.error('Xác minh thất bại:', continueErr.message || continueErr.error);
                        reject(new Error('Mã xác minh không đúng hoặc đã hết hạn'));
                    } else {
                        logger.info('Xác minh thành công!');
                        this.saveAppstate(api);
                        this.saveCookies(api);
                        resolve(api);
                    }
                });
            } else {
                // Fallback cho phiên bản cũ
                this.submitVerificationCodeFallback(credentials, verificationCode.trim(), resolve, reject);
            }
        });
    }

    submitVerificationCodeFallback(credentials, code, resolve, reject) {
        logger.info('Đang thử phương thức xác minh dự phòng...');
        
        const loginData = {
            email: credentials.email,
            password: credentials.password
        };

        const verificationOptions = {
            logLevel: 'silent',
            forceLogin: true,
            updatePresence: false,
            selfListen: false,
            listenEvents: false,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        const fca = require('fca-unofficial');
        fca(loginData, verificationOptions, (verifyErr, api) => {
            if (verifyErr) {
                logger.error('Xác minh dự phòng thất bại:', verifyErr.message || verifyErr.error);
                reject(new Error('Không thể xác minh mã. Vui lòng thử lại hoặc kiểm tra mã xác minh.'));
            } else {
                logger.info('Xác minh dự phòng thành công!');
                this.saveAppstate(api);
                this.saveCookies(api);
                resolve(api);
            }
        });
    }

    submitVerificationCode(continueUrl, code, resolve, reject) {
        const https = require('https');
        const querystring = require('querystring');
        
        logger.info('🔗 Đang gửi mã xác minh đến Facebook...');
        
        const postData = querystring.stringify({
            'approvals_code': code
        });

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };

        const req = https.request(continueUrl, options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    logger.info('✅ Mã xác minh được chấp nhận!');
                    logger.info('🔄 Đang thử đăng nhập lại...');
                    
                    // Thử đăng nhập lại sau khi xác minh
                    this.retryAfterVerification(resolve, reject);
                } else {
                    logger.error('❌ Xác minh thất bại. Mã có thể sai hoặc đã hết hạn');
                    reject(new Error('Mã xác minh không hợp lệ'));
                }
            });
        });

        req.on('error', (error) => {
            logger.error('❌ Lỗi khi gửi mã xác minh:', error.message);
            reject(new Error('Không thể gửi mã xác minh'));
        });

        req.write(postData);
        req.end();
    }

    retryAfterVerification(resolve, reject) {
        const config = require('../config/config');
        const credentials = config.getCredentials();
        
        const loginData = {
            email: credentials.email,
            password: credentials.password
        };

        const retryOptions = {
            logLevel: 'silent',
            forceLogin: true,
            updatePresence: false,
            selfListen: false,
            listenEvents: false,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        const fca = require('fca-unofficial');
        fca(loginData, retryOptions, (err, api) => {
            if (err) {
                logger.error('❌ Đăng nhập sau xác minh thất bại:', err.message);
                reject(new Error('Đăng nhập thất bại sau xác minh'));
            } else {
                logger.info('🎉 Đăng nhập thành công sau xác minh!');
                this.saveAppstate(api);
                this.saveCookies(api);
                resolve(api);
            }
        });
    }

    saveCookies(api) {
        try {
            const appState = api.getAppState();
            const fs = require('fs');
            
            // Lưu cookies dự trữ
            fs.writeFileSync('./cookies.json', JSON.stringify(appState, null, 2));
            logger.info('💾 Đã lưu cookies dự trữ vào cookies.json');
        } catch (error) {
            logger.error('❌ Không thể lưu cookies:', error.message);
        }
    }

    saveAppstate(api) {
        try {
            const appState = api.getAppState();
            storage.saveAppstate(appState);
            logger.info('Appstate saved successfully');
        } catch (error) {
            logger.error('Failed to save appstate:', error.message);
        }
    }

    updateAppstate(api) {
        try {
            const appState = api.getAppState();
            storage.updateAppstate(appState);
            logger.info('Appstate updated successfully');
        } catch (error) {
            logger.error('Failed to update appstate:', error.message);
        }
    }

    removeAppstate() {
        try {
            if (fs.existsSync(this.appstatePath)) {
                fs.unlinkSync(this.appstatePath);
                logger.info('Appstate file removed');
            }
        } catch (error) {
            logger.error('Failed to remove appstate:', error.message);
        }
    }

    validateAppstate(appState) {
        if (!Array.isArray(appState)) {
            return false;
        }

        const requiredFields = ['key', 'value', 'domain'];
        return appState.every(cookie => 
            requiredFields.every(field => cookie.hasOwnProperty(field))
        );
    }

    async testConnection(api) {
        return new Promise((resolve) => {
            try {
                api.getFriendsList((err, data) => {
                    if (err) {
                        logger.warn('Connection test failed:', err.message);
                        resolve(false);
                    } else {
                        logger.info('Connection test successful');
                        resolve(true);
                    }
                });
            } catch (error) {
                logger.error('Connection test error:', error.message);
                resolve(false);
            }
        });
    }
}

module.exports = new LoginManager();
