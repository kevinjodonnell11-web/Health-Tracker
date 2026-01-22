/**
 * Health Tracker - Production Server
 *
 * A lightweight Express server for serving the static health tracking app.
 * Includes security headers, compression, and proper caching.
 */

const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================
// MIDDLEWARE
// ============================================

// Request logging
if (NODE_ENV === 'production') {
    app.use(morgan('combined'));
} else {
    app.use(morgan('dev'));
}

// Security headers (relaxed for local storage usage)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// Gzip compression
app.use(compression());

// ============================================
// STATIC FILE SERVING
// ============================================

// Cache static assets for 1 year in production
const staticOptions = {
    maxAge: NODE_ENV === 'production' ? '1y' : 0,
    etag: true,
    lastModified: true,
    index: false, // We'll handle index.html manually
};

// Serve CSS with appropriate cache
app.use('/css', express.static(path.join(__dirname, 'css'), {
    ...staticOptions,
    setHeaders: (res) => {
        res.setHeader('Content-Type', 'text/css');
    }
}));

// Serve JS with appropriate cache
app.use('/js', express.static(path.join(__dirname, 'js'), {
    ...staticOptions,
    setHeaders: (res) => {
        res.setHeader('Content-Type', 'application/javascript');
    }
}));

// Serve data files (JSON) - shorter cache
app.use('/data', express.static(path.join(__dirname, 'data'), {
    maxAge: NODE_ENV === 'production' ? '1h' : 0,
    etag: true,
}));

// Serve pages
app.use('/pages', express.static(path.join(__dirname, 'pages'), staticOptions));

// ============================================
// ROUTES
// ============================================

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
    });
});

// API info endpoint
app.get('/api/info', (req, res) => {
    res.json({
        name: 'Health Tracker',
        version: '1.0.0',
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

// Main app route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// SPA fallback - serve index.html for any unmatched routes
// This allows client-side routing if implemented later
app.get('*', (req, res) => {
    // Check if it's a page request
    if (req.path.startsWith('/pages/')) {
        const pagePath = path.join(__dirname, req.path);
        res.sendFile(pagePath, (err) => {
            if (err) {
                res.status(404).sendFile(path.join(__dirname, 'index.html'));
            }
        });
    } else {
        // For all other routes, serve the main app
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: NODE_ENV === 'development' ? err.message : 'Something went wrong',
    });
});

// ============================================
// SERVER START
// ============================================

app.listen(PORT, () => {
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

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    process.exit(0);
});

module.exports = app;
