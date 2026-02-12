// Main App Initialization

// Local data is intentionally preserved between refreshes.
// Auth + cloud sync handle user isolation and synchronization.

// Utility: Throttle function for scroll/resize events
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

function safeText(value) {
    return window.escapeHtml ? window.escapeHtml(value ?? '') : String(value ?? '');
}

function safeInsightType(type) {
    return ['positive', 'warning', 'negative', 'info'].includes(type) ? type : 'info';
}

const App = {
    currentWeightDays: 30, // Default time range for weight chart
    dataLoaded: false,
    _renderQueued: false,

    init() {
        this.setupEventListeners();
        this.setupModal();
        this.setupKeyboardShortcuts();
        this.setupTimeRangeSelectors();
        this.setupFAB();
        this.setupPullToRefresh();
        this.setupRefreshButton();
        this.setupHeaderScroll();

        // Wait for auth state before rendering
        this.checkAuthAndRender();
    },

    // Header scroll effect
    setupHeaderScroll() {
        const header = document.querySelector('.main-header');
        if (!header) return;

        const handleScroll = throttle(() => {
            if (window.scrollY > 10) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        }, 100);

        window.addEventListener('scroll', handleScroll, { passive: true });
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

    // Render all dashboard components with batched updates
    renderDashboard() {
        // Prevent multiple renders in the same frame
        if (this._renderQueued) return;
        this._renderQueued = true;

        requestAnimationFrame(() => {
            this._renderQueued = false;

            // Batch DOM reads first
            const dashboard = document.querySelector('.dashboard');
            if (!dashboard) return;

            // Then batch DOM writes
            this.renderTodaySummary();
            this.renderWeekCalendar();
            this.renderWorkoutStreak();
            this.renderLifetimeStats();
            this.renderInsights();
            this.renderUpcoming();
            this.renderProgressRings();
            this.renderWorkoutProgress();
            this.enhanceClickableStats();

            // Defer heavy chart rendering
            requestAnimationFrame(() => {
                this.renderWeightChart();
            });
        });
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

    // Render lifetime stats
    renderLifetimeStats() {
        const container = document.getElementById('lifetimeStats');
        if (!container) return;

        const stats = Workouts.getLifetimeStats();

        // Find top PR to highlight
        let topPR = null;
        let topPRWeight = 0;
        Object.entries(stats.exercisePRs).forEach(([name, pr]) => {
            if (pr.weight > topPRWeight) {
                topPRWeight = pr.weight;
                topPR = { name, ...pr };
            }
        });

        container.innerHTML = `
            <div class="lifetime-stat clickable-stat" data-action="workouts" title="View all workouts">
                <span class="stat-value">${stats.totalVolumeFormatted}</span>
                <span class="stat-label">Lbs Lifted</span>
            </div>
            <div class="lifetime-stat clickable-stat" data-action="analytics-workouts" title="Open workout analytics">
                <span class="stat-value">${stats.totalReps.toLocaleString()}</span>
                <span class="stat-label">Total Reps</span>
            </div>
            <div class="lifetime-stat clickable-stat" data-action="analytics-workouts" title="Open workout analytics">
                <span class="stat-value">${stats.totalSets.toLocaleString()}</span>
                <span class="stat-label">Total Sets</span>
            </div>
            <div class="lifetime-stat clickable-stat" data-action="analytics-workouts" title="Open workout analytics">
                <span class="stat-value">${stats.uniqueExercises}</span>
                <span class="stat-label">Exercises</span>
            </div>
            ${stats.mostFrequentExercise ? `
                <div class="lifetime-stat clickable-stat" data-action="workouts" style="grid-column: span 2;" title="View workout history">
                    <span class="stat-value" style="font-size: 1rem;">${safeText(stats.mostFrequentExercise)}</span>
                    <span class="stat-label">Most Frequent (${stats.mostFrequentExerciseCount}x)</span>
                </div>
            ` : ''}
            ${topPR ? `
                <div class="lifetime-stat clickable-stat" data-action="analytics-exercise" style="grid-column: span 2;" title="Open exercise progress">
                    <span class="stat-value" style="font-size: 1rem;">${safeText(topPR.name)}: ${topPR.weight} lbs</span>
                    <span class="stat-label">Top PR (${topPR.reps} reps)</span>
                </div>
            ` : ''}
        `;
    },

    // Render insights
    renderInsights() {
        const insights = Analytics.generateInsights();
        const container = document.getElementById('insightsList');

        if (insights.length === 0 || (insights.length === 1 && insights[0].category === 'general')) {
            container.innerHTML = `<p class="insight-placeholder">${safeText(insights[0]?.text || 'Log more data to see personalized insights')}</p>`;
            return;
        }

        // Show top 3 insights
        container.innerHTML = insights.slice(0, 3).map(insight => `
            <div class="insight-item ${safeInsightType(insight.type)}">
                <p class="insight-text">${safeText(insight.text)}</p>
            </div>
        `).join('');
    },

    // Render upcoming workout suggestion
    renderUpcoming() {
        const suggestion = Workouts.getSuggestedWorkout();
        const container = document.getElementById('upcomingWorkout');

        container.innerHTML = `
            <div class="suggested-workout">
                <div class="workout-type-badge">${safeText(suggestion.type)}</div>
                <div class="workout-suggestion-text">
                    <strong>Suggested Next Workout</strong>
                    <p class="workout-suggestion-reason">${safeText(suggestion.reason)}</p>
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

        // Clickable stats - event delegation
        this.setupClickableStats();
    },

    // Setup clickable stats for navigation
    setupClickableStats() {
        document.addEventListener('click', (e) => {
            // Don't interfere with modal interactions
            if (e.target.closest('.modal')) return;

            // Don't interfere with any interactive elements
            if (e.target.closest('button') ||
                e.target.closest('a') ||
                e.target.closest('input') ||
                e.target.closest('select') ||
                e.target.closest('textarea') ||
                e.target.closest('form') ||
                e.target.closest('.btn') ||
                e.target.closest('[onclick]')) {
                return;
            }

            const clickableStat = e.target.closest('.clickable-stat');
            if (!clickableStat) return;

            const action = clickableStat.dataset.action;
            if (!action) return;

            e.preventDefault();
            this.handleStatAction(action);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const target = e.target.closest('.clickable-stat');
            if (!target) return;
            if (target.matches('button, a, input, select, textarea')) return;
            const action = target.dataset.action;
            if (!action) return;
            e.preventDefault();
            this.handleStatAction(action);
        });
    },

    handleStatAction(action) {
        switch (action) {
            case 'weight':
                window.location.href = 'pages/analytics.html?focus=weight-trend';
                break;

            case 'nutrition':
            case 'nutrition-week':
                window.location.href = 'pages/nutrition.html';
                break;

            case 'metrics':
                if (window.DayView) {
                    DayView.open(Storage.getToday());
                }
                break;

            case 'workouts':
                window.location.href = 'pages/workouts.html?view=all';
                break;

            case 'workouts-week':
                window.location.href = 'pages/workouts.html?view=recent';
                break;

            case 'analytics-workouts':
                window.location.href = 'pages/analytics.html?focus=workout-frequency';
                break;

            case 'analytics-exercise':
                window.location.href = 'pages/analytics.html?focus=exercise-progress';
                break;

            case 'last-workout': {
                const streak = Workouts.getStreakInfo();
                if (streak.lastWorkout && window.DayView) {
                    DayView.open(streak.lastWorkout);
                } else {
                    window.location.href = 'pages/workouts.html?view=all';
                }
                break;
            }

            default:
                break;
        }
    },

    enhanceClickableStats() {
        document.querySelectorAll('.clickable-stat').forEach((el) => {
            if (el.matches('a, button, input, select, textarea')) return;
            if (!el.hasAttribute('tabindex')) {
                el.setAttribute('tabindex', '0');
            }
            if (!el.hasAttribute('role')) {
                el.setAttribute('role', 'button');
            }
        });
    },

    // Setup modal
    setupModal() {
        const modal = document.getElementById('quickLogModal');
        const closeBtn = document.getElementById('modalClose');

        closeBtn?.addEventListener('click', () => this.closeModal());
        // Also handle touchend for reliable mobile close
        closeBtn?.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.closeModal();
        }, { passive: false });

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
                try {
                    content = Workouts.renderWorkoutForm();
                } catch (error) {
                    console.error('Error rendering workout form:', error);
                    content = '<p>Error loading form</p>';
                }
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

        // Setup form handlers and mobile touch handlers after DOM is updated
        requestAnimationFrame(() => {
            try {
                this.setupFormHandlers(type);
                // Add touchend handlers for all action buttons inside the modal (for mobile)
                modalBody.querySelectorAll('.action-btn[onclick]').forEach(btn => {
                    btn.addEventListener('touchend', (e) => {
                        e.preventDefault();
                        // Trigger the onclick
                        btn.click();
                    }, { passive: false });
                });
            } catch (error) {
                console.error('Error in setupFormHandlers:', error);
            }
        });
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
            const handleGuidedSubmit = (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                const formData = new FormData(form);
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
            };

            form.addEventListener('submit', handleGuidedSubmit);

            // Add touchend handler for mobile
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    handleGuidedSubmit(e);
                }, { passive: false });
            }
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
        const form = document.getElementById('workoutForm');
        const exercisesList = document.getElementById('exercisesList');
        const addExerciseBtn = document.getElementById('addExerciseBtn');
        const workoutTypeSelect = document.getElementById('workoutType');

        if (!form || !exercisesList || !addExerciseBtn || !workoutTypeSelect) {
            console.error('Workout form elements not found:', { form, exercisesList, addExerciseBtn, workoutTypeSelect });
            return;
        }

        let exerciseCount = 0;

        const addExercise = () => {
            const workoutType = workoutTypeSelect.value;
            const exerciseHtml = Workouts.renderExerciseBlock(exerciseCount, workoutType);
            exercisesList.insertAdjacentHTML('beforeend', exerciseHtml);

            const block = exercisesList.querySelector(`[data-index="${exerciseCount}"]`);
            if (block) {
                const removeBtn = block.querySelector('.remove-exercise');
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => block.remove());
                }
            }

            exerciseCount++;
        };

        // Add first exercise
        addExercise();

        addExerciseBtn.addEventListener('click', addExercise);
        addExerciseBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            addExercise();
        }, { passive: false });

        // Event delegation for dynamic elements (add set, copy set, exercise select)
        // Handle touchend for mobile - delegate same as click
        exercisesList.addEventListener('touchend', (e) => {
            const addSetBtn = e.target.closest('.add-set-btn');
            const copyBtn = e.target.closest('.copy-set-btn');
            const removeSetBtn = e.target.closest('.remove-set-btn');
            if (addSetBtn || copyBtn || removeSetBtn) {
                e.preventDefault();
                // Let the click handler do the work
                (addSetBtn || copyBtn || removeSetBtn).click();
            }
        }, { passive: false });

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
            // Remove set button
            const removeSetBtn = e.target.closest('.remove-set-btn');
            if (removeSetBtn) {
                const setRow = removeSetBtn.closest('.set-row');
                const setsContainer = setRow.parentElement;
                // Only remove if more than 1 set remains
                if (setsContainer.querySelectorAll('.set-row').length > 1) {
                    setRow.remove();
                    // Renumber remaining sets
                    setsContainer.querySelectorAll('.set-row').forEach((row, i) => {
                        row.querySelector('.set-number').textContent = i + 1;
                    });
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

        workoutTypeSelect.addEventListener('change', (e) => {
            const workoutType = e.target.value;
            // Update exercise dropdowns for all exercise blocks
            document.querySelectorAll('.exercise-block').forEach(block => {
                const select = block.querySelector('.exercise-select');
                const hiddenInput = block.querySelector('.exercise-name');
                const currentValue = hiddenInput?.value || '';

                if (select) {
                    const defaultExercises = Workouts.COMMON_EXERCISES[workoutType] || [];
                    const settings = Storage.settings.get();
                    const customExercises = settings.customExercises || [];
                    const allExercises = [...new Set([...defaultExercises, ...customExercises])].sort();

                    // Check if current value is in the new list
                    const isInList = allExercises.includes(currentValue);

                    select.innerHTML = `
                        <option value="">Select exercise...</option>
                        ${allExercises.map(ex => `<option value="${safeText(ex)}" ${ex === currentValue ? 'selected' : ''}>${safeText(ex)}</option>`).join('')}
                        <option value="__custom__" ${currentValue && !isInList ? 'selected' : ''}>+ Add custom...</option>
                    `;
                }
            });
        });

        // Form submission handler function
        const handleSubmit = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }

            try {
                const formData = new FormData(form);
                const result = Workouts.handleWorkoutSubmit(formData);
                if (result) {
                    this.closeModal();
                    this.renderDashboard();
                    this.showToast('Workout logged successfully!', 'success');
                } else {
                    this.showToast('Failed to save workout', 'error');
                }
            } catch (error) {
                console.error('Error saving workout:', error);
                this.showToast('Error saving workout: ' + error.message, 'error');
            }

            return false;
        };

        // Attach to form submit event
        form.onsubmit = handleSubmit;

        // Also attach click and touchend handlers directly to submit button for mobile compatibility
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.addEventListener('click', (e) => {
                handleSubmit(e);
            });
            // Touchend handler for mobile Safari
            submitBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                handleSubmit(e);
            }, { passive: false });
        } else {
            console.error('Submit button not found in form');
        }
    },

    // Meal form setup
    setupMealForm() {
        const form = document.getElementById('mealForm');
        const foodList = document.getElementById('foodItemsList');
        const foodQuickAdd = document.getElementById('foodQuickAdd');
        const addCustomFoodBtn = document.getElementById('addCustomFood');

        if (!form || !foodList) {
            console.error('Meal form elements not found');
            return;
        }

        let foodItemCount = 0;

        const addFoodItem = (name = '', calories = '', protein = '') => {
            foodList.insertAdjacentHTML('beforeend', Nutrition.renderFoodItemRow(foodItemCount, name, calories, protein));

            const row = foodList.querySelector(`[data-index="${foodItemCount}"]`);
            if (row) {
                const removeBtn = row.querySelector('.remove-food');
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        row.remove();
                        updateMealTotals();
                    });
                }
                row.querySelectorAll('input').forEach(input => {
                    input.addEventListener('change', updateMealTotals);
                });
            }

            foodItemCount++;
        };

        const updateMealTotals = () => {
            let totalCal = 0, totalPro = 0;
            document.querySelectorAll('.food-item-row').forEach(row => {
                const calInput = row.querySelector('.food-calories');
                const proInput = row.querySelector('.food-protein');
                totalCal += parseInt(calInput?.value) || 0;
                totalPro += parseInt(proInput?.value) || 0;
            });
            const calTotalEl = document.getElementById('mealCalTotal');
            const proTotalEl = document.getElementById('mealProTotal');
            if (calTotalEl) calTotalEl.textContent = totalCal;
            if (proTotalEl) proTotalEl.textContent = totalPro;
        };

        // Add first food item
        addFoodItem();

        if (foodQuickAdd) {
            foodQuickAdd.addEventListener('change', (e) => {
                if (e.target.value) {
                    const food = Nutrition.FOOD_DATABASE[e.target.value];
                    if (food) {
                        addFoodItem(e.target.value, food.calories, food.protein);
                        e.target.value = '';
                        updateMealTotals();
                    }
                }
            });
        }

        if (addCustomFoodBtn) {
            addCustomFoodBtn.addEventListener('click', () => addFoodItem());
        }

        const handleMealSubmit = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }

            try {
                const formData = new FormData(form);
                if (Nutrition.handleMealSubmit(formData)) {
                    this.closeModal();
                    this.renderDashboard();
                    this.showToast('Meal logged successfully!', 'success');
                } else {
                    this.showToast('Failed to save meal', 'error');
                }
            } catch (error) {
                console.error('Error saving meal:', error);
                this.showToast('Error saving meal: ' + error.message, 'error');
            }
        };

        form.addEventListener('submit', handleMealSubmit);

        // Add touchend handler for mobile
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                handleMealSubmit(e);
            }, { passive: false });
        }
    },

    // Weight form setup
    setupWeightForm() {
        const form = document.getElementById('weightForm');
        if (!form) {
            console.error('Weight form not found');
            return;
        }

        const handleWeightSubmit = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            const formData = new FormData(form);
            if (Metrics.handleWeightSubmit(formData)) {
                this.closeModal();
                this.renderDashboard();
                this.showToast('Weight logged successfully!', 'success');
            }
        };

        form.addEventListener('submit', handleWeightSubmit);

        // Add touchend handler for mobile
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                handleWeightSubmit(e);
            }, { passive: false });
        }
    },

    // Metrics form setup
    setupMetricsForm() {
        const form = document.getElementById('metricsForm');
        if (!form) {
            console.error('Metrics form not found');
            return;
        }

        const handleMetricsSubmit = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            const formData = new FormData(form);
            if (Metrics.handleMetricsSubmit(formData)) {
                this.closeModal();
                this.renderDashboard();
                this.showToast('Metrics logged successfully!', 'success');
            }
        };

        form.addEventListener('submit', handleMetricsSubmit);

        // Add touchend handler for mobile
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                handleMetricsSubmit(e);
            }, { passive: false });
        }
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

        // Toggle FAB menu - use both click and touchend for mobile
        const toggleFAB = (e) => {
            e.stopPropagation();
            fabContainer.classList.toggle('active');
        };
        fabMain.addEventListener('click', toggleFAB);

        // Handle FAB option clicks/taps
        const handleFABOption = (e) => {
            const option = e.target.closest('.fab-option');
            if (option) {
                e.preventDefault();
                e.stopPropagation();
                const action = option.dataset.action;
                fabContainer.classList.remove('active');
                this.openModal(action);
            }
        };
        fabMenu?.addEventListener('click', handleFABOption);
        fabMenu?.addEventListener('touchend', (e) => {
            const option = e.target.closest('.fab-option');
            if (option) {
                e.preventDefault();
                handleFABOption(e);
            }
        }, { passive: false });

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

        const createRing = (pct, colorClass, value, label, action) => {
            const offset = circumference - (pct / 100) * circumference;
            return `
                <div class="progress-ring-item clickable-stat" data-action="${action}" title="View ${label.toLowerCase()} details">
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
            ${createRing(caloriesPct, 'calories', calories, 'Calories', 'nutrition')}
            ${createRing(proteinPct, 'protein', protein, 'Protein', 'nutrition')}
            ${createRing(stepsPct, 'steps', steps, 'Steps', 'metrics')}
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

    // Pull to refresh for PWA - DISABLED due to mobile click offset issues
    setupPullToRefresh() {
        // This feature is disabled - it causes touch position bugs on iOS Safari
        // Use the refresh button instead (setupRefreshButton)
        const pullIndicator = document.getElementById('pullToRefresh');
        if (pullIndicator) {
            pullIndicator.style.display = 'none';
        }
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
