/**
 * Health Tracker - Production Server
 *
 * Serves the static app with:
 * - secure defaults (helmet/CSP)
 * - compressed responses
 * - predictable cache strategy
 * - explicit page routing without path traversal
 */

const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_VERSION = process.env.npm_package_version || '1.0.0';
const IS_PRODUCTION = NODE_ENV === 'production';

const PAGE_FILES = new Set([
    'workouts.html',
    'nutrition.html',
    'analytics.html',
    'settings.html',
]);

const STATIC_OPTIONS = {
    maxAge: 0,
    etag: true,
    lastModified: true,
    index: false,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', IS_PRODUCTION ? 'public, max-age=0, must-revalidate' : 'no-store');
    },
};

function setNoStoreHtml(res) {
    res.setHeader('Cache-Control', 'no-store');
}

function createApp() {
    const app = express();
    app.disable('x-powered-by');

    app.use(morgan(IS_PRODUCTION ? 'combined' : 'dev'));
    app.use(helmet({
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "'unsafe-eval'",
                    'https://cdn.jsdelivr.net',
                    'https://apis.google.com',
                    'https://www.gstatic.com',
                ],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    'https://fonts.googleapis.com',
                ],
                fontSrc: [
                    "'self'",
                    'https://fonts.gstatic.com',
                    'data:',
                ],
                imgSrc: [
                    "'self'",
                    'data:',
                    'blob:',
                    'https:',
                ],
                connectSrc: [
                    "'self'",
                    'https://firestore.googleapis.com',
                    'https://identitytoolkit.googleapis.com',
                    'https://securetoken.googleapis.com',
                    'https://www.googleapis.com',
                    'https://apis.google.com',
                    'https://firebaseinstallations.googleapis.com',
                    'https://www.gstatic.com',
                ],
                frameSrc: [
                    "'self'",
                    'https://*.firebaseapp.com',
                    'https://accounts.google.com',
                ],
                objectSrc: ["'none'"],
            },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    }));
    app.use(compression());

    app.use('/css', express.static(path.join(__dirname, 'css'), STATIC_OPTIONS));
    app.use('/js', express.static(path.join(__dirname, 'js'), STATIC_OPTIONS));

    app.use('/data', express.static(path.join(__dirname, 'data'), {
        maxAge: IS_PRODUCTION ? '1h' : 0,
        etag: true,
        lastModified: true,
        index: false,
    }));

    app.get('/health', (req, res) => {
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: NODE_ENV,
        });
    });

    app.get('/api/info', (req, res) => {
        res.json({
            name: 'Health Tracker',
            version: APP_VERSION,
            description: 'Personal health and fitness tracking dashboard',
            features: [
                'Workout logging with guided mode',
                'Nutrition tracking',
                'Weight monitoring',
                'Sleep tracking',
                'Progress analytics',
            ],
        });
    });

    app.get(['/', '/index.html'], (req, res) => {
        setNoStoreHtml(res);
        res.sendFile(path.join(__dirname, 'index.html'));
    });

    // Explicit allow-list prevents path traversal (e.g. /pages/../server.js).
    app.get('/pages/:page', (req, res, next) => {
        const page = req.params.page;
        if (!PAGE_FILES.has(page)) {
            return next();
        }

        setNoStoreHtml(res);
        return res.sendFile(path.join(__dirname, 'pages', page));
    });

    // SPA-style fallback for extensionless routes only.
    app.get('*', (req, res, next) => {
        if (req.path === '/health' || req.path.startsWith('/api/')) {
            return next();
        }

        if (req.path.startsWith('/pages/')) {
            return next();
        }

        if (path.extname(req.path)) {
            return next();
        }

        setNoStoreHtml(res);
        return res.sendFile(path.join(__dirname, 'index.html'));
    });

    app.use((req, res) => {
        res.status(404).json({
            error: 'Not Found',
            message: `Cannot ${req.method} ${req.path}`,
        });
    });

    app.use((err, req, res, next) => {
        console.error('Server error:', err);
        res.status(500).json({
            error: 'Internal Server Error',
            message: IS_PRODUCTION ? 'Something went wrong' : err.message,
        });
    });

    return app;
}

const app = createApp();

if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════════╗
║           HEALTH TRACKER SERVER                ║
╠════════════════════════════════════════════════╣
║  Status:      Running                          ║
║  Port:        ${PORT.toString().padEnd(34)}║
║  Environment: ${NODE_ENV.padEnd(34)}║
║  URL:         http://localhost:${PORT.toString().padEnd(18)}║
╚════════════════════════════════════════════════╝
        `);
    });

    const shutdown = (signal) => {
        console.log(`${signal} received, shutting down gracefully...`);
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { app, createApp };
