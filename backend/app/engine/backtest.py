"""
Portfolio backtesting engine using historical crisis period simulation.

Reuses the existing GBM and Merton Jump Diffusion infrastructure from monte_carlo.py
but calibrates parameters to match historical crisis-era behaviour. Generates synthetic
price paths for each asset during a chosen crisis window, then aggregates into portfolio
equity curves with optional daily rebalancing.
"""

from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from app.engine.monte_carlo import (
    generate_correlated_normals,
    simulate_gbm,
    simulate_merton_jump_diffusion,
)


# ---------------------------------------------------------------------------
# Crisis period definitions
# ---------------------------------------------------------------------------

@dataclass
class AssetCrisisParams:
    """Per-asset parameters calibrated to a specific crisis period."""
    ticker: str
    name: str
    drift: float
    volatility: float
    jump_intensity: float = 0.0
    jump_mean: float = 0.0
    jump_vol: float = 0.0


@dataclass
class CrisisPeriod:
    """A historical crisis with calibrated per-asset simulation parameters."""
    id: str
    name: str
    start_date: str
    end_date: str
    trading_days: int
    description: str
    assets: dict[str, AssetCrisisParams] = field(default_factory=dict)
    correlation_overrides: dict[tuple[str, str], float] = field(
        default_factory=dict,
    )


# Common asset tickers used across crises
_BTC = "BTC-USD"
_SPX = "SPY"
_GOLD = "GLD"
_BOND = "TLT"
_QQQ = "QQQ"
_VTI = "VTI"

