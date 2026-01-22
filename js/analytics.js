// Analytics Module - Predictive analysis and insights engine

const Analytics = {
    // Minimum data points needed for analysis
    MIN_DATA_POINTS: 7,

    // Generate all insights
    generateInsights() {
        const insights = [];

        // Get all required data
        const workouts = Storage.workouts.getAll();
        const nutrition = Storage.nutrition.getAll();
        const metrics = Storage.metrics.getAll();

        if (workouts.length < this.MIN_DATA_POINTS &&
            nutrition.length < this.MIN_DATA_POINTS) {
            return [{
                type: 'info',
                text: 'Log more data to see personalized insights. Need at least 7 days of data.',
                category: 'general'
            }];
        }

        // Run all analysis functions
        const sleepPerformance = this.analyzeSleepPerformance(workouts, metrics);
        if (sleepPerformance) insights.push(sleepPerformance);

        const restDayImpact = this.analyzeRestDayImpact(workouts);
        if (restDayImpact) insights.push(restDayImpact);

        const proteinImpact = this.analyzeProteinImpact(workouts, nutrition);
        if (proteinImpact) insights.push(proteinImpact);

        const alcoholImpact = this.analyzeAlcoholImpact(workouts, nutrition);
        if (alcoholImpact) insights.push(alcoholImpact);

        const weightProgress = this.analyzeWeightProgress();
        if (weightProgress) insights.push(weightProgress);

        const bestDays = this.analyzeBestWorkoutDays(workouts);
        if (bestDays) insights.push(bestDays);

        const workoutConsistency = this.analyzeWorkoutConsistency(workouts);
        if (workoutConsistency) insights.push(workoutConsistency);

        const nutritionConsistency = this.analyzeNutritionConsistency(nutrition);
        if (nutritionConsistency) insights.push(nutritionConsistency);

        return insights.length > 0 ? insights : [{
            type: 'info',
            text: 'Keep logging data to unlock more insights!',
            category: 'general'
        }];
    },

    // Analyze sleep impact on workout performance
    analyzeSleepPerformance(workouts, metrics) {
        if (workouts.length < 5 || metrics.length < 5) return null;

        const metricsMap = new Map(metrics.map(m => [m.date, m]));
        const workoutsWithSleep = [];

        workouts.forEach(workout => {
            // Get previous night's sleep
            const prevDate = new Date(workout.date + 'T00:00:00');
            prevDate.setDate(prevDate.getDate() - 1);
            const prevDateStr = prevDate.toISOString().split('T')[0];
            const prevMetrics = metricsMap.get(prevDateStr);

            if (prevMetrics?.sleepHours && workout.energyLevel) {
                workoutsWithSleep.push({
                    sleep: prevMetrics.sleepHours,
                    energy: workout.energyLevel
                });
            }
        });

        if (workoutsWithSleep.length < 5) return null;

        // Compare high sleep vs low sleep
        const avgSleep = workoutsWithSleep.reduce((sum, w) => sum + w.sleep, 0) / workoutsWithSleep.length;
        const highSleep = workoutsWithSleep.filter(w => w.sleep >= avgSleep);
        const lowSleep = workoutsWithSleep.filter(w => w.sleep < avgSleep);

        if (highSleep.length < 2 || lowSleep.length < 2) return null;

        const highSleepEnergy = highSleep.reduce((sum, w) => sum + w.energy, 0) / highSleep.length;
        const lowSleepEnergy = lowSleep.reduce((sum, w) => sum + w.energy, 0) / lowSleep.length;

        const diff = ((highSleepEnergy - lowSleepEnergy) / lowSleepEnergy * 100).toFixed(0);

        if (Math.abs(diff) > 5) {
            return {
                type: diff > 0 ? 'positive' : 'warning',
                text: `Your workout energy is ${Math.abs(diff)}% ${diff > 0 ? 'higher' : 'lower'} after ${avgSleep.toFixed(1)}+ hours of sleep.`,
                category: 'sleep'
            };
        }

        return null;
    },

    // Analyze rest day impact on performance
    analyzeRestDayImpact(workouts) {
        if (workouts.length < 10) return null;

        const sortedWorkouts = [...workouts].sort((a, b) => new Date(a.date) - new Date(b.date));
        const workoutsWithRest = [];

        for (let i = 1; i < sortedWorkouts.length; i++) {
            const current = sortedWorkouts[i];
            const prev = sortedWorkouts[i - 1];

            const daysBetween = Math.floor(
                (new Date(current.date) - new Date(prev.date)) / (1000 * 60 * 60 * 24)
            );

            if (current.energyLevel) {
                workoutsWithRest.push({
                    restDays: daysBetween - 1,
                    energy: current.energyLevel
                });
            }
        }

        if (workoutsWithRest.length < 5) return null;

        // Group by rest days
        const groups = {};
        workoutsWithRest.forEach(w => {
            const key = w.restDays >= 2 ? '2+' : w.restDays.toString();
            if (!groups[key]) groups[key] = [];
            groups[key].push(w.energy);
        });

        // Find optimal rest period
        let bestRest = null;
        let bestEnergy = 0;

        Object.entries(groups).forEach(([rest, energies]) => {
            if (energies.length >= 2) {
                const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
                if (avgEnergy > bestEnergy) {
                    bestEnergy = avgEnergy;
                    bestRest = rest;
                }
            }
        });

        if (bestRest !== null) {
            return {
                type: 'positive',
                text: `Your best workout energy comes after ${bestRest === '0' ? 'back-to-back' : bestRest + ' rest'} day${bestRest === '1' ? '' : 's'}.`,
                category: 'rest'
            };
        }

        return null;
    },

    // Analyze protein intake impact
    analyzeProteinImpact(workouts, nutrition) {
        if (workouts.length < 5 || nutrition.length < 5) return null;

        const nutritionMap = new Map(nutrition.map(n => [n.date, n]));
        const workoutsWithProtein = [];

        workouts.forEach(workout => {
            // Get previous day's nutrition
            const prevDate = new Date(workout.date + 'T00:00:00');
            prevDate.setDate(prevDate.getDate() - 1);
            const prevDateStr = prevDate.toISOString().split('T')[0];
            const prevNutrition = nutritionMap.get(prevDateStr);

            if (prevNutrition?.totalProtein && workout.energyLevel) {
                workoutsWithProtein.push({
                    protein: prevNutrition.totalProtein,
                    energy: workout.energyLevel
                });
            }
        });

        if (workoutsWithProtein.length < 5) return null;

        const goals = Storage.goals.get();
        const targetProtein = goals.dailyProtein;

        const highProtein = workoutsWithProtein.filter(w => w.protein >= targetProtein);
        const lowProtein = workoutsWithProtein.filter(w => w.protein < targetProtein);

        if (highProtein.length < 2 || lowProtein.length < 2) return null;

        const highEnergy = highProtein.reduce((sum, w) => sum + w.energy, 0) / highProtein.length;
        const lowEnergy = lowProtein.reduce((sum, w) => sum + w.energy, 0) / lowProtein.length;

        const diff = ((highEnergy - lowEnergy) / lowEnergy * 100).toFixed(0);

        if (diff > 5) {
            return {
                type: 'positive',
                text: `Hitting ${targetProtein}g+ protein the day before improves workout energy by ${diff}%.`,
                category: 'nutrition'
            };
        }

        return null;
    },

    // Analyze alcohol impact on workouts
    analyzeAlcoholImpact(workouts, nutrition) {
        if (workouts.length < 5 || nutrition.length < 5) return null;

        const nutritionMap = new Map(nutrition.map(n => [n.date, n]));
        const workoutsWithAlcohol = [];

        workouts.forEach(workout => {
            // Check previous 2 days for alcohol
            let hadAlcohol = false;
            for (let i = 1; i <= 2; i++) {
                const checkDate = new Date(workout.date + 'T00:00:00');
                checkDate.setDate(checkDate.getDate() - i);
                const checkDateStr = checkDate.toISOString().split('T')[0];
                const dayNutrition = nutritionMap.get(checkDateStr);

                if (dayNutrition?.alcohol?.drinks > 0) {
                    hadAlcohol = true;
                    break;
                }
            }

            if (workout.energyLevel) {
                workoutsWithAlcohol.push({
                    hadAlcohol,
                    energy: workout.energyLevel
                });
            }
        });

        if (workoutsWithAlcohol.length < 5) return null;

        const withAlcohol = workoutsWithAlcohol.filter(w => w.hadAlcohol);
        const withoutAlcohol = workoutsWithAlcohol.filter(w => !w.hadAlcohol);

        if (withAlcohol.length < 2 || withoutAlcohol.length < 2) return null;

        const alcoholEnergy = withAlcohol.reduce((sum, w) => sum + w.energy, 0) / withAlcohol.length;
        const soberEnergy = withoutAlcohol.reduce((sum, w) => sum + w.energy, 0) / withoutAlcohol.length;

        const diff = ((soberEnergy - alcoholEnergy) / alcoholEnergy * 100).toFixed(0);

        if (diff > 5) {
            return {
                type: 'warning',
                text: `Alcohol within 48hrs reduces workout energy by ${diff}%.`,
                category: 'nutrition'
            };
        }

        return null;
    },

    // Analyze weight progress
    analyzeWeightProgress() {
        const trend = Metrics.calculateWeightTrend();
        const goals = Storage.goals.get();

        if (!trend.trend) return null;

        const insights = [];

        if (trend.goalEta) {
            return {
                type: 'positive',
                text: `At your current pace (${Math.abs(trend.weeklyChange)} lbs/week), you'll reach ${goals.weightGoal} lbs by ${trend.goalEta.formatted}.`,
                category: 'weight'
            };
        } else if (trend.trend === 'up' && trend.currentWeight > goals.weightGoal) {
            return {
                type: 'warning',
                text: `Weight trending up (+${trend.weeklyChange} lbs/week). Review calorie intake to get back on track.`,
                category: 'weight'
            };
        } else if (trend.trend === 'stable') {
            return {
                type: 'info',
                text: `Weight is stable. Consider adjusting calories or increasing workout intensity to continue progress.`,
                category: 'weight'
            };
        }

        return null;
    },

    // Analyze best workout days
    analyzeBestWorkoutDays(workouts) {
        if (workouts.length < 14) return null;

        const dayStats = {};
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        workouts.forEach(workout => {
            if (workout.energyLevel) {
                const dayOfWeek = new Date(workout.date + 'T00:00:00').getDay();
                if (!dayStats[dayOfWeek]) {
                    dayStats[dayOfWeek] = { count: 0, totalEnergy: 0 };
                }
                dayStats[dayOfWeek].count++;
                dayStats[dayOfWeek].totalEnergy += workout.energyLevel;
            }
        });

        let bestDay = null;
        let bestAvg = 0;

        Object.entries(dayStats).forEach(([day, stats]) => {
            if (stats.count >= 2) {
                const avg = stats.totalEnergy / stats.count;
                if (avg > bestAvg) {
                    bestAvg = avg;
                    bestDay = parseInt(day);
                }
            }
        });

        if (bestDay !== null && bestAvg > 6) {
            return {
                type: 'positive',
                text: `Your highest energy workouts tend to be on ${dayNames[bestDay]}s (avg ${bestAvg.toFixed(1)}/10).`,
                category: 'schedule'
            };
        }

        return null;
    },

    // Analyze workout consistency
    analyzeWorkoutConsistency(workouts) {
        if (workouts.length < 7) return null;

        const last30Days = Storage.workouts.getByDateRange(
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            Storage.getToday()
        );

        const goals = Storage.goals.get();
        const targetPerWeek = goals.weeklyWorkouts;
        const actualPerWeek = (last30Days.length / 4).toFixed(1);

        if (actualPerWeek >= targetPerWeek) {
            return {
                type: 'positive',
                text: `Great consistency! You're averaging ${actualPerWeek} workouts/week (goal: ${targetPerWeek}).`,
                category: 'consistency'
            };
        } else {
            const diff = (targetPerWeek - actualPerWeek).toFixed(1);
            return {
                type: 'warning',
                text: `You're ${diff} workouts/week below your goal. Try scheduling workouts in advance.`,
                category: 'consistency'
            };
        }
    },

    // Analyze nutrition consistency
    analyzeNutritionConsistency(nutrition) {
        if (nutrition.length < 7) return null;

        const stats = Nutrition.getStats(30);
        const goals = Storage.goals.get();

        if (stats.daysUnderCalories >= stats.daysLogged * 0.8) {
            return {
                type: 'positive',
                text: `Excellent calorie discipline! You stayed under ${goals.dailyCalories} cal on ${stats.daysUnderCalories}/${stats.daysLogged} days.`,
                category: 'nutrition'
            };
        }

        if (stats.daysMetProtein < stats.daysLogged * 0.5) {
            return {
                type: 'warning',
                text: `Protein intake is low. Only ${stats.daysMetProtein}/${stats.daysLogged} days hit ${goals.dailyProtein}g+ protein.`,
                category: 'nutrition'
            };
        }

        return null;
    },

    // Calculate correlations between two variables
    calculateCorrelation(xValues, yValues) {
        if (xValues.length !== yValues.length || xValues.length < 3) return null;

        const n = xValues.length;
        const sumX = xValues.reduce((a, b) => a + b, 0);
        const sumY = yValues.reduce((a, b) => a + b, 0);
        const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
        const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);
        const sumY2 = yValues.reduce((sum, y) => sum + y * y, 0);

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

        if (denominator === 0) return null;

        return numerator / denominator;
    },

    // Get schedule optimization suggestions
    getScheduleSuggestions() {
        const suggestion = Workouts.getSuggestedWorkout();
        const streak = Workouts.getStreakInfo();
        const suggestions = [];

        suggestions.push({
            type: 'next_workout',
            workout: suggestion.type,
            reason: suggestion.reason
        });

        if (streak.daysSince > 2) {
            suggestions.push({
                type: 'rest_warning',
                text: `It's been ${streak.daysSince} days since your last workout. Time to get moving!`
            });
        }

        // Check for workout type gaps
        const workouts = Storage.workouts.getLatest(20);
        const settings = Storage.settings.get();
        const split = settings.workoutSplit || ['push', 'pull', 'legs'];

        split.forEach(type => {
            const lastOfType = workouts.find(w => w.type === type);
            if (lastOfType) {
                const daysSince = Math.floor(
                    (new Date() - new Date(lastOfType.date + 'T00:00:00')) / (1000 * 60 * 60 * 24)
                );
                if (daysSince > 6) {
                    suggestions.push({
                        type: 'split_gap',
                        text: `You haven't done ${type} in ${daysSince} days!`
                    });
                }
            }
        });

        return suggestions;
    }
};

// Make Analytics available globally
window.Analytics = Analytics;
