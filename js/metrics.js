// Metrics Module - Weight, Sleep, Steps tracking

const Metrics = {
    // Get today's metrics summary for dashboard (falls back to most recent data)
    getTodaySummary() {
        const today = Storage.getToday();
        const goals = Storage.goals.get();

        // Get today's data first
        let metricsEntry = Storage.metrics.findByDate(today);
        let nutritionEntry = Storage.nutrition.findByDate(today);
        let workoutEntry = Storage.workouts.findByDate(today)[0];

        // For weight, get the most recent if not available today
        let weight = metricsEntry?.weight || workoutEntry?.preWeight || null;
        if (!weight) {
            const recentWorkouts = Storage.workouts.getLatest(1);
            const recentMetrics = Storage.metrics.getLatest(1);
            weight = recentWorkouts[0]?.preWeight || recentMetrics[0]?.weight || null;
        }

        // For calories/protein, get most recent if not available today
        let calories = nutritionEntry?.totalCalories || null;
        let protein = nutritionEntry?.totalProtein || null;
        if (!calories) {
            const recentNutrition = Storage.nutrition.getLatest(1);
            if (recentNutrition[0]) {
                calories = recentNutrition[0].totalCalories || null;
                protein = recentNutrition[0].totalProtein || null;
            }
        }

        // For steps, check multiple sources
        let steps = metricsEntry?.steps || nutritionEntry?.steps || null;
        if (!steps) {
            const recentMetrics = Storage.metrics.getLatest(5);
            const withSteps = recentMetrics.find(m => m.steps);
            steps = withSteps?.steps || null;
        }

        // For sleep, get most recent if not available today
        let sleepHours = metricsEntry?.sleepHours || null;
        let sleepQuality = metricsEntry?.sleepQuality || null;
        if (!sleepHours) {
            const recentMetrics = Storage.metrics.getLatest(5);
            const withSleep = recentMetrics.find(m => m.sleepHours);
            if (withSleep) {
                sleepHours = withSleep.sleepHours;
                sleepQuality = withSleep.sleepQuality;
            }
        }

        return {
            weight,
            steps,
            calories,
            protein,
            sleepHours,
            sleepQuality,
            energyLevel: metricsEntry?.energyLevel || null,
            mood: metricsEntry?.mood || null,
            goals: goals,
            isToday: !!(metricsEntry || nutritionEntry || workoutEntry)
        };
    },

    // Log weight
    logWeight(weight, date = null) {
        date = date || Storage.getToday();
        let entry = Storage.metrics.findByDate(date);

        if (entry) {
            Storage.metrics.update(entry.id, { weight });
        } else {
            Storage.metrics.add({
                date,
                weight,
                sleepHours: null,
                sleepQuality: null,
                steps: null,
                energyLevel: null,
                mood: null,
                workoutCompleted: false,
                nutritionCompleted: false
            });
        }
        return weight;
    },

    // Log sleep
    logSleep(hours, quality = null, date = null) {
        date = date || Storage.getToday();
        let entry = Storage.metrics.findByDate(date);

        if (entry) {
            Storage.metrics.update(entry.id, {
                sleepHours: hours,
                sleepQuality: quality
            });
        } else {
            Storage.metrics.add({
                date,
                weight: null,
                sleepHours: hours,
                sleepQuality: quality,
                steps: null,
                energyLevel: null,
                mood: null,
                workoutCompleted: false,
                nutritionCompleted: false
            });
        }
        return { hours, quality };
    },

    // Log steps
    logSteps(steps, date = null) {
        date = date || Storage.getToday();
        let entry = Storage.metrics.findByDate(date);

        if (entry) {
            Storage.metrics.update(entry.id, { steps });
        } else {
            Storage.metrics.add({
                date,
                weight: null,
                sleepHours: null,
                sleepQuality: null,
                steps,
                energyLevel: null,
                mood: null,
                workoutCompleted: false,
                nutritionCompleted: false
            });
        }
        return steps;
    },

    // Log energy level (1-10)
    logEnergy(level, date = null) {
        date = date || Storage.getToday();
        let entry = Storage.metrics.findByDate(date);

        if (entry) {
            Storage.metrics.update(entry.id, { energyLevel: level });
        } else {
            Storage.metrics.add({
                date,
                weight: null,
                sleepHours: null,
                sleepQuality: null,
                steps: null,
                energyLevel: level,
                mood: null,
                workoutCompleted: false,
                nutritionCompleted: false
            });
        }
        return level;
    },

    // Log full daily metrics
    logDailyMetrics(data) {
        const date = data.date || Storage.getToday();
        let entry = Storage.metrics.findByDate(date);

        const metrics = {
            date,
            weight: data.weight || null,
            sleepHours: data.sleepHours || null,
            sleepQuality: data.sleepQuality || null,
            steps: data.steps || null,
            energyLevel: data.energyLevel || null,
            mood: data.mood || null,
            workoutCompleted: data.workoutCompleted || false,
            nutritionCompleted: data.nutritionCompleted || false
        };

        if (entry) {
            return Storage.metrics.update(entry.id, metrics);
        } else {
            return Storage.metrics.add(metrics);
        }
    },

    // Get weight history for charts
    getWeightHistory(days = 30) {
        const endDate = Storage.getToday();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startStr = startDate.toISOString().split('T')[0];

        const metrics = Storage.metrics.getByDateRange(startStr, endDate);
        const workouts = Storage.workouts.getByDateRange(startStr, endDate);

        // Combine weights from metrics and workout pre-weights
        const weightMap = new Map();

        metrics.forEach(m => {
            if (m.weight && !weightMap.has(m.date)) {
                weightMap.set(m.date, m.weight);
            }
        });

        workouts.forEach(w => {
            if (w.preWeight && !weightMap.has(w.date)) {
                weightMap.set(w.date, w.preWeight);
            }
        });

        // Convert to sorted array
        return Array.from(weightMap.entries())
            .map(([date, weight]) => ({ date, weight }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    // Calculate weight trend and goal ETA
    calculateWeightTrend() {
        const history = this.getWeightHistory(30);
        const goals = Storage.goals.get();

        if (history.length < 2) {
            return {
                trend: null,
                weeklyChange: null,
                projection: null,
                goalEta: null
            };
        }

        // Calculate linear regression
        const n = history.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

        history.forEach((point, i) => {
            sumX += i;
            sumY += point.weight;
            sumXY += i * point.weight;
            sumX2 += i * i;
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Weekly change rate
        const weeklyChange = slope * 7;

        // Current weight (latest)
        const currentWeight = history[history.length - 1].weight;

        // Days to goal
        const goalWeight = goals.weightGoal;
        const weightToLose = currentWeight - goalWeight;

        let goalEta = null;
        if (slope < 0 && weightToLose > 0) {
            const daysToGoal = Math.ceil(weightToLose / Math.abs(slope));
            const goalDate = new Date();
            goalDate.setDate(goalDate.getDate() + daysToGoal);
            goalEta = {
                date: goalDate.toISOString().split('T')[0],
                formatted: goalDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                }),
                daysRemaining: daysToGoal
            };
        }

        // Generate projection points
        const projection = [];
        for (let i = 0; i < 14; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            projection.push({
                date: date.toISOString().split('T')[0],
                weight: currentWeight + (slope * i)
            });
        }

        return {
            trend: slope < 0 ? 'down' : slope > 0 ? 'up' : 'stable',
            weeklyChange: weeklyChange.toFixed(1),
            currentWeight,
            projection,
            goalEta,
            slope,
            intercept
        };
    },

    // Get week stats for dashboard
    getWeekStats() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

        const weekStart = monday.toISOString().split('T')[0];
        const weekEnd = Storage.getToday();

        const workouts = Storage.workouts.getByDateRange(weekStart, weekEnd);
        const nutrition = Storage.nutrition.getByDateRange(weekStart, weekEnd);
        const metrics = Storage.metrics.getByDateRange(weekStart, weekEnd);

        // Calculate averages
        let totalCalories = 0, totalProtein = 0, nutritionDays = 0;
        nutrition.forEach(n => {
            if (n.totalCalories) {
                totalCalories += n.totalCalories;
                totalProtein += n.totalProtein || 0;
                nutritionDays++;
            }
        });

        return {
            workoutCount: workouts.length,
            avgCalories: nutritionDays > 0 ? Math.round(totalCalories / nutritionDays) : null,
            avgProtein: nutritionDays > 0 ? Math.round(totalProtein / nutritionDays) : null,
            workoutDates: workouts.map(w => w.date),
            nutritionDates: nutrition.map(n => n.date)
        };
    },

    // Build week calendar data
    getWeekCalendar() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

        const weekStart = monday.toISOString().split('T')[0];
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const weekEnd = sunday.toISOString().split('T')[0];

        const weekStats = this.getWeekStats();

        // Get weight data for the week
        const metrics = Storage.metrics.getByDateRange(weekStart, weekEnd);
        const workouts = Storage.workouts.getByDateRange(weekStart, weekEnd);
        const weightDates = new Set([
            ...metrics.filter(m => m.weight).map(m => m.date),
            ...workouts.filter(w => w.preWeight).map(w => w.date)
        ]);

        const days = [];
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const todayStr = Storage.getToday();

            days.push({
                dayName: dayNames[i],
                dayNumber: date.getDate(),
                date: dateStr,
                isToday: dateStr === todayStr,
                hasWorkout: weekStats.workoutDates.includes(dateStr),
                hasNutrition: weekStats.nutritionDates.includes(dateStr),
                hasWeight: weightDates.has(dateStr)
            });
        }

        return days;
    },

    // Render weight quick log form
    renderWeightForm() {
        const today = Storage.getToday();
        const todayMetrics = Storage.metrics.findByDate(today);
        const currentWeight = todayMetrics?.weight || '';

        return `
            <form id="weightForm" class="quick-log-form">
                <div class="form-group">
                    <label class="form-label">Date</label>
                    <input type="date" class="form-input" name="date" value="${today}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Weight (lbs)</label>
                    <input type="number" class="form-input" name="weight" step="0.1"
                           placeholder="e.g., 225.5" value="${currentWeight}" required>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Weight</button>
                </div>
            </form>
        `;
    },

    // Render full metrics form
    renderMetricsForm() {
        const today = Storage.getToday();
        const todayMetrics = Storage.metrics.findByDate(today);

        return `
            <form id="metricsForm" class="quick-log-form">
                <div class="form-group">
                    <label class="form-label">Date</label>
                    <input type="date" class="form-input" name="date" value="${today}" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Weight (lbs)</label>
                        <input type="number" class="form-input" name="weight" step="0.1"
                               placeholder="225.5" value="${todayMetrics?.weight || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Steps</label>
                        <input type="number" class="form-input" name="steps"
                               placeholder="10000" value="${todayMetrics?.steps || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Sleep Hours</label>
                        <input type="number" class="form-input" name="sleepHours" step="0.5"
                               placeholder="7.5" value="${todayMetrics?.sleepHours || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sleep Quality (1-10)</label>
                        <input type="number" class="form-input" name="sleepQuality" min="1" max="10"
                               placeholder="8" value="${todayMetrics?.sleepQuality || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Energy Level (1-10)</label>
                        <input type="number" class="form-input" name="energyLevel" min="1" max="10"
                               placeholder="7" value="${todayMetrics?.energyLevel || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Mood (1-10)</label>
                        <input type="number" class="form-input" name="mood" min="1" max="10"
                               placeholder="7" value="${todayMetrics?.mood || ''}">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Metrics</button>
                </div>
            </form>
        `;
    },

    // Handle weight form submission
    handleWeightSubmit(formData) {
        const date = formData.get('date');
        const weight = parseFloat(formData.get('weight'));

        if (weight && !isNaN(weight)) {
            this.logWeight(weight, date);
            return true;
        }
        return false;
    },

    // Handle metrics form submission
    handleMetricsSubmit(formData) {
        const data = {
            date: formData.get('date'),
            weight: formData.get('weight') ? parseFloat(formData.get('weight')) : null,
            steps: formData.get('steps') ? parseInt(formData.get('steps')) : null,
            sleepHours: formData.get('sleepHours') ? parseFloat(formData.get('sleepHours')) : null,
            sleepQuality: formData.get('sleepQuality') ? parseInt(formData.get('sleepQuality')) : null,
            energyLevel: formData.get('energyLevel') ? parseInt(formData.get('energyLevel')) : null,
            mood: formData.get('mood') ? parseInt(formData.get('mood')) : null
        };

        this.logDailyMetrics(data);
        return true;
    }
};

// Make Metrics available globally
window.Metrics = Metrics;
