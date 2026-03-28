# Portfolio Monte Carlo Simulator

An enterprise-grade portfolio simulation platform that combines **AI-powered analysis** with **Monte Carlo methods** (GBM and Merton Jump Diffusion) to model portfolio outcomes across thousands of stochastic paths.

Users describe a portfolio in plain English, review AI-recommended assets with calibrated parameters, configure simulation settings, and visualize results through interactive percentile fan charts, sample paths, and comprehensive risk metrics.

The platform also includes a **Historical Crisis Stress Test** mode that backtests portfolios against 6 major market crises using crisis-calibrated simulation parameters.

---

## Screenshots

### Step 1 — Describe Your Portfolio
Describe your investment goals in natural language. Select risk tolerance and investment horizon. Choose from preset prompts or write your own.

![Step 1 — Describe](docs/step1-describe.png)

### Step 2 — Review AI Analysis
AI analyzes your description and recommends specific assets with calibrated drift, volatility, and jump parameters. Edit allocations, add/remove assets, and review the first-principles rationale.

![Step 2 — Analyze](docs/step2-analyze.png)

### Step 3 — Configure Simulation
Choose between Geometric Brownian Motion and Merton Jump Diffusion models. Set number of simulations (50-2000), horizon (1-30 years), initial investment, and random seed.

![Step 3 — Configure](docs/step3-configure.png)

### Step 4 — Simulation Results
Interactive dashboard with key metrics (median terminal value, VaR, Sharpe ratio, max drawdown), percentile fan chart (P10/P25/median/P75/P90), sample simulation paths, detailed risk metrics table, and per-asset breakdown.

![Step 4 — Simulate](docs/step4-simulate.png)
![Step 4 — Details](docs/step4-simulate-details.png)

### Stress Test — Historical Crisis Backtest
Switch to "Stress Test" mode to backtest any portfolio against 6 historical market crises. Select a crisis period, configure asset allocations with presets, and run Monte Carlo simulation calibrated to crisis-era parameters. View results across 6 tabs: equity curve with confidence bands, drawdown analysis, per-asset breakdown, sample paths, returns histogram, and detailed statistics including Sharpe, Sortino, Calmar ratios, VaR, and recovery time.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  Mode: Forward Sim  |  Stress Test                       │
│  Step 1: Describe → Step 2: Analyze → Step 3: Configure │
│                    → Step 4: Simulate                    │
│  Backtest: Crisis Select → Portfolio → Run → Results     │
│  React 18 + TypeScript + Tailwind CSS + Recharts         │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP (JSON)
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   FastAPI Backend                         │
│  POST /api/analyze-portfolio  →  Gemini AI Analyzer      │
│  POST /api/simulate           →  Monte Carlo Engine      │
│  POST /api/optimize-weights   →  SLSQP Optimizer         │
│  GET  /api/crisis-periods     →  Crisis Period Catalog   │
│  GET  /api/backtest-assets    →  Available Assets         │
│  POST /api/backtest           →  Crisis Backtest Engine   │
│                                                          │
│  NumPy + SciPy + google-genai                            │
└─────────────────────────────────────────────────────────┘
```

**Backend** — Python 3.12 / FastAPI. Six endpoints: portfolio analysis (Gemini AI with curated fallbacks), Monte Carlo simulation (GBM + Merton Jump Diffusion with Cholesky-correlated assets), weight optimization (SLSQP), and historical crisis backtesting.

**Frontend** — React 18 / TypeScript / Vite. Mode switcher between Forward Simulation (4-step wizard) and Stress Test (crisis backtest). Interactive Recharts visualizations and dark enterprise theme built with Tailwind CSS.

---

## Key Features

- **Natural Language Portfolio Builder** — describe your portfolio in plain English; AI recommends assets with calibrated parameters
- **Geometric Brownian Motion (GBM)** — `S(t+dt) = S(t) * exp((mu - sigma^2/2)*dt + sigma*sqrt(dt)*Z)`
- **Merton Jump Diffusion** — `dS/S = (mu - lambda*k)dt + sigma*dW + J*dN` with Poisson jumps and log-normal jump sizes
- **Cholesky-Decomposed Correlation** — correlated Brownian motions across all assets via Cholesky factorization
- **Comprehensive Risk Metrics** — VaR (95%, 99%), CVaR (Expected Shortfall), Sharpe Ratio, Max Drawdown
- **Percentile Fan Charts** — P10, P25, Median, P75, P90 bands at annual intervals from monthly time steps
- **Per-Asset Breakdown** — individual asset results with allocation, terminal value, return, volatility, and drawdown
- **Configurable Parameters** — number of simulations, horizon, model type, initial investment, random seed
- **Editable Asset Allocations** — adjust drift, volatility, jump intensity, and allocation percentages before simulation
- **AI Fallback System** — 3 curated portfolio templates when Gemini API is unavailable
- **Portfolio Weight Optimizer** — SLSQP-based optimization for Sharpe, min variance, min CVaR, min max drawdown, or max return
- **Historical Crisis Stress Test** — backtest portfolios against 6 major market crises with calibrated parameters
- **6 Crisis Periods** — COVID-19 Crash, 2022 Crypto Winter, 2018 Bear Market, China Ban 2021, GFC 2008, Dot-Com Bust
- **Crisis-Calibrated Parameters** — per-asset drift, volatility, jump intensity, and correlation overrides matched to historical behavior
- **Backtest Analytics** — equity curve with confidence bands, drawdown analysis, per-asset breakdown, sample paths, returns histogram, Sharpe/Sortino/Calmar ratios, VaR, recovery time
- **Portfolio Presets** — Balanced, Aggressive Growth, Conservative, Crypto Heavy, Equity Only

---

## Dependencies

### Backend (Python 3.12)

| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi[standard]` | ^0.135.2 | Web framework with Uvicorn |
| `numpy` | ^2.4.3 | Monte Carlo simulation engine |
| `scipy` | ^1.17.1 | Statistical functions, Cholesky decomposition |
| `pydantic` | ^2.12.5 | Request/response validation |
| `google-genai` | ^1.68.0 | Gemini AI portfolio analysis |

