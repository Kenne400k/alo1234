const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = './logs';
        this.logFile = path.join(this.logDir, 'app.log');
        this.maxLogSize = 10 * 1024 * 1024; // 10MB
        this.maxLogFiles = 5;
        
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const formattedMessage = typeof message === 'object' ? JSON.stringify(message) : message;
        const dataString = data ? ` | Data: ${JSON.stringify(data)}` : '';
        
        return `[${timestamp}] [${level.toUpperCase()}] ${formattedMessage}${dataString}`;
    }

    writeToFile(formattedMessage) {
        try {
            // Check if log rotation is needed
            if (fs.existsSync(this.logFile)) {
                const stats = fs.statSync(this.logFile);
                if (stats.size > this.maxLogSize) {
                    this.rotateLog();
                }
            }

            fs.appendFileSync(this.logFile, formattedMessage + '\n');
        } catch (error) {
            console.error('Failed to write to log file:', error.message);
        }
    }

    rotateLog() {
        try {
            // Move current log files
            for (let i = this.maxLogFiles - 1; i > 0; i--) {
                const oldFile = path.join(this.logDir, `app.log.${i}`);
                const newFile = path.join(this.logDir, `app.log.${i + 1}`);
                
                if (fs.existsSync(oldFile)) {
                    if (i === this.maxLogFiles - 1) {
                        fs.unlinkSync(oldFile); // Delete oldest log
                    } else {
                        fs.renameSync(oldFile, newFile);
                    }
                }
            }

            // Move current log to .1
            if (fs.existsSync(this.logFile)) {
                fs.renameSync(this.logFile, path.join(this.logDir, 'app.log.1'));
            }
        } catch (error) {
            console.error('Failed to rotate log:', error.message);
        }
    }

    log(level, message, data = null) {
        const formattedMessage = this.formatMessage(level, message, data);
        
        // Console output with colors
        const colors = {
            info: '\x1b[36m',    // Cyan
            warn: '\x1b[33m',    // Yellow
            error: '\x1b[31m',   // Red
            debug: '\x1b[90m',   // Gray
            success: '\x1b[32m'  // Green
        };
        
        const reset = '\x1b[0m';
        const color = colors[level] || colors.info;
        
        console.log(`${color}${formattedMessage}${reset}`);
        
        // Write to file
        this.writeToFile(formattedMessage);
    }

    info(message, data = null) {
        this.log('info', message, data);
    }

    warn(message, data = null) {
        this.log('warn', message, data);
    }

    error(message, data = null) {
        this.log('error', message, data);
    }

    debug(message, data = null) {
        this.log('debug', message, data);
    }

    success(message, data = null) {
        this.log('success', message, data);
    }

    clearLogs() {
        try {
            if (fs.existsSync(this.logDir)) {
                const files = fs.readdirSync(this.logDir);
                files.forEach(file => {
                    if (file.startsWith('app.log')) {
                        fs.unlinkSync(path.join(this.logDir, file));
                    }
                });
                this.info('Log files cleared');
            }
        } catch (error) {
            this.error('Failed to clear logs:', error.message);
        }
    }

    getLogStats() {
        try {
            const stats = {
                totalLogs: 0,
                totalSize: 0,
                files: []
            };

            if (fs.existsSync(this.logDir)) {
                const files = fs.readdirSync(this.logDir);
                files.forEach(file => {
                    if (file.startsWith('app.log')) {
                        const filePath = path.join(this.logDir, file);
                        const fileStats = fs.statSync(filePath);
                        stats.files.push({
                            name: file,
                            size: fileStats.size,
                            modified: fileStats.mtime
                        });
                        stats.totalSize += fileStats.size;
                        stats.totalLogs++;
                    }
                });
            }

            return stats;
        } catch (error) {
            this.error('Failed to get log stats:', error.message);
            return null;
        }
    }
}

module.exports = new Logger();
