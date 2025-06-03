const logger = require('../utils/logger');

class ErrorHandler {
    constructor() {
        this.errorCodes = {
            'login-approval': 'Two-factor authentication required',
            'login': 'Invalid credentials or account suspended',
            'checkpoint': 'Facebook security checkpoint triggered',
            'form_password_incorrect': 'Incorrect password',
            'form_email_incorrect': 'Invalid email address',
            'rate_limit': 'Too many login attempts, please wait',
            'network_error': 'Network connection error',
            'timeout': 'Request timeout',
            'captcha_required': 'CAPTCHA verification required',
            'account_locked': 'Account temporarily locked',
            'unusual_activity': 'Unusual activity detected on account'
        };

        this.retryableErrors = [
            'network_error',
            'timeout',
            'rate_limit'
        ];
    }

    handleLoginError(error) {
        const errorMessage = this.getErrorMessage(error);
        const isRetryable = this.isRetryableError(error);
        
        logger.error('Login error occurred:', {
            error: error.error || 'unknown',
            message: errorMessage,
            retryable: isRetryable,
            details: error
        });

        const handledError = new Error(errorMessage);
        handledError.code = error.error;
        handledError.retryable = isRetryable;
        handledError.originalError = error;

        return handledError;
    }

    getErrorMessage(error) {
        if (!error) {
            return 'Unknown error occurred';
        }

        // Check for specific error codes
        if (error.error && this.errorCodes[error.error]) {
            return this.errorCodes[error.error];
        }

        // Check for common error patterns
        if (error.message) {
            if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
                return 'Connection timeout - please check your internet connection';
            }
            
            if (error.message.includes('ENOTFOUND') || error.message.includes('DNS')) {
                return 'DNS resolution failed - please check your network settings';
            }
            
            if (error.message.includes('ECONNREFUSED')) {
                return 'Connection refused - Facebook servers may be unreachable';
            }
            
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                return 'Authentication failed - please check your credentials';
            }
            
            if (error.message.includes('403') || error.message.includes('Forbidden')) {
                return 'Access denied - your account may be restricted';
            }
            
            if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
                return 'Rate limit exceeded - please wait before trying again';
            }
            
            if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
                return 'Facebook server error - please try again later';
            }
        }

        // Facebook-specific error handling
        if (error.error === 'login-approval') {
            return 'Two-factor authentication is enabled. Please disable it or use an app password';
        }

        if (error.error === 'checkpoint') {
            return 'Facebook security checkpoint detected. Please log in through a browser first';
        }

        // Generic error message
        return error.message || error.error || 'An unexpected error occurred during login';
    }

    isRetryableError(error) {
        if (!error) return false;

        // Check if error code is in retryable list
        if (error.error && this.retryableErrors.includes(error.error)) {
            return true;
        }

        // Check for network-related errors
        if (error.message) {
            const networkErrors = [
                'ETIMEDOUT',
                'ENOTFOUND',
                'ECONNREFUSED',
                'ECONNRESET',
                'timeout',
                '500',
                '502',
                '503',
                '504'
            ];

            return networkErrors.some(netError => 
                error.message.includes(netError)
            );
        }

        return false;
    }

    createRetryStrategy(error, currentAttempt, maxAttempts) {
        if (!this.isRetryableError(error)) {
            return {
                shouldRetry: false,
                delay: 0,
                reason: 'Error is not retryable'
            };
        }

        if (currentAttempt >= maxAttempts) {
            return {
                shouldRetry: false,
                delay: 0,
                reason: 'Maximum retry attempts reached'
            };
        }

        // Calculate exponential backoff delay
        const baseDelay = 2000; // 2 seconds
        const delay = baseDelay * Math.pow(2, currentAttempt - 1);
        const maxDelay = 30000; // Maximum 30 seconds
        const finalDelay = Math.min(delay, maxDelay);

        return {
            shouldRetry: true,
            delay: finalDelay,
            reason: `Retrying in ${finalDelay}ms (attempt ${currentAttempt}/${maxAttempts})`
        };
    }

    logError(error, context = {}) {
        logger.error('Error details:', {
            message: error.message,
            code: error.code,
            stack: error.stack,
            context: context,
            timestamp: new Date().toISOString()
        });
    }

    handleAPIError(error, apiMethod) {
        logger.error(`API Error in ${apiMethod}:`, {
            error: error.error || 'unknown',
            message: error.message || 'No message provided',
            method: apiMethod
        });

        // Handle specific API errors
        if (error.error === 'Cannot reply to this conversation') {
            return new Error('Cannot send message to this conversation - it may be archived or restricted');
        }

        if (error.error === 'Invalid thread ID') {
            return new Error('The conversation ID is invalid or no longer exists');
        }

        if (error.error === 'Message failed to send') {
            return new Error('Failed to send message - please try again');
        }

        return new Error(`API Error: ${error.message || error.error || 'Unknown API error'}`);
    }

    getRecoveryActions(error) {
        const actions = [];

        if (error.code === 'login-approval') {
            actions.push('Disable two-factor authentication in Facebook settings');
            actions.push('Use an application-specific password if available');
            actions.push('Try logging in through a web browser first');
        }

        if (error.code === 'checkpoint') {
            actions.push('Log in to Facebook through a web browser');
            actions.push('Complete any security checks requested by Facebook');
            actions.push('Wait a few hours before trying again');
        }

        if (error.code === 'login') {
            actions.push('Verify your email and password are correct');
            actions.push('Check if your account is locked or suspended');
            actions.push('Try logging in through the Facebook website');
        }

        if (this.isRetryableError(error)) {
            actions.push('Check your internet connection');
            actions.push('Wait a few minutes and try again');
            actions.push('Restart your router if network issues persist');
        }

        return actions;
    }
}

module.exports = new ErrorHandler();
