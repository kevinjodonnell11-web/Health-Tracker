// Main App Initialization

// IMMEDIATELY clear all data on page load - data will be loaded from cloud after auth
(function() {
    localStorage.removeItem('health_tracker_workouts');
    localStorage.removeItem('health_tracker_nutrition');
    localStorage.removeItem('health_tracker_metrics');
    localStorage.removeItem('health_tracker_goals');
    localStorage.removeItem('health_tracker_settings');
    console.log('localStorage cleared on page load');
})();

const App = {
    currentWeightDays: 30, // Default time range for weight chart
    dataLoaded: false,

    init() {
        this.setupEventListeners();
        this.setupModal();
        this.setupKeyboardShortcuts();
        this.setupTimeRangeSelectors();
        this.setupFAB();
        this.setupPullToRefresh();
        this.setupRefreshButton();

        // Wait for auth state before rendering
        this.checkAuthAndRender();
    },

    // Check auth state and render appropriately
    checkAuthAndRender() {
        // Listen for auth state changes
        window.addEventListener('authStateChanged', (e) => {
            if (e.detail.user && this.dataLoaded) {
                // User is signed in AND data is loaded - render dashboard
                this.renderDashboard();
            } else if (!e.detail.user) {
                // User is signed out - show login prompt
                this.showLoginPrompt();
            }
        });

        // Listen for data loaded event
        window.addEventListener('cloudDataLoaded', () => {
            this.dataLoaded = true;
            if (window.Auth?.currentUser) {
                this.renderDashboard();
            }
        });

        // Initial render (will show login prompt if not signed in)
        setTimeout(() => {
            if (!window.Auth?.currentUser) {
                this.showLoginPrompt();
            }
        }, 1500);
    },

    // Show login prompt instead of dashboard
    showLoginPrompt() {
        const dashboard = document.querySelector('.dashboard');
        if (dashboard) {
            dashboard.innerHTML = `
                <div class="login-prompt">
                    <div class="login-prompt-content">
                        <h2>Welcome to Health Tracker</h2>
                        <p>Sign in to track your workouts, nutrition, and progress across all your devices.</p>
                        <button class="btn btn-primary btn-lg" onclick="Auth.signInWithGoogle()">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 10px;">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            Sign in with Google
                        </button>
                        <p class="login-subtext">Your data is private and only visible to you.</p>
                    </div>
                </div>
            `;
        }
    },

    // Render all dashboard components
    renderDashboard() {
        this.renderTodaySummary();
        this.renderWeightChart();
        this.renderWeekCalendar();
        this.renderWorkoutStreak();
        this.renderInsights();
        this.renderUpcoming();
        this.renderProgressRings();
        this.renderWorkoutProgress();
    },

    // Render today's summary card
    renderTodaySummary() {
        const summary = Metrics.getTodaySummary();
        const goals = summary.goals;

        document.getElementById('todayWeight').textContent = summary.weight?.toFixed(1) || '--';
        document.getElementById('todaySteps').textContent = summary.steps?.toLocaleString() || '--';
        document.getElementById('todayCalories').textContent = summary.calories || '--';
        document.getElementById('todayProtein').textContent = summary.protein ? `${summary.protein}g` : '--';
        document.getElementById('todaySleep').textContent = summary.sleepHours?.toFixed(1) || '--';

        document.getElementById('caloriesGoal').textContent = `/ ${goals.dailyCalories} goal`;
        document.getElementById('proteinGoal').textContent = `/ ${goals.dailyProtein}g goal`;
    },

    // Render weight trend chart
    renderWeightChart() {
        // Use currentWeightDays if set, otherwise default to 30
        // Note: 0 means "All time" so we treat it as 365 days
        const days = this.currentWeightDays !== undefined ? this.currentWeightDays : 30;
        const effectiveDays = days === 0 ? 730 : days; // 730 days = ~2 years for "All time"
        const weightHistory = Metrics.getWeightHistory(effectiveDays);
        const weightTrend = Metrics.calculateWeightTrend();

        if (weightHistory.length > 0) {
            Charts.createWeightChart('weightChart', effectiveDays);
        }

        // Update goal ETA
        const etaEl = document.getElementById('weightGoalEta');
        if (weightTrend.goalEta) {
            etaEl.querySelector('.eta-value').textContent =
                `${weightTrend.goalEta.formatted} (${weightTrend.goalEta.daysRemaining} days)`;
            etaEl.querySelector('.eta-value').className = 'eta-value';
        } else if (weightTrend.trend === 'up') {
            etaEl.querySelector('.eta-value').textContent = 'Weight trending up - adjust intake';
            etaEl.querySelector('.eta-value').className = 'eta-value text-warning';
        } else if (weightHistory.length < 3) {
            etaEl.querySelector('.eta-value').textContent = 'Enter more weight data for projection';
            etaEl.querySelector('.eta-value').className = 'eta-value text-muted';
        }
    },

    // Render week calendar
    renderWeekCalendar() {
        const weekDays = Metrics.getWeekCalendar();
        const weekStats = Metrics.getWeekStats();

        const calendarHtml = weekDays.map(day => {
            const dots = [];
            if (day.hasWorkout) dots.push('<span class="week-dot workout" title="Workout"></span>');
            if (day.hasNutrition) dots.push('<span class="week-dot nutrition" title="Nutrition"></span>');
            if (day.hasWeight) dots.push('<span class="week-dot weight" title="Weight"></span>');

            return `
                <div class="week-day ${day.isToday ? 'today' : ''} ${day.hasWorkout ? 'has-workout' : ''} ${day.hasNutrition ? 'has-nutrition' : ''}"
                     onclick="DayView.open('${day.date}')" style="cursor: pointer;">
                    <span class="day-label">${day.dayName}</span>
                    <span class="day-number">${day.dayNumber}</span>
                    ${dots.length > 0 ? `<div class="week-day-dots">${dots.join('')}</div>` : '<span class="day-indicator none">·</span>'}
                </div>
            `;
        }).join('');

        document.getElementById('weekCalendar').innerHTML = calendarHtml;
        document.getElementById('weekWorkouts').textContent = weekStats.workoutCount;
        document.getElementById('weekAvgCalories').textContent = weekStats.avgCalories || '--';
        document.getElementById('weekAvgProtein').textContent = weekStats.avgProtein ? `${weekStats.avgProtein}g` : '--';
    },

    // Render workout streak card
    renderWorkoutStreak() {
        const streak = Workouts.getStreakInfo();
        const weekStats = Metrics.getWeekStats();

        document.getElementById('streakCount').textContent = streak.streak;
        document.getElementById('lastWorkoutType').textContent = streak.lastType ?
            streak.lastType.charAt(0).toUpperCase() + streak.lastType.slice(1) : '--';
        document.getElementById('daysSinceWorkout').textContent = streak.daysSince !== null ?
            `${streak.daysSince} day${streak.daysSince !== 1 ? 's' : ''}` : '--';
        document.getElementById('workoutsThisWeek').textContent = `${weekStats.workoutCount} workout${weekStats.workoutCount !== 1 ? 's' : ''}`;
    },

    // Render insights
    renderInsights() {
        const insights = Analytics.generateInsights();
        const container = document.getElementById('insightsList');

        if (insights.length === 0 || (insights.length === 1 && insights[0].category === 'general')) {
            container.innerHTML = `<p class="insight-placeholder">${insights[0]?.text || 'Log more data to see personalized insights'}</p>`;
            return;
        }

        // Show top 3 insights
        container.innerHTML = insights.slice(0, 3).map(insight => `
            <div class="insight-item ${insight.type}">
                <p class="insight-text">${insight.text}</p>
            </div>
        `).join('');
    },

    // Render upcoming workout suggestion
    renderUpcoming() {
        const suggestion = Workouts.getSuggestedWorkout();
        const container = document.getElementById('upcomingWorkout');

        container.innerHTML = `
            <div class="suggested-workout">
                <div class="workout-type-badge">${suggestion.type}</div>
                <div class="workout-suggestion-text">
                    <strong>Suggested Next Workout</strong>
                    <p class="workout-suggestion-reason">${suggestion.reason}</p>
                </div>
            </div>
        `;
    },

    // Setup event listeners
    setupEventListeners() {
        // Quick log buttons
        document.getElementById('quickLogBtn')?.addEventListener('click', () => this.openQuickLogMenu());
        document.getElementById('logWorkoutBtn')?.addEventListener('click', () => this.openModal('workout'));
        document.getElementById('logMealBtn')?.addEventListener('click', () => this.openModal('meal'));
        document.getElementById('logWeightBtn')?.addEventListener('click', () => this.openModal('weight'));
        document.getElementById('logMetricsBtn')?.addEventListener('click', () => this.openModal('metrics'));
    },

    // Setup modal
    setupModal() {
        const modal = document.getElementById('quickLogModal');
        const closeBtn = document.getElementById('modalClose');

        closeBtn?.addEventListener('click', () => this.closeModal());
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });

        // Handle keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    },

    // Open quick log menu
    openQuickLogMenu() {
        this.openModal('quicklog');
    },

    // Open modal with specific form
    openModal(type) {
        const modal = document.getElementById('quickLogModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        let title = '';
        let content = '';

        switch (type) {
            case 'quicklog':
                title = 'Quick Log';
                content = `
                    <div class="quick-log-options">
                        <button class="action-btn action-btn-featured" onclick="App.openModal('guided')">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                                <path d="M2 17l10 5 10-5"></path>
                                <path d="M2 12l10 5 10-5"></path>
                            </svg>
                            Guided Workout
                            <span class="action-btn-badge">Smart</span>
                        </button>
                        <button class="action-btn" onclick="App.openModal('workout')">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M6.5 6.5h11v11h-11z"></path>
                                <path d="M6.5 1v5.5M17.5 1v5.5M6.5 17.5V23M17.5 17.5V23M1 6.5h5.5M1 17.5h5.5M17.5 6.5H23M17.5 17.5H23"></path>
                            </svg>
                            Log Workout
                        </button>
                        <button class="action-btn" onclick="App.openModal('meal')">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
                                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
                            </svg>
                            Log Meal
                        </button>
                        <button class="action-btn" onclick="App.openModal('weight')">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 6v6l4 2"></path>
                            </svg>
                            Log Weight
                        </button>
                        <button class="action-btn" onclick="App.openModal('metrics')">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                            </svg>
                            Log Metrics
                        </button>
                    </div>
                `;
                break;

            case 'workout':
                title = 'Log Workout';
                content = Workouts.renderWorkoutForm();
                break;

            case 'meal':
                title = 'Log Meal';
                content = Nutrition.renderMealForm();
                break;

            case 'weight':
                title = 'Log Weight';
                content = Metrics.renderWeightForm();
                break;

            case 'metrics':
                title = 'Log Daily Metrics';
                content = Metrics.renderMetricsForm();
                break;

            case 'guided':
                title = 'Guided Workout';
                content = Workouts.renderGuidedWorkoutSelection();
                break;

            case 'guided-active':
                title = 'Guided Workout';
                content = Workouts.renderGuidedWorkoutUI();
                break;
        }

        modalTitle.textContent = title;
        modalBody.innerHTML = content;
        modal.classList.add('active');

        // Setup form handlers
        this.setupFormHandlers(type);
    },

    // Close modal
    closeModal() {
        const modal = document.getElementById('quickLogModal');
        modal?.classList.remove('active');
    },

    // Setup form handlers after modal opens
    setupFormHandlers(type) {
        switch (type) {
            case 'workout':
                this.setupWorkoutForm();
                break;
            case 'meal':
                this.setupMealForm();
                break;
            case 'weight':
                this.setupWeightForm();
                break;
            case 'metrics':
                this.setupMetricsForm();
                break;
            case 'guided-active':
                this.setupGuidedWorkoutForm();
                break;
        }
    },

    // Guided workout methods
    startGuidedWorkout(workoutType) {
        Workouts.startGuidedWorkout(workoutType);
        this.openModal('guided-active');
    },

    setupGuidedWorkoutForm() {
        const form = document.getElementById('guidedSetForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const reps = formData.get('reps');
                const weight = formData.get('weight');

                const result = Workouts.recordGuidedSet(reps, weight);

                if (result && result.complete) {
                    // Workout complete
                    this.closeModal();
                    this.renderDashboard();
                    this.showToast('Workout completed and saved!', 'success');
                } else if (result) {
                    // Next set - re-render the form
                    this.openModal('guided-active');
                }
            });
        }
    },

    guidedSkipExercise() {
        const result = Workouts.skipExercise();
        if (result && result.complete) {
            this.closeModal();
            this.renderDashboard();
            this.showToast('Workout completed and saved!', 'success');
        } else if (result) {
            this.openModal('guided-active');
        }
    },

    guidedCancel() {
        if (confirm('End this workout? Your progress will be saved.')) {
            const result = Workouts.finishGuidedWorkout();
            this.closeModal();
            this.renderDashboard();
            if (result && result.workout) {
                this.showToast('Workout saved!', 'success');
            }
        }
    },

    // Workout form setup
    setupWorkoutForm() {
        let exerciseCount = 0;

        const addExercise = () => {
            const workoutType = document.getElementById('workoutType').value;
            const container = document.getElementById('exercisesList');
            const exerciseHtml = Workouts.renderExerciseBlock(exerciseCount, workoutType);
            container.insertAdjacentHTML('beforeend', exerciseHtml);

            const block = container.querySelector(`[data-index="${exerciseCount}"]`);
            block.querySelector('.remove-exercise').addEventListener('click', () => block.remove());

            exerciseCount++;
        };

        // Add first exercise
        addExercise();

        document.getElementById('addExerciseBtn').addEventListener('click', addExercise);

        // Event delegation for dynamic elements (add set, copy set, exercise select)
        const exercisesList = document.getElementById('exercisesList');

        exercisesList.addEventListener('click', (e) => {
            // Add set button
            const addSetBtn = e.target.closest('.add-set-btn');
            if (addSetBtn) {
                const exerciseIndex = addSetBtn.dataset.exercise;
                const setsContainer = document.getElementById(`sets_${exerciseIndex}`);
                const setCount = setsContainer.querySelectorAll('.set-row').length;
                // Get values from last set to prefill
                const lastSet = setsContainer.querySelector('.set-row:last-child');
                const lastReps = lastSet?.querySelector('.set-reps')?.value || '';
                const lastWeight = lastSet?.querySelector('.set-weight')?.value || '';
                setsContainer.insertAdjacentHTML('beforeend', Workouts.renderSetRow(exerciseIndex, setCount, lastReps, lastWeight));
            }
            // Copy set button - copies current row values to next row (or creates new)
            const copyBtn = e.target.closest('.copy-set-btn');
            if (copyBtn) {
                const exerciseIndex = copyBtn.dataset.exercise;
                const setIndex = parseInt(copyBtn.dataset.set);
                const setsContainer = document.getElementById(`sets_${exerciseIndex}`);
                const currentRow = setsContainer.querySelector(`[data-set="${setIndex}"]`);
                const reps = currentRow.querySelector('.set-reps').value;
                const weight = currentRow.querySelector('.set-weight').value;

                // Check if next row exists
                const nextRow = setsContainer.querySelector(`[data-set="${setIndex + 1}"]`);
                if (nextRow) {
                    // Fill next row with current values
                    nextRow.querySelector('.set-reps').value = reps;
                    nextRow.querySelector('.set-weight').value = weight;
                } else {
                    // Create new row with current values
                    const setCount = setsContainer.querySelectorAll('.set-row').length;
                    setsContainer.insertAdjacentHTML('beforeend', Workouts.renderSetRow(exerciseIndex, setCount, reps, weight));
                }
            }
        });

        // Handle exercise select dropdown and custom input
        exercisesList.addEventListener('change', (e) => {
            // Exercise dropdown changed
            if (e.target.classList.contains('exercise-select')) {
                const index = e.target.dataset.index;
                const block = e.target.closest('.exercise-block');
                const customInput = block.querySelector('.exercise-custom');
                const hiddenInput = block.querySelector('.exercise-name');

                if (e.target.value === '__custom__') {
                    // Show custom input
                    customInput.style.display = 'block';
                    customInput.focus();
                    hiddenInput.value = '';
                } else {
                    // Hide custom input, use selected value
                    customInput.style.display = 'none';
                    customInput.value = '';
                    hiddenInput.value = e.target.value;
                }
            }
            // Custom exercise input changed
            if (e.target.classList.contains('exercise-custom')) {
                const block = e.target.closest('.exercise-block');
                const hiddenInput = block.querySelector('.exercise-name');
                hiddenInput.value = e.target.value;
            }
        });

        // Also handle input event for custom exercise (for real-time updates)
        exercisesList.addEventListener('input', (e) => {
            if (e.target.classList.contains('exercise-custom')) {
                const block = e.target.closest('.exercise-block');
                const hiddenInput = block.querySelector('.exercise-name');
                hiddenInput.value = e.target.value;
            }
        });

        document.getElementById('workoutType').addEventListener('change', (e) => {
            const workoutType = e.target.value;
            // Update exercise dropdowns for all exercise blocks
            document.querySelectorAll('.exercise-block').forEach(block => {
                const select = block.querySelector('.exercise-select');
                const hiddenInput = block.querySelector('.exercise-name');
                const currentValue = hiddenInput.value;

                if (select) {
                    const defaultExercises = Workouts.COMMON_EXERCISES[workoutType] || [];
                    const settings = Storage.settings.get();
                    const customExercises = settings.customExercises || [];
                    const allExercises = [...new Set([...defaultExercises, ...customExercises])].sort();

                    // Check if current value is in the new list
                    const isInList = allExercises.includes(currentValue);

                    select.innerHTML = `
                        <option value="">Select exercise...</option>
                        ${allExercises.map(ex => `<option value="${ex}" ${ex === currentValue ? 'selected' : ''}>${ex}</option>`).join('')}
                        <option value="__custom__" ${currentValue && !isInList ? 'selected' : ''}>+ Add custom...</option>
                    `;
                }
            });
        });

        document.getElementById('workoutForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            if (Workouts.handleWorkoutSubmit(formData)) {
                this.closeModal();
                this.renderDashboard();
                this.showToast('Workout logged successfully!', 'success');
            }
        });
    },

    // Meal form setup
    setupMealForm() {
        let foodItemCount = 0;

        const addFoodItem = (name = '', calories = '', protein = '') => {
            const foodList = document.getElementById('foodItemsList');
            foodList.insertAdjacentHTML('beforeend', Nutrition.renderFoodItemRow(foodItemCount, name, calories, protein));

            const row = foodList.querySelector(`[data-index="${foodItemCount}"]`);
            row.querySelector('.remove-food').addEventListener('click', () => {
                row.remove();
                updateMealTotals();
            });
            row.querySelectorAll('input').forEach(input => {
                input.addEventListener('change', updateMealTotals);
            });

            foodItemCount++;
        };

        const updateMealTotals = () => {
            let totalCal = 0, totalPro = 0;
            document.querySelectorAll('.food-item-row').forEach(row => {
                totalCal += parseInt(row.querySelector('.food-calories').value) || 0;
                totalPro += parseInt(row.querySelector('.food-protein').value) || 0;
            });
            document.getElementById('mealCalTotal').textContent = totalCal;
            document.getElementById('mealProTotal').textContent = totalPro;
        };

        // Add first food item
        addFoodItem();

        document.getElementById('foodQuickAdd').addEventListener('change', (e) => {
            if (e.target.value) {
                const food = Nutrition.FOOD_DATABASE[e.target.value];
                addFoodItem(e.target.value, food.calories, food.protein);
                e.target.value = '';
                updateMealTotals();
            }
        });

        document.getElementById('addCustomFood').addEventListener('click', () => addFoodItem());

        document.getElementById('mealForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            if (Nutrition.handleMealSubmit(formData)) {
                this.closeModal();
                this.renderDashboard();
                this.showToast('Meal logged successfully!', 'success');
            }
        });
    },

    // Weight form setup
    setupWeightForm() {
        document.getElementById('weightForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            if (Metrics.handleWeightSubmit(formData)) {
                this.closeModal();
                this.renderDashboard();
                this.showToast('Weight logged successfully!', 'success');
            }
        });
    },

    // Metrics form setup
    setupMetricsForm() {
        document.getElementById('metricsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            if (Metrics.handleMetricsSubmit(formData)) {
                this.closeModal();
                this.renderDashboard();
                this.showToast('Metrics logged successfully!', 'success');
            }
        });
    },

    // Setup keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Check for Cmd (Mac) or Ctrl (Windows/Linux)
            const modifier = e.metaKey || e.ctrlKey;

            if (modifier) {
                switch (e.key.toLowerCase()) {
                    case 'w':
                        // Cmd+W - Log Workout (but not close tab)
                        if (!e.shiftKey) {
                            e.preventDefault();
                            this.openModal('workout');
                        }
                        break;
                    case 'm':
                        // Cmd+M - Log Meal
                        e.preventDefault();
                        this.openModal('meal');
                        break;
                    case 'k':
                        // Cmd+K - Log Weight
                        e.preventDefault();
                        this.openModal('weight');
                        break;
                    case 'd':
                        // Cmd+D - Open Day View for today
                        e.preventDefault();
                        DayView.open(Storage.getToday());
                        break;
                }
            }
        });
    },

    // Setup time range selectors
    setupTimeRangeSelectors() {
        const weightTimeRange = document.getElementById('weightTimeRange');
        if (weightTimeRange) {
            weightTimeRange.addEventListener('click', (e) => {
                if (e.target.classList.contains('time-range-btn')) {
                    // Update active button
                    weightTimeRange.querySelectorAll('.time-range-btn').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    e.target.classList.add('active');

                    // Update chart
                    const days = parseInt(e.target.dataset.days, 10);
                    this.currentWeightDays = days;
                    this.renderWeightChart();
                }
            });
        }
    },

    // Setup Floating Action Button
    setupFAB() {
        const fabContainer = document.getElementById('fabContainer');
        const fabMain = document.getElementById('fabMain');
        const fabMenu = document.getElementById('fabMenu');

        if (!fabContainer || !fabMain) return;

        // Toggle FAB menu
        fabMain.addEventListener('click', () => {
            fabContainer.classList.toggle('active');
        });

        // Handle FAB option clicks
        fabMenu?.addEventListener('click', (e) => {
            const option = e.target.closest('.fab-option');
            if (option) {
                const action = option.dataset.action;
                fabContainer.classList.remove('active');
                this.openModal(action);
            }
        });

        // Close FAB when clicking outside
        document.addEventListener('click', (e) => {
            if (fabContainer.classList.contains('active') &&
                !fabContainer.contains(e.target)) {
                fabContainer.classList.remove('active');
            }
        });

        // Close FAB on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && fabContainer.classList.contains('active')) {
                fabContainer.classList.remove('active');
            }
        });
    },

    // Show toast notification
    showToast(message, type = 'info', duration = 3000) {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // Render progress rings for daily goals
    renderProgressRings() {
        const container = document.getElementById('progressRings');
        if (!container) return;

        const summary = Metrics.getTodaySummary();
        const goals = summary.goals;

        const calories = summary.calories || 0;
        const protein = summary.protein || 0;
        const steps = summary.steps || 0;

        const caloriesPct = goals.dailyCalories ? Math.min(100, Math.round((calories / goals.dailyCalories) * 100)) : 0;
        const proteinPct = goals.dailyProtein ? Math.min(100, Math.round((protein / goals.dailyProtein) * 100)) : 0;
        const stepsPct = goals.dailySteps ? Math.min(100, Math.round((steps / goals.dailySteps) * 100)) : 0;

        // SVG parameters for circular progress
        const radius = 28;
        const circumference = 2 * Math.PI * radius;

        const createRing = (pct, colorClass, value, label) => {
            const offset = circumference - (pct / 100) * circumference;
            return `
                <div class="progress-ring-item">
                    <div class="progress-ring">
                        <svg viewBox="0 0 70 70">
                            <circle class="progress-ring-bg" cx="35" cy="35" r="${radius}"></circle>
                            <circle class="progress-ring-fill ${colorClass}"
                                    cx="35" cy="35" r="${radius}"
                                    stroke-dasharray="${circumference}"
                                    stroke-dashoffset="${offset}"></circle>
                        </svg>
                        <span class="progress-ring-text">${pct}%</span>
                    </div>
                    <span class="progress-ring-label">${label}</span>
                </div>
            `;
        };

        container.innerHTML = `
            ${createRing(caloriesPct, 'calories', calories, 'Calories')}
            ${createRing(proteinPct, 'protein', protein, 'Protein')}
            ${createRing(stepsPct, 'steps', steps, 'Steps')}
        `;
    },

    // Render workout progress bar
    renderWorkoutProgress() {
        const countEl = document.getElementById('workoutProgressCount');
        const fillEl = document.getElementById('workoutProgressFill');

        if (!countEl || !fillEl) return;

        const weekStats = Metrics.getWeekStats();
        const goals = Storage.goals.get();
        const target = goals.weeklyWorkouts || 4;
        const current = weekStats.workoutCount;
        const pct = Math.min(100, Math.round((current / target) * 100));

        countEl.textContent = `${current}/${target}`;
        fillEl.style.width = `${pct}%`;
    },

    // Pull to refresh for PWA
    setupPullToRefresh() {
        const pullIndicator = document.getElementById('pullToRefresh');
        if (!pullIndicator) return;

        let startY = 0;
        let currentY = 0;
        let isPulling = false;
        const threshold = 80;

        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!isPulling) return;

            currentY = e.touches[0].clientY;
            const pullDistance = currentY - startY;

            if (pullDistance > 0 && window.scrollY === 0) {
                pullIndicator.classList.add('visible');
                if (pullDistance > threshold) {
                    pullIndicator.querySelector('span').textContent = 'Release to refresh';
                } else {
                    pullIndicator.querySelector('span').textContent = 'Pull down to refresh';
                }
            }
        }, { passive: true });

        document.addEventListener('touchend', () => {
            if (!isPulling) return;

            const pullDistance = currentY - startY;
            if (pullDistance > threshold && window.scrollY === 0) {
                pullIndicator.classList.add('refreshing');
                this.refreshPage();
            } else {
                pullIndicator.classList.remove('visible');
            }

            isPulling = false;
            startY = 0;
            currentY = 0;
        }, { passive: true });
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

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Make App available globally
window.App = App;
