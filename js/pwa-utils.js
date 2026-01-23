// PWA Utilities - shared across all pages

const PWAUtils = {
    init() {
        this.setupPullToRefresh();
        this.setupRefreshButton();
    },

    // Pull to refresh for PWA
    setupPullToRefresh() {
        const pullIndicator = document.getElementById('pullToRefresh');
        if (!pullIndicator) return;

        let startY = 0;
        let currentY = 0;
        let isPulling = false;
        const threshold = 80;

        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!isPulling) return;

            currentY = e.touches[0].clientY;
            const pullDistance = currentY - startY;

            if (pullDistance > 0 && window.scrollY === 0) {
                pullIndicator.classList.add('visible');
                if (pullDistance > threshold) {
                    pullIndicator.querySelector('span').textContent = 'Release to refresh';
                } else {
                    pullIndicator.querySelector('span').textContent = 'Pull down to refresh';
                }
            }
        }, { passive: true });

        document.addEventListener('touchend', () => {
            if (!isPulling) return;

            const pullDistance = currentY - startY;
            if (pullDistance > threshold && window.scrollY === 0) {
                pullIndicator.classList.add('refreshing');
                this.refreshPage();
            } else {
                pullIndicator.classList.remove('visible');
            }

            isPulling = false;
            startY = 0;
            currentY = 0;
        }, { passive: true });
    },

    // Refresh button for PWA when pull-to-refresh isn't intuitive
    setupRefreshButton() {
        // Add refresh button to page if it doesn't exist
        if (!document.querySelector('.refresh-btn')) {
            const refreshBtn = document.createElement('button');
            refreshBtn.className = 'refresh-btn';
            refreshBtn.title = 'Refresh page';
            refreshBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
            `;
            refreshBtn.addEventListener('click', () => this.refreshPage());
            document.body.appendChild(refreshBtn);
        }
    },

    // Refresh page content
    refreshPage() {
        const pullIndicator = document.getElementById('pullToRefresh');

        // Show loading state
        if (pullIndicator) {
            pullIndicator.classList.add('refreshing');
        }

        // Reload the page after a brief delay
        setTimeout(() => {
            window.location.reload();
        }, 500);
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    PWAUtils.init();
});

// Make available globally
window.PWAUtils = PWAUtils;
