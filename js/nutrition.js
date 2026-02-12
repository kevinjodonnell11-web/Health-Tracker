// Nutrition Module - Food tracking and nutrition logging

const Nutrition = {
    // Common food shortcuts with calories and protein
    FOOD_DATABASE: {
        'Protein Shake': { calories: 160, protein: 30 },
        'Greek Yogurt': { calories: 100, protein: 17 },
        'Chicken Breast (6oz)': { calories: 280, protein: 53 },
        'Salmon (6oz)': { calories: 350, protein: 40 },
        'Eggs (2)': { calories: 140, protein: 12 },
        'Rice (1 cup)': { calories: 200, protein: 4 },
        'Oatmeal (1 cup)': { calories: 150, protein: 5 },
        'Banana': { calories: 105, protein: 1 },
        'Apple': { calories: 95, protein: 0 },
        'JustSalad Wrap': { calories: 750, protein: 42 },
        'Chipotle Bowl': { calories: 700, protein: 45 },
        'PopChips': { calories: 100, protein: 1 },
        'Quest Bar': { calories: 190, protein: 21 },
        'Almonds (1oz)': { calories: 165, protein: 6 },
        'Cottage Cheese (1 cup)': { calories: 220, protein: 28 },
        'Turkey Sandwich': { calories: 350, protein: 25 },
        'Salad (no dressing)': { calories: 100, protein: 5 },
        'Beer': { calories: 150, protein: 0 },
        'Wine (glass)': { calories: 125, protein: 0 },
        'Cocktail': { calories: 200, protein: 0 }
    },

    SUPPLEMENTS: ['creatine', 'protein shake', 'multivitamin', 'fish oil', 'vitamin D', 'magnesium'],

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

    // Get or create nutrition entry for a date
    getOrCreate(date = null) {
        date = date || Storage.getToday();
        let entry = Storage.nutrition.findByDate(date);

        if (!entry) {
            entry = Storage.nutrition.add({
                date,
                foodWindow: { start: null, end: null },
                steps: null,
                totalCalories: 0,
                totalProtein: 0,
                meals: [],
                supplements: [],
                alcohol: { drinks: 0, type: null },
                notes: null
            });
        }

        return entry;
    },

    // Add a meal to today's nutrition
    addMeal(mealData, date = null) {
        date = date || Storage.getToday();
        const entry = this.getOrCreate(date);

        const meal = {
            time: mealData.time || new Date().toTimeString().slice(0, 5),
            items: mealData.items || []
        };

        entry.meals.push(meal);

        // Recalculate totals
        let totalCalories = 0;
        let totalProtein = 0;
        entry.meals.forEach(m => {
            m.items.forEach(item => {
                totalCalories += item.calories || 0;
                totalProtein += item.protein || 0;
            });
        });

        Storage.nutrition.update(entry.id, {
            meals: entry.meals,
            totalCalories,
            totalProtein
        });

        // Update metrics
        const metrics = Storage.metrics.findByDate(date);
        if (metrics) {
            Storage.metrics.update(metrics.id, { nutritionCompleted: true });
        }

        return entry;
    },

    // Quick add a single food item
    quickAddFood(foodItem, date = null) {
        date = date || Storage.getToday();
        const entry = this.getOrCreate(date);

        // Add to current meal or create new one
        const currentTime = new Date().toTimeString().slice(0, 5);
        let currentMeal = entry.meals.find(m => {
            const mealTime = new Date(`2000-01-01T${m.time}`);
            const now = new Date(`2000-01-01T${currentTime}`);
            return Math.abs(mealTime - now) < 30 * 60 * 1000; // Within 30 minutes
        });

        if (!currentMeal) {
            currentMeal = { time: currentTime, items: [] };
            entry.meals.push(currentMeal);
        }

        currentMeal.items.push(foodItem);

        // Recalculate totals
        const totalCalories = entry.totalCalories + (foodItem.calories || 0);
        const totalProtein = entry.totalProtein + (foodItem.protein || 0);

        Storage.nutrition.update(entry.id, {
            meals: entry.meals,
            totalCalories,
            totalProtein
        });

        return entry;
    },

    // Log full nutrition for a day
    logDay(data) {
        const date = data.date || Storage.getToday();
        let entry = Storage.nutrition.findByDate(date);

        const nutritionData = {
            date,
            foodWindow: data.foodWindow || { start: null, end: null },
            steps: data.steps || null,
            totalCalories: data.totalCalories || 0,
            totalProtein: data.totalProtein || 0,
            meals: data.meals || [],
            supplements: data.supplements || [],
            alcohol: data.alcohol || { drinks: 0, type: null },
            notes: data.notes || null
        };

        if (entry) {
            return Storage.nutrition.update(entry.id, nutritionData);
        } else {
            return Storage.nutrition.add(nutritionData);
        }
    },

    // Update fasting window
    setFastingWindow(start, end, date = null) {
        date = date || Storage.getToday();
        const entry = this.getOrCreate(date);

        Storage.nutrition.update(entry.id, {
            foodWindow: { start, end }
        });

        return entry;
    },

    // Log supplements
    logSupplements(supplements, date = null) {
        date = date || Storage.getToday();
        const entry = this.getOrCreate(date);

        Storage.nutrition.update(entry.id, {
            supplements
        });

        return entry;
    },

    // Log alcohol
    logAlcohol(drinks, type = null, date = null) {
        date = date || Storage.getToday();
        const entry = this.getOrCreate(date);

        Storage.nutrition.update(entry.id, {
            alcohol: { drinks, type }
        });

        return entry;
    },

    // Get nutrition statistics
    getStats(days = 30) {
        const endDate = Storage.getToday();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startStr = startDate.toISOString().split('T')[0];

        const entries = Storage.nutrition.getByDateRange(startStr, endDate);
        const goals = Storage.goals.get();

        if (entries.length === 0) {
            return {
                avgCalories: null,
                avgProtein: null,
                daysLogged: 0,
                daysUnderCalories: 0,
                daysMetProtein: 0,
                alcoholDays: 0,
                totalAlcohol: 0
            };
        }

        let totalCalories = 0;
        let totalProtein = 0;
        let daysUnderCalories = 0;
        let daysMetProtein = 0;
        let alcoholDays = 0;
        let totalAlcohol = 0;

        entries.forEach(e => {
            if (e.totalCalories) {
                totalCalories += e.totalCalories;
                if (e.totalCalories <= goals.dailyCalories) daysUnderCalories++;
            }
            if (e.totalProtein) {
                totalProtein += e.totalProtein;
                if (e.totalProtein >= goals.dailyProtein) daysMetProtein++;
            }
            if (e.alcohol && e.alcohol.drinks > 0) {
                alcoholDays++;
                totalAlcohol += e.alcohol.drinks;
            }
        });

        return {
            avgCalories: Math.round(totalCalories / entries.length),
            avgProtein: Math.round(totalProtein / entries.length),
            daysLogged: entries.length,
            daysUnderCalories,
            daysMetProtein,
            alcoholDays,
            totalAlcohol
        };
    },

    // Render meal logging form
    renderMealForm() {
        const today = Storage.getToday();
        const currentTime = new Date().toTimeString().slice(0, 5);

        // Build food database options
        const foodOptions = Object.entries(this.FOOD_DATABASE)
            .map(([name, info]) => `<option value="${this.escapeText(name)}">${this.escapeText(name)} (${info.calories} cal, ${info.protein}g)</option>`)
            .join('');

        return `
            <form id="mealForm" class="meal-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Date</label>
                        <input type="date" class="form-input" name="date" value="${today}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Time</label>
                        <input type="time" class="form-input" name="time" value="${currentTime}">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Food Items</label>
                    <div id="foodItemsList" class="food-items-list">
                        <!-- Food items will be added here -->
                    </div>
                    <div class="add-food-row">
                        <select class="form-select" id="foodQuickAdd">
                            <option value="">Quick add from database...</option>
                            ${foodOptions}
                        </select>
                        <button type="button" class="btn btn-secondary" id="addCustomFood">+ Custom</button>
                    </div>
                </div>

                <div class="meal-totals" id="mealTotals">
                    <span>Total: <strong id="mealCalTotal">0</strong> cal, <strong id="mealProTotal">0</strong>g protein</span>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Meal</button>
                </div>
            </form>
        `;
    },

    // Render food item row
    renderFoodItemRow(index, name = '', calories = '', protein = '') {
        const safeName = this.escapeText(name);
        const safeCalories = this.safeNumber(calories);
        const safeProtein = this.safeNumber(protein);
        return `
            <div class="food-item-row" data-index="${index}">
                <input type="text" class="form-input food-name" name="food_${index}_name"
                       placeholder="Food name" value="${safeName}" required>
                <input type="number" class="form-input food-calories" name="food_${index}_calories"
                       placeholder="Cal" value="${safeCalories}" required>
                <input type="number" class="form-input food-protein" name="food_${index}_protein"
                       placeholder="Pro" value="${safeProtein}" required>
                <button type="button" class="btn btn-danger btn-sm remove-food" data-index="${index}">&times;</button>
            </div>
        `;
    },

    // Render full day nutrition form
    renderDayForm(date = null) {
        date = date || Storage.getToday();
        const entry = Storage.nutrition.findByDate(date);
        const settings = Storage.settings.get();
        const safeDate = this.escapeText(date);
        const safeWindowStart = this.escapeText(entry?.foodWindow?.start || settings.defaultFastingWindow?.start || '');
        const safeWindowEnd = this.escapeText(entry?.foodWindow?.end || settings.defaultFastingWindow?.end || '');
        const safeTotalCalories = this.safeNumber(entry?.totalCalories || '');
        const safeTotalProtein = this.safeNumber(entry?.totalProtein || '');
        const safeSteps = this.safeNumber(entry?.steps || '');
        const safeAlcoholDrinks = this.safeNumber(entry?.alcohol?.drinks || 0);
        const safeNotes = this.escapeText(entry?.notes || '');

        return `
            <form id="nutritionDayForm" class="nutrition-form">
                <div class="form-group">
                    <label class="form-label">Date</label>
                    <input type="date" class="form-input" name="date" value="${safeDate}" required>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Eating Window Start</label>
                        <input type="time" class="form-input" name="windowStart"
                               value="${safeWindowStart}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Eating Window End</label>
                        <input type="time" class="form-input" name="windowEnd"
                               value="${safeWindowEnd}">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Total Calories</label>
                        <input type="number" class="form-input" name="totalCalories"
                               placeholder="1500" value="${safeTotalCalories}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Total Protein (g)</label>
                        <input type="number" class="form-input" name="totalProtein"
                               placeholder="150" value="${safeTotalProtein}">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Steps</label>
                    <input type="number" class="form-input" name="steps"
                           placeholder="10000" value="${safeSteps}">
                </div>

                <div class="form-group">
                    <label class="form-label">Supplements</label>
                    <div class="supplements-grid">
                        ${this.SUPPLEMENTS.map(supp => `
                            <label class="supplement-checkbox">
                                <input type="checkbox" name="supplements" value="${supp}"
                                       ${entry?.supplements?.includes(supp) ? 'checked' : ''}>
                                ${this.escapeText(supp)}
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Alcohol (drinks)</label>
                        <input type="number" class="form-input" name="alcoholDrinks" min="0"
                               placeholder="0" value="${safeAlcoholDrinks}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Alcohol Type</label>
                        <select class="form-select" name="alcoholType">
                            <option value="">None</option>
                            <option value="beer" ${entry?.alcohol?.type === 'beer' ? 'selected' : ''}>Beer</option>
                            <option value="wine" ${entry?.alcohol?.type === 'wine' ? 'selected' : ''}>Wine</option>
                            <option value="cocktail" ${entry?.alcohol?.type === 'cocktail' ? 'selected' : ''}>Cocktails</option>
                            <option value="mixed" ${entry?.alcohol?.type === 'mixed' ? 'selected' : ''}>Mixed</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Notes</label>
                    <textarea class="form-textarea" name="notes" rows="2"
                              placeholder="Any notes about today's nutrition...">${safeNotes}</textarea>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save</button>
                </div>
            </form>
        `;
    },

    // Handle meal form submission
    handleMealSubmit(formData) {
        const date = formData.get('date');
        const time = formData.get('time');

        const items = [];
        let index = 0;
        while (formData.has(`food_${index}_name`)) {
            const name = formData.get(`food_${index}_name`);
            if (name) {
                items.push({
                    name,
                    calories: parseInt(formData.get(`food_${index}_calories`)) || 0,
                    protein: parseInt(formData.get(`food_${index}_protein`)) || 0
                });
            }
            index++;
        }

        if (items.length > 0) {
            // Get or create entry for the date
            let entry = Storage.nutrition.findByDate(date);
            if (!entry) {
                entry = this.getOrCreate(date);
            }

            // Add meal
            const meal = { time, items };
            entry.meals = entry.meals || [];
            entry.meals.push(meal);

            // Recalculate totals
            let totalCalories = 0;
            let totalProtein = 0;
            entry.meals.forEach(m => {
                m.items.forEach(item => {
                    totalCalories += item.calories || 0;
                    totalProtein += item.protein || 0;
                });
            });

            Storage.nutrition.update(entry.id, {
                meals: entry.meals,
                totalCalories,
                totalProtein
            });

            return true;
        }

        return false;
    },

    // Handle day form submission
    handleDaySubmit(formData) {
        const supplements = formData.getAll('supplements');

        const data = {
            date: formData.get('date'),
            foodWindow: {
                start: formData.get('windowStart') || null,
                end: formData.get('windowEnd') || null
            },
            steps: formData.get('steps') ? parseInt(formData.get('steps')) : null,
            totalCalories: formData.get('totalCalories') ? parseInt(formData.get('totalCalories')) : 0,
            totalProtein: formData.get('totalProtein') ? parseInt(formData.get('totalProtein')) : 0,
            supplements,
            alcohol: {
                drinks: parseInt(formData.get('alcoholDrinks')) || 0,
                type: formData.get('alcoholType') || null
            },
            notes: formData.get('notes') || null
        };

        this.logDay(data);

        // Also update steps in metrics
        if (data.steps) {
            Metrics.logSteps(data.steps, data.date);
        }

        return true;
    }
};

// Make Nutrition available globally
window.Nutrition = Nutrition;
