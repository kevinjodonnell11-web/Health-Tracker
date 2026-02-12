// Charts Module - Chart.js configurations and rendering

// Custom crosshair plugin for vertical line on hover
const crosshairPlugin = {
    id: 'crosshair',
    afterDraw: (chart) => {
        if (chart.tooltip._active && chart.tooltip._active.length) {
            const ctx = chart.ctx;
            const activePoint = chart.tooltip._active[0];
            const x = activePoint.element.x;
            const topY = chart.scales.y.top;
            const bottomY = chart.scales.y.bottom;

            // Draw vertical line
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x, topY);
            ctx.lineTo(x, bottomY);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(233, 69, 96, 0.5)';
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.restore();
        }
    }
};

// Register the plugin globally
Chart.register(crosshairPlugin);

const Charts = {
    instances: {},

    // Common chart options
    commonOptions: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false
        },
        hover: {
            mode: 'index',
            intersect: false
        },
        plugins: {
            legend: {
                display: false
            }
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    color: '#a0a0a0',
                    font: { size: 10 }
                }
            },
            y: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    color: '#a0a0a0',
                    font: { size: 10 }
                }
            }
        }
    },

    // Create weight trend chart
    createWeightChart(canvasId, days = 30) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        // Destroy existing chart
        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
        }

        const weightHistory = Metrics.getWeightHistory(days);
        const weightTrend = Metrics.calculateWeightTrend();
        const goals = Storage.goals.get();

        // Prepare data
        const labels = weightHistory.map(d => {
            const date = new Date(d.date + 'T00:00:00');
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        const data = weightHistory.map(d => d.weight);

        // Add projection data if available
        let projectionLabels = [];
        let projectionData = [];
        if (weightTrend.projection && weightTrend.projection.length > 0) {
            projectionLabels = weightTrend.projection.map(d => {
                const date = new Date(d.date + 'T00:00:00');
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            });
            projectionData = weightTrend.projection.map(d => d.weight);
        }

        // Calculate y-axis range
        const allWeights = [...data, ...projectionData, goals.weightGoal].filter(w => w);
        const minWeight = Math.min(...allWeights) - 5;
        const maxWeight = Math.max(...allWeights) + 5;

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [...labels, ...projectionLabels.slice(1)],
                datasets: [
                    {
                        label: 'Weight',
                        data: [...data, ...Array(projectionLabels.length - 1).fill(null)],
                        borderColor: '#e94560',
                        backgroundColor: 'rgba(233, 69, 96, 0.1)',
                        borderWidth: 2,
                        pointRadius: 3,
                        pointBackgroundColor: '#e94560',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Projection',
                        data: [...Array(data.length - 1).fill(null), data[data.length - 1], ...projectionData.slice(1)],
                        borderColor: '#a0a0a0',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false,
                        tension: 0.3
                    },
                    {
                        label: 'Goal',
                        data: Array(labels.length + projectionLabels.length - 1).fill(goals.weightGoal),
                        borderColor: '#00b894',
                        borderWidth: 1,
                        borderDash: [3, 3],
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                ...this.commonOptions,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                hover: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#a0a0a0',
                            boxWidth: 20,
                            font: { size: 10 }
                        }
                    },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(22, 33, 62, 0.95)',
                        titleColor: '#eee',
                        bodyColor: '#eee',
                        borderColor: 'rgba(233, 69, 96, 0.5)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            title: (tooltipItems) => {
                                return tooltipItems[0]?.label || '';
                            },
                            label: (context) => {
                                if (context.parsed.y === null) return null;
                                return ` ${context.dataset.label}: ${context.parsed.y?.toFixed(1)} lbs`;
                            }
                        },
                        filter: (tooltipItem) => tooltipItem.parsed.y !== null
                    },
                    crosshair: true
                },
                scales: {
                    ...this.commonOptions.scales,
                    y: {
                        ...this.commonOptions.scales.y,
                        min: minWeight,
                        max: maxWeight
                    }
                },
                onHover: (event, activeElements, chart) => {
                    chart.canvas.style.cursor = activeElements.length ? 'crosshair' : 'default';
                }
            }
        });

        this.instances[canvasId] = chart;
        return chart;
    },

    // Create sparkline chart (minimal weight trend)
    createSparkline(canvasId, days = 30) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
        }

        const weightHistory = Metrics.getWeightHistory(days);
        const data = weightHistory.map(d => d.weight);

        if (data.length === 0) return null;

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: weightHistory.map(() => ''),
                datasets: [{
                    data: data,
                    borderColor: '#e94560',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: {
                    x: { display: false },
                    y: { display: false }
                }
            }
        });

        this.instances[canvasId] = chart;
        return chart;
    },

    // Create workout frequency bar chart
    createWorkoutFrequencyChart(canvasId, weeks = 8) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
        }

        // Get workout counts by week
        const weekData = [];
        const today = new Date();

        for (let i = weeks - 1; i >= 0; i--) {
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay() - (i * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);

            const startStr = weekStart.toISOString().split('T')[0];
            const endStr = weekEnd.toISOString().split('T')[0];
            const workouts = Storage.workouts.getByDateRange(startStr, endStr);

            weekData.push({
                label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                count: workouts.length
            });
        }

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: weekData.map(w => w.label),
                datasets: [{
                    label: 'Workouts',
                    data: weekData.map(w => w.count),
                    backgroundColor: 'rgba(233, 69, 96, 0.7)',
                    borderColor: '#e94560',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                ...this.commonOptions,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#16213e',
                        titleColor: '#eee',
                        bodyColor: '#eee',
                        callbacks: {
                            label: (context) => `${context.parsed.y} workouts`
                        }
                    }
                },
                scales: {
                    ...this.commonOptions.scales,
                    y: {
                        ...this.commonOptions.scales.y,
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: '#a0a0a0'
                        }
                    }
                }
            }
        });

        this.instances[canvasId] = chart;
        return chart;
    },

    // Create workout type distribution pie chart
    createWorkoutTypeChart(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
        }

        const stats = Workouts.getStats();
        const types = Object.entries(stats.byType).filter(([_, count]) => count > 0);

        if (types.length === 0) return null;

        const colors = {
            push: '#e94560',
            pull: '#74b9ff',
            legs: '#00b894',
            upper: '#fdcb6e',
            cardio: '#a29bfe',
            superset: '#ff6b6b'
        };

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: types.map(([type]) => type.charAt(0).toUpperCase() + type.slice(1)),
                datasets: [{
                    data: types.map(([_, count]) => count),
                    backgroundColor: types.map(([type]) => colors[type] || '#666'),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#a0a0a0',
                            font: { size: 11 },
                            padding: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: '#16213e',
                        titleColor: '#eee',
                        bodyColor: '#eee',
                        callbacks: {
                            label: (context) => `${context.label}: ${context.parsed} workouts`
                        }
                    }
                }
            }
        });

        this.instances[canvasId] = chart;
        return chart;
    },

    // Create calories/protein trend chart
    createNutritionChart(canvasId, days = 30) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
        }

        const endDate = Storage.getToday();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startStr = startDate.toISOString().split('T')[0];

        const nutritionData = Storage.nutrition.getByDateRange(startStr, endDate)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (nutritionData.length === 0) return null;

        const goals = Storage.goals.get();

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: nutritionData.map(d => {
                    const date = new Date(d.date + 'T00:00:00');
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }),
                datasets: [
                    {
                        label: 'Calories',
                        data: nutritionData.map(d => d.totalCalories),
                        borderColor: '#fdcb6e',
                        backgroundColor: 'rgba(253, 203, 110, 0.1)',
                        borderWidth: 2,
                        pointRadius: 3,
                        fill: true,
                        tension: 0.3,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Protein',
                        data: nutritionData.map(d => d.totalProtein),
                        borderColor: '#74b9ff',
                        borderWidth: 2,
                        pointRadius: 3,
                        fill: false,
                        tension: 0.3,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Cal Goal',
                        data: Array(nutritionData.length).fill(goals.dailyCalories),
                        borderColor: '#fdcb6e',
                        borderWidth: 1,
                        borderDash: [3, 3],
                        pointRadius: 0,
                        fill: false,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Pro Goal',
                        data: Array(nutritionData.length).fill(goals.dailyProtein),
                        borderColor: '#74b9ff',
                        borderWidth: 1,
                        borderDash: [3, 3],
                        pointRadius: 0,
                        fill: false,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                ...this.commonOptions,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#a0a0a0',
                            boxWidth: 20,
                            font: { size: 10 }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#16213e',
                        titleColor: '#eee',
                        bodyColor: '#eee'
                    }
                },
                scales: {
                    x: this.commonOptions.scales.x,
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#fdcb6e', font: { size: 10 } },
                        title: { display: true, text: 'Calories', color: '#fdcb6e' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { color: '#74b9ff', font: { size: 10 } },
                        title: { display: true, text: 'Protein (g)', color: '#74b9ff' }
                    }
                }
            }
        });

        this.instances[canvasId] = chart;
        return chart;
    },

    // Create exercise progress chart
    createExerciseProgressChart(canvasId, exerciseName, days = 90) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
        }

        const endDate = Storage.getToday();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startStr = startDate.toISOString().split('T')[0];

        const workouts = Storage.workouts.getByDateRange(startStr, endDate);

        // Extract max weight for each workout for this exercise
        const progressData = [];
        workouts.forEach(workout => {
            const exercise = workout.exercises?.find(e =>
                e.name.toLowerCase().includes(exerciseName.toLowerCase())
            );
            if (exercise && exercise.sets.length > 0) {
                const maxWeight = Math.max(...exercise.sets.map(s => s.weight || 0));
                const maxReps = Math.max(...exercise.sets.map(s => s.reps || 0));
                if (maxWeight > 0) {
                    progressData.push({
                        date: workout.date,
                        weight: maxWeight,
                        reps: maxReps
                    });
                }
            }
        });

        if (progressData.length === 0) return null;

        progressData.sort((a, b) => new Date(a.date) - new Date(b.date));

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: progressData.map(d => {
                    const date = new Date(d.date + 'T00:00:00');
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }),
                datasets: [{
                    label: 'Max Weight',
                    data: progressData.map(d => d.weight),
                    borderColor: '#e94560',
                    backgroundColor: 'rgba(233, 69, 96, 0.1)',
                    borderWidth: 2,
                    pointRadius: 4,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                ...this.commonOptions,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#16213e',
                        titleColor: '#eee',
                        bodyColor: '#eee',
                        callbacks: {
                            label: (context) => {
                                const d = progressData[context.dataIndex];
                                return `${d.weight} lbs x ${d.reps} reps`;
                            }
                        }
                    }
                }
            }
        });

        this.instances[canvasId] = chart;
        return chart;
    },

    // Destroy all charts
    destroyAll() {
        Object.values(this.instances).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.instances = {};
    }
};

// Make Charts available globally
window.Charts = Charts;
