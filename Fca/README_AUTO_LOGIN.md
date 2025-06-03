# Fca-Horizon-Remastered - Auto Login System

## Tính năng chính

✅ **Auto Login hoàn chỉnh** - Tự động đăng nhập khi khởi động
✅ **Auto Reconnect** - Tự động kết nối lại khi mất kết nối  
✅ **Checkpoint Handler** - Xử lý tất cả checkpoint Facebook tự động
✅ **Multi Strategy Login** - 4 chiến lược đăng nhập khác nhau
✅ **Web Interface** - Giao diện web để lấy appstate
✅ **Health Check** - Giám sát kết nối liên tục
✅ **Smart Retry** - Thử lại thông minh với delay tăng dần

## Cách sử dụng

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Lấy appstate từ máy khác (quan trọng)
```bash
# Trên máy có thể đăng nhập Facebook:
npm install fca-unofficial

# Tạo file get_appstate.js:
const fca = require('fca-unofficial');
fca({
    email: 'your-email@gmail.com',
    password: 'your-password'
}, (err, api) => {
    if (err) {
        console.error('Lỗi:', err);
        return;
    }
    console.log('APPSTATE:');
    console.log(JSON.stringify(api.getAppState(), null, 2));
    api.logout();
});

# Chạy và copy appstate:
node get_appstate.js
```

### 3. Paste appstate vào file appstate.json

### 4. Chạy hệ thống
```bash
# Chạy auto login system hoàn chỉnh:
node final_auto_login.js

# Hoặc chạy bản gốc với auto login:
node index.js

# Test auto login:
node test_auto_login.js
```

### 5. Sử dụng web interface (nếu cần)
```bash
node web-server.js
# Mở http://localhost:5000
```

## Files quan trọng

- `final_auto_login.js` - Auto login system hoàn chỉnh
- `index.js` - Main bot với auto login tích hợp
- `bypass_solution.js` - Solution để bypass Facebook IP block
- `web-server.js` - Web server để lấy appstate
- `config.json` - Cấu hình auto login
- `appstate.json` - Facebook session data

## Cấu hình

File `config.json`:
```json
{
  "credentials": {
    "email": "your-email@gmail.com",
    "password": "your-password"
  },
  "bypassMode": true,
  "autoReconnect": true,
  "maxRetries": 50,
  "retryDelay": 5000
}
```

## Xử lý lỗi

### Facebook chặn IP
- Sử dụng appstate từ máy khác
- Chạy `node bypass_solution.js` để setup

### Appstate hết hạn
- Lấy appstate mới từ máy có thể đăng nhập
- Hệ thống sẽ tự động thử đăng nhập lại

### Mất kết nối
- Auto reconnect sẽ tự động xử lý
- Tối đa 50 lần thử kết nối lại

## Tính năng nâng cao

- **Smart Login Strategies**: 4 phương pháp đăng nhập khác nhau
- **Checkpoint Detection**: Phát hiện và xử lý checkpoint tự động
- **Health Monitoring**: Giám sát trạng thái kết nối
- **Progressive Retry**: Delay tăng dần khi thử lại
- **Session Management**: Quản lý session Facebook thông minh

## Hỗ trợ

Hệ thống đã được test và hoạt động ổn định. Chỉ cần appstate hợp lệ từ máy có thể đăng nhập Facebook.