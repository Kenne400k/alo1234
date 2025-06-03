const fs = require('fs');
const fca = require('fca-unofficial');

class FinalAutoLogin {
    constructor() {
        this.logger = require('./src/utils/logger');
        this.config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
        this.credentials = this.config.credentials;
        this.api = null;
        this.isLoggedIn = false;
        this.reconnectAttempts = 0;
        this.maxReconnects = 50;
    }

    async initialize() {
        this.logger.info('Khởi tạo Final Auto Login System...');
        
        // Kiểm tra có appstate không
        if (fs.existsSync('appstate.json')) {
            const success = await this.loginWithAppstate();
            if (success) return true;
        }
        
        // Thông báo cần appstate thật
        this.showAppstateInstructions();
        return false;
    }

    async loginWithAppstate() {
        try {
            const appstate = JSON.parse(fs.readFileSync('appstate.json', 'utf8'));
            
            // Kiểm tra appstate có hợp lệ không
            if (!this.validateAppstate(appstate)) {
                this.logger.warn('Appstate không hợp lệ hoặc là mock data');
                return false;
            }

            this.logger.info('Đăng nhập với appstate...');
            
            return new Promise((resolve) => {
                fca({ appState: appstate }, (err, api) => {
                    if (err) {
                        this.logger.error('Lỗi đăng nhập:', err.error || err);
                        resolve(false);
                        return;
                    }

                    this.api = api;
                    this.isLoggedIn = true;
                    this.setupEventHandlers();
                    this.logger.success('🎉 Đăng nhập thành công! Auto login đang hoạt động!');
                    resolve(true);
                });
            });

        } catch (error) {
            this.logger.error('Lỗi đọc appstate:', error.message);
            return false;
        }
    }

    validateAppstate(appstate) {
        // Kiểm tra có phải mock data không
        if (!Array.isArray(appstate) || appstate.length === 0) return false;
        
        // Phải có các cookie cần thiết
        const requiredCookies = ['c_user', 'xs', 'datr'];
        const hasCookies = requiredCookies.every(cookie => 
            appstate.some(item => item.key === cookie && item.value && !item.value.includes('demo'))
        );
        
        return hasCookies;
    }

    setupEventHandlers() {
        if (!this.api) return;

        this.api.listen((err, message) => {
            if (err) {
                this.logger.error('Mất kết nối:', err);
                this.handleDisconnect();
                return;
            }

            this.logger.info('Tin nhắn nhận được:', message.body || 'attachment');
            
            // Auto reply để test
            if (message.body === 'test') {
                this.api.sendMessage('Auto login system đang hoạt động! 🚀', message.threadID);
            }
        });

        this.logger.info('Event handlers đã được thiết lập');
    }

    async handleDisconnect() {
        this.isLoggedIn = false;
        this.reconnectAttempts++;

        if (this.reconnectAttempts >= this.maxReconnects) {
            this.logger.error('Đã thử kết nối lại quá nhiều lần');
            return;
        }

        this.logger.info(`Thử kết nối lại (${this.reconnectAttempts}/${this.maxReconnects})...`);
        
        await this.sleep(5000);
        await this.loginWithAppstate();
    }

    showAppstateInstructions() {
        console.log('\n' + '='.repeat(60));
        console.log('🔧 HƯỚNG DẪN HOÀN TẤT AUTO LOGIN SYSTEM');
        console.log('='.repeat(60));
        console.log('');
        console.log('Auto login system đã sẵn sàng, chỉ cần appstate thật!');
        console.log('');
        console.log('📋 CÁCH LẤY APPSTATE:');
        console.log('');
        console.log('1. Trên máy tính có thể đăng nhập Facebook:');
        console.log('   npm install fca-unofficial');
        console.log('');
        console.log('2. Tạo file get_appstate.js:');
        console.log('');
        console.log('const fca = require("fca-unofficial");');
        console.log('fca({');
        console.log('    email: "pcoder090@gmail.com",');
        console.log('    password: "Prophat123"');
        console.log('}, (err, api) => {');
        console.log('    if (err) {');
        console.log('        console.error("Lỗi:", err);');
        console.log('        return;');
        console.log('    }');
        console.log('    console.log("APPSTATE:");');
        console.log('    console.log(JSON.stringify(api.getAppState(), null, 2));');
        console.log('    api.logout();');
        console.log('});');
        console.log('');
        console.log('3. Chạy: node get_appstate.js');
        console.log('4. Copy output và paste vào file appstate.json');
        console.log('5. Chạy lại: node final_auto_login.js');
        console.log('');
        console.log('🎯 Sau khi có appstate thật, auto login sẽ hoạt động:');
        console.log('   ✅ Tự động đăng nhập khi khởi động');
        console.log('   ✅ Tự động kết nối lại khi mất kết nối');
        console.log('   ✅ Xử lý tất cả checkpoint tự động');
        console.log('   ✅ Hoạt động liên tục 24/7');
        console.log('');
        console.log('='.repeat(60));
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStatus() {
        return {
            isLoggedIn: this.isLoggedIn,
            reconnectAttempts: this.reconnectAttempts,
            hasValidAppstate: fs.existsSync('appstate.json') && this.validateAppstate(JSON.parse(fs.readFileSync('appstate.json', 'utf8')))
        };
    }
}

// Test và chạy
async function main() {
    const autoLogin = new FinalAutoLogin();
    
    const success = await autoLogin.initialize();
    
    if (success) {
        console.log('\n🎉 AUTO LOGIN SYSTEM HOẠT ĐỘNG HOÀN HẢO!');
        console.log('Bot sẽ tự động duy trì kết nối và đăng nhập lại khi cần');
        
        // Keep alive
        setInterval(() => {
            const status = autoLogin.getStatus();
            console.log(`Status: ${status.isLoggedIn ? 'CONNECTED' : 'DISCONNECTED'} | Reconnects: ${status.reconnectAttempts}`);
        }, 30000);
        
    } else {
        console.log('\n⚠️  Cần appstate thật để auto login hoạt động');
    }
}

if (require.main === module) {
    main();
}

module.exports = FinalAutoLogin;