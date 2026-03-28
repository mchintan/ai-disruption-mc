# Portfolio Monte Carlo Simulator

An enterprise-grade portfolio simulation platform that combines **AI-powered analysis** with **Monte Carlo methods** (GBM and Merton Jump Diffusion) to model portfolio outcomes across thousands of stochastic paths.

Users describe a portfolio in plain English, review AI-recommended assets with calibrated parameters, run simulations, optimize weights, stress-test against historical crises, and execute trades through connected brokerages — all within a tab-based workspace that auto-saves experiments to IndexedDB.

---

## How It Works

The app is organized as a **workspace** with five tabs. A persistent portfolio bar shows the active portfolio at all times, and users can jump between tabs freely without losing state.

### Build
Describe your investment goals in natural language. AI analyzes your description and recommends specific assets with calibrated drift, volatility, and jump parameters. Edit allocations, add/remove assets, and adjust risk parameters. The AI description section collapses after first use — the asset editor is always accessible.

### Simulate
Choose between Geometric Brownian Motion and Merton Jump Diffusion models. Configure number of simulations (50-2000), horizon (1-30 years), initial investment, and random seed. Results include percentile fan charts (P10/P25/median/P75/P90), sample simulation paths, detailed risk metrics (VaR, CVaR, Sharpe, max drawdown), and per-asset breakdown.

### Backtest
Stress-test portfolios against 6 historical market crises: COVID-19 Crash, 2022 Crypto Winter, 2018 Bear Market, China Crypto Ban 2021, Global Financial Crisis 2008, and Dot-Com Bust. Crisis-calibrated parameters match historical asset behavior. View results across equity curves, drawdown analysis, per-asset breakdown, sample paths, returns histogram, and detailed statistics (Sharpe, Sortino, Calmar ratios, VaR, recovery time). Portfolio presets available: Balanced, Aggressive Growth, Conservative, Crypto Heavy, Equity Only.

### Optimize
Find optimal asset weights by running Monte Carlo optimization (scipy SLSQP). Choose from 5 objectives: maximize Sharpe ratio, minimize VaR, minimize CVaR, minimize max drawdown, or maximize expected return. View weight comparison tables, before/after metrics, and AI-generated narrative analysis. **"Apply Weights"** pushes optimized allocations back to the portfolio bar for re-simulation.

### Execute
Connect a brokerage account (Alpaca via OAuth) and generate a trade list from target allocations vs current holdings. Review buy/sell/hold actions, confirm, and submit orders with one click. Default paper trading mode with server-side safety gates. IBKR support planned.

---

## Workspace Features

- **Portfolio Bar** — always-visible strip showing current assets, allocations, and total
- **Non-Destructive Navigation** — switching tabs never clears results; edit assets without losing simulation data
- **Portfolio Experiments** — named, auto-saved experiments persisted to IndexedDB. Create, duplicate, rename, delete. Restored on page reload.
- **Cross-Tab Data Flow** — optimizer applies weights back to portfolio, backtest feeds into forward sim, execute reads from portfolio bar
- **Light/Dark Theme** — toggle with localStorage persistence

---

## Architecture

The backend is organized into **bounded context modules** — logically separated services running in a single container. Each context has its own router and can be extracted to a standalone service when scaling demands it.

