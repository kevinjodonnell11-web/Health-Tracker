// Cloud Storage - Firestore sync with localStorage cache

const CloudStorage = {
    isSyncing: false,
    lastSync: null,
    OWNER_KEY: 'health_tracker_owner_uid',
    DATA_KEYS: [
        'health_tracker_workouts',
        'health_tracker_nutrition',
        'health_tracker_metrics',
        'health_tracker_goals',
        'health_tracker_settings',
    ],

    getLocalSnapshot() {
        const snapshot = {};
        this.DATA_KEYS.forEach((key) => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                snapshot[key] = value;
            }
        });
        return snapshot;
    },

    restoreLocalSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return;

        this.DATA_KEYS.forEach((key) => localStorage.removeItem(key));
        Object.entries(snapshot).forEach(([key, value]) => {
            localStorage.setItem(key, value);
        });
    },

    // Sync all data from cloud to local
    async syncFromCloud() {
        const userId = Auth.getUserId();
        if (!userId) return;

        this.isSyncing = true;
        this.updateSyncStatus('Syncing...');

        const localOwnerId = localStorage.getItem(this.OWNER_KEY);
        const isDifferentUser = !!(localOwnerId && localOwnerId !== userId);
        const localSnapshot = isDifferentUser ? null : this.getLocalSnapshot();

        try {
            // Only clear immediately when we know a different user previously owned this local cache.
            if (isDifferentUser) {
                this.clearAllLocalData();
            }

            // Get user's data document
            const userDataRef = firebaseDb.collection('userData').doc(userId);
            const doc = await userDataRef.get();

            if (doc.exists) {
                const cloudData = doc.data();

                // Cloud is source of truth when present.
                this.clearAllLocalData();

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

                // Data loaded from cloud
            } else {
                // No cloud data yet: keep local snapshot for this user if available.
            }

            localStorage.setItem(this.OWNER_KEY, userId);

            this.lastSync = new Date();
            this.updateSyncStatus('Synced');

            // Notify app that data is ready
            window.dispatchEvent(new CustomEvent('cloudDataLoaded'));
        } catch (error) {
            console.error('Sync from cloud failed:', error);
            // Recover local data if sync failed to avoid destructive data loss.
            if (localSnapshot && Object.keys(localSnapshot).length > 0) {
                this.restoreLocalSnapshot(localSnapshot);
                localStorage.setItem(this.OWNER_KEY, userId);
            }
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
            localStorage.setItem(this.OWNER_KEY, userId);
            this.updateSyncStatus('Synced');
            // Data synced to cloud
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
        this.DATA_KEYS.forEach((key) => localStorage.removeItem(key));
        localStorage.removeItem(this.OWNER_KEY);
        this.lastSync = null;
        // All local data cleared
    },

    // Update sync status indicator
    updateSyncStatus(status) {
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) {
            syncStatus.textContent = status;
            syncStatus.className = 'sync-status ' + status.toLowerCase().replace(/\s+/g, '-');
        }
    },

    // Load historical data for admin user from backup file
    async loadHistoricalDataForAdmin() {
        const userId = Auth.getUserId();
        if (!userId) return;

        // Only for admin users
        if (!Auth.isAdmin) {
            return;
        }

        // Check if already has data in cloud
        const userDataDoc = await firebaseDb.collection('userData').doc(userId).get();
        if (userDataDoc.exists && userDataDoc.data().workouts && userDataDoc.data().workouts.length > 0) {
            return;
        }

        // Load historical data from backup file
        try {
            const basePath = window.location.pathname.includes('/pages/') ? '../' : '';
            const response = await fetch(basePath + 'data/historical-import.json');
            if (response.ok) {
                const data = await response.json();
                // Loading historical data for admin

                // Save to localStorage
                if (data.workouts) localStorage.setItem('health_tracker_workouts', JSON.stringify(data.workouts));
                if (data.nutrition) localStorage.setItem('health_tracker_nutrition', JSON.stringify(data.nutrition));
                if (data.metrics) localStorage.setItem('health_tracker_metrics', JSON.stringify(data.metrics));
                if (data.goals) localStorage.setItem('health_tracker_goals', JSON.stringify(data.goals));
                if (data.settings) localStorage.setItem('health_tracker_settings', JSON.stringify(data.settings));

                // Upload to cloud
                await this.syncToCloud();
                // Historical data loaded and synced

                // Notify app to re-render
                window.dispatchEvent(new CustomEvent('cloudDataLoaded'));
            }
        } catch (e) {
            // Could not load historical data
        }
    }
};

// Hook into Storage module to enable cloud sync
document.addEventListener('DOMContentLoaded', () => {
    // Listen for auth changes to trigger sync
    // Note: syncFromCloud is already called in auth.js onAuthStateChanged
});

// Make available globally
window.CloudStorage = CloudStorage;
