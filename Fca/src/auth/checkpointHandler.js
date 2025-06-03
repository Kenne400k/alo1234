const logger = require('../utils/logger');
const readline = require('readline');
const https = require('https');
const fs = require('fs');

class CheckpointHandler {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async handleCheckpoint(err, credentials, api, resolve, reject) {
        logger.info('🔒 Facebook checkpoint detected!');
        
        if (err.error === 'login-approval') {
            return this.handleLoginApproval(err, credentials, resolve, reject);
        }
        
        if (err.error === 'checkpoint') {
            return this.handleSecurityCheckpoint(err, credentials, resolve, reject);
        }
        
        if (err.continue && typeof err.continue === 'function') {
            return this.handleContinueCallback(err, credentials, resolve, reject);
        }
        
        // Handle other checkpoint types
        if (err.error && err.error.includes('checkpoint')) {
            return this.handleGenericCheckpoint(err, credentials, resolve, reject);
        }
        
        logger.error('Unknown checkpoint type:', err);
        reject(new Error('Loại checkpoint không được hỗ trợ'));
    }

    async handleLoginApproval(err, credentials, resolve, reject) {
        logger.warn('📧 Facebook yêu cầu xác minh thiết bị');
        logger.info('Kiểm tra email hoặc SMS để lấy mã xác minh');
        
        if (err.continue && typeof err.continue === 'function') {
            logger.info('Đang chờ mã xác minh...');
            
            const code = await this.askForCode('Nhập mã xác minh từ email/SMS: ');
            
            if (code) {
                try {
                    err.continue(code, (continueErr, api) => {
                        if (continueErr) {
                            logger.error('Mã xác minh sai:', continueErr.message);
                            // Thử lại
                            this.handleLoginApproval(err, credentials, resolve, reject);
                        } else {
                            logger.info('✅ Xác minh thành công!');
                            this.saveSession(api);
                            resolve(api);
                        }
                    });
                } catch (error) {
                    logger.error('Lỗi xử lý mã xác minh:', error.message);
                    reject(error);
                }
            } else {
                reject(new Error('Không có mã xác minh'));
            }
        } else {
            // Try alternative method
            this.tryAlternativeVerification(credentials, resolve, reject);
        }
    }

    async handleSecurityCheckpoint(err, credentials, resolve, reject) {
        logger.warn('🛡️ Facebook security checkpoint');
        logger.info('Đang thử bypass checkpoint...');
        
        if (err.continue && typeof err.continue === 'function') {
            // Try to continue with default action
            err.continue((continueErr, api) => {
                if (continueErr) {
                    logger.warn('Checkpoint bypass thất bại, cần xác minh thủ công');
                    this.handleManualCheckpoint(err, credentials, resolve, reject);
                } else {
                    logger.info('✅ Bypass checkpoint thành công!');
                    this.saveSession(api);
                    resolve(api);
                }
            });
        } else {
            this.handleManualCheckpoint(err, credentials, resolve, reject);
        }
    }

    async handleContinueCallback(err, credentials, resolve, reject) {
        logger.info('🔄 Đang xử lý callback checkpoint...');
        
        try {
            // First try without any input
            err.continue((continueErr, api) => {
                if (continueErr) {
                    logger.warn('Callback đầu tiên thất bại, thử phương pháp khác...');
                    
                    // Try with empty string
                    err.continue('', (retryErr, retryApi) => {
                        if (retryErr) {
                            logger.warn('Cần thông tin bổ sung từ người dùng');
                            this.handleInteractiveCheckpoint(err, credentials, resolve, reject);
                        } else {
                            logger.info('✅ Checkpoint resolved!');
                            this.saveSession(retryApi);
                            resolve(retryApi);
                        }
                    });
                } else {
                    logger.info('✅ Checkpoint tự động resolved!');
                    this.saveSession(api);
                    resolve(api);
                }
            });
        } catch (error) {
            logger.error('Lỗi xử lý callback:', error.message);
            this.handleInteractiveCheckpoint(err, credentials, resolve, reject);
        }
    }

    async handleGenericCheckpoint(err, credentials, resolve, reject) {
        logger.warn('🔍 Generic checkpoint detected');
        logger.info('Error details:', err.error);
        
        // Try to extract useful information
        if (err.res && err.res.body) {
            const body = err.res.body;
            
            // Look for verification patterns
            if (body.includes('verification') || body.includes('verify')) {
                logger.info('Phát hiện yêu cầu xác minh');
                return this.handleVerificationCheckpoint(err, credentials, resolve, reject);
            }
            
            if (body.includes('approval') || body.includes('approve')) {
                logger.info('Phát hiện yêu cầu phê duyệt');
                return this.handleApprovalCheckpoint(err, credentials, resolve, reject);
            }
        }
        
        // Default handling
        this.handleManualCheckpoint(err, credentials, resolve, reject);
    }