```
┌─────────────────────────────────────────────────────────────┐
│  React Frontend (TypeScript + Tailwind + Recharts)          │
│  Workspace: Build | Simulate | Backtest | Optimize | Execute│
│  Portfolio Experiments: auto-saved to IndexedDB             │
│  Telemetry: sendBeacon → /api/obs/event                     │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP (JSON)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  FastAPI Backend (single container, scale by cloning)       │
│                                                             │
│  Bounded Contexts:                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Intake   │ │Portfolio │ │Simulation│ │ Insights │      │
│  │          │ │          │ │          │ │          │      │
│  │ Gemini   │ │ CRUD     │ │ MC sim   │ │ AI       │      │
│  │ NLP→     │ │ presets  │ │ optimizer│ │ narrative│      │
│  │ assets   │ │ versions │ │ backtest │ │ critique │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│  ┌──────────┐ ┌─────────────────────────────────────┐      │
│  │ Fulfill  │ │ Observability (cross-cutting)       │      │
│  │          │ │ Request tracing → SQLite             │      │
│  │ broker   │ │ Journey events → funnel, drop-offs   │      │
│  │ trades   │ │ /api/obs/* query endpoints           │      │
│  │ execute  │ │                                      │      │
│  └──────────┘ └─────────────────────────────────────┘      │
│                                                             │
│  Shared: engine/monte_carlo.py (GBM, Merton, Cholesky)     │
│  NumPy + SciPy + google-genai + httpx + cryptography        │
└─────────────────────────────────────────────────────────────┘
```

**Backend** — Python 3.12 / FastAPI. Six bounded contexts: intake (Gemini AI analysis), portfolio (persistence), simulation (Monte Carlo + optimizer + backtest), insights (AI narratives), fulfill (brokerage integration + trade execution), and observability (request tracing + user journey analytics). All run in a single container; scale horizontally by cloning.

**Frontend** — React 18 / TypeScript / Vite. Tab-based workspace (Build, Simulate, Backtest, Optimize, Execute) with a persistent portfolio bar and experiment management. Portfolio experiments auto-saved to IndexedDB and restored on reload. Light/dark theme toggle. Frontend telemetry via `sendBeacon`. Interactive Recharts visualizations built with Tailwind CSS.

---

## Key Features

### Simulation & Analysis
- **Natural Language Portfolio Builder** — describe your portfolio in plain English; AI recommends assets with calibrated parameters
- **Geometric Brownian Motion (GBM)** — `S(t+dt) = S(t) * exp((mu - sigma^2/2)*dt + sigma*sqrt(dt)*Z)`
- **Merton Jump Diffusion** — `dS/S = (mu - lambda*k)dt + sigma*dW + J*dN` with Poisson jumps and log-normal jump sizes
- **Cholesky-Decomposed Correlation** — correlated Brownian motions across all assets via Cholesky factorization
- **Comprehensive Risk Metrics** — VaR (95%, 99%), CVaR (Expected Shortfall), Sharpe Ratio, Max Drawdown
- **Percentile Fan Charts** — P10, P25, Median, P75, P90 bands at annual intervals from monthly time steps
- **Per-Asset Breakdown** — individual asset results with allocation, terminal value, return, volatility, and drawdown
- **AI Fallback System** — 3 curated portfolio templates when Gemini API is unavailable

### Optimization & Backtesting
- **Portfolio Weight Optimizer** — SLSQP-based optimization for max Sharpe, min VaR, min CVaR, min max drawdown, or max return
- **Apply Optimized Weights** — one-click to update portfolio and re-simulate with optimal allocations
- **Historical Crisis Stress Test** — backtest portfolios against 6 major market crises with calibrated parameters
- **Crisis-Calibrated Parameters** — per-asset drift, volatility, jump intensity, and correlation overrides matched to historical behavior
- **Backtest Analytics** — equity curves, drawdown, per-asset breakdown, sample paths, returns histogram, Sharpe/Sortino/Calmar ratios

### Execution & Brokerage
- **Brokerage Integration** — connect Alpaca via OAuth, generate trade lists from target allocations vs current holdings
- **Provider Abstraction** — clean `BrokerProvider` interface for adding new brokers (one file + one registry line)
- **Trade Safety** — default paper trading mode, server-side `confirm` gate, encrypted token storage, PAPER/LIVE indicators

