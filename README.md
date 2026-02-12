# Health Tracker

A personal health and fitness tracking web application with workout logging, nutrition tracking, and analytics.

![Health Tracker Dashboard](https://via.placeholder.com/800x400?text=Health+Tracker+Dashboard)

## Features

### Workout Tracking
- **Smart Workout Generation** - Automatically suggests weights and reps based on your history
- **Guided Workout Mode** - Step-by-step guidance through each exercise with progressive overload
- **Exercise Library** - Common exercises for push, pull, legs, and cardio workouts
- **Workout Streak** - Track your consistency with streak counting

### Nutrition Tracking
- **Meal Logging** - Track calories and protein for each meal
- **Fasting Windows** - Monitor intermittent fasting schedules
- **Quick Add** - Common foods database for fast entry
- **Daily Totals** - See progress toward daily goals

### Metrics & Analytics
- **Weight Tracking** - Log weight with trend visualization and goal projection
- **Sleep Monitoring** - Track hours and quality of sleep
- **Energy Levels** - Correlate energy with workouts and nutrition
- **Personalized Insights** - AI-generated recommendations based on your data

### Additional Features
- **Dark Mode** - Easy on the eyes, always
- **Mobile Responsive** - Works great on any device
- **Offline Support** - Data stored locally, works without internet
- **Data Export/Import** - Backup and transfer your data

## Quick Start

### Local Development
```bash
# Install dependencies
npm install

# Run server checks
npm run lint
npm test

# Start server
npm start

# Open http://localhost:3000
```

### Alternative (No Node.js)
```bash
# Using Python
python -m http.server 3000

# Open http://localhost:3000
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy Options

| Platform | One-Click Deploy |
|----------|------------------|
| Render | Connect GitHub, auto-deploys |
| Railway | Connect GitHub, auto-deploys |
| Netlify | Drag & drop or connect repo |
| Vercel | `vercel --prod` |

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Charts**: Chart.js
- **Storage**: Browser localStorage + optional Firebase cloud sync
- **Server**: Node.js + Express (optional)

## Project Structure

```
health-tracker/
├── index.html          # Main dashboard
├── server.js           # Production server
├── package.json        # Dependencies
├── css/
│   └── styles.css      # All styles
├── js/
│   ├── app.js          # App initialization
│   ├── storage.js      # Data management
│   ├── workouts.js     # Workout features
│   ├── nutrition.js    # Nutrition features
│   ├── metrics.js      # Metrics tracking
│   ├── analytics.js    # Insights engine
│   └── charts.js       # Visualizations
└── pages/              # Secondary pages
```

## Data Privacy

By default, data is stored in your browser (`localStorage`).

If you sign in with Google, your data is synced to your own Firestore document so it can be used across devices.

Firestore security rules restrict reads/writes to the authenticated user that owns the document.

To backup your data:
1. Go to Settings
2. Click "Export Data"
3. Save the JSON file

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](./LICENSE) for details.
