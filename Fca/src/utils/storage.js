const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

class StorageManager {
    constructor() {
        this.appstatePath = './appstate.json';
        this.credentialsPath = './credentials.json';
        this.backupDir = './backups';
        this.encryptionKey = process.env.ENCRYPTION_KEY || 'fca-horizon-default-key-2024';
        
        this.ensureDirectories();
    }

    ensureDirectories() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    encrypt(text) {
        try {
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
            const iv = crypto.randomBytes(16);
            
            const cipher = crypto.createCipher(algorithm, key);
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            return iv.toString('hex') + ':' + encrypted;
        } catch (error) {
            logger.error('Encryption failed:', error.message);
            return text; // Fallback to plain text
        }
    }

    decrypt(encryptedText) {
        try {
            if (!encryptedText.includes(':')) {
                return encryptedText; // Not encrypted
            }

            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
            const [ivHex, encrypted] = encryptedText.split(':');
            const iv = Buffer.from(ivHex, 'hex');
            
            const decipher = crypto.createDecipher(algorithm, key);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            logger.error('Decryption failed:', error.message);
            return encryptedText; // Fallback to original text
        }
    }

    saveAppstate(appState) {
        try {
            const backupPath = this.createBackup(this.appstatePath);
            if (backupPath) {
                logger.info(`Appstate backed up to: ${backupPath}`);
            }

            const appStateString = JSON.stringify(appState, null, 2);
            fs.writeFileSync(this.appstatePath, appStateString);
            
            logger.info('Appstate saved successfully');
            return true;
        } catch (error) {
            logger.error('Failed to save appstate:', error.message);
            return false;
        }
    }

    loadAppstate() {
        try {
            if (!fs.existsSync(this.appstatePath)) {
                return null;
            }

            const appStateString = fs.readFileSync(this.appstatePath, 'utf8');
            const appState = JSON.parse(appStateString);
            
            if (this.validateAppstate(appState)) {
                logger.info('Appstate loaded successfully');
                return appState;
            } else {
                logger.warn('Invalid appstate format');
                return null;
            }
        } catch (error) {
            logger.error('Failed to load appstate:', error.message);
            return null;
        }
    }

    updateAppstate(appState) {
        try {
            const existingAppstate = this.loadAppstate();
            if (existingAppstate) {
                // Merge with existing appstate to preserve any additional data
                const mergedAppstate = this.mergeAppstates(existingAppstate, appState);
                return this.saveAppstate(mergedAppstate);
            } else {
                return this.saveAppstate(appState);
            }
        } catch (error) {
            logger.error('Failed to update appstate:', error.message);
            return false;
        }
    }

    validateAppstate(appState) {
        if (!Array.isArray(appState)) {
            return false;
        }

        const requiredFields = ['key', 'value', 'domain'];
        return appState.length > 0 && appState.every(cookie => 
            requiredFields.every(field => cookie.hasOwnProperty(field))
        );
    }

    mergeAppstates(existing, updated) {
        try {
            const existingMap = new Map();
            existing.forEach(cookie => {
                const key = `${cookie.key}_${cookie.domain}`;
                existingMap.set(key, cookie);
            });

            updated.forEach(cookie => {
                const key = `${cookie.key}_${cookie.domain}`;
                existingMap.set(key, cookie);
            });

            return Array.from(existingMap.values());
        } catch (error) {
            logger.error('Failed to merge appstates:', error.message);
            return updated;
        }
    }

    saveCredentials(credentials) {
        try {
            const encryptedCredentials = {
                email: credentials.email,
                password: this.encrypt(credentials.password),
                encrypted: true,
                timestamp: Date.now()
            };

            fs.writeFileSync(this.credentialsPath, JSON.stringify(encryptedCredentials, null, 2));
            logger.info('Credentials saved successfully');
            return true;
        } catch (error) {
            logger.error('Failed to save credentials:', error.message);
            return false;
        }
    }

    loadCredentials() {
        try {
            if (!fs.existsSync(this.credentialsPath)) {
                return null;
            }

            const credentialsString = fs.readFileSync(this.credentialsPath, 'utf8');
            const credentialsData = JSON.parse(credentialsString);
            
            if (credentialsData.encrypted) {
                credentialsData.password = this.decrypt(credentialsData.password);
            }

            return {
                email: credentialsData.email,
                password: credentialsData.password
            };
        } catch (error) {
            logger.error('Failed to load credentials:', error.message);
            return null;
        }
    }

    createBackup(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }

            const fileName = path.basename(filePath);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `${fileName}.backup.${timestamp}`;
            const backupPath = path.join(this.backupDir, backupFileName);

            fs.copyFileSync(filePath, backupPath);
            
            // Keep only the last 10 backups
            this.cleanupBackups(fileName);
            
            return backupPath;
        } catch (error) {
            logger.error('Failed to create backup:', error.message);
            return null;
        }
    }

    cleanupBackups(fileName) {
        try {
            const backupFiles = fs.readdirSync(this.backupDir)
                .filter(file => file.startsWith(fileName + '.backup.'))
                .map(file => ({
                    name: file,
                    path: path.join(this.backupDir, file),
                    time: fs.statSync(path.join(this.backupDir, file)).mtime
                }))
                .sort((a, b) => b.time - a.time);

            // Keep only the 10 most recent backups
            if (backupFiles.length > 10) {
                backupFiles.slice(10).forEach(backup => {
                    fs.unlinkSync(backup.path);
                    logger.info(`Deleted old backup: ${backup.name}`);
                });
            }
        } catch (error) {
            logger.error('Failed to cleanup backups:', error.message);
        }
    }

    deleteFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                logger.info(`File deleted: ${filePath}`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`Failed to delete file ${filePath}:`, error.message);
            return false;
        }
    }

    getStorageStats() {
        try {
            const stats = {
                appstate: {
                    exists: fs.existsSync(this.appstatePath),
                    size: 0,
                    modified: null
                },
                credentials: {
                    exists: fs.existsSync(this.credentialsPath),
                    size: 0,
                    modified: null
                },
                backups: {
                    count: 0,
                    totalSize: 0
                }
            };

            if (stats.appstate.exists) {
                const appstateStats = fs.statSync(this.appstatePath);
                stats.appstate.size = appstateStats.size;
                stats.appstate.modified = appstateStats.mtime;
            }

            if (stats.credentials.exists) {
                const credentialsStats = fs.statSync(this.credentialsPath);
                stats.credentials.size = credentialsStats.size;
                stats.credentials.modified = credentialsStats.mtime;
            }

            if (fs.existsSync(this.backupDir)) {
                const backupFiles = fs.readdirSync(this.backupDir);
                stats.backups.count = backupFiles.length;
                stats.backups.totalSize = backupFiles.reduce((total, file) => {
                    const filePath = path.join(this.backupDir, file);
                    return total + fs.statSync(filePath).size;
                }, 0);
            }

            return stats;
        } catch (error) {
            logger.error('Failed to get storage stats:', error.message);
            return null;
        }
    }
}

module.exports = new StorageManager();
