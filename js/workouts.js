// Workouts Module - Workout logging and tracking

const Workouts = {
    WORKOUT_TYPES: ['push', 'pull', 'legs', 'upper', 'cardio', 'superset'],

    COMMON_EXERCISES: {
        push: [
            'Dumbbell Bench Press', 'Incline Dumbbell Press', 'Dumbbell Shoulder Press',
            'Cable Fly', 'Tricep Pushdown', 'Lateral Raises', 'Dips'
        ],
        pull: [
            'Pull-ups', 'Lat Pulldown', 'Seated Cable Row', 'Face Pulls',
            'Dumbbell Rows', 'Barbell Rows', 'Bicep Curls', 'Hammer Curls'
        ],
        legs: [
            'Squats', 'Leg Press', 'Romanian Deadlift', 'Leg Curl',
            'Leg Extension', 'Calf Raises', 'Walking Lunges', 'Hip Thrusts'
        ],
        upper: [
            'Bench Press', 'Overhead Press', 'Pull-ups', 'Rows',
            'Bicep Curls', 'Tricep Extensions', 'Face Pulls'
        ],
        cardio: [
            'Treadmill Run', 'Incline Walk', 'Bike', 'Elliptical', 'Rowing'
        ],
        superset: [
            'Dumbbell Bench Press', 'Dumbbell Rows', 'Shoulder Press',
            'Bicep Curls', 'Tricep Extensions', 'Lateral Raises'
        ]
    },

    normalizeWorkoutType(type) {
        return this.WORKOUT_TYPES.includes(type) ? type : this.WORKOUT_TYPES[0];
    },

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

    safeNumber(value) {
        const num = Number(value);
        return Number.isFinite(num) ? String(num) : '';
    },

    // Get workout streak info
    getStreakInfo() {
        const workouts = Storage.workouts.getAll()
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        if (workouts.length === 0) {
            return {
                streak: 0,
                lastWorkout: null,
                lastType: null,
                daysSince: null
            };
        }

        const lastWorkout = workouts[0];
        const lastDate = new Date(lastWorkout.date + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const daysSince = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

        // Calculate streak (consecutive days with workouts, max 1 rest day allowed)
        let streak = 0;
        let lastWorkoutDate = null;

        for (const workout of workouts) {
            const workoutDate = new Date(workout.date + 'T00:00:00');

            if (!lastWorkoutDate) {
                // First workout - only count if recent
                if (daysSince <= 1) {
                    streak = 1;
                    lastWorkoutDate = workoutDate;
                } else {
                    break;
                }
            } else {
                const gap = Math.floor((lastWorkoutDate - workoutDate) / (1000 * 60 * 60 * 24));
                if (gap <= 2) { // Allow up to 1 rest day between workouts
                    streak++;
                    lastWorkoutDate = workoutDate;
                } else {
                    break;
                }
            }
        }

        return {
            streak,
            lastWorkout: lastWorkout.date,
            lastType: lastWorkout.type,
            daysSince
        };
    },

    // Get suggested next workout based on rotation
    getSuggestedWorkout() {
        const settings = Storage.settings.get();
        const rawSplit = Array.isArray(settings.workoutSplit) ? settings.workoutSplit : ['push', 'pull', 'legs'];
        const split = rawSplit.filter(type => this.WORKOUT_TYPES.includes(type));
        if (split.length === 0) {
            split.push('push', 'pull', 'legs');
        }
        const workouts = Storage.workouts.getLatest(10);

        if (workouts.length === 0) {
            return {
                type: split[0],
                reason: 'Start your workout journey!'
            };
        }

        // Count days since each workout type
        const typeLastDone = {};
        split.forEach(type => typeLastDone[type] = null);

        for (const workout of workouts) {
            if (split.includes(workout.type) && !typeLastDone[workout.type]) {
                typeLastDone[workout.type] = workout.date;
            }
        }

        // Find the type that hasn't been done longest
        let suggestedType = split[0];
        let maxDays = 0;

        for (const type of split) {
            if (!typeLastDone[type]) {
                suggestedType = type;
                maxDays = Infinity;
                break;
            }

            const lastDate = new Date(typeLastDone[type] + 'T00:00:00');
            const today = new Date();
            const daysSince = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

            if (daysSince > maxDays) {
                maxDays = daysSince;
                suggestedType = type;
            }
        }

        let reason;
        if (maxDays === Infinity) {
            reason = `You haven't done ${suggestedType} yet!`;
        } else if (maxDays > 5) {
            reason = `${maxDays} days since last ${suggestedType} - time to hit it!`;
        } else {
            reason = `Next in your rotation`;
        }

        return {
            type: suggestedType,
            reason,
            daysSince: maxDays === Infinity ? null : maxDays
        };
    },

    // Get the next workout day number (finds max existing + 1)
    getNextDayNumber() {
        const workouts = Storage.workouts.getAll();
        if (workouts.length === 0) return 1;
        const maxDayNumber = Math.max(...workouts.map(w => w.dayNumber || 0));
        return maxDayNumber + 1;
    },

    // Recalculate all workout day numbers based on date order
    recalculateDayNumbers() {
        const workouts = Storage.workouts.getAll();
        // Sort by date ascending
        workouts.sort((a, b) => new Date(a.date) - new Date(b.date));

        let updated = 0;
        workouts.forEach((workout, index) => {
            const correctDayNumber = index + 1;
            if (workout.dayNumber !== correctDayNumber) {
                Storage.workouts.update(workout.id, { dayNumber: correctDayNumber });
                updated++;
            }
        });

        return updated;
    },

    // Create a new workout entry
    createWorkout(data) {
        const nextDayNumber = this.getNextDayNumber();
        const safeType = this.normalizeWorkoutType(data.type);

        const workout = {
            date: data.date || Storage.getToday(),
            type: safeType,
            dayNumber: nextDayNumber,
            preWeight: data.preWeight || null,
            exercises: data.exercises || [],
            cardio: data.cardio || null,
            notes: data.notes || null,
            energyLevel: data.energyLevel || null
        };

        const saved = Storage.workouts.add(workout);

        // Update metrics to mark workout completed
        if (saved) {
            const metrics = Storage.metrics.findByDate(workout.date);
            if (metrics) {
                Storage.metrics.update(metrics.id, { workoutCompleted: true });
            } else {
                Storage.metrics.add({
                    date: workout.date,
                    workoutCompleted: true,
                    weight: workout.preWeight
                });
            }
        }

        return saved;
    },

    // Render workout log form (with optional workout for editing)
    renderWorkoutForm(existingWorkout = null) {
        const today = Storage.getToday();
        const suggestion = this.getSuggestedWorkout();
        const isEdit = !!existingWorkout;

        const date = existingWorkout?.date || today;
        const type = existingWorkout?.type || suggestion.type;
        const preWeight = existingWorkout?.preWeight || '';
        const energyLevel = existingWorkout?.energyLevel || '';
        const notes = existingWorkout?.notes || '';
        const cardio = existingWorkout?.cardio || {};
        const safeType = this.normalizeWorkoutType(type);
        const safeEditId = this.escapeText(existingWorkout?.id || '');
        const safeDate = this.escapeText(date);
        const safePreWeight = this.safeNumber(preWeight);
        const safeEnergyLevel = this.safeNumber(energyLevel);
        const safeCardioDistance = this.safeNumber(cardio.distance || '');
        const safeCardioDuration = this.escapeText(cardio.duration || '');
        const safeNotes = this.escapeText(notes);

        return `
            <form id="workoutForm" class="workout-form" data-edit-id="${safeEditId}">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Date</label>
                        <input type="date" class="form-input" name="date" value="${safeDate}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Workout Type</label>
                        <select class="form-select" name="type" id="workoutType" required>
                            ${this.WORKOUT_TYPES.map(t =>
                                `<option value="${t}" ${t === safeType ? 'selected' : ''}>
                                    ${t.charAt(0).toUpperCase() + t.slice(1)}
                                </option>`
                            ).join('')}
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Pre-Workout Weight (lbs)</label>
                        <input type="number" class="form-input" name="preWeight" step="0.1" placeholder="225.0" value="${safePreWeight}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Energy Level (1-10)</label>
                        <input type="number" class="form-input" name="energyLevel" min="1" max="10" placeholder="7" value="${safeEnergyLevel}">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Exercises</label>
                    <div id="exercisesList" class="exercises-list">
                        <!-- Dynamic exercises will be added here -->
                    </div>
                    <button type="button" class="btn btn-secondary mt-1" id="addExerciseBtn">
                        + Add Exercise
                    </button>
                </div>

                <div class="form-group">
                    <label class="form-label">Cardio (Optional)</label>
                    <div class="form-row">
                        <select class="form-select" name="cardioType">
                            <option value="">None</option>
                            <option value="run" ${cardio.type === 'run' ? 'selected' : ''}>Run</option>
                            <option value="walk" ${cardio.type === 'walk' ? 'selected' : ''}>Walk</option>
                            <option value="incline" ${cardio.type === 'incline' ? 'selected' : ''}>Incline Walk</option>
                            <option value="bike" ${cardio.type === 'bike' ? 'selected' : ''}>Bike</option>
                        </select>
                        <input type="number" class="form-input" name="cardioDistance" step="0.1" placeholder="Distance (mi)" value="${safeCardioDistance}">
                        <input type="text" class="form-input" name="cardioDuration" placeholder="Duration (mm:ss)" value="${safeCardioDuration}">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Notes</label>
                    <textarea class="form-textarea" name="notes" rows="2" placeholder="How did it feel?">${safeNotes}</textarea>
                </div>

                <div class="modal-footer">
                    ${isEdit ? `<button type="button" class="btn btn-danger" id="deleteWorkoutBtn">Delete</button>` : ''}
                    <button type="button" class="btn btn-secondary" onclick="App.closeModal ? App.closeModal() : closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Save'} Workout</button>
                </div>
            </form>
        `;
    },

    // Get exercises data for pre-filling edit form
    getExercisesForEdit(workout) {
        return workout?.exercises || [];
    },

    // Update an existing workout
    updateWorkout(id, data) {
        const workout = {
            date: data.date,
            type: this.normalizeWorkoutType(data.type),
            preWeight: data.preWeight || null,
            exercises: data.exercises || [],
            cardio: data.cardio || null,
            notes: data.notes || null,
            energyLevel: data.energyLevel || null
        };

        const updated = Storage.workouts.update(id, workout);
        return updated;
    },

    // Delete a workout
    deleteWorkout(id) {
        return Storage.workouts.delete(id);
    },

    // Render exercise input block (with 3 sets by default, or existing sets for editing)
    renderExerciseBlock(index, workoutType, exerciseName = '', existingSets = null) {
        const safeWorkoutType = this.normalizeWorkoutType(workoutType);
        const defaultExercises = this.COMMON_EXERCISES[safeWorkoutType] || [];
        // Get custom exercises from settings
        const settings = Storage.settings.get();
        const customExercises = settings.customExercises || [];
        // Combine and dedupe
        const allExercises = [...new Set([...defaultExercises, ...customExercises])].sort();

        // Check if exerciseName is a custom one (not in the list)
        const isCustom = exerciseName && !allExercises.includes(exerciseName);
        const safeExerciseName = this.escapeText(exerciseName);

        // Get last workout data for this exercise if available (only if not editing with existing sets)
        let prefillReps = '';
        let prefillWeight = '';
        if (exerciseName && !existingSets) {
            const recommendation = this.getExerciseRecommendation(exerciseName, 3);
            if (recommendation.lastReps) prefillReps = recommendation.lastReps;
            if (recommendation.lastWeight) prefillWeight = recommendation.lastWeight;
        }

        // Determine sets to render
        let setsHtml;
        if (existingSets && existingSets.length > 0) {
            // Render existing sets for editing
            setsHtml = existingSets.map((set, i) =>
                this.renderSetRow(index, i, set.reps || '', set.weight || '')
            ).join('');
        } else {
            // Default 3 empty sets
            setsHtml = `
                ${this.renderSetRow(index, 0, prefillReps, prefillWeight)}
                ${this.renderSetRow(index, 1, prefillReps, prefillWeight)}
                ${this.renderSetRow(index, 2, prefillReps, prefillWeight)}
            `;
        }

        return `
            <div class="exercise-block" data-index="${index}">
                <div class="exercise-header">
                    <select class="form-select exercise-select" data-index="${index}">
                        <option value="">Select exercise...</option>
                        ${allExercises.map(ex => `<option value="${this.escapeText(ex)}" ${ex === exerciseName ? 'selected' : ''}>${this.escapeText(ex)}</option>`).join('')}
                        <option value="__custom__" ${isCustom ? 'selected' : ''}>+ Add custom...</option>
                    </select>
                    <input type="text" class="form-input exercise-custom" data-index="${index}"
                           placeholder="Enter exercise name..." value="${isCustom ? safeExerciseName : ''}"
                           style="display: ${isCustom ? 'block' : 'none'};">
                    <input type="hidden" class="exercise-name" name="exercise_${index}_name" value="${safeExerciseName}">
                    <button type="button" class="btn btn-danger btn-sm remove-exercise" data-index="${index}">
                        ✕
                    </button>
                </div>
                <div class="sets-list" id="sets_${index}">
                    ${setsHtml}
                </div>
                <button type="button" class="btn btn-secondary btn-sm add-set-btn" data-exercise="${index}">
                    + Set
                </button>
            </div>
        `;
    },

    // Render set row (simplified - no notes per set)
    renderSetRow(exerciseIndex, setIndex, prefillReps = '', prefillWeight = '') {
        const safeReps = this.safeNumber(prefillReps);
        const safeWeight = this.safeNumber(prefillWeight);
        return `
            <div class="set-row" data-set="${setIndex}">
                <span class="set-number">${setIndex + 1}</span>
                <input type="number" class="form-input set-reps" name="exercise_${exerciseIndex}_set_${setIndex}_reps"
                       placeholder="Reps" min="1" value="${safeReps}" inputmode="numeric">
                <input type="number" class="form-input set-weight" name="exercise_${exerciseIndex}_set_${setIndex}_weight"
                       placeholder="Wt" step="2.5" value="${safeWeight}" inputmode="decimal">
                <button type="button" class="btn btn-sm copy-set-btn" title="Copy to next set" data-exercise="${exerciseIndex}" data-set="${setIndex}">⬇</button>
                <button type="button" class="btn btn-sm remove-set-btn" title="Remove set" data-exercise="${exerciseIndex}" data-set="${setIndex}">✕</button>
            </div>
        `;
    },

    // Handle workout form submission
    handleWorkoutSubmit(formData) {
        const rawPreWeight = formData.get('preWeight');
        const rawEnergy = formData.get('energyLevel');
        const parsedPreWeight = rawPreWeight !== null && rawPreWeight !== '' ? Number(rawPreWeight) : null;
        const parsedEnergy = rawEnergy !== null && rawEnergy !== '' ? Number(rawEnergy) : null;
        const rawNotes = formData.get('notes');
        const workout = {
            date: formData.get('date'),
            type: this.normalizeWorkoutType(formData.get('type')),
            preWeight: Number.isFinite(parsedPreWeight) ? parsedPreWeight : null,
            energyLevel: Number.isInteger(parsedEnergy) ? parsedEnergy : null,
            notes: rawNotes ? rawNotes.trim() : null,
            exercises: [],
            cardio: null
        };

        // Parse exercises from form data (use data-index attribute, not loop index)
        const exerciseBlocks = document.querySelectorAll('.exercise-block');
        exerciseBlocks.forEach((block) => {
            const blockIndex = block.dataset.index;
            let exerciseName = formData.get(`exercise_${blockIndex}_name`);

            // Check if custom input was used but hidden input wasn't updated
            const customInput = block.querySelector('.exercise-custom');
            const selectInput = block.querySelector('.exercise-select');
            if (selectInput && selectInput.value === '__custom__' && customInput && customInput.value) {
                // Force sync from custom input
                exerciseName = customInput.value;
            }

            exerciseName = String(exerciseName || '').trim();
            if (!exerciseName) {
                return;
            }

            const exercise = {
                name: exerciseName,
                sets: []
            };

            // Parse sets
            let setIndex = 0;
            while (formData.has(`exercise_${blockIndex}_set_${setIndex}_reps`)) {
                const reps = formData.get(`exercise_${blockIndex}_set_${setIndex}_reps`);
                const weight = formData.get(`exercise_${blockIndex}_set_${setIndex}_weight`);

                if (reps) {
                    const parsedReps = Number(reps);
                    const parsedWeight = weight !== null && weight !== '' ? Number(weight) : null;
                    if (Number.isFinite(parsedReps) && parsedReps > 0) {
                        exercise.sets.push({
                            reps: Math.round(parsedReps),
                            weight: Number.isFinite(parsedWeight) ? parsedWeight : null,
                            notes: formData.get(`exercise_${blockIndex}_set_${setIndex}_notes`) || null
                        });
                    }
                }
                setIndex++;
            }

            if (exercise.sets.length > 0) {
                workout.exercises.push(exercise);
            }
        });

        // Parse cardio
        const cardioType = formData.get('cardioType');
        if (cardioType) {
            const rawDistance = formData.get('cardioDistance');
            const parsedDistance = rawDistance !== null && rawDistance !== '' ? Number(rawDistance) : null;
            workout.cardio = {
                type: String(cardioType).trim(),
                distance: Number.isFinite(parsedDistance) ? parsedDistance : null,
                duration: formData.get('cardioDuration') ? String(formData.get('cardioDuration')).trim() : null
            };
        }

        // Save any custom exercises to settings for future autocomplete
        this.saveCustomExercises(workout.exercises, workout.type);

        // Check if this is an edit operation
        const form = document.getElementById('workoutForm');
        const editId = form?.dataset.editId;

        if (editId) {
            // Update existing workout
            return this.updateWorkout(editId, workout);
        } else {
            // Create new workout
            return this.createWorkout(workout);
        }
    },

    // Save custom exercises to settings
    saveCustomExercises(exercises, workoutType) {
        const safeWorkoutType = this.normalizeWorkoutType(workoutType);
        const defaultExercises = this.COMMON_EXERCISES[safeWorkoutType] || [];
        const allDefaults = Object.values(this.COMMON_EXERCISES).flat();

        const settings = Storage.settings.get();
        const customExercises = settings.customExercises || [];

        let hasNew = false;
        exercises.forEach(ex => {
            const name = String(ex.name || '').trim();
            // If not in any default list and not already saved as custom
            if (name && !allDefaults.includes(name) && !customExercises.includes(name)) {
                customExercises.push(name);
                hasNew = true;
                // Saved custom exercise
            }
        });

        if (hasNew) {
            settings.customExercises = customExercises.sort();
            Storage.settings.set(settings);
        }
    },

    // Get workout statistics
    getStats() {
        const workouts = Storage.workouts.getAll();
        const last30Days = Storage.workouts.getByDateRange(
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            Storage.getToday()
        );

        // Count by type
        const byType = {};
        this.WORKOUT_TYPES.forEach(type => byType[type] = 0);
        workouts.forEach(w => {
            if (byType[w.type] !== undefined) byType[w.type]++;
        });

        return {
            totalWorkouts: workouts.length,
            last30Days: last30Days.length,
            byType,
            averagePerWeek: last30Days.length > 0 ? (last30Days.length / 4).toFixed(1) : 0
        };
    },

    // Get lifetime stats with fun metrics
    getLifetimeStats() {
        const workouts = Storage.workouts.getAll();

        let totalVolume = 0; // Total pounds lifted (weight × reps)
        let totalReps = 0;
        let totalSets = 0;
        const exerciseCounts = {}; // Track frequency of each exercise
        const exercisePRs = {}; // Personal records per exercise (heaviest weight)
        const typeCounts = {};

        workouts.forEach(workout => {
            // Count workout types
            typeCounts[workout.type] = (typeCounts[workout.type] || 0) + 1;

            // Process exercises
            if (workout.exercises && workout.exercises.length > 0) {
                workout.exercises.forEach(exercise => {
                    const name = exercise.name;
                    exerciseCounts[name] = (exerciseCounts[name] || 0) + 1;

                    if (exercise.sets && exercise.sets.length > 0) {
                        exercise.sets.forEach(set => {
                            const reps = parseInt(set.reps) || 0;
                            const weight = parseFloat(set.weight) || 0;

                            totalReps += reps;
                            totalSets++;
                            totalVolume += weight * reps;

                            // Track PR (heaviest weight used)
                            if (weight > 0 && (!exercisePRs[name] || weight > exercisePRs[name].weight)) {
                                exercisePRs[name] = {
                                    weight,
                                    reps,
                                    date: workout.date
                                };
                            }
                        });
                    }
                });
            }
        });

        // Find most frequent exercise
        let mostFrequentExercise = null;
        let maxExerciseCount = 0;
        Object.entries(exerciseCounts).forEach(([name, count]) => {
            if (count > maxExerciseCount) {
                maxExerciseCount = count;
                mostFrequentExercise = name;
            }
        });

        // Find favorite workout type
        let favoriteType = null;
        let maxTypeCount = 0;
        Object.entries(typeCounts).forEach(([type, count]) => {
            if (count > maxTypeCount) {
                maxTypeCount = count;
                favoriteType = type;
            }
        });

        // Format total volume for display
        const formatVolume = (lbs) => {
            if (lbs >= 1000000) return `${(lbs / 1000000).toFixed(1)}M`;
            if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}K`;
            return Math.round(lbs).toLocaleString();
        };

        return {
            totalWorkouts: workouts.length,
            totalVolume: Math.round(totalVolume),
            totalVolumeFormatted: formatVolume(totalVolume),
            totalReps,
            totalSets,
            mostFrequentExercise,
            mostFrequentExerciseCount: maxExerciseCount,
            favoriteType,
            favoriteTypeCount: maxTypeCount,
            exercisePRs,
            uniqueExercises: Object.keys(exerciseCounts).length
        };
    },

    // Format workout for display
    formatWorkout(workout) {
        let summary = `Day ${workout.dayNumber}: ${workout.type.toUpperCase()}`;

        if (workout.exercises.length > 0) {
            const exerciseNames = workout.exercises.map(e => e.name).join(', ');
            summary += ` - ${exerciseNames}`;
        }

        if (workout.cardio) {
            summary += ` + ${workout.cardio.type}`;
            if (workout.cardio.distance) summary += ` ${workout.cardio.distance}mi`;
        }

        return summary;
    },

    // ==========================================
    // SMART WORKOUT GENERATION
    // ==========================================

    // Get exercise history for generating recommendations
    getExerciseHistory(exerciseName, limit = 10) {
        const workouts = Storage.workouts.getAll()
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        const history = [];
        for (const workout of workouts) {
            for (const exercise of workout.exercises || []) {
                if (exercise.name === exerciseName && exercise.sets && exercise.sets.length > 0) {
                    history.push({
                        date: workout.date,
                        sets: exercise.sets,
                        energyLevel: workout.energyLevel
                    });
                    if (history.length >= limit) break;
                }
            }
            if (history.length >= limit) break;
        }
        return history;
    },

    // Calculate recommended weight/reps for an exercise based on history
    getExerciseRecommendation(exerciseName, targetSets = 3) {
        const history = this.getExerciseHistory(exerciseName, 5);

        if (history.length === 0) {
            // No history - return empty recommendation
            return {
                sets: Array(targetSets).fill({ reps: 10, weight: null, notes: null }),
                reason: 'No prior history - start light and work up'
            };
        }

        // Analyze last workout with this exercise
        const lastWorkout = history[0];
        const lastSets = lastWorkout.sets;

        // Calculate average weight and reps from last session
        const validSets = lastSets.filter(s => s.weight && s.reps);
        if (validSets.length === 0) {
            return {
                sets: Array(targetSets).fill({ reps: 10, weight: null, notes: null }),
                reason: 'Previous sets missing weight data'
            };
        }

        const avgWeight = validSets.reduce((sum, s) => sum + s.weight, 0) / validSets.length;
        const avgReps = validSets.reduce((sum, s) => sum + s.reps, 0) / validSets.length;
        const maxWeight = Math.max(...validSets.map(s => s.weight));
        const maxReps = Math.max(...validSets.map(s => s.reps));

        // Progressive overload logic
        let recommendedWeight = avgWeight;
        let recommendedReps = Math.round(avgReps);
        let reason = '';

        // Check if they hit target reps (8+) on all sets - time to increase weight
        const allSetsHitTarget = validSets.every(s => s.reps >= 8);
        const avgRepsHigh = avgReps >= 10;

        if (allSetsHitTarget && avgRepsHigh) {
            // Increase weight by 5 lbs (or 2.5 for smaller increments)
            const increase = avgWeight >= 50 ? 5 : 2.5;
            recommendedWeight = Math.round((avgWeight + increase) / 2.5) * 2.5;
            recommendedReps = 8; // Reset reps lower when increasing weight
            reason = `Great progress! Increasing weight from ${avgWeight} to ${recommendedWeight} lbs`;
        } else if (avgReps < 6) {
            // Struggling with current weight - keep weight, aim for more reps
            recommendedReps = Math.min(avgReps + 1, 8);
            reason = `Focus on hitting ${recommendedReps} reps before increasing weight`;
        } else {
            // Making progress - try to add 1 rep
            recommendedReps = Math.min(Math.round(avgReps) + 1, 12);
            reason = `Try for ${recommendedReps} reps at ${avgWeight} lbs`;
        }

        // Generate recommended sets with pyramid approach
        const sets = [];
        for (let i = 0; i < targetSets; i++) {
            if (i === 0) {
                // First set: warmup with lighter weight, higher reps
                sets.push({
                    reps: recommendedReps + 2,
                    weight: Math.round((recommendedWeight * 0.7) / 2.5) * 2.5,
                    notes: 'warmup'
                });
            } else if (i === targetSets - 1 && targetSets >= 3) {
                // Last set: push for max
                sets.push({
                    reps: recommendedReps - 1,
                    weight: Math.round((recommendedWeight * 1.05) / 2.5) * 2.5,
                    notes: 'push set'
                });
            } else {
                // Working sets
                sets.push({
                    reps: recommendedReps,
                    weight: recommendedWeight,
                    notes: null
                });
            }
        }

        return {
            sets,
            reason,
            lastWeight: avgWeight,
            lastReps: Math.round(avgReps),
            lastDate: lastWorkout.date
        };
    },

    // Generate a complete workout based on history and workout type
    generateWorkout(workoutType) {
        const safeWorkoutType = this.normalizeWorkoutType(workoutType);
        const exercises = this.COMMON_EXERCISES[safeWorkoutType] || [];
        const settings = Storage.settings.get();

        // Get the last workout of this type to see which exercises were done
        const workouts = Storage.workouts.getAll()
            .filter(w => w.type === safeWorkoutType)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        let selectedExercises;

        if (workouts.length > 0 && workouts[0].exercises.length > 0) {
            // Use exercises from last workout of this type
            selectedExercises = workouts[0].exercises.map(e => e.name);
        } else {
            // Default to first 4-5 exercises for the type
            selectedExercises = exercises.slice(0, Math.min(5, exercises.length));
        }

        // Generate recommendations for each exercise
        const generatedExercises = selectedExercises.map(name => {
            const recommendation = this.getExerciseRecommendation(name, 3);
            return {
                name,
                recommendation,
                sets: recommendation.sets
            };
        });

        return {
            type: safeWorkoutType,
            exercises: generatedExercises,
            suggestion: this.getSuggestedWorkout()
        };
    },

    // ==========================================
    // GUIDED WORKOUT MODE
    // ==========================================

    // State for guided workout
    guidedState: {
        active: false,
        workoutType: null,
        exercises: [],
        currentExerciseIndex: 0,
        currentSetIndex: 0,
        completedSets: [],
        startTime: null
    },

    // Start guided workout
    startGuidedWorkout(workoutType) {
        const safeWorkoutType = this.normalizeWorkoutType(workoutType);
        const generated = this.generateWorkout(safeWorkoutType);

        this.guidedState = {
            active: true,
            workoutType: safeWorkoutType,
            exercises: generated.exercises,
            currentExerciseIndex: 0,
            currentSetIndex: 0,
            completedSets: generated.exercises.map(() => []),
            startTime: new Date()
        };

        return this.guidedState;
    },

    // Get current guided workout step
    getGuidedStep() {
        const state = this.guidedState;
        if (!state.active || state.currentExerciseIndex >= state.exercises.length) {
            return null;
        }

        const currentExercise = state.exercises[state.currentExerciseIndex];
        const currentSet = currentExercise.sets[state.currentSetIndex];
        const totalExercises = state.exercises.length;
        const totalSets = currentExercise.sets.length;
        const completedSetsForExercise = state.completedSets[state.currentExerciseIndex].length;

        return {
            exerciseIndex: state.currentExerciseIndex + 1,
            totalExercises,
            exerciseName: currentExercise.name,
            setIndex: state.currentSetIndex + 1,
            totalSets,
            suggestedReps: currentSet.reps,
            suggestedWeight: currentSet.weight,
            setNotes: currentSet.notes,
            recommendation: currentExercise.recommendation,
            completedSetsForExercise,
            isLastSet: state.currentSetIndex === totalSets - 1,
            isLastExercise: state.currentExerciseIndex === totalExercises - 1
        };
    },

    // Record a set in guided mode and advance
    recordGuidedSet(reps, weight, notes = null) {
        const state = this.guidedState;
        if (!state.active) return null;

        // Record the set
        state.completedSets[state.currentExerciseIndex].push({
            reps: parseInt(reps),
            weight: weight ? parseFloat(weight) : null,
            notes
        });

        const currentExercise = state.exercises[state.currentExerciseIndex];

        // Advance to next set or exercise
        if (state.currentSetIndex < currentExercise.sets.length - 1) {
            state.currentSetIndex++;
        } else if (state.currentExerciseIndex < state.exercises.length - 1) {
            state.currentExerciseIndex++;
            state.currentSetIndex = 0;
        } else {
            // Workout complete
            return this.finishGuidedWorkout();
        }

        return this.getGuidedStep();
    },

    // Skip current exercise in guided mode
    skipExercise() {
        const state = this.guidedState;
        if (!state.active) return null;

        if (state.currentExerciseIndex < state.exercises.length - 1) {
            state.currentExerciseIndex++;
            state.currentSetIndex = 0;
            return this.getGuidedStep();
        } else {
            return this.finishGuidedWorkout();
        }
    },

    // Finish guided workout and save
    finishGuidedWorkout() {
        const state = this.guidedState;
        if (!state.active) return null;

        // Build workout data
        const exercises = state.exercises
            .map((ex, i) => ({
                name: ex.name,
                sets: state.completedSets[i]
            }))
            .filter(ex => ex.sets.length > 0);

        const workout = this.createWorkout({
            type: state.workoutType,
            exercises,
            notes: `Guided workout - ${Math.round((new Date() - state.startTime) / 60000)} min`
        });

        // Reset state
        this.guidedState = {
            active: false,
            workoutType: null,
            exercises: [],
            currentExerciseIndex: 0,
            currentSetIndex: 0,
            completedSets: [],
            startTime: null
        };

        return {
            complete: true,
            workout
        };
    },

    // Cancel guided workout
    cancelGuidedWorkout() {
        this.guidedState = {
            active: false,
            workoutType: null,
            exercises: [],
            currentExerciseIndex: 0,
            currentSetIndex: 0,
            completedSets: [],
            startTime: null
        };
    },

    // Render guided workout UI
    renderGuidedWorkoutUI() {
        const step = this.getGuidedStep();
        if (!step) {
            return '<p>No active guided workout</p>';
        }

        const progressPercent = ((step.exerciseIndex - 1) / step.totalExercises) * 100 +
                               (step.completedSetsForExercise / step.totalSets / step.totalExercises) * 100;
        const safeExerciseName = this.escapeText(step.exerciseName);
        const safeSetNotes = this.escapeText(step.setNotes || '');
        const safeReason = this.escapeText(step.recommendation.reason || '');

        return `
            <div class="guided-workout">
                <div class="guided-progress">
                    <div class="guided-progress-bar" style="width: ${progressPercent}%"></div>
                </div>
                <div class="guided-progress-text">
                    Exercise ${step.exerciseIndex}/${step.totalExercises} · Set ${step.setIndex}/${step.totalSets}
                </div>

                <div class="guided-exercise">
                    <h3 class="guided-exercise-name">${safeExerciseName}</h3>
                    ${step.setNotes ? `<span class="guided-set-note">${safeSetNotes}</span>` : ''}
                </div>

                <div class="guided-suggestion">
                    <div class="guided-target">
                        <span class="target-label">Target</span>
                        <span class="target-value">${step.suggestedReps} reps</span>
                        <span class="target-weight">${step.suggestedWeight ? step.suggestedWeight + ' lbs' : 'bodyweight'}</span>
                    </div>
                    ${step.recommendation.reason ? `<p class="guided-reason">${safeReason}</p>` : ''}
                </div>

                <form id="guidedSetForm" class="guided-form">
                    <div class="guided-inputs">
                        <div class="guided-input-group">
                            <label>Reps</label>
                            <input type="number" name="reps" class="form-input guided-reps"
                                   value="${step.suggestedReps}" min="1" required autofocus>
                        </div>
                        <div class="guided-input-group">
                            <label>Weight (lbs)</label>
                            <input type="number" name="weight" class="form-input guided-weight"
                                   value="${step.suggestedWeight || ''}" step="2.5">
                        </div>
                    </div>

                    <div class="guided-actions">
                        <button type="submit" class="btn btn-primary btn-lg guided-log-btn">
                            Log Set ${step.isLastSet && step.isLastExercise ? '& Finish' : ''}
                        </button>
                    </div>

                    <div class="guided-secondary-actions">
                        ${!step.isLastExercise ? `
                            <button type="button" class="btn btn-secondary btn-sm" onclick="App.guidedSkipExercise()">
                                Skip Exercise
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-danger btn-sm" onclick="App.guidedCancel()">
                            End Workout
                        </button>
                    </div>
                </form>
            </div>
        `;
    },

    // Render workout type selection for guided mode
    renderGuidedWorkoutSelection() {
        const suggestion = this.getSuggestedWorkout();
        const safeSuggestionReason = this.escapeText(suggestion.reason || '');

        return `
            <div class="guided-selection">
                <h3>Start Guided Workout</h3>
                <p class="guided-intro">Choose a workout type and we'll guide you through each exercise with personalized recommendations based on your history.</p>

                <div class="guided-type-options">
                    ${this.WORKOUT_TYPES.filter(t => t !== 'cardio').map(type => `
                        <button class="guided-type-btn ${type === suggestion.type ? 'recommended' : ''}"
                                onclick="App.startGuidedWorkout('${type}')">
                            <span class="type-name">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                            ${type === suggestion.type ? '<span class="recommended-badge">Recommended</span>' : ''}
                        </button>
                    `).join('')}
                </div>

                ${suggestion.reason ? `<p class="guided-suggestion-reason">${safeSuggestionReason}</p>` : ''}

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
                </div>
            </div>
        `;
    }
};

// Make Workouts available globally
window.Workouts = Workouts;
