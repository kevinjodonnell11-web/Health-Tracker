// PWA Utilities - shared across all pages

const PWAUtils = {
    init() {
        // Disable pull-to-refresh as it causes click offset issues on iOS
        // this.setupPullToRefresh();
        this.setupRefreshButton();
        this.hidePullIndicator();
    },

    // Hide the pull indicator element
    hidePullIndicator() {
        const pullIndicator = document.getElementById('pullToRefresh');
        if (pullIndicator) {
            pullIndicator.style.display = 'none';
        }
    },

    // Pull to refresh - DISABLED due to iOS click offset issues
    setupPullToRefresh() {
        // This feature is disabled - it causes touch position bugs on iOS Safari
        return;
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
