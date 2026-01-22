# Health Tracker - Project Context

## What This Project Is
A personal health and fitness tracking web application built with vanilla JavaScript. Features workout logging with smart recommendations, nutrition tracking, weight monitoring, and analytics.

## Tech Stack
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Storage**: Browser localStorage (client-side only)
- **Server**: Node.js + Express (for static file serving)
- **Charts**: Chart.js

## Quick Start

### Local Development
```bash
# Option 1: Using Node.js
npm install
npm start
# Open http://localhost:3000

# Option 2: Simple HTTP server
python -m http.server 3000
# Open http://localhost:3000
```

### Production Deployment
```bash
# Render
# Connect repo and it auto-deploys via render.yaml

# Railway
# Connect repo and it auto-deploys via railway.json

# Docker
docker build -t health-tracker .
docker run -p 3000:3000 health-tracker
```

## Project Structure
```
health-tracker/
├── index.html              # Main dashboard
├── server.js               # Express production server
├── package.json            # Node.js dependencies
├── css/
│   ├── styles.css          # Global styles (dark theme)
│   └── dashboard.css       # Dashboard-specific styles
├── js/
│   ├── app.js              # Main app initialization
│   ├── storage.js          # localStorage abstraction
│   ├── workouts.js         # Workout logging + guided mode
│   ├── nutrition.js        # Nutrition tracking
│   ├── metrics.js          # Weight, sleep, daily metrics
│   ├── analytics.js        # Insights and analytics
│   ├── charts.js           # Chart.js visualizations
│   └── dayview.js          # Unified day view
├── pages/
│   ├── workouts.html       # Workout history
│   ├── nutrition.html      # Nutrition logs
│   ├── analytics.html      # Analytics dashboard
│   └── settings.html       # Settings page
└── data/
    └── historical-import.json  # Sample/historical data
```

## Key Features

### Workout Tracking
- Log exercises with sets, reps, and weights
- **Smart workout generation** based on history
- **Guided workout mode** with progressive overload
- Workout streak tracking
- Exercise rotation suggestions

### Nutrition Tracking
- Meal logging with calories and protein
- Fasting window tracking
- Daily totals and goals
- Quick-add from food database

### Metrics & Analytics
- Weight trend with goal projection
- Sleep quality tracking
- Energy level correlation
- Weekly statistics
- Personalized insights

## Data Storage
All data is stored in browser localStorage under these keys:
- `health_tracker_workouts` - Workout history
- `health_tracker_nutrition` - Nutrition logs
- `health_tracker_metrics` - Daily metrics
- `health_tracker_goals` - User goals
- `health_tracker_settings` - App settings

## Deployment Notes
- **No database required** - all client-side storage
- Works offline after initial load
- Mobile-responsive design
- PWA-ready (can add service worker)