### Workspace & Navigation
- **Tab-Based Workspace** — 5 tabs (Build, Simulate, Backtest, Optimize, Execute) replacing the linear wizard
- **Portfolio Experiments** — named, auto-saved experiments with IndexedDB persistence, duplicate/rename/delete
- **Non-Destructive Navigation** — switching tabs never clears results
- **Cross-Tab Data Flow** — optimizer applies weights back to portfolio, backtest feeds into forward sim
- **Light/Dark Theme** — toggle between themes with localStorage persistence

### Platform
- **Observability** — automatic request tracing, user journey events, funnel analytics, drop-off detection, bottleneck identification
- **Bounded Context Architecture** — modular backend ready for microservice extraction
- **Telemetry** — frontend sendBeacon + backend SQLite store, exportable via OTLP

---

## Dependencies

### Backend (Python 3.12)

| Package | Purpose |
|---------|---------|
| `fastapi[standard]` | Web framework with Uvicorn |
| `numpy` | Monte Carlo simulation engine |
| `scipy` | Statistical functions, Cholesky decomposition, SLSQP optimizer |
| `pydantic` | Request/response validation |
| `google-genai` | Gemini AI portfolio analysis and narrative generation |
| `python-dotenv` | Environment variable management |
| `httpx` | Async HTTP client for brokerage APIs |
| `cryptography` | Fernet encryption for OAuth token storage |
| `opentelemetry-api` | Telemetry instrumentation |
| `opentelemetry-sdk` | Telemetry SDK |
| `opentelemetry-instrumentation-fastapi` | Auto-instrumentation for FastAPI |

### Frontend (Node.js)

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI framework |
| `typescript` | Type safety |
| `vite` | Build tool and dev server |
| `tailwindcss` | Utility-first CSS |
| `recharts` | Charts (fan chart, line chart, bar chart, area chart) |
| `lucide-react` | Icons |

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+ and npm

### Backend Setup

```bash
cd backend

# Install dependencies (pip or poetry)
pip install fastapi[standard] numpy scipy pydantic google-genai python-dotenv httpx cryptography opentelemetry-api opentelemetry-sdk opentelemetry-instrumentation-fastapi

# (Optional) Set Gemini API key for AI analysis
# Without it, the app uses curated fallback portfolios
echo 'GEMINI_API_KEY=your-google-gemini-api-key' > .env

# Start the backend server
uvicorn app.main:app --reload --port 8000
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
| `GEMINI_API_KEY` | Backend `.env` | (none) | Google Gemini API key. Falls back to curated portfolios if unset |
| `VITE_API_URL` | Frontend | `http://localhost:8000` | Backend API URL |
| `ALPACA_CLIENT_ID` | Backend `.env` | (none) | Alpaca OAuth client ID |
| `ALPACA_CLIENT_SECRET` | Backend `.env` | (none) | Alpaca OAuth client secret |
| `DEFAULT_TRADING_MODE` | Backend `.env` | `paper` | `paper` for sandbox, `live` for real money |
| `TOKEN_ENCRYPTION_KEY` | Backend `.env` | (auto-gen) | Fernet key for encrypting stored OAuth tokens |
| `OTEL_EXPORTER_ENDPOINT` | Backend `.env` | (none) | OTLP collector endpoint for external telemetry export |

---

## Project Structure