CRISIS_PERIODS: list[CrisisPeriod] = [
    CrisisPeriod(
        id="covid_crash",
        name="COVID-19 Crash",
        start_date="2020-02-19",
        end_date="2020-06-08",
        trading_days=78,
        description=(
            "Pandemic-driven sell-off. S&P 500 fell 34% in 23 trading days, "
            "the fastest bear market in history. Bitcoin dropped 50% on March 12. "
            "Gold initially sold off then rallied as flight-to-safety resumed. "
            "Treasuries surged as Fed cut rates to zero."
        ),
        assets={
            _SPX: AssetCrisisParams(_SPX, "S&P 500 ETF", -0.65, 0.80, 2.5, -0.08, 0.12),
            _QQQ: AssetCrisisParams(_QQQ, "Nasdaq-100 ETF", -0.50, 0.85, 2.0, -0.07, 0.11),
            _BTC: AssetCrisisParams(_BTC, "Bitcoin", -0.90, 1.20, 3.0, -0.12, 0.18),
            _GOLD: AssetCrisisParams(_GOLD, "Gold ETF", 0.15, 0.30, 0.5, 0.03, 0.06),
            _BOND: AssetCrisisParams(_BOND, "20+ Year Treasury ETF", 0.25, 0.40, 0.8, 0.04, 0.08),
            _VTI: AssetCrisisParams(_VTI, "Total Stock Market ETF", -0.60, 0.78, 2.4, -0.07, 0.11),
        },
        correlation_overrides={
            (_SPX, _QQQ): 0.95, (_SPX, _BTC): 0.60, (_SPX, _GOLD): -0.15,
            (_SPX, _BOND): -0.45, (_SPX, _VTI): 0.99,
            (_QQQ, _BTC): 0.55, (_QQQ, _GOLD): -0.20, (_QQQ, _BOND): -0.40,
            (_QQQ, _VTI): 0.96,
            (_BTC, _GOLD): 0.10, (_BTC, _BOND): -0.20, (_BTC, _VTI): 0.58,
            (_GOLD, _BOND): 0.35, (_GOLD, _VTI): -0.15,
            (_BOND, _VTI): -0.45,
        },
    ),
    CrisisPeriod(
        id="crypto_winter_2022",
        name="2022 Crypto Winter & Rate Shock",
        start_date="2022-01-03",
        end_date="2022-12-30",
        trading_days=251,
        description=(
            "Fed hiked rates aggressively from 0% to 4.5%. Bitcoin fell 65%, "
            "Luna/UST collapsed, FTX imploded. S&P 500 dropped 25%, Nasdaq fell 33%. "
            "Long-duration Treasuries had their worst year ever (-31%). "
            "Gold was roughly flat as dollar strength offset inflation demand."
        ),
        assets={
            _SPX: AssetCrisisParams(_SPX, "S&P 500 ETF", -0.22, 0.28, 1.0, -0.04, 0.08),
            _QQQ: AssetCrisisParams(_QQQ, "Nasdaq-100 ETF", -0.30, 0.35, 1.2, -0.05, 0.09),
            _BTC: AssetCrisisParams(_BTC, "Bitcoin", -0.65, 0.75, 2.5, -0.10, 0.15),
            _GOLD: AssetCrisisParams(_GOLD, "Gold ETF", -0.02, 0.16, 0.3, -0.01, 0.04),
            _BOND: AssetCrisisParams(_BOND, "20+ Year Treasury ETF", -0.35, 0.32, 0.8, -0.05, 0.07),
            _VTI: AssetCrisisParams(_VTI, "Total Stock Market ETF", -0.21, 0.27, 1.0, -0.04, 0.08),
        },
        correlation_overrides={
            (_SPX, _QQQ): 0.92, (_SPX, _BTC): 0.55, (_SPX, _GOLD): -0.05,
            (_SPX, _BOND): 0.50, (_SPX, _VTI): 0.99,
            (_QQQ, _BTC): 0.60, (_QQQ, _GOLD): -0.10, (_QQQ, _BOND): 0.45,
            (_QQQ, _VTI): 0.94,
            (_BTC, _GOLD): 0.05, (_BTC, _BOND): 0.30, (_BTC, _VTI): 0.53,
            (_GOLD, _BOND): 0.10, (_GOLD, _VTI): -0.05,
            (_BOND, _VTI): 0.50,
        },
    ),
    CrisisPeriod(
        id="bear_market_2018",
        name="2018 Crypto Bear & Q4 Sell-off",
        start_date="2018-01-08",
        end_date="2018-12-24",
        trading_days=242,
        description=(
            "Bitcoin collapsed 84% from its Dec-2017 peak. Equities sold off sharply "
            "in Q4 2018 as Fed tightened. S&P 500 dropped 20% from Oct highs. "
            "Gold was weak through most of the year but rallied in Q4. "
            "Treasuries provided modest refuge."
        ),
        assets={
            _SPX: AssetCrisisParams(_SPX, "S&P 500 ETF", -0.08, 0.22, 0.8, -0.04, 0.07),
            _QQQ: AssetCrisisParams(_QQQ, "Nasdaq-100 ETF", -0.05, 0.25, 0.9, -0.04, 0.08),
            _BTC: AssetCrisisParams(_BTC, "Bitcoin", -0.90, 0.85, 2.0, -0.12, 0.16),
            _GOLD: AssetCrisisParams(_GOLD, "Gold ETF", -0.04, 0.14, 0.3, -0.01, 0.04),
            _BOND: AssetCrisisParams(_BOND, "20+ Year Treasury ETF", -0.02, 0.18, 0.4, 0.01, 0.05),
            _VTI: AssetCrisisParams(_VTI, "Total Stock Market ETF", -0.07, 0.21, 0.8, -0.04, 0.07),
        },
        correlation_overrides={
            (_SPX, _QQQ): 0.93, (_SPX, _BTC): 0.25, (_SPX, _GOLD): -0.10,
            (_SPX, _BOND): -0.35, (_SPX, _VTI): 0.99,
            (_QQQ, _BTC): 0.30, (_QQQ, _GOLD): -0.15, (_QQQ, _BOND): -0.30,
            (_QQQ, _VTI): 0.95,
            (_BTC, _GOLD): 0.05, (_BTC, _BOND): -0.10, (_BTC, _VTI): 0.24,
            (_GOLD, _BOND): 0.25, (_GOLD, _VTI): -0.10,
            (_BOND, _VTI): -0.35,
        },
    ),
    CrisisPeriod(
        id="china_ban_2021",
        name="China Crypto Ban & May 2021 Crash",
        start_date="2021-05-10",
        end_date="2021-07-20",
        trading_days=50,
        description=(
            "China banned crypto mining and trading. Bitcoin crashed 55% from $58K to $29K. "
            "Equities were largely unaffected - S&P 500 continued upward. "
            "Gold edged lower. Treasuries were mixed as inflation concerns grew."
        ),
        assets={
            _SPX: AssetCrisisParams(_SPX, "S&P 500 ETF", 0.15, 0.14, 0.3, -0.02, 0.04),
            _QQQ: AssetCrisisParams(_QQQ, "Nasdaq-100 ETF", 0.18, 0.16, 0.4, -0.02, 0.05),
            _BTC: AssetCrisisParams(_BTC, "Bitcoin", -1.20, 1.10, 4.0, -0.15, 0.20),
            _GOLD: AssetCrisisParams(_GOLD, "Gold ETF", -0.08, 0.15, 0.3, -0.02, 0.04),
            _BOND: AssetCrisisParams(_BOND, "20+ Year Treasury ETF", 0.05, 0.18, 0.3, 0.01, 0.04),
            _VTI: AssetCrisisParams(_VTI, "Total Stock Market ETF", 0.14, 0.14, 0.3, -0.02, 0.04),
        },
        correlation_overrides={
            (_SPX, _QQQ): 0.90, (_SPX, _BTC): 0.15, (_SPX, _GOLD): 0.05,
            (_SPX, _BOND): -0.20, (_SPX, _VTI): 0.99,
            (_QQQ, _BTC): 0.20, (_QQQ, _GOLD): 0.00, (_QQQ, _BOND): -0.15,
            (_QQQ, _VTI): 0.93,
            (_BTC, _GOLD): 0.10, (_BTC, _BOND): -0.05, (_BTC, _VTI): 0.14,
            (_GOLD, _BOND): 0.30, (_GOLD, _VTI): 0.05,
            (_BOND, _VTI): -0.20,
        },
    ),
    CrisisPeriod(
        id="gfc_2008",
        name="Global Financial Crisis (2008)",
        start_date="2008-09-15",
        end_date="2009-03-09",
        trading_days=124,
        description=(
            "Lehman Brothers collapsed, triggering global financial meltdown. "
            "S&P 500 fell 46% from Sep 2008 to Mar 2009 low. All risk assets "
            "suffered extreme correlation convergence. Gold rallied 25%. "
            "Treasuries surged as Fed slashed rates. Bitcoin did not exist."
        ),
        assets={
            _SPX: AssetCrisisParams(_SPX, "S&P 500 ETF", -0.80, 0.65, 3.0, -0.10, 0.14),
            _QQQ: AssetCrisisParams(_QQQ, "Nasdaq-100 ETF", -0.70, 0.60, 2.5, -0.09, 0.12),
            _GOLD: AssetCrisisParams(_GOLD, "Gold ETF", 0.30, 0.30, 0.6, 0.04, 0.07),
            _BOND: AssetCrisisParams(_BOND, "20+ Year Treasury ETF", 0.35, 0.35, 0.5, 0.05, 0.08),
            _VTI: AssetCrisisParams(_VTI, "Total Stock Market ETF", -0.78, 0.64, 2.9, -0.10, 0.13),
        },
        correlation_overrides={
            (_SPX, _QQQ): 0.96, (_SPX, _GOLD): -0.20, (_SPX, _BOND): -0.55,
            (_SPX, _VTI): 0.99,
            (_QQQ, _GOLD): -0.25, (_QQQ, _BOND): -0.50, (_QQQ, _VTI): 0.97,
            (_GOLD, _BOND): 0.40, (_GOLD, _VTI): -0.20,
            (_BOND, _VTI): -0.55,
        },
    ),
    CrisisPeriod(
        id="dotcom_bust",
        name="Dot-Com Bust (2000-2002)",
        start_date="2000-03-10",
        end_date="2002-10-09",
        trading_days=650,
        description=(
            "Nasdaq fell 78% from peak. S&P 500 dropped 49%. Tech bubble deflated "
            "over 2.5 years. Treasuries rallied strongly as Fed cut rates from 6.5% "
            "to 1.25%. Gold was initially flat but began its secular bull run. "
            "Bitcoin did not exist."
        ),
        assets={
            _SPX: AssetCrisisParams(_SPX, "S&P 500 ETF", -0.25, 0.25, 1.2, -0.05, 0.09),
            _QQQ: AssetCrisisParams(_QQQ, "Nasdaq-100 ETF", -0.55, 0.45, 2.0, -0.08, 0.12),
            _GOLD: AssetCrisisParams(_GOLD, "Gold ETF", 0.05, 0.14, 0.2, 0.01, 0.03),
            _BOND: AssetCrisisParams(_BOND, "20+ Year Treasury ETF", 0.12, 0.18, 0.3, 0.02, 0.05),
            _VTI: AssetCrisisParams(_VTI, "Total Stock Market ETF", -0.22, 0.24, 1.1, -0.05, 0.09),
        },
        correlation_overrides={
            (_SPX, _QQQ): 0.88, (_SPX, _GOLD): -0.05, (_SPX, _BOND): -0.40,
            (_SPX, _VTI): 0.99,
            (_QQQ, _GOLD): -0.10, (_QQQ, _BOND): -0.35, (_QQQ, _VTI): 0.90,
            (_GOLD, _BOND): 0.20, (_GOLD, _VTI): -0.05,
            (_BOND, _VTI): -0.40,
        },
    ),
]

