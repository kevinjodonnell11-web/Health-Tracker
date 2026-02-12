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
        const strengthProgression = this.analyzeStrengthProgression(workouts);
        if (strengthProgression) insights.push(strengthProgression);

        const trainingLoadTrend = this.analyzeTrainingLoadTrend(workouts);
        if (trainingLoadTrend) insights.push(trainingLoadTrend);

        const splitBalance = this.analyzeSplitBalance(workouts);
        if (splitBalance) insights.push(splitBalance);

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

    normalizeExerciseName(name) {
        return String(name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    },

    estimateOneRepMax(weight, reps) {
        const safeWeight = Number(weight);
        const safeReps = Number(reps);
        if (!Number.isFinite(safeWeight) || safeWeight <= 0) return 0;
        if (!Number.isFinite(safeReps) || safeReps <= 0) return safeWeight;
        return safeWeight * (1 + safeReps / 30);
    },

    average(values) {
        if (!Array.isArray(values) || values.length === 0) return null;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    },

    // Analyze weighted exercise progression to detect progressive overload or plateaus.
    analyzeStrengthProgression(workouts) {
        if (workouts.length < 6) return null;

        const sortedWorkouts = [...workouts].sort((a, b) => new Date(a.date) - new Date(b.date));
        const exerciseHistory = new Map();

        sortedWorkouts.forEach(workout => {
            (workout.exercises || []).forEach(exercise => {
                const weightedSets = (exercise.sets || [])
                    .map(set => ({
                        reps: Number(set.reps),
                        weight: Number(set.weight)
                    }))
                    .filter(set =>
                        Number.isFinite(set.reps) && set.reps > 0 &&
                        Number.isFinite(set.weight) && set.weight > 0
                    );
                if (weightedSets.length === 0) return;

                const topSet = weightedSets.reduce((best, set) => {
                    if (!best) return set;
                    if (set.weight > best.weight) return set;
                    if (set.weight === best.weight && set.reps > best.reps) return set;
                    return best;
                }, null);

                const key = this.normalizeExerciseName(exercise.name);
                if (!exerciseHistory.has(key)) {
                    exerciseHistory.set(key, {
                        name: String(exercise.name || '').trim(),
                        sessions: []
                    });
                }

                exerciseHistory.get(key).sessions.push({
                    date: workout.date,
                    topWeight: topSet.weight,
                    topReps: topSet.reps,
                    oneRepMax: this.estimateOneRepMax(topSet.weight, topSet.reps)
                });
            });
        });

        let bestProgress = null;
        let biggestDrop = null;
        let trackedExercises = 0;

        exerciseHistory.forEach(entry => {
            const sessions = entry.sessions.sort((a, b) => new Date(a.date) - new Date(b.date));
            if (sessions.length < 3) return;
            trackedExercises++;

            const recentWindowSize = Math.max(1, Math.min(3, Math.floor(sessions.length / 2)));
            const baselineSlice = sessions.slice(0, sessions.length - recentWindowSize);
            const recentSlice = sessions.slice(-recentWindowSize);

            if (baselineSlice.length === 0 || recentSlice.length === 0) return;

            const baselineWeight = this.average(baselineSlice.map(session => session.topWeight));
            const recentWeight = this.average(recentSlice.map(session => session.topWeight));
            const baselineOneRepMax = this.average(baselineSlice.map(session => session.oneRepMax));
            const recentOneRepMax = this.average(recentSlice.map(session => session.oneRepMax));

            if (!baselineWeight || !recentWeight || !baselineOneRepMax || !recentOneRepMax) return;

            const deltaWeight = recentWeight - baselineWeight;
            const deltaPercent = (deltaWeight / baselineWeight) * 100;
            const deltaOneRepMax = recentOneRepMax - baselineOneRepMax;

            const analysis = {
                ...entry,
                sessions,
                deltaWeight,
                deltaPercent,
                deltaOneRepMax,
                baselineWeight,
                recentWeight
            };

            if (!bestProgress || analysis.deltaPercent > bestProgress.deltaPercent) {
                bestProgress = analysis;
            }
            if (!biggestDrop || analysis.deltaPercent < biggestDrop.deltaPercent) {
                biggestDrop = analysis;
            }
        });

        if (bestProgress && bestProgress.deltaPercent >= 4 && bestProgress.deltaWeight >= 5) {
            return {
                type: 'positive',
                text: `${bestProgress.name} is trending up ${bestProgress.deltaPercent.toFixed(0)}% (${bestProgress.baselineWeight.toFixed(1)} to ${bestProgress.recentWeight.toFixed(1)} lbs top set). Keep loading in 2.5-5 lb jumps when reps are strong.`,
                category: 'strength'
            };
        }

        if (biggestDrop && biggestDrop.deltaPercent <= -6 && Math.abs(biggestDrop.deltaWeight) >= 5) {
            return {
                type: 'warning',
                text: `${biggestDrop.name} dropped ${Math.abs(biggestDrop.deltaPercent).toFixed(0)}% in recent sessions. Consider a lighter week and rebuild from your recent working weight.`,
                category: 'strength'
            };
        }

        if (trackedExercises >= 3) {
            return {
                type: 'info',
                text: `You're tracking ${trackedExercises} weighted exercises consistently. To spark progress, prioritize adding reps at the same load before increasing weight.`,
                category: 'strength'
            };
        }

        return null;
    },

    // Analyze short-term training load shifts and recovery response.
    analyzeTrainingLoadTrend(workouts) {
        if (workouts.length < 8) return null;

        const sessions = workouts
            .map(workout => {
                const volume = (workout.exercises || []).reduce((workoutSum, exercise) => {
                    return workoutSum + (exercise.sets || []).reduce((setSum, set) => {
                        const reps = Number(set.reps);
                        const weight = Number(set.weight);
                        if (!Number.isFinite(reps) || reps <= 0 || !Number.isFinite(weight) || weight <= 0) {
                            return setSum;
                        }
                        return setSum + (reps * weight);
                    }, 0);
                }, 0);

                return {
                    date: workout.date,
                    volume,
                    energy: Number(workout.energyLevel)
                };
            })
            .filter(session => session.volume > 0)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (sessions.length < 8) return null;

        const recent = sessions.slice(-4);
        const previous = sessions.slice(-8, -4);

        const recentVolume = this.average(recent.map(session => session.volume));
        const previousVolume = this.average(previous.map(session => session.volume));
        if (!recentVolume || !previousVolume) return null;

        const loadPercentChange = ((recentVolume - previousVolume) / previousVolume) * 100;
        const recentEnergy = this.average(recent.map(session => session.energy).filter(Number.isFinite));
        const previousEnergy = this.average(previous.map(session => session.energy).filter(Number.isFinite));
        const energyDelta = (recentEnergy !== null && previousEnergy !== null)
            ? recentEnergy - previousEnergy
            : null;

        if (loadPercentChange >= 18 && energyDelta !== null && energyDelta <= -0.8) {
            return {
                type: 'warning',
                text: `Training volume jumped ${loadPercentChange.toFixed(0)}% while energy fell ${Math.abs(energyDelta).toFixed(1)} points. Consider one lower-volume session this week to recover.`,
                category: 'recovery'
            };
        }

        if (loadPercentChange >= 12 && (energyDelta === null || energyDelta >= -0.2)) {
            return {
                type: 'positive',
                text: `Recent training volume is up ${loadPercentChange.toFixed(0)}% with stable energy. This is a strong overload block if sleep and protein stay consistent.`,
                category: 'recovery'
            };
        }

        if (loadPercentChange <= -20) {
            return {
                type: 'info',
                text: `Training volume is down ${Math.abs(loadPercentChange).toFixed(0)}% vs your previous block. If this wasn't intentional deloading, add one extra hard set per lift this week.`,
                category: 'recovery'
            };
        }

        return null;
    },

    // Analyze balance across the configured workout split.
    analyzeSplitBalance(workouts) {
        if (workouts.length < 8) return null;

        const settings = Storage.settings.get();
        const split = Array.isArray(settings.workoutSplit)
            ? settings.workoutSplit.filter(type => Workouts.WORKOUT_TYPES.includes(type))
            : ['push', 'pull', 'legs'];
        const trackedTypes = split.length > 0 ? split : ['push', 'pull', 'legs'];
        if (trackedTypes.length < 2) return null;

        const endDate = Storage.getToday();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 42);
        const startStr = startDate.toISOString().split('T')[0];

        const recentWorkouts = workouts.filter(workout => workout.date >= startStr && workout.date <= endDate);
        if (recentWorkouts.length < trackedTypes.length + 2) return null;

        const counts = trackedTypes.map(type => ({
            type,
            count: recentWorkouts.filter(workout => workout.type === type).length
        }));

        const highest = counts.reduce((best, current) => current.count > best.count ? current : best, counts[0]);
        const lowest = counts.reduce((best, current) => current.count < best.count ? current : best, counts[0]);

        if (lowest.count === 0 && highest.count >= 3) {
            return {
                type: 'warning',
                text: `No ${lowest.type} workouts logged in the last 6 weeks. Add ${lowest.type} back in this week to keep your split balanced.`,
                category: 'programming'
            };
        }

        if (highest.count - lowest.count >= 3) {
            return {
                type: 'info',
                text: `Your ${highest.type} volume is outpacing ${lowest.type} (${highest.count} vs ${lowest.count} sessions in 6 weeks). Schedule ${lowest.type} first next week.`,
                category: 'programming'
            };
        }

        if (counts.every(entry => entry.count >= 2)) {
            return {
                type: 'positive',
                text: `Your training split is well balanced: every workout type has at least 2 sessions over the past 6 weeks.`,
                category: 'programming'
            };
        }

        return null;
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

        // Avoid division by zero
        if (lowSleepEnergy === 0) return null;

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

        // Avoid division by zero
        if (alcoholEnergy === 0) return null;

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
