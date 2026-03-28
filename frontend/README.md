# Portfolio Monte Carlo — Frontend

React 18 + TypeScript + Vite frontend for the Portfolio Monte Carlo Simulator. Implements a 4-step wizard UI for portfolio construction, AI analysis review, simulation configuration, and interactive results visualization.

## 4-Step Flow

| Step | Component | Description |
|------|-----------|-------------|
| 1. Describe | `PortfolioDescriber.tsx` | Natural language portfolio input with risk tolerance and horizon |
| 2. Analyze | `AnalysisReview.tsx` | AI recommendations with editable assets, allocations, and parameters |
| 3. Configure | `SimulationConfig.tsx` | Model selection (GBM/Merton), simulation count, horizon, investment |
| 4. Simulate | `SimulationDashboard.tsx` | Fan charts, sample paths, risk metrics, per-asset breakdown |

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx                          # 4-step wizard state machine
│   ├── App.css                          # Global styles
│   ├── api.ts                           # Backend API client (analyze + simulate)
│   ├── types/
│   │   └── portfolio.ts                 # TypeScript interfaces for all data models
│   └── components/
│       ├── PortfolioDescriber.tsx        # Step 1: text input, presets, risk, horizon
│       ├── AnalysisReview.tsx            # Step 2: AI analysis, editable asset cards
│       ├── SimulationConfig.tsx          # Step 3: model picker, sliders, summary
│       └── SimulationDashboard.tsx       # Step 4: charts, metrics, asset table
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── eslint.config.js
└── README.md
```

## Dependencies

### Runtime

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | React DOM renderer |
| `recharts` | ^2.12.4 | AreaChart (fan chart), LineChart (sample paths) |
| `lucide-react` | ^0.364.0 | Icon library (TrendingUp, Activity, BarChart3, etc.) |
| `class-variance-authority` | ^0.7.1 | Component variant management |
| `clsx` | ^2.1.1 | Conditional CSS class composition |
| `tailwind-merge` | ^3.5.0 | Intelligent Tailwind class merging |
| `tailwindcss-animate` | ^1.0.7 | Animation utilities |

### Development

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ~5.6.2 | Type checking |
| `vite` | ^6.0.1 | Build tool + HMR dev server |
| `@vitejs/plugin-react` | ^4.3.4 | React Fast Refresh |
| `tailwindcss` | ^3.4.16 | Utility-first CSS framework |
| `postcss` | ^8.4.49 | CSS processing |
| `autoprefixer` | ^10.4.20 | Vendor prefixing |
| `eslint` | ^9.15.0 | Linting |
| `typescript-eslint` | ^8.15.0 | TypeScript ESLint integration |

## Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend API base URL |

Set before building for production:
```bash
VITE_API_URL=https://your-backend-url.com npm run build
```

## Key Components

### PortfolioDescriber (Step 1)
- Textarea for natural language portfolio description
- 4 preset prompt buttons for quick start
- Risk tolerance selector (Low / Moderate / Aggressive)
- Investment horizon slider (1-30 years)

### AnalysisReview (Step 2)
- First-principles analysis display from AI
- Allocation progress bar with color-coded segments
- Editable asset cards: ticker, name, allocation %, drift, volatility, jump intensity
- Add/remove assets dynamically
- Allocation validation (must sum to 100%)

### SimulationConfig (Step 3)
- Model selection: GBM vs Merton Jump Diffusion with formula display
- Number of simulations slider (50-2000)
- Simulation horizon slider (1-30 years)
- Initial investment input
- Random seed input with reseed button
- Portfolio summary showing all assets and config

### SimulationDashboard (Step 4)
- Key metric cards: median terminal value, VaR (95%), Sharpe ratio, max drawdown
- Percentile fan chart (P10/P25/median/P75/P90) using Recharts AreaChart
- Sample simulation paths using Recharts LineChart
- Detailed risk metrics grid: expected return, volatility, Sharpe, VaR, CVaR, max drawdown
- Per-asset results table: allocation, median terminal, return, volatility, Sharpe, max drawdown
- Reconfigure and Build New Portfolio actions

## Build & Deploy

```bash
# Production build
npm run build
# Output in dist/

# Deploy to Firebase Hosting
firebase init hosting  # public dir: dist, SPA: Yes
firebase deploy

# Or serve with any static file server
npx serve dist
```