CRISIS_MAP: dict[str, CrisisPeriod] = {c.id: c for c in CRISIS_PERIODS}

# Available backtest assets (superset across all crises)
BACKTEST_ASSETS: dict[str, str] = {
    _SPX: "S&P 500 ETF",
    _QQQ: "Nasdaq-100 ETF",
    _BTC: "Bitcoin",
    _GOLD: "Gold ETF",
    _BOND: "20+ Year Treasury ETF",
    _VTI: "Total Stock Market ETF",
}


# ---------------------------------------------------------------------------
# Correlation matrix builder
# ---------------------------------------------------------------------------

def _build_correlation_matrix(
    tickers: list[str],
    crisis: CrisisPeriod,
) -> NDArray[np.float64]:
    """Build an NxN correlation matrix from crisis overrides."""
    n = len(tickers)
    corr = np.eye(n, dtype=np.float64)
    for i in range(n):
        for j in range(i + 1, n):
            pair = (tickers[i], tickers[j])
            pair_rev = (tickers[j], tickers[i])
            rho = crisis.correlation_overrides.get(
                pair,
                crisis.correlation_overrides.get(pair_rev, 0.0),
            )
            corr[i, j] = rho
            corr[j, i] = rho

    # Ensure positive semi-definite
    eigvals = np.linalg.eigvalsh(corr)
    if np.any(eigvals < -1e-8):
        corr += np.eye(n) * (abs(eigvals.min()) + 1e-6)

    return corr


