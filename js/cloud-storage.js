// Cloud Storage - Firestore sync with localStorage cache

const CloudStorage = {
    isSyncing: false,
    lastSync: null,

    // Sync all data from cloud to local
    async syncFromCloud() {
        const userId = Auth.getUserId();
        if (!userId) return;

        this.isSyncing = true;
        this.updateSyncStatus('Syncing...');

        try {
            // ALWAYS clear local data first to prevent data leakage between users
            this.clearAllLocalData();

            // Get user's data document
            const userDataRef = firebaseDb.collection('userData').doc(userId);
            const doc = await userDataRef.get();

            if (doc.exists) {
                const cloudData = doc.data();

                // Load cloud data (NOT merge - replace completely)
                if (cloudData.workouts) {
                    localStorage.setItem('health_tracker_workouts', JSON.stringify(cloudData.workouts));
                }
                if (cloudData.nutrition) {
                    localStorage.setItem('health_tracker_nutrition', JSON.stringify(cloudData.nutrition));
                }
                if (cloudData.metrics) {
                    localStorage.setItem('health_tracker_metrics', JSON.stringify(cloudData.metrics));
                }
                if (cloudData.goals) {
                    localStorage.setItem('health_tracker_goals', JSON.stringify(cloudData.goals));
                }
                if (cloudData.settings) {
                    localStorage.setItem('health_tracker_settings', JSON.stringify(cloudData.settings));
                }

                console.log('Data loaded from cloud for user:', userId);
            } else {
                // No cloud data for this user - they start fresh (empty)
                console.log('No cloud data found for user - starting fresh');
            }

            this.lastSync = new Date();
            this.updateSyncStatus('Synced');

            // Notify app that data is ready
            window.dispatchEvent(new CustomEvent('cloudDataLoaded'));
        } catch (error) {
            console.error('Sync from cloud failed:', error);
            this.updateSyncStatus('Sync failed');
            // Still notify so app can render (with empty data)
            window.dispatchEvent(new CustomEvent('cloudDataLoaded'));
        }

        this.isSyncing = false;
    },

    // Sync all data to cloud
    async syncToCloud() {
        const userId = Auth.getUserId();
        if (!userId) return;

        this.isSyncing = true;
        this.updateSyncStatus('Saving...');

        try {
            const userData = {
                workouts: JSON.parse(localStorage.getItem('health_tracker_workouts') || '[]'),
                nutrition: JSON.parse(localStorage.getItem('health_tracker_nutrition') || '[]'),
                metrics: JSON.parse(localStorage.getItem('health_tracker_metrics') || '[]'),
                goals: JSON.parse(localStorage.getItem('health_tracker_goals') || '{}'),
                settings: JSON.parse(localStorage.getItem('health_tracker_settings') || '{}'),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            };

            await firebaseDb.collection('userData').doc(userId).set(userData, { merge: true });

            this.lastSync = new Date();
            this.updateSyncStatus('Synced');
            console.log('Data synced to cloud');
        } catch (error) {
            console.error('Sync to cloud failed:', error);
            this.updateSyncStatus('Sync failed');
        }

        this.isSyncing = false;
    },

    // Merge cloud data with local data (by date/id)
    mergeData(key, cloudData) {
        const localData = JSON.parse(localStorage.getItem(key) || '[]');

        // Create a map of local items by date or id
        const localMap = new Map();
        localData.forEach(item => {
            const itemKey = item.date || item.id;
            localMap.set(itemKey, item);
        });

        // Merge cloud data (cloud wins for same date/id)
        cloudData.forEach(item => {
            const itemKey = item.date || item.id;
            localMap.set(itemKey, item);
        });

        // Convert back to array and sort by date (newest first)
        const mergedData = Array.from(localMap.values()).sort((a, b) => {
            const dateA = a.date || a.createdAt || '';
            const dateB = b.date || b.createdAt || '';
            return dateB.localeCompare(dateA);
        });

        localStorage.setItem(key, JSON.stringify(mergedData));
    },

    // Save specific data type and sync
    async save(key, data) {
        // Always save to localStorage first (instant)
        localStorage.setItem(key, JSON.stringify(data));

        // Then sync to cloud if signed in
        if (Auth.getUserId()) {
            // Debounce cloud sync
            this.debouncedSync();
        }
    },

    // Debounced sync to avoid too many writes
    _syncTimeout: null,
    debouncedSync() {
        if (this._syncTimeout) {
            clearTimeout(this._syncTimeout);
        }
        this._syncTimeout = setTimeout(() => {
            this.syncToCloud();
        }, 2000); // Wait 2 seconds after last change
    },

    // Force immediate sync
    async forceSync() {
        if (this._syncTimeout) {
            clearTimeout(this._syncTimeout);
        }
        await this.syncToCloud();
    },

    // Clear local cache (on sign out)
    clearCache() {
        this.lastSync = null;
        this.updateSyncStatus('Local only');
    },

    // Clear ALL local data (on sign out or user switch)
    clearAllLocalData() {
        localStorage.removeItem('health_tracker_workouts');
        localStorage.removeItem('health_tracker_nutrition');
        localStorage.removeItem('health_tracker_metrics');
        localStorage.removeItem('health_tracker_goals');
        localStorage.removeItem('health_tracker_settings');
        this.lastSync = null;
        console.log('All local data cleared');
    },

    // Update sync status indicator
    updateSyncStatus(status) {
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) {
            syncStatus.textContent = status;
            syncStatus.className = 'sync-status ' + status.toLowerCase().replace(' ', '-');
        }
    },

    // Load historical data for admin user from backup file
    async loadHistoricalDataForAdmin() {
        const userId = Auth.getUserId();
        if (!userId) return;

        // Only for admin users
        if (!Auth.isAdmin) {
            console.log('Not admin - no historical data to load');
            return;
        }

        // Check if already has data in cloud
        const userDataDoc = await firebaseDb.collection('userData').doc(userId).get();
        if (userDataDoc.exists && userDataDoc.data().workouts && userDataDoc.data().workouts.length > 0) {
            console.log('Admin already has cloud data');
            return;
        }

        // Load historical data from backup file
        try {
            const basePath = window.location.pathname.includes('/pages/') ? '../' : '';
            const response = await fetch(basePath + 'data/historical-import.json');
            if (response.ok) {
                const data = await response.json();
                console.log('Loading historical data for admin...');

                // Save to localStorage
                if (data.workouts) localStorage.setItem('health_tracker_workouts', JSON.stringify(data.workouts));
                if (data.nutrition) localStorage.setItem('health_tracker_nutrition', JSON.stringify(data.nutrition));
                if (data.metrics) localStorage.setItem('health_tracker_metrics', JSON.stringify(data.metrics));
                if (data.goals) localStorage.setItem('health_tracker_goals', JSON.stringify(data.goals));
                if (data.settings) localStorage.setItem('health_tracker_settings', JSON.stringify(data.settings));

                // Upload to cloud
                await this.syncToCloud();
                console.log('Historical data loaded and synced for admin');

                // Notify app to re-render
                window.dispatchEvent(new CustomEvent('cloudDataLoaded'));
            }
        } catch (e) {
            console.log('Could not load historical data:', e.message);
        }
    }
};

// Hook into Storage module to enable cloud sync
document.addEventListener('DOMContentLoaded', () => {
    // Listen for auth changes to trigger sync
    window.addEventListener('authStateChanged', async (e) => {
        if (e.detail.user) {
            // User signed in - migrate and sync
            await CloudStorage.migrateLocalData();
        }
    });
});

// Make available globally
window.CloudStorage = CloudStorage;