```
ai-disruption-mc/
├── backend/
│   ├── app/
│   │   ├── main.py                          # FastAPI app, middleware, router mounts
│   │   ├── contexts/                        # Bounded context modules
│   │   │   ├── intake/
│   │   │   │   └── router.py                # POST /api/analyze-portfolio
│   │   │   ├── portfolio/
│   │   │   │   └── router.py                # CRUD endpoints (placeholder)
│   │   │   ├── simulation/
│   │   │   │   └── router.py                # /api/simulate, /optimize-weights, /backtest
│   │   │   ├── insights/
│   │   │   │   ├── narrator.py              # AI narrative generation (Gemini)
│   │   │   │   └── router.py                # Explain endpoints (placeholder)
│   │   │   ├── fulfill/
│   │   │   │   ├── router.py                # OAuth, trade list, execute, order status
│   │   │   │   ├── schemas.py               # Fulfill-specific Pydantic models
│   │   │   │   ├── trade_generator.py       # Target vs current → buy/sell list
│   │   │   │   ├── token_store.py           # Encrypted OAuth token storage
│   │   │   │   └── providers/
│   │   │   │       ├── base.py              # BrokerProvider ABC
│   │   │   │       └── alpaca.py            # Alpaca REST API adapter
│   │   │   └── observability/
│   │   │       ├── middleware.py             # Request tracing middleware
│   │   │       ├── journey.py               # Event emitter + SQLite store
│   │   │       └── router.py                # /api/obs/* query endpoints
│   │   ├── engine/                          # Shared compute library
│   │   │   ├── analyzer.py                  # Gemini AI portfolio analyzer
│   │   │   ├── backtest.py                  # Crisis backtest engine
│   │   │   ├── monte_carlo.py               # GBM, Merton, risk metrics
│   │   │   └── optimizer.py                 # SLSQP weight optimizer
│   │   └── models/
│   │       └── schemas.py                   # Pydantic models
│   ├── pyproject.toml
│   └── .env                                 # Secrets (gitignored)
├── frontend/
│   ├── src/
│   │   ├── App.tsx                          # Workspace shell + experiment management
│   │   ├── api.ts                           # API client (sends X-Session-ID)
│   │   ├── telemetry.ts                     # Frontend event tracker (sendBeacon)
│   │   ├── store/
│   │   │   ├── experiments.ts               # IndexedDB wrapper for experiments
│   │   │   └── useExperiment.ts             # React hook for experiment state
│   │   ├── types/
│   │   │   ├── portfolio.ts                 # Core types + PortfolioExperiment
│   │   │   └── fulfill.ts                   # Brokerage/trade interfaces
│   │   └── components/
│   │       ├── WorkspaceTabs.tsx             # 5-tab navigation bar
│   │       ├── PortfolioBar.tsx              # Always-visible portfolio strip
│   │       ├── BuildTab.tsx                  # AI describe + asset editor
│   │       ├── SimulateTab.tsx               # Config + results dashboard
│   │       ├── OptimizeTab.tsx               # Weight optimization + apply
│   │       ├── BacktestTab.tsx               # Crisis stress test
│   │       ├── ExecuteTab.tsx                # Broker connect + trade execution
│   │       └── ThemeProvider.tsx             # Light/dark theme context
│   ├── package.json
│   └── tailwind.config.js
├── docs/                                    # Screenshots
└── README.md
```

---

## Observability

Built-in observability for monitoring user journeys and system performance. Telemetry stored locally in SQLite (`telemetry.db`) and queryable via REST endpoints.

| Endpoint | Description |
|----------|-------------|
| `GET /api/obs/funnel?hours=24` | Step completion rates across bounded contexts |
| `GET /api/obs/timing?hours=24` | P50/P95/P99 latency per API endpoint |
| `GET /api/obs/journey/:session` | Full event timeline for a specific user session |
| `GET /api/obs/errors?hours=24` | Recent errors grouped by context and endpoint |
| `GET /api/obs/bottlenecks` | Top 10 slowest endpoints by P95 latency |
| `GET /api/obs/drop-offs?hours=24` | Steps with highest user abandonment rates |
| `POST /api/obs/event` | Frontend event sink (receives telemetry via sendBeacon) |

Set `OTEL_EXPORTER_ENDPOINT` to ship telemetry to an external OpenTelemetry collector (Jaeger, Grafana Tempo, Datadog) instead of local SQLite.

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
- **Sortino Ratio** — like Sharpe but uses downside deviation only
- **Calmar Ratio** — annualized return / max drawdown
- **Max Drawdown** — worst peak-to-trough decline averaged across all paths

---

## License

MIT
