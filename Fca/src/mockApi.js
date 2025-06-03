
// Mock API để test auto login system khi Facebook block IP
class MockFacebookAPI {
    constructor() {
        this.isConnected = true;
        this.userID = '100000000000000';
    }

    sendMessage(message, threadID, callback) {
        setTimeout(() => {
            if (callback) callback(null, {
                messageID: 'mock_' + Date.now(),
                timestamp: Date.now()
            });
        }, 100);
    }

    listen(callback) {
        // Mock listen để test auto reconnect
        setTimeout(() => {
            callback(null, {
                type: 'message',
                messageID: 'mock_' + Date.now(),
                body: 'Test message from mock API',
                senderID: '100000000000001',
                threadID: '100000000000002'
            });
        }, 1000);
    }

    logout(callback) {
        this.isConnected = false;
        if (callback) callback();
    }

    getAppState() {
        return require('../appstate.json');
    }
}

module.exports = MockFacebookAPI;
