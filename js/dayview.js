// Day View Module - Unified view for all data on a specific date

const DayView = {
    currentDate: null,

    escapeText(value) {
        if (window.escapeHtml) {
            return window.escapeHtml(value ?? '');
        }
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    normalizeWorkoutType(type) {
        if (window.Workouts?.WORKOUT_TYPES?.includes(type)) return type;
        return 'push';
    },

    // Open day view modal for a specific date
    open(dateStr) {
        this.currentDate = dateStr;
        this.render();
    },

    // Navigate to previous/next day
    navigate(direction) {
        if (!this.currentDate) return;

        const date = new Date(this.currentDate + 'T00:00:00');
        date.setDate(date.getDate() + direction);
        this.currentDate = date.toISOString().split('T')[0];
        this.render();
    },

    // Get all data for a specific date
    getDayData(dateStr) {
        const goals = Storage.goals.get();

        // Get workout for this date
        const workouts = Storage.workouts.findByDate(dateStr);
        const workout = workouts.length > 0 ? workouts[0] : null;

        // Get nutrition for this date
        const nutrition = Storage.nutrition.findByDate(dateStr);

        // Get metrics for this date
        const metrics = Storage.metrics.findByDate(dateStr);

        return {
            date: dateStr,
            workout,
            nutrition,
            metrics,
            goals
        };
    },

    // Render the day view modal
    render() {
        const data = this.getDayData(this.currentDate);
        const modal = this.getOrCreateModal();

        const dateObj = new Date(this.currentDate + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
        const safeFormattedDate = this.escapeText(formattedDate);

        const isToday = this.currentDate === Storage.getToday();

        modal.querySelector('.dayview-modal-body').innerHTML = `
            <div class="dayview-header">
                <button class="dayview-nav-btn" onclick="DayView.navigate(-1)">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <div class="dayview-date">
                    <h2>${safeFormattedDate}</h2>
                    ${isToday ? '<span class="today-badge">Today</span>' : ''}
                </div>
                <button class="dayview-nav-btn" onclick="DayView.navigate(1)">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>
            </div>

            ${this.renderQuickStats(data)}
            ${this.renderWorkoutSection(data)}
            ${this.renderNutritionSection(data)}
            ${this.renderMetricsSection(data)}
        `;

        modal.classList.add('active');
    },

    // Render quick stats bar
    renderQuickStats(data) {
        const { metrics, nutrition, goals, workout } = data;
        const weight = metrics?.weight || workout?.preWeight;
        const calories = nutrition?.totalCalories || 0;
        const protein = nutrition?.totalProtein || 0;
        const steps = metrics?.steps || nutrition?.steps || 0;

        const caloriesPct = goals.dailyCalories ? Math.min(100, Math.round((calories / goals.dailyCalories) * 100)) : 0;
        const proteinPct = goals.dailyProtein ? Math.min(100, Math.round((protein / goals.dailyProtein) * 100)) : 0;
        const stepsPct = goals.dailySteps ? Math.min(100, Math.round((steps / goals.dailySteps) * 100)) : 0;

        return `
            <div class="dayview-quick-stats">
                <div class="quick-stat-item">
                    <div class="quick-stat-icon weight-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 6v6l4 2"></path>
                        </svg>
                    </div>
                    <div class="quick-stat-content">
                        <span class="quick-stat-value">${weight ? weight.toFixed(1) : '--'}</span>
                        <span class="quick-stat-label">lbs</span>
                    </div>
                </div>
                <div class="quick-stat-item">
                    <div class="quick-stat-icon calories-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2a10 10 0 1 0 10 10H12V2z"></path>
                        </svg>
                    </div>
                    <div class="quick-stat-content">
                        <span class="quick-stat-value">${calories || '--'}</span>
                        <span class="quick-stat-label">cal</span>
                        ${calories ? `<div class="quick-stat-progress"><div class="progress-fill calories" style="width: ${caloriesPct}%"></div></div>` : ''}
                    </div>
                </div>
                <div class="quick-stat-item">
                    <div class="quick-stat-icon protein-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
                            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
                        </svg>
                    </div>
                    <div class="quick-stat-content">
                        <span class="quick-stat-value">${protein || '--'}</span>
                        <span class="quick-stat-label">g protein</span>
                        ${protein ? `<div class="quick-stat-progress"><div class="progress-fill protein" style="width: ${proteinPct}%"></div></div>` : ''}
                    </div>
                </div>
                <div class="quick-stat-item">
                    <div class="quick-stat-icon steps-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                        </svg>
                    </div>
                    <div class="quick-stat-content">
                        <span class="quick-stat-value">${steps ? steps.toLocaleString() : '--'}</span>
                        <span class="quick-stat-label">steps</span>
                        ${steps ? `<div class="quick-stat-progress"><div class="progress-fill steps" style="width: ${stepsPct}%"></div></div>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    // Render workout section
    renderWorkoutSection(data) {
        const { workout } = data;

        if (!workout) {
            return `
                <div class="dayview-section">
                    <div class="dayview-section-header">
                        <h3>Workout</h3>
                    </div>
                    <div class="dayview-empty-state">
                        <p>No workout logged</p>
                        <button class="btn btn-secondary btn-sm" onclick="DayView.close(); App.openModal('workout');">
                            + Log Workout
                        </button>
                    </div>
                </div>
            `;
        }

        const safeType = this.normalizeWorkoutType(workout.type);
        const typeBadgeClass = `badge-${safeType}`;
        const safeTypeLabel = this.escapeText(safeType);

        return `
            <div class="dayview-section">
                <div class="dayview-section-header">
                    <h3>Workout</h3>
                    <span class="badge ${typeBadgeClass}">${safeTypeLabel}</span>
                    ${workout.dayNumber ? `<span class="workout-day-num">#${workout.dayNumber}</span>` : ''}
                </div>

                ${workout.exercises && workout.exercises.length > 0 ? `
                    <div class="dayview-exercises">
                        ${workout.exercises.map(ex => `
                            <div class="dayview-exercise">
                                <span class="exercise-name">${this.escapeText(ex.name)}</span>
                                <div class="exercise-sets">
                                    ${ex.sets.map(set => `
                                        <span class="set-chip">${set.reps || '?'}${set.weight ? ` x ${set.weight}` : ''}</span>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${workout.cardio ? `
                    <div class="dayview-cardio">
                        <span class="cardio-badge">${this.escapeText(workout.cardio.type)}</span>
                        ${workout.cardio.distance ? `<span>${workout.cardio.distance} mi</span>` : ''}
                        ${workout.cardio.duration ? `<span>${this.escapeText(workout.cardio.duration)}</span>` : ''}
                    </div>
                ` : ''}

                ${workout.notes ? `
                    <div class="dayview-notes">"${this.escapeText(workout.notes)}"</div>
                ` : ''}

                ${workout.energyLevel ? `
                    <div class="dayview-energy">Energy: ${workout.energyLevel}/10</div>
                ` : ''}
            </div>
        `;
    },

    // Render nutrition section
    renderNutritionSection(data) {
        const { nutrition } = data;

        if (!nutrition) {
            return `
                <div class="dayview-section">
                    <div class="dayview-section-header">
                        <h3>Nutrition</h3>
                    </div>
                    <div class="dayview-empty-state">
                        <p>No nutrition logged</p>
                        <button class="btn btn-secondary btn-sm" onclick="DayView.close(); App.openModal('meal');">
                            + Log Meal
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="dayview-section">
                <div class="dayview-section-header">
                    <h3>Nutrition</h3>
                    <span class="nutrition-totals-badge">${nutrition.totalCalories || 0} cal / ${nutrition.totalProtein || 0}g</span>
                </div>

                ${nutrition.meals && nutrition.meals.length > 0 ? `
                    <div class="dayview-meals">
                        ${nutrition.meals.map(meal => `
                            <div class="dayview-meal">
                                <div class="meal-time-badge">${this.escapeText(meal.time)}</div>
                                <div class="meal-items">
                                    ${meal.items.map(item => `
                                        <div class="meal-item">
                                            <span class="item-name">${this.escapeText(item.name)}</span>
                                            <span class="item-macros">${item.calories} cal, ${item.protein}g</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${nutrition.foodWindow?.start ? `
                    <div class="dayview-food-window">
                        <span class="window-label">Food Window:</span>
                        <span class="window-times">${this.escapeText(nutrition.foodWindow.start)} - ${this.escapeText(nutrition.foodWindow.end)}</span>
                    </div>
                ` : ''}

                ${nutrition.supplements && nutrition.supplements.length > 0 ? `
                    <div class="dayview-supplements">
                        <span class="supplements-label">Supplements:</span>
                        <div class="supplements-list">
                            ${nutrition.supplements.map(s => `<span class="supplement-tag">${this.escapeText(s)}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                ${nutrition.alcohol?.drinks > 0 ? `
                    <div class="dayview-alcohol">
                        Alcohol: ${nutrition.alcohol.drinks} ${this.escapeText(nutrition.alcohol.type || 'drinks')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    // Render metrics section
    renderMetricsSection(data) {
        const { metrics, nutrition } = data;

        // Combine metrics from both sources
        const sleepHours = metrics?.sleepHours;
        const sleepQuality = metrics?.sleepQuality;
        const energyLevel = metrics?.energyLevel;
        const mood = metrics?.mood;
        const steps = metrics?.steps || nutrition?.steps;

        const hasMetrics = sleepHours || sleepQuality || energyLevel || mood;

        if (!hasMetrics) {
            return `
                <div class="dayview-section">
                    <div class="dayview-section-header">
                        <h3>Daily Metrics</h3>
                    </div>
                    <div class="dayview-empty-state">
                        <p>No metrics logged</p>
                        <button class="btn btn-secondary btn-sm" onclick="DayView.close(); App.openModal('metrics');">
                            + Log Metrics
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="dayview-section">
                <div class="dayview-section-header">
                    <h3>Daily Metrics</h3>
                </div>
                <div class="dayview-metrics-grid">
                    ${sleepHours ? `
                        <div class="metric-item">
                            <span class="metric-value">${sleepHours}</span>
                            <span class="metric-label">hrs sleep</span>
                        </div>
                    ` : ''}
                    ${sleepQuality ? `
                        <div class="metric-item">
                            <span class="metric-value">${sleepQuality}/10</span>
                            <span class="metric-label">sleep quality</span>
                        </div>
                    ` : ''}
                    ${energyLevel ? `
                        <div class="metric-item">
                            <span class="metric-value">${energyLevel}/10</span>
                            <span class="metric-label">energy</span>
                        </div>
                    ` : ''}
                    ${mood ? `
                        <div class="metric-item">
                            <span class="metric-value">${mood}/10</span>
                            <span class="metric-label">mood</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // Get or create the modal element
    getOrCreateModal() {
        let modal = document.getElementById('dayViewModal');

        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'dayViewModal';
            modal.className = 'modal dayview-modal';
            modal.innerHTML = `
                <div class="modal-content dayview-modal-content">
                    <div class="modal-header">
                        <h2>Day View</h2>
                        <button class="modal-close" onclick="DayView.close()">&times;</button>
                    </div>
                    <div class="modal-body dayview-modal-body">
                        <!-- Content populated by render() -->
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Close on background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.close();
            });

            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.classList.contains('active')) {
                    this.close();
                }
            });
        }

        return modal;
    },

    // Close the modal
    close() {
        const modal = document.getElementById('dayViewModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }
};

// Make DayView available globally
window.DayView = DayView;
