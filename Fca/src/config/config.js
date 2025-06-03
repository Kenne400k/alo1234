const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class ConfigManager {
    constructor() {
        this.configPath = './config.json';
        this.defaultConfig = {
            maxRetries: 3,
            retryDelay: 3000,
            sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
            autoSaveAppstate: true,
            enableLogging: true,
            logLevel: 'info',
            facebook: {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                forceLogin: true,
                listenEvents: true,
                updatePresence: true,
                selfListen: false,
                autoMarkDelivery: false,
                autoMarkRead: false
            },
            credentials: {
                email: process.env.FB_EMAIL || '',
                password: process.env.FB_PASSWORD || '',
                appPassword: process.env.FB_APP_PASSWORD || ''
            },
            security: {
                encryptCredentials: true,
                autoBackup: true,
                maxBackups: 10
            },
            connection: {
                timeout: 30000,
                keepAlive: true,
                reconnectAttempts: 5,
                reconnectDelay: 5000
            }
        };
        
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configString = fs.readFileSync(this.configPath, 'utf8');
                const config = JSON.parse(configString);
                
                // Merge with default config to ensure all properties exist
                const mergedConfig = this.mergeConfigs(this.defaultConfig, config);
                logger.info('Configuration loaded successfully');
                return mergedConfig;
            } else {
                logger.info('No config file found, creating default configuration');
                this.saveConfig(this.defaultConfig);
                return this.defaultConfig;
            }
        } catch (error) {
            logger.error('Failed to load config:', error.message);
            logger.info('Using default configuration');
            return this.defaultConfig;
        }
    }

    saveConfig(config = this.config) {
        try {
            const configString = JSON.stringify(config, null, 2);
            fs.writeFileSync(this.configPath, configString);
            logger.info('Configuration saved successfully');
            return true;
        } catch (error) {
            logger.error('Failed to save config:', error.message);
            return false;
        }
    }

    mergeConfigs(defaultConfig, userConfig) {
        const merged = { ...defaultConfig };
        
        for (const key in userConfig) {
            if (userConfig.hasOwnProperty(key)) {
                if (typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key])) {
                    merged[key] = this.mergeConfigs(defaultConfig[key] || {}, userConfig[key]);
                } else {
                    merged[key] = userConfig[key];
                }
            }
        }
        
        return merged;
    }

    get(key) {
        const keys = key.split('.');
        let value = this.config;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && value.hasOwnProperty(k)) {
                value = value[k];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    set(key, value) {
        const keys = key.split('.');
        let current = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!current[k] || typeof current[k] !== 'object') {
                current[k] = {};
            }
            current = current[k];
        }
        
        current[keys[keys.length - 1]] = value;
        this.saveConfig();
    }

    getCredentials() {
        const credentials = {
            email: this.get('credentials.email'),
            password: this.get('credentials.password'),
            appPassword: this.get('credentials.appPassword')
        };

        // Override with environment variables if available
        if (process.env.FB_EMAIL) {
            credentials.email = process.env.FB_EMAIL;
        }
        
        if (process.env.FB_PASSWORD) {
            credentials.password = process.env.FB_PASSWORD;
        }

        if (process.env.FB_APP_PASSWORD) {
            credentials.appPassword = process.env.FB_APP_PASSWORD;
        }

        return credentials;
    }

    setCredentials(email, password) {
        this.set('credentials.email', email);
        this.set('credentials.password', password);
        logger.info('Credentials updated in configuration');
    }

    getFacebookOptions() {
        return {
            logLevel: this.get('facebook.logLevel') || 'silent',
            forceLogin: this.get('facebook.forceLogin'),
            userAgent: this.get('facebook.userAgent'),
            listenEvents: this.get('facebook.listenEvents'),
            updatePresence: this.get('facebook.updatePresence'),
            selfListen: this.get('facebook.selfListen'),
            autoMarkDelivery: this.get('facebook.autoMarkDelivery'),
            autoMarkRead: this.get('facebook.autoMarkRead')
        };
    }

    getConnectionSettings() {
        return {
            timeout: this.get('connection.timeout'),
            keepAlive: this.get('connection.keepAlive'),
            reconnectAttempts: this.get('connection.reconnectAttempts'),
            reconnectDelay: this.get('connection.reconnectDelay')
        };
    }

    validateConfig() {
        const requiredFields = [
            'maxRetries',
            'retryDelay',
            'sessionTimeout'
        ];

        const missing = requiredFields.filter(field => this.get(field) === undefined);
        
        if (missing.length > 0) {
            logger.warn('Missing required config fields:', missing);
            return false;
        }

        // Validate data types
        if (typeof this.get('maxRetries') !== 'number' || this.get('maxRetries') < 1) {
            logger.warn('Invalid maxRetries value, using default');
            this.set('maxRetries', this.defaultConfig.maxRetries);
        }

        if (typeof this.get('retryDelay') !== 'number' || this.get('retryDelay') < 1000) {
            logger.warn('Invalid retryDelay value, using default');
            this.set('retryDelay', this.defaultConfig.retryDelay);
        }

        return true;
    }

    resetToDefaults() {
        try {
            this.config = { ...this.defaultConfig };
            this.saveConfig();
            logger.info('Configuration reset to defaults');
            return true;
        } catch (error) {
            logger.error('Failed to reset configuration:', error.message);
            return false;
        }
    }

    backup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `./config.backup.${timestamp}.json`;
            fs.copyFileSync(this.configPath, backupPath);
            logger.info(`Configuration backed up to: ${backupPath}`);
            return backupPath;
        } catch (error) {
            logger.error('Failed to backup configuration:', error.message);
            return null;
        }
    }

    getConfigSummary() {
        return {
            hasCredentials: !!(this.get('credentials.email') && this.get('credentials.password')),
            maxRetries: this.get('maxRetries'),
            retryDelay: this.get('retryDelay'),
            autoSaveAppstate: this.get('autoSaveAppstate'),
            enableLogging: this.get('enableLogging'),
            encryptCredentials: this.get('security.encryptCredentials'),
            autoBackup: this.get('security.autoBackup')
        };
    }
}

module.exports = new ConfigManager();
