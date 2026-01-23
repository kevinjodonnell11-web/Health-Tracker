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
            // Get user's data document
            const userDataRef = firebaseDb.collection('userData').doc(userId);
            const doc = await userDataRef.get();

            if (doc.exists) {
                const cloudData = doc.data();

                // Merge cloud data with local (cloud takes precedence for newer items)
                if (cloudData.workouts) {
                    this.mergeData('health_tracker_workouts', cloudData.workouts);
                }
                if (cloudData.nutrition) {
                    this.mergeData('health_tracker_nutrition', cloudData.nutrition);
                }
                if (cloudData.metrics) {
                    this.mergeData('health_tracker_metrics', cloudData.metrics);
                }
                if (cloudData.goals) {
                    localStorage.setItem('health_tracker_goals', JSON.stringify(cloudData.goals));
                }
                if (cloudData.settings) {
                    localStorage.setItem('health_tracker_settings', JSON.stringify(cloudData.settings));
                }

                console.log('Data synced from cloud');
            } else {
                // No cloud data yet - upload local data
                console.log('No cloud data found, uploading local data...');
                await this.syncToCloud();
            }

            this.lastSync = new Date();
            this.updateSyncStatus('Synced');
        } catch (error) {
            console.error('Sync from cloud failed:', error);
            this.updateSyncStatus('Sync failed');
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

    // Migrate existing localStorage data to cloud on first sign-in
    async migrateLocalData() {
        const userId = Auth.getUserId();
        if (!userId) return;

        // Check if migration already done
        const userDoc = await firebaseDb.collection('users').doc(userId).get();
        if (userDoc.exists && userDoc.data().dataMigrated) {
            return;
        }

        // Check if there's local data to migrate
        const workouts = JSON.parse(localStorage.getItem('health_tracker_workouts') || '[]');
        const nutrition = JSON.parse(localStorage.getItem('health_tracker_nutrition') || '[]');
        const metrics = JSON.parse(localStorage.getItem('health_tracker_metrics') || '[]');

        if (workouts.length > 0 || nutrition.length > 0 || metrics.length > 0) {
            console.log('Migrating local data to cloud...');
            await this.syncToCloud();

            // Mark migration as complete
            await firebaseDb.collection('users').doc(userId).update({
                dataMigrated: true,
                migratedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('Local data migration complete');
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
