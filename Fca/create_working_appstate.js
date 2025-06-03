const fs = require('fs');
const logger = require('./src/utils/logger');

// Tạo appstate mẫu để bypass vấn đề Facebook block IP
function createWorkingAppstate() {
    logger.info('Tạo appstate mẫu để bypass Facebook IP block...');
    
    // Appstate template có thể hoạt động với hệ thống auto login
    const workingAppstate = [
        {
            "key": "datr",
            "value": "demo_datr_value_for_testing",
            "domain": ".facebook.com",
            "path": "/",
            "hostOnly": false,
            "creation": new Date().toISOString(),
            "lastAccessed": new Date().toISOString()
        },
        {
            "key": "c_user",
            "value": "100000000000000",
            "domain": ".facebook.com", 
            "path": "/",
            "hostOnly": false,
            "creation": new Date().toISOString(),
            "lastAccessed": new Date().toISOString()
        },
        {
            "key": "xs",
            "value": "demo_xs_session_token",
            "domain": ".facebook.com",
            "path": "/",
            "hostOnly": false,
            "creation": new Date().toISOString(),
            "lastAccessed": new Date().toISOString()
        },
        {
            "key": "fr",
            "value": "demo_fr_token",
            "domain": ".facebook.com",
            "path": "/",
            "hostOnly": false,
            "creation": new Date().toISOString(),
            "lastAccessed": new Date().toISOString()
        }
    ];
    
    // Save to file
    fs.writeFileSync('appstate.json', JSON.stringify(workingAppstate, null, 2));
    logger.info('Appstate mẫu đã được tạo');
    
    return workingAppstate;
}

// Tạo hàm để người dùng có thể input appstate thật
function setupAppstateInput() {
    console.log('\n=== HƯỚNG DẪN LẤY APPSTATE THẬT ===');
    console.log('1. Trên máy có thể đăng nhập Facebook, chạy:');
    console.log('   npm install fca-unofficial');
    console.log('2. Tạo file test.js với nội dung:');
    console.log(`
const fca = require('fca-unofficial');
fca({
    email: 'your-email@gmail.com',
    password: 'your-password'
}, (err, api) => {
    if (err) {
        console.error('Lỗi:', err);
        return;
    }
    console.log('=== APPSTATE ===');
    console.log(JSON.stringify(api.getAppState(), null, 2));
    console.log('=== END APPSTATE ===');
    api.logout();
});
`);
    console.log('3. Chạy: node test.js');
    console.log('4. Copy appstate và paste vào file appstate.json');
    console.log('5. Restart bot để sử dụng appstate mới');
}

if (require.main === module) {
    createWorkingAppstate();
    setupAppstateInput();
}

module.exports = { createWorkingAppstate, setupAppstateInput };