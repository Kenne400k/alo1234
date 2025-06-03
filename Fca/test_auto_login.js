
const FcaHorizonRemastered = require('./index');

async function testAutoLogin() {
    console.log('Testing auto login system...');
    
    const bot = new FcaHorizonRemastered();
    
    try {
        await bot.initialize();
        console.log('✅ Auto login system hoạt động tốt!');
        
        // Test auto reconnect
        setTimeout(() => {
            console.log('Testing auto reconnect...');
            bot.handleAutoRelogin();
        }, 5000);
        
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    }
}

testAutoLogin();
