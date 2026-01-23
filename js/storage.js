// LocalStorage Abstraction Layer

const Storage = {
    KEYS: {
        WORKOUTS: 'health_tracker_workouts',
        NUTRITION: 'health_tracker_nutrition',
        METRICS: 'health_tracker_metrics',
        GOALS: 'health_tracker_goals',
        SETTINGS: 'health_tracker_settings'
    },

    // Generate UUID
    generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    // Get today's date in YYYY-MM-DD format
    getToday() {
        return new Date().toISOString().split('T')[0];
    },

    // Format date to display format
    formatDate(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    },

    // Get data from localStorage
    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error reading from localStorage:', e);
            return [];
        }
    },

    // Save data to localStorage (and sync to cloud if signed in)
    set(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            // Trigger cloud sync if available
            if (window.CloudStorage && window.Auth?.getUserId()) {
                CloudStorage.debouncedSync();
            }
            return true;
        } catch (e) {
            console.error('Error writing to localStorage:', e);
            return false;
        }
    },

    // Add item to a collection
    add(key, item) {
        const items = this.get(key);
        item.id = item.id || this.generateId();
        item.createdAt = item.createdAt || new Date().toISOString();
        items.push(item);
        return this.set(key, items) ? item : null;
    },

    // Update item in a collection
    update(key, id, updates) {
        const items = this.get(key);
        const index = items.findIndex(item => item.id === id);
        if (index !== -1) {
            items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
            return this.set(key, items) ? items[index] : null;
        }
        return null;
    },

    // Delete item from a collection
    delete(key, id) {
        const items = this.get(key);
        const filtered = items.filter(item => item.id !== id);
        return this.set(key, filtered);
    },

    // Find item by ID
    findById(key, id) {
        const items = this.get(key);
        return items.find(item => item.id === id) || null;
    },

    // Find items by date
    findByDate(key, date) {
        const items = this.get(key);
        return items.filter(item => item.date === date);
    },

    // Find items in date range
    findByDateRange(key, startDate, endDate) {
        const items = this.get(key);
        return items.filter(item => item.date >= startDate && item.date <= endDate);
    },

    // Get latest N items
    getLatest(key, count = 10) {
        const items = this.get(key);
        return items
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, count);
    },

    // Workouts
    workouts: {
        getAll() { return Storage.get(Storage.KEYS.WORKOUTS); },
        add(workout) { return Storage.add(Storage.KEYS.WORKOUTS, workout); },
        update(id, updates) { return Storage.update(Storage.KEYS.WORKOUTS, id, updates); },
        delete(id) { return Storage.delete(Storage.KEYS.WORKOUTS, id); },
        findById(id) { return Storage.findById(Storage.KEYS.WORKOUTS, id); },
        findByDate(date) { return Storage.findByDate(Storage.KEYS.WORKOUTS, date); },
        getLatest(count) { return Storage.getLatest(Storage.KEYS.WORKOUTS, count); },
        getByDateRange(start, end) { return Storage.findByDateRange(Storage.KEYS.WORKOUTS, start, end); },
        getCount() { return Storage.get(Storage.KEYS.WORKOUTS).length; }
    },

    // Nutrition
    nutrition: {
        getAll() { return Storage.get(Storage.KEYS.NUTRITION); },
        add(entry) { return Storage.add(Storage.KEYS.NUTRITION, entry); },
        update(id, updates) { return Storage.update(Storage.KEYS.NUTRITION, id, updates); },
        delete(id) { return Storage.delete(Storage.KEYS.NUTRITION, id); },
        findById(id) { return Storage.findById(Storage.KEYS.NUTRITION, id); },
        findByDate(date) { return Storage.findByDate(Storage.KEYS.NUTRITION, date)[0] || null; },
        getLatest(count) { return Storage.getLatest(Storage.KEYS.NUTRITION, count); },
        getByDateRange(start, end) { return Storage.findByDateRange(Storage.KEYS.NUTRITION, start, end); }
    },

    // Metrics
    metrics: {
        getAll() { return Storage.get(Storage.KEYS.METRICS); },
        add(entry) { return Storage.add(Storage.KEYS.METRICS, entry); },
        update(id, updates) { return Storage.update(Storage.KEYS.METRICS, id, updates); },
        delete(id) { return Storage.delete(Storage.KEYS.METRICS, id); },
        findById(id) { return Storage.findById(Storage.KEYS.METRICS, id); },
        findByDate(date) { return Storage.findByDate(Storage.KEYS.METRICS, date)[0] || null; },
        getLatest(count) { return Storage.getLatest(Storage.KEYS.METRICS, count); },
        getByDateRange(start, end) { return Storage.findByDateRange(Storage.KEYS.METRICS, start, end); },

        // Get or create today's metrics
        getOrCreateToday() {
            const today = Storage.getToday();
            let entry = this.findByDate(today);
            if (!entry) {
                entry = this.add({
                    date: today,
                    weight: null,
                    sleepHours: null,
                    sleepQuality: null,
                    steps: null,
                    energyLevel: null,
                    mood: null,
                    workoutCompleted: false,
                    nutritionCompleted: false
                });
            }
            return entry;
        }
    },

    // Goals
    goals: {
        get() {
            const defaults = {
                weightGoal: 210,
                dailyCalories: 1500,
                dailyProtein: 150,
                weeklyWorkouts: 4,
                dailySteps: 10000,
                sleepHours: 7
            };
            const saved = Storage.get(Storage.KEYS.GOALS);
            return Array.isArray(saved) || !saved ? defaults : { ...defaults, ...saved };
        },
        set(goals) {
            return Storage.set(Storage.KEYS.GOALS, goals);
        }
    },

    // Settings
    settings: {
        get() {
            const defaults = {
                darkMode: true,
                workoutSplit: ['push', 'pull', 'legs'],
                defaultFastingWindow: { start: '12:00', end: '20:00' }
            };
            const saved = Storage.get(Storage.KEYS.SETTINGS);
            return Array.isArray(saved) || !saved ? defaults : { ...defaults, ...saved };
        },
        set(settings) {
            return Storage.set(Storage.KEYS.SETTINGS, settings);
        }
    },

    // Export all data
    exportAll() {
        return {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            workouts: this.workouts.getAll(),
            nutrition: this.nutrition.getAll(),
            metrics: this.metrics.getAll(),
            goals: this.goals.get(),
            settings: this.settings.get()
        };
    },

    // Import data
    importAll(data) {
        try {
            if (data.workouts) this.set(this.KEYS.WORKOUTS, data.workouts);
            if (data.nutrition) this.set(this.KEYS.NUTRITION, data.nutrition);
            if (data.metrics) this.set(this.KEYS.METRICS, data.metrics);
            if (data.goals) this.goals.set(data.goals);
            if (data.settings) this.settings.set(data.settings);
            return true;
        } catch (e) {
            console.error('Error importing data:', e);
            return false;
        }
    },

    // Clear all data
    clearAll() {
        Object.values(this.KEYS).forEach(key => localStorage.removeItem(key));
    }
};

// Make Storage available globally
window.Storage = Storage;
