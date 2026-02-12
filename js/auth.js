// Authentication System

const Auth = {
    currentUser: null,
    isAdmin: false,
    onAuthChangeCallbacks: [],

    // Initialize auth listener
    init() {
        // Track if this is initial load
        this.initialLoad = true;

        firebaseAuth.onAuthStateChanged(async (user) => {
            const previousUser = this.currentUser;
            this.currentUser = user;

            if (user) {
                // If switching users, clear old data first
                if (previousUser && previousUser.uid !== user.uid) {
                    CloudStorage.clearAllLocalData();
                }

                // Check if user is admin
                await this.checkAdminStatus(user);
                // Sync data from cloud
                await CloudStorage.syncFromCloud();
                // If admin with no data, load historical data
                if (this.isAdmin) {
                    await CloudStorage.loadHistoricalDataForAdmin();
                }
                this.updateUI(true);

            } else {
                this.isAdmin = false;
                // Clear all local data on sign out
                CloudStorage.clearAllLocalData();
                this.updateUI(false);
            }

            // Notify callbacks
            this.onAuthChangeCallbacks.forEach(cb => cb(user));

            // Only reload after user action (not on initial page load)
            if (!this.initialLoad) {
                window.location.reload();
            }
            this.initialLoad = false;
        });
    },

    // Check if user is admin (first user or marked as admin)
    async checkAdminStatus(user) {
        try {
            const userDoc = await firebaseDb.collection('users').doc(user.uid).get();

            if (userDoc.exists) {
                this.isAdmin = userDoc.data().isAdmin || false;
            } else {
                // New user - check if they're the first user (make them admin)
                const usersSnapshot = await firebaseDb.collection('users').get();
                const isFirstUser = usersSnapshot.empty;

                // Create user document
                await firebaseDb.collection('users').doc(user.uid).set({
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    isAdmin: isFirstUser, // First user becomes admin
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                this.isAdmin = isFirstUser;

                // First user automatically granted admin privileges
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
        }
    },

    // Sign in with Google
    async signInWithGoogle() {
        if (this.currentUser) {
            return this.currentUser;
        }

        try {
            const result = await firebaseAuth.signInWithPopup(googleProvider);
            return result.user;
        } catch (error) {
            console.error('Sign in error:', error);
            if (error.code === 'auth/popup-blocked') {
                alert('Please allow popups to sign in with Google');
            } else if (error.code === 'auth/popup-closed-by-user') {
                // User closed popup, no action needed
            } else {
                alert('Sign in failed: ' + error.message);
            }
            return null;
        }
    },

    // Sign out
    async signOut() {
        try {
            await firebaseAuth.signOut();
            // Clear any cached cloud data
            CloudStorage.clearCache();
        } catch (error) {
            console.error('Sign out error:', error);
        }
    },

    // Update UI based on auth state
    updateUI(isSignedIn) {
        const authContainer = document.getElementById('authContainer');
        const userInfo = document.getElementById('userInfo');
        const signInBtn = document.getElementById('signInBtn');
        const signOutBtn = document.getElementById('signOutBtn');
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        const syncStatus = document.getElementById('syncStatus');

        // Some pages (like Settings) do not render authContainer.
        // Still dispatch auth state so page-specific account UIs can update.
        if (authContainer) {
            if (isSignedIn && this.currentUser) {
                if (signInBtn) signInBtn.style.display = 'none';
                if (userInfo) userInfo.style.display = 'flex';
                if (userAvatar) userAvatar.src = this.currentUser.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><circle cx="12" cy="8" r="4"/><path d="M12 14c-6 0-8 3-8 6v2h16v-2c0-3-2-6-8-6z"/></svg>';
                if (userName) userName.textContent = this.currentUser.displayName || this.currentUser.email;
                if (syncStatus) syncStatus.textContent = 'Synced';
                if (signOutBtn) signOutBtn.style.display = 'block';
            } else {
                if (signInBtn) signInBtn.style.display = 'flex';
                if (userInfo) userInfo.style.display = 'none';
                if (syncStatus) syncStatus.textContent = 'Local only';
            }
        }

        // Dispatch custom event for other components
        window.dispatchEvent(new CustomEvent('authStateChanged', {
            detail: { user: this.currentUser, isAdmin: this.isAdmin }
        }));
    },

    // Register callback for auth changes
    onAuthChange(callback) {
        this.onAuthChangeCallbacks.push(callback);
    },

    // Get current user ID
    getUserId() {
        return this.currentUser?.uid || null;
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});

// Make available globally
window.Auth = Auth;
