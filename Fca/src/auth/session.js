const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const storage = require('../utils/storage');

class SessionManager {
    constructor() {
        this.sessionPath = './session.json';
        this.sessionData = {
            loginTime: null,
            lastActivity: null,
            sessionId: null,
            userInfo: null,
            isActive: false
        };
        this.loadSession();
    }

    createSession(api, userInfo = null) {
        try {
            const sessionId = this.generateSessionId();
            const currentTime = Date.now();

            this.sessionData = {
                loginTime: currentTime,
                lastActivity: currentTime,
                sessionId: sessionId,
                userInfo: userInfo,
                isActive: true
            };

            this.saveSession();
            logger.info(`Session created with ID: ${sessionId}`);
            
            // Set up session maintenance
            this.startSessionMaintenance(api);
            
            return sessionId;
        } catch (error) {
            logger.error('Failed to create session:', error.message);
            throw error;
        }
    }

    updateActivity() {
        try {
            this.sessionData.lastActivity = Date.now();
            this.saveSession();
        } catch (error) {
            logger.error('Failed to update session activity:', error.message);
        }
    }

    endSession() {
        try {
            this.sessionData.isActive = false;
            this.sessionData.lastActivity = Date.now();
            this.saveSession();
            logger.info('Session ended');
            
            if (this.maintenanceInterval) {
                clearInterval(this.maintenanceInterval);
            }
        } catch (error) {
            logger.error('Failed to end session:', error.message);
        }
    }

    isSessionValid() {
        if (!this.sessionData.isActive) {
            return false;
        }

        const maxInactivity = 24 * 60 * 60 * 1000; // 24 hours
        const timeSinceActivity = Date.now() - this.sessionData.lastActivity;
        
        if (timeSinceActivity > maxInactivity) {
            logger.warn('Session expired due to inactivity');
            this.endSession();
            return false;
        }

        return true;
    }

    getSessionInfo() {
        return {
            ...this.sessionData,
            duration: this.getSessionDuration(),
            timeSinceActivity: Date.now() - this.sessionData.lastActivity
        };
    }

    getSessionDuration() {
        if (!this.sessionData.loginTime) {
            return 0;
        }
        return Date.now() - this.sessionData.loginTime;
    }

    saveSession() {
        try {
            fs.writeFileSync(this.sessionPath, JSON.stringify(this.sessionData, null, 2));
        } catch (error) {
            logger.error('Failed to save session:', error.message);
        }
    }

    loadSession() {
        try {
            if (fs.existsSync(this.sessionPath)) {
                const sessionString = fs.readFileSync(this.sessionPath, 'utf8');
                this.sessionData = { ...this.sessionData, ...JSON.parse(sessionString) };
                
                // Validate loaded session
                if (!this.isSessionValid()) {
                    this.clearSession();
                }
            }
        } catch (error) {
            logger.error('Failed to load session:', error.message);
            this.clearSession();
        }
    }

    clearSession() {
        try {
            this.sessionData = {
                loginTime: null,
                lastActivity: null,
                sessionId: null,
                userInfo: null,
                isActive: false
            };
            
            if (fs.existsSync(this.sessionPath)) {
                fs.unlinkSync(this.sessionPath);
            }
            
            logger.info('Session cleared');
        } catch (error) {
            logger.error('Failed to clear session:', error.message);
        }
    }

    generateSessionId() {
        return `fca_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    startSessionMaintenance(api) {
        // Update session activity every 5 minutes
        this.maintenanceInterval = setInterval(() => {
            try {
                this.updateActivity();
                
                // Test connection periodically
                api.getFriendsList((err, data) => {
                    if (err) {
                        logger.warn('Session maintenance: Connection test failed');
                    }
                });
            } catch (error) {
                logger.error('Session maintenance error:', error.message);
            }
        }, 5 * 60 * 1000);
    }

    backup() {
        try {
            const backupPath = `./session_backup_${Date.now()}.json`;
            fs.copyFileSync(this.sessionPath, backupPath);
            logger.info(`Session backed up to: ${backupPath}`);
            return backupPath;
        } catch (error) {
            logger.error('Failed to backup session:', error.message);
            return null;
        }
    }

    restore(backupPath) {
        try {
            if (fs.existsSync(backupPath)) {
                fs.copyFileSync(backupPath, this.sessionPath);
                this.loadSession();
                logger.info(`Session restored from: ${backupPath}`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error('Failed to restore session:', error.message);
            return false;
        }
    }
}

module.exports = new SessionManager();
