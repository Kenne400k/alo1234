const express = require('express');
const path = require('path');
const fs = require('fs');
const logger = require('./src/utils/logger');

const app = express();
const PORT = 5000;

app.use(express.json());
app.use(express.static('web'));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// API to save appstate
app.post('/api/save-appstate', (req, res) => {
    try {
        const { appstate } = req.body;
        
        if (!appstate) {
            return res.status(400).json({ error: 'Missing appstate data' });
        }

        // Parse and validate appstate
        let parsedAppstate;
        try {
            if (typeof appstate === 'string') {
                parsedAppstate = JSON.parse(appstate);
            } else {
                parsedAppstate = appstate;
            }
        } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON format' });
        }

        // Save to appstate.json
        fs.writeFileSync(path.join(__dirname, 'appstate.json'), JSON.stringify(parsedAppstate, null, 2));
        
        logger.info('New appstate saved from web interface');
        res.json({ success: true, message: 'AppState saved successfully' });

    } catch (error) {
        logger.error('Error saving appstate:', error.message);
        res.status(500).json({ error: 'Failed to save appstate' });
    }
});

// API to test login with new appstate
app.post('/api/test-login', async (req, res) => {
    try {
        const fca = require('fca-unofficial');
        const appstatePath = path.join(__dirname, 'appstate.json');
        
        if (!fs.existsSync(appstatePath)) {
            return res.status(400).json({ error: 'No appstate found' });
        }

        const appstate = JSON.parse(fs.readFileSync(appstatePath, 'utf8'));
        
        // Test login
        fca({ appState: appstate }, { logLevel: 'silent' }, (err, api) => {
            if (err) {
                logger.error('Test login failed:', err.message);
                res.status(400).json({ error: 'Login test failed: ' + err.message });
            } else {
                logger.info('Test login successful');
                api.logout();
                res.json({ success: true, message: 'Login test successful' });
            }
        });

    } catch (error) {
        logger.error('Error testing login:', error.message);
        res.status(500).json({ error: 'Test failed: ' + error.message });
    }
});

// Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        timestamp: new Date().toISOString(),
        message: 'Facebook Login Helper is ready'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Web interface started on port ${PORT}`);
    logger.info(`Open http://localhost:${PORT} to use Facebook Login Helper`);
});

module.exports = app;