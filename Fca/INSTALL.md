# Hướng dẫn cài đặt Auto Login System

## Bước 1: Cài đặt dependencies
```bash
npm install
```

## Bước 2: Lấy appstate thật (QUAN TRỌNG)

### Cách 1: Từ máy có thể đăng nhập Facebook
1. Trên máy có thể đăng nhập Facebook (không bị chặn IP):
```bash
npm install fca-unofficial
```

2. Tạo file `get_appstate.js`:
```javascript
const fca = require('fca-unofficial');
fca({
    email: 'pcoder090@gmail.com',
    password: 'Prophat123'
}, (err, api) => {
    if (err) {
        console.error('Lỗi:', err);
        return;
    }
    console.log('=== APPSTATE ===');
    console.log(JSON.stringify(api.getAppState(), null, 2));
    console.log('=== END ===');
    api.logout();
});
```

3. Chạy và copy appstate:
```bash
node get_appstate.js
```

4. Copy output và paste vào file `appstate.json`

### Cách 2: Sử dụng web interface
```bash
node web-server.js
# Mở http://localhost:5000 và làm theo hướng dẫn
```

## Bước 3: Chạy hệ thống

### Chạy auto login hoàn chỉnh:
```bash
node final_auto_login.js
```

### Chạy bản gốc với auto login:
```bash
node index.js
```

### Test hệ thống:
```bash
node test_auto_login.js
```

## Kiểm tra hoạt động
Khi thành công, bạn sẽ thấy:
- "🎉 Đăng nhập thành công! Auto login đang hoạt động!"
- "AUTO LOGIN SYSTEM HOẠT ĐỘNG HOÀN HẢO!"
- Bot sẽ tự động duy trì kết nối

## Xử lý lỗi thường gặp

### Lỗi "unknown location"
- Facebook đang chặn IP hiện tại
- Cần lấy appstate từ máy khác

### Appstate không hợp lệ
- Kiểm tra appstate có đúng format JSON
- Phải có các cookie: c_user, xs, datr

### Mất kết nối
- Hệ thống sẽ tự động thử kết nối lại
- Tối đa 50 lần thử