# ---------------------------------------------------------------------------
# Core backtest runner
# ---------------------------------------------------------------------------

def run_backtest(
    crisis_id: str,
    portfolio: list[dict],
    num_simulations: int,
    initial_investment: float,
    model: str,
    rebalance: bool,
    seed: int | None = 42,
) -> dict:
    """
    Run a portfolio backtest against a historical crisis period.

    Args:
        crisis_id: ID of the crisis period to simulate
        portfolio: List of dicts with {ticker, allocation_pct}
        num_simulations: Number of Monte Carlo paths
        initial_investment: Starting portfolio value in dollars
        model: 'gbm' or 'merton'
        rebalance: Whether to rebalance daily
        seed: Random seed

    Returns:
        Dictionary with equity curves, drawdown, statistics, etc.
    """
    crisis = CRISIS_MAP.get(crisis_id)
    if crisis is None:
        raise ValueError(f"Unknown crisis period: {crisis_id}")

    rng = np.random.default_rng(seed)
    num_steps = crisis.trading_days
    dt = 1.0 / 252  # Daily time steps

    # Filter portfolio to assets available in this crisis
    valid_portfolio = []
    for item in portfolio:
        ticker = item["ticker"]
        if ticker in crisis.assets:
            valid_portfolio.append(item)

    if not valid_portfolio:
        raise ValueError(
            f"None of the selected assets are available in the "
            f"'{crisis.name}' crisis period."
        )

    # Normalize weights to sum to 100
    total_weight = sum(p["allocation_pct"] for p in valid_portfolio)
    if total_weight <= 0:
        raise ValueError("Total allocation must be positive")
    for p in valid_portfolio:
        p["allocation_pct"] = p["allocation_pct"] * 100.0 / total_weight

    num_assets = len(valid_portfolio)
    tickers = [p["ticker"] for p in valid_portfolio]
    weights = np.array([p["allocation_pct"] / 100.0 for p in valid_portfolio])

    # Build correlation matrix
    corr = _build_correlation_matrix(tickers, crisis)

    # Generate correlated normals
    Z_all = generate_correlated_normals(
        num_assets, num_simulations, num_steps, corr, rng,
    )

    # Simulate each asset's price paths
    asset_paths: list[NDArray[np.float64]] = []
    asset_info: list[dict] = []

    for i, item in enumerate(valid_portfolio):
        ticker = item["ticker"]
        params = crisis.assets[ticker]
        S0 = 100.0  # Normalised to 100 for each asset
        Z = Z_all[:, :, i]

        if model == "merton" and (params.jump_intensity > 0 or params.jump_vol > 0):
            paths = simulate_merton_jump_diffusion(
                S0=S0,
                mu=params.drift,
                sigma=params.volatility,
                lambda_j=params.jump_intensity,
                mu_j=params.jump_mean,
                sigma_j=params.jump_vol,
                dt=dt,
                num_steps=num_steps,
                Z=Z,
                rng=rng,
            )
        else:
            paths = simulate_gbm(
                S0=S0,
                mu=params.drift,
                sigma=params.volatility,
                dt=dt,
                num_steps=num_steps,
                Z=Z,
            )

        asset_paths.append(paths)
        asset_info.append({
            "ticker": ticker,
            "name": params.name,
            "allocation_pct": round(item["allocation_pct"], 2),
        })

    # Build portfolio equity curves
    # shape of each asset_paths[i]: (num_simulations, num_steps+1)
    portfolio_equity = np.zeros((num_simulations, num_steps + 1))

    if rebalance:
        # Daily rebalancing: each day reset weights to target
        portfolio_equity[:, 0] = initial_investment
        for t in range(1, num_steps + 1):
            daily_return = 0.0
            for i in range(num_assets):
                asset_ret = asset_paths[i][:, t] / asset_paths[i][:, t - 1]
                daily_return = daily_return + weights[i] * asset_ret
            portfolio_equity[:, t] = portfolio_equity[:, t - 1] * daily_return
    else:
        # Buy and hold: initial allocation, no rebalancing
        for i in range(num_assets):
            allocation = initial_investment * weights[i]
            # Scale from normalised S0=100 to dollar value
            portfolio_equity += allocation * (asset_paths[i] / 100.0)

    # Compute per-asset dollar curves (buy-and-hold basis for display)
    asset_curves: list[dict] = []
    for i in range(num_assets):
        allocation = initial_investment * weights[i]
        dollar_paths = allocation * (asset_paths[i] / 100.0)
        median_curve = np.median(dollar_paths, axis=0).tolist()
        final_vals = dollar_paths[:, -1]
        asset_curves.append({
            **asset_info[i],
            "median_curve": [round(v, 2) for v in median_curve],
            "final_median": round(float(np.median(final_vals)), 2),
            "final_return_pct": round(
                float((np.median(final_vals) - allocation) / allocation * 100), 2,
            ),
        })

    # Portfolio statistics
    stats = _compute_backtest_stats(
        portfolio_equity, initial_investment, num_steps, dt,
    )

    # Percentile bands for equity curve
    days = list(range(num_steps + 1))
    equity_percentiles = []
    for t in days:
        vals = portfolio_equity[:, t]
        equity_percentiles.append({
            "day": t,
            "p5": round(float(np.percentile(vals, 5)), 2),
            "p25": round(float(np.percentile(vals, 25)), 2),
            "median": round(float(np.median(vals)), 2),
            "p75": round(float(np.percentile(vals, 75)), 2),
            "p95": round(float(np.percentile(vals, 95)), 2),
        })

    # Drawdown curve (median path)
    median_equity = np.median(portfolio_equity, axis=0)
    running_max = np.maximum.accumulate(median_equity)
    drawdown_curve = ((running_max - median_equity) / running_max * 100).tolist()
    drawdown_percentiles = []
    for t in days:
        rm = np.maximum.accumulate(portfolio_equity[:, :t + 1], axis=1)
        dd = (rm[:, -1] - portfolio_equity[:, t]) / rm[:, -1] * 100
        drawdown_percentiles.append({
            "day": t,
            "median": round(float(np.median(dd)), 2),
            "p75": round(float(np.percentile(dd, 75)), 2),
            "p95": round(float(np.percentile(dd, 95)), 2),
        })

    # Sample paths (6 paths for visualization)
    n_sample = min(6, num_simulations)
    sample_paths = []
    for si in range(n_sample):
        path_data = [
            {"day": t, "value": round(float(portfolio_equity[si, t]), 2)}
            for t in days
        ]
        sample_paths.append(path_data)

    # Daily returns histogram
    daily_rets = np.diff(portfolio_equity, axis=1) / portfolio_equity[:, :-1]
    median_daily_rets = np.median(daily_rets, axis=0)
    hist_data = _compute_returns_histogram(median_daily_rets)

    return {
        "crisis": {
            "id": crisis.id,
            "name": crisis.name,
            "start_date": crisis.start_date,
            "end_date": crisis.end_date,
            "trading_days": crisis.trading_days,
            "description": crisis.description,
        },
        "portfolio": asset_info,
        "equity_percentiles": equity_percentiles,
        "drawdown_curve": [round(v, 2) for v in drawdown_curve],
        "drawdown_percentiles": drawdown_percentiles,
        "sample_paths": sample_paths,
        "asset_curves": asset_curves,
        "returns_histogram": hist_data,
        "statistics": stats,
        "config": {
            "num_simulations": num_simulations,
            "initial_investment": initial_investment,
            "model": model,
            "rebalance": rebalance,
        },
    }


