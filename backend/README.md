# Portfolio Monte Carlo — Backend

FastAPI backend powering the Portfolio Monte Carlo Simulator. Provides AI-driven portfolio analysis via Google Gemini and a NumPy-based Monte Carlo simulation engine with GBM and Merton Jump Diffusion models.

## API Endpoints

### `POST /api/analyze-portfolio`

Analyzes a natural language portfolio description and returns AI-recommended assets with calibrated simulation parameters.

**Request:**
```json
{
  "description": "Tech-heavy growth portfolio with AI exposure, hedged against inflation",
  "risk_tolerance": "moderate",
  "horizon_years": 10
}
```

**Response:**
```json
{
  "analysis": "First principles rationale for the portfolio...",
  "assets": [
    {
      "ticker": "QQQ",
      "name": "Nasdaq-100 ETF",
      "allocation_pct": 30,
      "drift": 0.12,
      "volatility": 0.22,
      "jump_intensity": 0.8,
      "jump_mean": -0.05,
      "jump_vol": 0.1,
      "rationale": "Tech/growth tilt for AI exposure"
    }
  ],
  "correlation_matrix": [[1.0, 0.7], [0.7, 1.0]]
}
```

### `POST /api/simulate`

Runs Monte Carlo simulation on a configured portfolio and returns percentile bands, sample paths, risk metrics, and per-asset results.

**Request:**
```json
{
  "assets": [...],
  "correlation_matrix": [[...]],
  "num_simulations": 500,
  "num_years": 10,
  "model": "merton",
  "initial_investment": 100000,
  "seed": 42
}
```

**Response includes:**
- `portfolio_percentiles` — P10, P25, median, P75, P90 at annual intervals
- `portfolio_risk_metrics` — VaR, CVaR, Sharpe, max drawdown, terminal values
- `portfolio_sample_paths` — 6 sample simulation paths for visualization
- `asset_results` — per-asset percentiles, risk metrics, and sample paths

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS middleware
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py        # API route handlers
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── analyzer.py      # Gemini AI analyzer + 3 fallback portfolios
│   │   └── monte_carlo.py   # GBM, Merton Jump Diffusion, risk metrics
│   └── models/
│       ├── __init__.py
│       └── schemas.py       # Pydantic request/response models
├── pyproject.toml            # Poetry dependencies
└── README.md
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi[standard]` | ^0.135.2 | Web framework + Uvicorn server |
| `numpy` | ^2.4.3 | Array operations, random number generation |
| `scipy` | ^1.17.1 | Cholesky decomposition, statistical functions |
| `pydantic` | ^2.12.5 | Request/response validation and serialization |
| `google-genai` | ^1.68.0 | Google Gemini API client for portfolio analysis |

## Setup

```bash
# Install dependencies
poetry install

# Set Gemini API key (optional — falls back to curated portfolios)
export GEMINI_API_KEY="your-google-gemini-api-key"

# Run development server
poetry run uvicorn app.main:app --reload --port 8000

# API docs available at http://localhost:8000/docs
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | No | Google Gemini API key. When unset, the analyzer returns one of 3 curated fallback portfolios based on risk tolerance |

## Monte Carlo Engine

### Geometric Brownian Motion (GBM)

```
S(t+dt) = S(t) * exp((mu - sigma^2/2) * dt + sigma * sqrt(dt) * Z)
```

Monthly time steps (`dt = 1/12`). Paths are generated using NumPy's `default_rng` for reproducibility.

### Merton Jump Diffusion

```
dS/S = (mu - lambda*k)dt + sigma*dW + J*dN
```

- `N ~ Poisson(lambda)` — jump arrival process
- `J ~ LogNormal(mu_J, sigma_J)` — jump size distribution
- `k = exp(mu_J + sigma_J^2/2) - 1` — jump compensation term

### Correlation

Assets are correlated via Cholesky decomposition of the correlation matrix. The engine validates positive semi-definiteness and applies diagonal correction if needed.

### Risk Metrics

- **VaR (95%, 99%)** — `var = -percentile(returns, alpha) * initial_investment`
- **CVaR (95%)** — expected loss beyond VaR threshold
- **Sharpe Ratio** — `(mean_annual_return - 0.04) / annual_volatility`
- **Max Drawdown** — average worst peak-to-trough across all paths

## AI Analyzer

The analyzer sends structured prompts to Google Gemini requesting:
- Asset recommendations with ticker, name, allocation, drift, volatility
- Jump diffusion parameters (intensity, mean, vol) for each asset
- Correlation matrix between all recommended assets
- First-principles analysis explaining the portfolio construction rationale

When the Gemini API is unavailable or `GEMINI_API_KEY` is not set, the analyzer returns one of three curated fallback portfolios:
1. **Conservative** — bonds, gold, dividend stocks, REITs
2. **Moderate** — balanced mix of equities, bonds, gold, crypto
3. **Aggressive** — tech-heavy with crypto, growth stocks, leveraged positions