    async handleVerificationCheckpoint(err, credentials, resolve, reject) {
        logger.info('📱 Xử lý verification checkpoint...');
        
        const verificationMethods = [
            () => this.tryPhoneVerification(err, credentials),
            () => this.tryEmailVerification(err, credentials),
            () => this.trySecurityQuestions(err, credentials),
            () => this.tryPhotoVerification(err, credentials)
        ];
        
        for (const method of verificationMethods) {
            try {
                const result = await method();
                if (result) {
                    this.saveSession(result);
                    return resolve(result);
                }
            } catch (methodError) {
                logger.warn('Phương pháp verification thất bại:', methodError.message);
            }
        }
        
        // If all methods fail
        this.handleManualCheckpoint(err, credentials, resolve, reject);
    }

    async handleApprovalCheckpoint(err, credentials, resolve, reject) {
        logger.info('✅ Xử lý approval checkpoint...');
        
        // Try automatic approval
        if (err.continue) {
            err.continue((approvalErr, api) => {
                if (approvalErr) {
                    logger.warn('Auto approval thất bại');
                    this.handleManualCheckpoint(err, credentials, resolve, reject);
                } else {
                    logger.info('✅ Auto approval thành công!');
                    this.saveSession(api);
                    resolve(api);
                }
            });
        } else {
            this.handleManualCheckpoint(err, credentials, resolve, reject);
        }
    }

    async handleInteractiveCheckpoint(err, credentials, resolve, reject) {
        logger.info('💬 Interactive checkpoint - cần input từ user');
        
        // Ask user for input
        const userInput = await this.askForInput('Facebook yêu cầu thông tin bổ sung. Nhập thông tin: ');
        
        if (err.continue && userInput) {
            err.continue(userInput, (inputErr, api) => {
                if (inputErr) {
                    logger.error('Input không hợp lệ:', inputErr.message);
                    // Retry
                    this.handleInteractiveCheckpoint(err, credentials, resolve, reject);
                } else {
                    logger.info('✅ Input được chấp nhận!');
                    this.saveSession(api);
                    resolve(api);
                }
            });
        } else {
            reject(new Error('Không thể xử lý interactive checkpoint'));
        }
    }

    async handleManualCheckpoint(err, credentials, resolve, reject) {
        logger.warn('⚠️ Cần xử lý checkpoint thủ công');
        logger.info('Hướng dẫn:');
        logger.info('1. Mở browser và đăng nhập Facebook');
        logger.info('2. Hoàn thành tất cả bước xác minh');
        logger.info('3. Export cookies và cập nhật appstate.json');
        logger.info('4. Khởi động lại ứng dụng');
        
        // Try to save current state for later recovery
        if (err.res && err.res.jar) {
            this.saveTemporaryState(err.res.jar);
        }
        
        reject(new Error('Cần xử lý checkpoint thủ công qua browser'));
    }

    async tryPhoneVerification(err, credentials) {
        logger.info('📞 Thử phone verification...');
        // Implementation for phone verification
        return null;
    }

    async tryEmailVerification(err, credentials) {
        logger.info('📧 Thử email verification...');
        // Implementation for email verification
        return null;
    }

    async trySecurityQuestions(err, credentials) {
        logger.info('❓ Thử security questions...');
        // Implementation for security questions
        return null;
    }

    async tryPhotoVerification(err, credentials) {
        logger.info('📷 Thử photo verification...');
        // Implementation for photo verification
        return null;
    }

    async tryAlternativeVerification(credentials, resolve, reject) {
        logger.info('🔄 Thử phương pháp xác minh thay thế...');
        
        // Try re-login with different options
        const fca = require('fca-unofficial');
        const altOptions = {
            logLevel: 'silent',
            forceLogin: false,
            updatePresence: false,
            selfListen: false,
            listenEvents: false,
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        };

        fca({
            email: credentials.email,
            password: credentials.password
        }, altOptions, (altErr, altApi) => {
            if (altErr) {
                logger.error('Alternative verification thất bại');
                reject(altErr);
            } else {
                logger.info('✅ Alternative verification thành công!');
                this.saveSession(altApi);
                resolve(altApi);
            }
        });
    }

    async askForCode(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    async askForInput(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    saveSession(api) {
        try {
            if (api && typeof api.getAppState === 'function') {
                const appState = api.getAppState();
                fs.writeFileSync('appstate.json', JSON.stringify(appState, null, 2));
                logger.info('Session đã được lưu');
            }
        } catch (error) {
            logger.warn('Không thể lưu session:', error.message);
        }
    }

    saveTemporaryState(jar) {
        try {
            // Save temporary state for recovery
            const tempState = {
                cookies: jar.getCookies('https://www.facebook.com'),
                timestamp: Date.now()
            };
            fs.writeFileSync('temp_state.json', JSON.stringify(tempState, null, 2));
            logger.info('Temporary state đã được lưu');
        } catch (error) {
            logger.warn('Không thể lưu temporary state:', error.message);
        }
    }

    cleanup() {
        if (this.rl) {
            this.rl.close();
        }
    }
}

module.exports = CheckpointHandler;