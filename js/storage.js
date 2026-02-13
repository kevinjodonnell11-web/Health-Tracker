// LocalStorage abstraction with schema migrations and data normalization.

// HTML escape function to prevent XSS
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// Make escape function globally available
window.escapeHtml = escapeHtml;

const Storage = {
    SCHEMA_VERSION: 2,
    WORKOUT_TYPES: ['push', 'pull', 'legs', 'upper', 'cardio', 'superset'],
    PROFILE_GOALS: ['fat_loss', 'muscle_gain', 'performance', 'maintenance'],
    PROFILE_LEVELS: ['beginner', 'intermediate', 'advanced'],
    PROFILE_UNITS: ['imperial', 'metric'],

    KEYS: {
        WORKOUTS: 'health_tracker_workouts',
        NUTRITION: 'health_tracker_nutrition',
        METRICS: 'health_tracker_metrics',
        GOALS: 'health_tracker_goals',
        SETTINGS: 'health_tracker_settings',
        SCHEMA_VERSION: 'health_tracker_schema_version'
    },

    DEFAULTS: {
        goals: {
            weightGoal: 210,
            dailyCalories: 1500,
            dailyProtein: 150,
            weeklyWorkouts: 4,
            dailySteps: 10000,
            sleepHours: 7
        },
        profile: {
            displayName: '',
            primaryGoal: 'fat_loss',
            experienceLevel: 'intermediate',
            units: 'imperial'
        },
        settings: {
            darkMode: true,
            theme: 'dark',
            workoutSplit: ['push', 'pull', 'legs'],
            defaultFastingWindow: { start: '12:00', end: '20:00' },
            customExercises: [],
            onboardingCompleted: false,
            onboardingCompletedAt: null,
            onboardingDeferredUntil: null
        }
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

    normalizeThemeValue(theme, darkMode) {
        if (theme === 'light' || theme === 'dark') return theme;
        if (darkMode === false) return 'light';
        return 'dark';
    },

    applyTheme(theme) {
        const resolvedTheme = this.normalizeThemeValue(theme, null);
        if (typeof document !== 'undefined' && document.documentElement) {
            document.documentElement.setAttribute('data-theme', resolvedTheme);
        }
        return resolvedTheme;
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

    toNumber(value) {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    },

    toPositiveInt(value, fallback) {
        const num = Number.parseInt(value, 10);
        if (!Number.isFinite(num) || num <= 0) return fallback;
        return num;
    },

    normalizeDateValue(value, fallback = null) {
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                return trimmed;
            }
            if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
                return trimmed.slice(0, 10);
            }
        }
        return fallback || this.getToday();
    },

    normalizeTimeValue(value, fallback) {
        if (typeof value !== 'string') return fallback;
        const trimmed = value.trim();
        if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) {
            return trimmed;
        }
        return fallback;
    },

    readRaw(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null) return fallback;
            return JSON.parse(raw);
        } catch (e) {
            console.error(`Error reading ${key} from localStorage:`, e);
            return fallback;
        }
    },

    writeRaw(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    // Get data from localStorage
    get(key) {
        const data = this.readRaw(key, []);
        return Array.isArray(data) ? data : [];
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

    normalizeWorkoutType(type) {
        return this.WORKOUT_TYPES.includes(type) ? type : this.WORKOUT_TYPES[0];
    },

    normalizeWorkoutSplit(split) {
        const raw = Array.isArray(split)
            ? split
            : (typeof split === 'string' ? split.split(',') : this.DEFAULTS.settings.workoutSplit);

        const normalized = raw
            .map((type) => String(type || '').trim().toLowerCase())
            .filter((type) => this.WORKOUT_TYPES.includes(type));

        const deduped = [...new Set(normalized)];
        return deduped.length > 0 ? deduped : [...this.DEFAULTS.settings.workoutSplit];
    },

    normalizeFastingWindow(foodWindow) {
        const source = foodWindow && typeof foodWindow === 'object'
            ? foodWindow
            : this.DEFAULTS.settings.defaultFastingWindow;
        return {
            start: this.normalizeTimeValue(source.start, this.DEFAULTS.settings.defaultFastingWindow.start),
            end: this.normalizeTimeValue(source.end, this.DEFAULTS.settings.defaultFastingWindow.end)
        };
    },

    normalizeCustomExercises(customExercises) {
        if (!Array.isArray(customExercises)) return [];
        const cleaned = customExercises
            .map((item) => String(item || '').trim())
            .filter((item) => item.length > 0 && item.length <= 80);
        return [...new Set(cleaned)];
    },

    normalizeProfile(profile) {
        const source = profile && typeof profile === 'object' && !Array.isArray(profile) ? profile : {};
        const defaults = this.DEFAULTS.profile;
        const displayName = String(source.displayName || defaults.displayName).trim();
        const primaryGoal = this.PROFILE_GOALS.includes(source.primaryGoal) ? source.primaryGoal : defaults.primaryGoal;
        const experienceLevel = this.PROFILE_LEVELS.includes(source.experienceLevel) ? source.experienceLevel : defaults.experienceLevel;
        const units = this.PROFILE_UNITS.includes(source.units) ? source.units : defaults.units;

        return {
            ...defaults,
            ...source,
            displayName: displayName.slice(0, 60),
            primaryGoal,
            experienceLevel,
            units
        };
    },

    normalizeGoals(goals) {
        const source = goals && typeof goals === 'object' && !Array.isArray(goals) ? goals : {};
        const defaults = this.DEFAULTS.goals;
        return {
            weightGoal: this.toNumber(source.weightGoal) ?? defaults.weightGoal,
            dailyCalories: this.toPositiveInt(source.dailyCalories, defaults.dailyCalories),
            dailyProtein: this.toPositiveInt(source.dailyProtein, defaults.dailyProtein),
            weeklyWorkouts: Math.min(7, Math.max(1, this.toPositiveInt(source.weeklyWorkouts, defaults.weeklyWorkouts))),
            dailySteps: this.toPositiveInt(source.dailySteps, defaults.dailySteps),
            sleepHours: this.toNumber(source.sleepHours) ?? defaults.sleepHours
        };
    },

    normalizeSettings(settings, options = {}) {
        const source = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
        const defaults = this.DEFAULTS.settings;
        const hasHistoricalData = !!options.hasHistoricalData;

        const theme = this.normalizeThemeValue(source.theme, source.darkMode);
        const profile = this.normalizeProfile(source.profile);
        const split = this.normalizeWorkoutSplit(source.workoutSplit);
        const foodWindow = this.normalizeFastingWindow(source.defaultFastingWindow);
        const customExercises = this.normalizeCustomExercises(source.customExercises);

        const explicitOnboarding = typeof source.onboardingCompleted === 'boolean'
            ? source.onboardingCompleted
            : null;
        const onboardingCompleted = explicitOnboarding !== null
            ? explicitOnboarding
            : hasHistoricalData;

        const completedAt = onboardingCompleted
            ? (typeof source.onboardingCompletedAt === 'string' && source.onboardingCompletedAt
                ? source.onboardingCompletedAt
                : new Date().toISOString())
            : null;

        let onboardingDeferredUntil = null;
        if (!onboardingCompleted && typeof source.onboardingDeferredUntil === 'string') {
            const normalizedDate = this.normalizeDateValue(source.onboardingDeferredUntil, null);
            if (normalizedDate && normalizedDate >= this.getToday()) {
                onboardingDeferredUntil = normalizedDate;
            }
        }

        return {
            ...defaults,
            ...source,
            schemaVersion: this.SCHEMA_VERSION,
            theme,
            darkMode: theme === 'dark',
            workoutSplit: split,
            defaultFastingWindow: foodWindow,
            customExercises,
            profile,
            onboardingCompleted,
            onboardingCompletedAt: completedAt,
            onboardingDeferredUntil
        };
    },

    normalizeWorkoutCollection(workouts) {
        if (!Array.isArray(workouts)) return [];

        return workouts
            .filter((workout) => workout && typeof workout === 'object')
            .map((workout) => {
                const exercises = Array.isArray(workout.exercises)
                    ? workout.exercises
                        .filter((exercise) => exercise && typeof exercise === 'object')
                        .map((exercise) => {
                            const sets = Array.isArray(exercise.sets)
                                ? exercise.sets
                                    .filter((set) => set && typeof set === 'object')
                                    .map((set) => ({
                                        reps: this.toNumber(set.reps),
                                        weight: this.toNumber(set.weight)
                                    }))
                                    .filter((set) => set.reps !== null || set.weight !== null)
                                : [];

                            return {
                                ...exercise,
                                name: String(exercise.name || '').trim(),
                                sets
                            };
                        })
                        .filter((exercise) => !!exercise.name)
                    : [];

                const cardio = workout.cardio && typeof workout.cardio === 'object'
                    ? {
                        ...workout.cardio,
                        type: typeof workout.cardio.type === 'string' ? workout.cardio.type : '',
                        distance: this.toNumber(workout.cardio.distance),
                        duration: typeof workout.cardio.duration === 'string' ? workout.cardio.duration : ''
                    }
                    : null;

                return {
                    ...workout,
                    id: typeof workout.id === 'string' && workout.id ? workout.id : this.generateId(),
                    createdAt: typeof workout.createdAt === 'string' && workout.createdAt
                        ? workout.createdAt
                        : new Date().toISOString(),
                    date: this.normalizeDateValue(workout.date),
                    type: this.normalizeWorkoutType(workout.type),
                    dayNumber: Number.isFinite(Number(workout.dayNumber))
                        ? Math.max(1, Math.round(Number(workout.dayNumber)))
                        : null,
                    preWeight: this.toNumber(workout.preWeight),
                    energyLevel: this.toNumber(workout.energyLevel),
                    notes: workout.notes ? String(workout.notes) : null,
                    exercises,
                    cardio
                };
            });
    },

    normalizeNutritionCollection(nutrition) {
        if (!Array.isArray(nutrition)) return [];

        return nutrition
            .filter((entry) => entry && typeof entry === 'object')
            .map((entry) => ({
                ...entry,
                id: typeof entry.id === 'string' && entry.id ? entry.id : this.generateId(),
                createdAt: typeof entry.createdAt === 'string' && entry.createdAt
                    ? entry.createdAt
                    : new Date().toISOString(),
                date: this.normalizeDateValue(entry.date),
                foodWindow: this.normalizeFastingWindow(entry.foodWindow),
                steps: this.toNumber(entry.steps),
                totalCalories: this.toNumber(entry.totalCalories) ?? 0,
                totalProtein: this.toNumber(entry.totalProtein) ?? 0,
                meals: Array.isArray(entry.meals) ? entry.meals : [],
                supplements: Array.isArray(entry.supplements) ? entry.supplements : [],
                alcohol: entry.alcohol && typeof entry.alcohol === 'object'
                    ? {
                        drinks: this.toNumber(entry.alcohol.drinks) ?? 0,
                        type: entry.alcohol.type || null
                    }
                    : { drinks: 0, type: null },
                notes: entry.notes ? String(entry.notes) : null
            }));
    },

    normalizeMetricsCollection(metrics) {
        if (!Array.isArray(metrics)) return [];

        return metrics
            .filter((entry) => entry && typeof entry === 'object')
            .map((entry) => ({
                ...entry,
                id: typeof entry.id === 'string' && entry.id ? entry.id : this.generateId(),
                createdAt: typeof entry.createdAt === 'string' && entry.createdAt
                    ? entry.createdAt
                    : new Date().toISOString(),
                date: this.normalizeDateValue(entry.date),
                weight: this.toNumber(entry.weight),
                sleepHours: this.toNumber(entry.sleepHours),
                sleepQuality: this.toNumber(entry.sleepQuality),
                steps: this.toNumber(entry.steps),
                energyLevel: this.toNumber(entry.energyLevel),
                mood: this.toNumber(entry.mood),
                workoutCompleted: !!entry.workoutCompleted,
                nutritionCompleted: !!entry.nutritionCompleted
            }));
    },

    detectSchemaVersion() {
        const rawVersion = Number.parseInt(localStorage.getItem(this.KEYS.SCHEMA_VERSION) || '', 10);
        if (Number.isFinite(rawVersion) && rawVersion > 0) {
            return rawVersion;
        }

        const settings = this.readRaw(this.KEYS.SETTINGS, {});
        const settingsVersion = Number.parseInt(settings?.schemaVersion || '', 10);
        if (Number.isFinite(settingsVersion) && settingsVersion > 0) {
            return settingsVersion;
        }
        return 1;
    },

    persistSchemaVersion(version) {
        localStorage.setItem(this.KEYS.SCHEMA_VERSION, String(version));
    },

    normalizeAllData() {
        const workouts = this.normalizeWorkoutCollection(this.readRaw(this.KEYS.WORKOUTS, []));
        const nutrition = this.normalizeNutritionCollection(this.readRaw(this.KEYS.NUTRITION, []));
        const metrics = this.normalizeMetricsCollection(this.readRaw(this.KEYS.METRICS, []));
        const goals = this.normalizeGoals(this.readRaw(this.KEYS.GOALS, {}));
        const hasHistoricalData = workouts.length + nutrition.length + metrics.length > 0;
        const settings = this.normalizeSettings(this.readRaw(this.KEYS.SETTINGS, {}), {
            hasHistoricalData
        });

        this.writeRaw(this.KEYS.WORKOUTS, workouts);
        this.writeRaw(this.KEYS.NUTRITION, nutrition);
        this.writeRaw(this.KEYS.METRICS, metrics);
        this.writeRaw(this.KEYS.GOALS, goals);
        this.writeRaw(this.KEYS.SETTINGS, settings);
        this.persistSchemaVersion(this.SCHEMA_VERSION);
    },

    migrate() {
        try {
            const version = this.detectSchemaVersion();
            if (version > this.SCHEMA_VERSION) {
                console.warn(`Stored schema version ${version} is newer than app schema ${this.SCHEMA_VERSION}.`);
            }
            this.normalizeAllData();
        } catch (e) {
            console.error('Storage migration failed:', e);
        }
    },

    init() {
        this.migrate();
        this.applyTheme(this.settings.get().theme);
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
            const saved = Storage.readRaw(Storage.KEYS.GOALS, {});
            return Storage.normalizeGoals(saved);
        },
        set(goals) {
            const current = this.get();
            const merged = { ...current, ...(goals || {}) };
            return Storage.set(Storage.KEYS.GOALS, Storage.normalizeGoals(merged));
        }
    },

    // Settings
    settings: {
        get() {
            const saved = Storage.readRaw(Storage.KEYS.SETTINGS, {});
            return Storage.normalizeSettings(saved);
        },
        set(settings) {
            const current = this.get();
            const incoming = settings || {};
            const merged = {
                ...current,
                ...incoming,
                profile: {
                    ...current.profile,
                    ...(incoming.profile || {})
                },
                defaultFastingWindow: {
                    ...current.defaultFastingWindow,
                    ...(incoming.defaultFastingWindow || {})
                }
            };
            const normalized = Storage.normalizeSettings(merged);
            const saved = Storage.set(Storage.KEYS.SETTINGS, normalized);
            if (saved) {
                Storage.persistSchemaVersion(Storage.SCHEMA_VERSION);
                Storage.applyTheme(normalized.theme);
            }
            return saved;
        }
    },

    // Profile metadata (stored in settings for cloud sync).
    profile: {
        get() {
            return Storage.settings.get().profile;
        },
        set(profileUpdates) {
            const merged = {
                ...Storage.profile.get(),
                ...(profileUpdates || {})
            };
            return Storage.settings.set({ profile: Storage.normalizeProfile(merged) });
        }
    },

    // Onboarding status helpers.
    onboarding: {
        shouldPrompt() {
            const settings = Storage.settings.get();
            if (settings.onboardingCompleted) return false;
            if (settings.onboardingDeferredUntil && settings.onboardingDeferredUntil >= Storage.getToday()) {
                return false;
            }
            return true;
        },
        complete({ profile, goals } = {}) {
            if (goals && typeof goals === 'object') {
                Storage.goals.set(goals);
            }

            const current = Storage.settings.get();
            const mergedProfile = profile
                ? Storage.normalizeProfile({ ...current.profile, ...profile })
                : current.profile;

            return Storage.settings.set({
                profile: mergedProfile,
                onboardingCompleted: true,
                onboardingCompletedAt: new Date().toISOString(),
                onboardingDeferredUntil: null
            });
        },
        defer(days = 7) {
            const deferDate = new Date();
            deferDate.setDate(deferDate.getDate() + Math.max(1, Number(days) || 7));
            return Storage.settings.set({
                onboardingDeferredUntil: deferDate.toISOString().split('T')[0]
            });
        },
        reset() {
            return Storage.settings.set({
                onboardingCompleted: false,
                onboardingCompletedAt: null,
                onboardingDeferredUntil: null
            });
        }
    },

    // Export all data
    exportAll() {
        return {
            version: '2.0',
            schemaVersion: this.SCHEMA_VERSION,
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
            if (Object.prototype.hasOwnProperty.call(data, 'workouts')) this.writeRaw(this.KEYS.WORKOUTS, data.workouts);
            if (Object.prototype.hasOwnProperty.call(data, 'nutrition')) this.writeRaw(this.KEYS.NUTRITION, data.nutrition);
            if (Object.prototype.hasOwnProperty.call(data, 'metrics')) this.writeRaw(this.KEYS.METRICS, data.metrics);
            if (Object.prototype.hasOwnProperty.call(data, 'goals')) this.writeRaw(this.KEYS.GOALS, data.goals);
            if (Object.prototype.hasOwnProperty.call(data, 'settings')) this.writeRaw(this.KEYS.SETTINGS, data.settings);
            this.migrate();
            if (window.CloudStorage && window.Auth?.getUserId()) {
                CloudStorage.debouncedSync();
            }
            return true;
        } catch (e) {
            console.error('Error importing data:', e);
            return false;
        }
    },

    // Clear all data
    clearAll() {
        Object.values(this.KEYS).forEach(key => localStorage.removeItem(key));
        this.applyTheme('dark');
    }
};

// Make Storage available globally
window.Storage = Storage;

// Migrate and apply persisted theme as soon as Storage is available.
Storage.init();

// Keep theme in sync when settings are updated from other tabs/windows.
window.addEventListener('storage', (event) => {
    if (event.key === Storage.KEYS.SETTINGS || event.key === Storage.KEYS.SCHEMA_VERSION) {
        Storage.migrate();
        Storage.applyTheme(Storage.settings.get().theme);
    }
});

// Re-apply migrations and theme after cloud sync loads account settings.
window.addEventListener('cloudDataLoaded', () => {
    Storage.migrate();
    Storage.applyTheme(Storage.settings.get().theme);
});