# ---------------------------------------------------------------------------
# Statistics helpers
# ---------------------------------------------------------------------------

def _compute_backtest_stats(
    equity: NDArray[np.float64],
    initial_investment: float,
    num_steps: int,
    dt: float,
) -> dict:
    """Compute comprehensive backtest statistics."""
    terminal = equity[:, -1]
    total_return = (terminal - initial_investment) / initial_investment

    # Annualisation factor
    years = num_steps * dt
    ann_return = (terminal / initial_investment) ** (1.0 / years) - 1.0 if years > 0 else total_return

    # Daily returns across all simulations
    daily_rets = np.diff(equity, axis=1) / equity[:, :-1]
    median_daily = np.median(daily_rets, axis=0)

    # Sharpe ratio (annualised, rf=4%)
    rf_daily = 0.04 / 252
    excess = median_daily - rf_daily
    sharpe = (
        float(np.mean(excess) / np.std(excess) * np.sqrt(252))
        if np.std(excess) > 0 else 0.0
    )

    # Sortino ratio (downside deviation only)
    downside = excess[excess < 0]
    sortino = (
        float(np.mean(excess) / np.std(downside) * np.sqrt(252))
        if len(downside) > 0 and np.std(downside) > 0 else 0.0
    )

    # Max drawdown per simulation, then stats
    max_drawdowns = []
    for path in equity:
        rm = np.maximum.accumulate(path)
        dd = (rm - path) / rm
        max_drawdowns.append(float(np.max(dd)))
    max_drawdowns_arr = np.array(max_drawdowns)

    # Calmar ratio
    median_ann_ret = float(np.median(ann_return))
    median_dd = float(np.median(max_drawdowns_arr))
    calmar = median_ann_ret / median_dd if median_dd > 0 else 0.0

    # Recovery: days from max drawdown to recovery for median path
    median_path = np.median(equity, axis=0)
    rm = np.maximum.accumulate(median_path)
    dd_series = (rm - median_path) / rm
    peak_idx = int(np.argmax(dd_series))
    recovery_days: int | None = None
    for t in range(peak_idx, len(median_path)):
        if median_path[t] >= rm[peak_idx]:
            recovery_days = t - peak_idx
            break

    # VaR
    var_95 = float(-np.percentile(total_return, 5) * initial_investment)
    var_99 = float(-np.percentile(total_return, 1) * initial_investment)

    # Best / worst day (median across simulations)
    best_day = float(np.max(median_daily) * 100)
    worst_day = float(np.min(median_daily) * 100)
    positive_days = float(np.sum(median_daily > 0) / len(median_daily) * 100)

    return {
        "total_return_pct": round(float(np.median(total_return) * 100), 2),
        "annualized_return_pct": round(float(median_ann_ret * 100), 2),
        "final_value_median": round(float(np.median(terminal)), 2),
        "final_value_p5": round(float(np.percentile(terminal, 5)), 2),
        "final_value_p95": round(float(np.percentile(terminal, 95)), 2),
        "max_drawdown_pct": round(median_dd * 100, 2),
        "max_drawdown_p95": round(float(np.percentile(max_drawdowns_arr, 95)) * 100, 2),
        "sharpe_ratio": round(sharpe, 3),
        "sortino_ratio": round(sortino, 3),
        "calmar_ratio": round(calmar, 3),
        "var_95": round(var_95, 2),
        "var_99": round(var_99, 2),
        "best_day_pct": round(best_day, 2),
        "worst_day_pct": round(worst_day, 2),
        "positive_days_pct": round(positive_days, 1),
        "recovery_days": recovery_days,
        "volatility_ann_pct": round(float(np.std(median_daily) * np.sqrt(252) * 100), 2),
    }


def _compute_returns_histogram(daily_rets: NDArray[np.float64]) -> list[dict]:
    """Bin daily returns into a histogram."""
    if len(daily_rets) == 0:
        return []

    pct_rets = daily_rets * 100
    bin_min = max(float(np.min(pct_rets)) - 0.5, -15.0)
    bin_max = min(float(np.max(pct_rets)) + 0.5, 15.0)
    n_bins = min(40, max(10, int((bin_max - bin_min) / 0.25)))
    counts, edges = np.histogram(pct_rets, bins=n_bins, range=(bin_min, bin_max))

    result = []
    for i in range(len(counts)):
        mid = (edges[i] + edges[i + 1]) / 2
        result.append({
            "bin": round(float(mid), 2),
            "count": int(counts[i]),
            "is_negative": mid < 0,
        })
    return result