### Frontend (Node.js)

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | React DOM renderer |
| `typescript` | ~5.6.2 | Type safety |
| `vite` | ^6.0.1 | Build tool and dev server |
| `tailwindcss` | ^3.4.16 | Utility-first CSS |
| `recharts` | ^2.12.4 | Charts (fan chart, line chart) |
| `lucide-react` | ^0.364.0 | Icons |
| `class-variance-authority` | ^0.7.1 | Component variants |
| `clsx` | ^2.1.1 | Conditional classnames |
| `tailwind-merge` | ^3.5.0 | Tailwind class merging |

---

## Getting Started

### Prerequisites

- Python 3.12+
- [Poetry](https://python-poetry.org/docs/#installation) (Python package manager)
- Node.js 18+ and npm

### Backend Setup

```bash
cd backend

# Install dependencies
poetry install

# (Optional) Set Gemini API key for AI analysis
# Without it, the app uses curated fallback portfolios
export GEMINI_API_KEY="your-google-gemini-api-key"

# Start the backend server
poetry run uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Environment Variables

| Variable | Location | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Backend | (none) | Google Gemini API key. Falls back to curated portfolios if unset |
| `VITE_API_URL` | Frontend | `http://localhost:8000` | Backend API URL |

---

## Deployment

### Firebase Hosting (Frontend) + Cloud Run (Backend)

**Frontend:**
```bash
cd frontend
npm run build
firebase init hosting  # public dir: dist, SPA: Yes
firebase deploy
```

**Backend:**
```bash
cd backend
gcloud run deploy portfolio-mc-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your-key
```

Update the frontend's `VITE_API_URL` to point to your Cloud Run URL before building.

---

## Project Structure

```
ai-disruption-mc/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app + CORS
│   │   ├── api/
│   │   │   └── routes.py            # /api/analyze-portfolio, /api/simulate, /api/backtest, etc.
│   │   ├── engine/
│   │   │   ├── analyzer.py          # Gemini AI portfolio analyzer + fallbacks
│   │   │   ├── backtest.py          # Crisis backtest engine + 6 crisis period definitions
│   │   │   ├── monte_carlo.py       # GBM, Merton Jump Diffusion, risk metrics
│   │   │   └── optimizer.py         # SLSQP portfolio weight optimizer
│   │   └── models/
│   │       └── schemas.py           # Pydantic request/response models
│   ├── pyproject.toml               # Poetry dependencies
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Mode switcher + 4-step wizard state machine
│   │   ├── api.ts                   # Backend API client
│   │   ├── types/
│   │   │   └── portfolio.ts         # TypeScript type definitions
│   │   └── components/
│   │       ├── BacktestPanel.tsx        # Stress Test: crisis backtest UI
│   │       ├── PortfolioDescriber.tsx   # Step 1: natural language input
│   │       ├── AnalysisReview.tsx       # Step 2: AI recommendations
│   │       ├── SimulationConfig.tsx     # Step 3: model & parameters
│   │       ├── SimulationDashboard.tsx  # Step 4: charts & metrics
│   │       └── ThemeProvider.tsx        # Light/dark theme context
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── README.md
├── docs/                            # Screenshots
└── README.md
```

---

## Mathematical Models

### Geometric Brownian Motion (GBM)

```
S(t+dt) = S(t) * exp((mu - sigma^2/2) * dt + sigma * sqrt(dt) * Z)
```

Where `mu` is drift (expected return), `sigma` is volatility, `dt = 1/12` (monthly steps), and `Z ~ N(0,1)`.

### Merton Jump Diffusion

```
dS/S = (mu - lambda*k)dt + sigma*dW + J*dN
```

Where `N ~ Poisson(lambda)` governs jump arrivals, `J ~ LogNormal(mu_J, sigma_J)` governs jump sizes, and `k = exp(mu_J + sigma_J^2/2) - 1` is the jump compensation term.

### Correlation

Asset paths are correlated via **Cholesky decomposition** of the correlation matrix, producing correlated Brownian motions across all assets in the portfolio.

### Risk Metrics

- **VaR (Value at Risk)** — dollar loss at 95th/99th percentile of the loss distribution
- **CVaR (Conditional VaR)** — expected loss beyond VaR (tail risk measure)
- **Sharpe Ratio** — `(E[r] - r_f) / sigma` with `r_f = 4%`
- **Max Drawdown** — worst peak-to-trough decline averaged across all paths

---

## License

MIT
