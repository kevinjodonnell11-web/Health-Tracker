const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createLocalStorage(seed = {}) {
    const store = new Map(Object.entries(seed));
    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
        clear() {
            store.clear();
        },
        toJSON() {
            return Object.fromEntries(store.entries());
        }
    };
}

function createDocumentStub() {
    return {
        documentElement: {
            setAttribute(name, value) {
                this[name] = value;
            }
        },
        createElement() {
            return {
                _textContent: '',
                set textContent(value) {
                    this._textContent = String(value);
                },
                get innerHTML() {
                    return this._textContent
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');
                }
            };
        }
    };
}

function loadStorage(seed = {}) {
    const localStorage = createLocalStorage(seed);
    const document = createDocumentStub();
    const window = {
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {}
    };

    const context = {
        console,
        Date,
        Math,
        JSON,
        window,
        document,
        localStorage,
        CustomEvent: class CustomEvent {
            constructor(type, init = {}) {
                this.type = type;
                this.detail = init.detail;
            }
        }
    };

    window.window = window;
    window.document = document;
    window.localStorage = localStorage;

    const storagePath = path.join(__dirname, '..', 'js', 'storage.js');
    const script = fs.readFileSync(storagePath, 'utf8');
    vm.createContext(context);
    vm.runInContext(script, context, { filename: 'storage.js' });

    return { Storage: window.Storage, localStorage, document };
}

test('legacy data is migrated to schema v2 and normalized', () => {
    const legacySeed = {
        health_tracker_workouts: JSON.stringify([
            {
                date: '2026-02-01T14:00:00.000Z',
                type: 'invalid',
                exercises: [{ name: 'Bench Press', sets: [{ reps: '8', weight: '135' }] }]
            }
        ]),
        health_tracker_settings: JSON.stringify({
            darkMode: false,
            workoutSplit: 'push,pull,legs,invalid'
        })
    };

    const { Storage } = loadStorage(legacySeed);
    const settings = Storage.settings.get();
    const workouts = Storage.workouts.getAll();

    assert.equal(settings.schemaVersion, 2);
    assert.equal(settings.theme, 'light');
    assert.equal(settings.darkMode, false);
    assert.deepEqual(Array.from(settings.workoutSplit), ['push', 'pull', 'legs']);
    assert.equal(settings.onboardingCompleted, true);
    assert.equal(workouts.length, 1);
    assert.equal(workouts[0].type, 'push');
    assert.equal(typeof workouts[0].id, 'string');
    assert.match(workouts[0].date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(workouts[0].exercises[0].sets[0].reps, 8);
    assert.equal(workouts[0].exercises[0].sets[0].weight, 135);
});

test('onboarding completion persists profile + goals and suppresses prompt', () => {
    const { Storage } = loadStorage();
    assert.equal(Storage.onboarding.shouldPrompt(), true);

    Storage.onboarding.complete({
        profile: {
            displayName: 'Alex',
            primaryGoal: 'performance',
            experienceLevel: 'advanced',
            units: 'metric'
        },
        goals: {
            dailyCalories: 2450,
            dailyProtein: 185,
            weeklyWorkouts: 5,
            dailySteps: 9000
        }
    });

    const profile = Storage.profile.get();
    const goals = Storage.goals.get();
    const settings = Storage.settings.get();

    assert.equal(profile.displayName, 'Alex');
    assert.equal(profile.primaryGoal, 'performance');
    assert.equal(profile.experienceLevel, 'advanced');
    assert.equal(profile.units, 'metric');
    assert.equal(goals.dailyCalories, 2450);
    assert.equal(goals.dailyProtein, 185);
    assert.equal(goals.weeklyWorkouts, 5);
    assert.equal(goals.dailySteps, 9000);
    assert.equal(settings.onboardingCompleted, true);
    assert.equal(Storage.onboarding.shouldPrompt(), false);
});

test('onboarding defer and reset correctly gate prompt visibility', () => {
    const { Storage } = loadStorage();
    assert.equal(Storage.onboarding.shouldPrompt(), true);

    Storage.onboarding.defer(3);
    assert.equal(Storage.onboarding.shouldPrompt(), false);

    Storage.onboarding.reset();
    assert.equal(Storage.onboarding.shouldPrompt(), true);
});

test('importAll supports explicit empty arrays and keeps schema normalized', () => {
    const { Storage } = loadStorage({
        health_tracker_workouts: JSON.stringify([{ id: 'w1', date: '2026-01-01', type: 'push', exercises: [] }]),
        health_tracker_nutrition: JSON.stringify([{ id: 'n1', date: '2026-01-01', totalCalories: 2200, totalProtein: 160 }]),
        health_tracker_metrics: JSON.stringify([{ id: 'm1', date: '2026-01-01', weight: 210 }])
    });

    const imported = Storage.importAll({
        workouts: [],
        nutrition: [],
        metrics: [],
        goals: { dailyCalories: 2000, dailyProtein: 170, weeklyWorkouts: 4, dailySteps: 8000, weightGoal: 205 },
        settings: { darkMode: false, theme: 'light' }
    });

    assert.equal(imported, true);
    assert.equal(Storage.workouts.getAll().length, 0);
    assert.equal(Storage.nutrition.getAll().length, 0);
    assert.equal(Storage.metrics.getAll().length, 0);
    assert.equal(Storage.goals.get().dailyCalories, 2000);
    assert.equal(Storage.settings.get().schemaVersion, 2);
    assert.equal(Storage.settings.get().theme, 'light');
});
