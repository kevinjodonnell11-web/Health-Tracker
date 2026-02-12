const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const { createApp } = require('../server');

async function withServer(run) {
    const app = createApp();
    const server = http.createServer(app);

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
        await run(baseUrl);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

test('GET /health returns service metadata', async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/health`);
        assert.equal(response.status, 200);

        const payload = await response.json();
        assert.equal(payload.status, 'healthy');
        assert.ok(payload.timestamp);
        assert.equal(typeof payload.uptime, 'number');
        assert.ok(payload.environment);
    });
});

test('GET /api/info returns app metadata', async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/info`);
        assert.equal(response.status, 200);

        const payload = await response.json();
        assert.equal(payload.name, 'Health Tracker');
        assert.equal(typeof payload.version, 'string');
        assert.ok(Array.isArray(payload.features));
        assert.ok(payload.features.length > 0);
    });
});

test('GET / serves index.html with non-cacheable headers', async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type') || '', /text\/html/);
        assert.equal(response.headers.get('cache-control'), 'no-store');

        const html = await response.text();
        assert.match(html, /<title>Health Tracker<\/title>/i);
    });
});

test('known page routes are served and unknown pages 404', async () => {
    await withServer(async (baseUrl) => {
        const okPage = await fetch(`${baseUrl}/pages/workouts.html`);
        assert.equal(okPage.status, 200);
        assert.match(okPage.headers.get('content-type') || '', /text\/html/);

        const missingPage = await fetch(`${baseUrl}/pages/not-real.html`);
        assert.equal(missingPage.status, 404);
    });
});

test('path traversal attempt under /pages is blocked', async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/pages/%2E%2E/server.js`);
        assert.equal(response.status, 404);

        const body = await response.text();
        assert.doesNotMatch(body, /const express/);
    });
});

test('CSP includes required Firebase/CDN sources', async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/`);
        assert.equal(response.status, 200);

        const csp = response.headers.get('content-security-policy') || '';
        assert.match(csp, /script-src[^;]*https:\/\/www\.gstatic\.com/);
        assert.match(csp, /script-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
        assert.match(csp, /connect-src[^;]*https:\/\/firestore\.googleapis\.com/);
    });
});

test('static JS uses revalidation cache policy', async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/js/app.js`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type') || '', /application\/javascript/);
        const cacheControl = response.headers.get('cache-control');
        assert.ok(
            cacheControl === 'public, max-age=0, must-revalidate' || cacheControl === 'no-store',
            `unexpected cache-control: ${cacheControl}`
        );
    });
});
