"""
Monte Carlo simulation engine with GBM and Merton Jump Diffusion models.

GBM: dS/S = mu*dt + sigma*dW
     => S(t+dt) = S(t) * exp((mu - sigma^2/2)*dt + sigma*sqrt(dt)*Z)

Merton Jump Diffusion: dS/S = (mu - lambda*k)*dt + sigma*dW + J*dN
     where N ~ Poisson(lambda), J ~ LogNormal(mu_J, sigma_J)
     k = exp(mu_J + sigma_J^2/2) - 1  (compensator)
     => S(t+dt) = S(t) * exp((mu - sigma^2/2 - lambda*k)*dt + sigma*sqrt(dt)*Z) * prod(jumps)
"""

import numpy as np
from numpy.typing import NDArray


def generate_correlated_normals(
    num_assets: int,
    num_simulations: int,
    num_steps: int,
    correlation_matrix: NDArray[np.float64],
    rng: np.random.Generator,
) -> NDArray[np.float64]:
    """Generate correlated standard normal random variables using Cholesky decomposition."""
    if num_assets == 1:
        return rng.standard_normal((num_simulations, num_steps, 1))

    cholesky = np.linalg.cholesky(correlation_matrix)
    uncorrelated = rng.standard_normal((num_simulations, num_steps, num_assets))
    correlated = uncorrelated @ cholesky.T
    return correlated


def simulate_gbm(
    S0: float,
    mu: float,
    sigma: float,
    dt: float,
    num_steps: int,
    Z: NDArray[np.float64],
) -> NDArray[np.float64]:
    """
    Geometric Brownian Motion simulation.

    S(t+dt) = S(t) * exp((mu - sigma^2/2)*dt + sigma*sqrt(dt)*Z)

    Args:
        S0: Initial price
        mu: Annual drift
        sigma: Annual volatility
        dt: Time step in years
        num_steps: Number of time steps
        Z: Standard normal random variables, shape (num_simulations, num_steps)

    Returns:
        Price paths, shape (num_simulations, num_steps + 1)
    """
    num_sims = Z.shape[0]
    paths = np.zeros((num_sims, num_steps + 1))
    paths[:, 0] = S0

    drift_term = (mu - 0.5 * sigma**2) * dt
    diffusion_term = sigma * np.sqrt(dt) * Z

    log_returns = drift_term + diffusion_term
    paths[:, 1:] = S0 * np.exp(np.cumsum(log_returns, axis=1))

    return paths


def simulate_merton_jump_diffusion(
    S0: float,
    mu: float,
    sigma: float,
    lambda_j: float,
    mu_j: float,
    sigma_j: float,
    dt: float,
    num_steps: int,
    Z: NDArray[np.float64],
    rng: np.random.Generator,
) -> NDArray[np.float64]:
    """
    Merton Jump Diffusion simulation.

    dS/S = (mu - lambda*k)*dt + sigma*dW + J*dN
    where k = exp(mu_J + sigma_J^2/2) - 1

    Args:
        S0: Initial price
        mu: Annual drift
        sigma: Annual volatility (diffusion component)
        lambda_j: Jump intensity (avg jumps per year)
        mu_j: Mean of log-normal jump size
        sigma_j: Vol of log-normal jump size
        dt: Time step in years
        num_steps: Number of time steps
        Z: Standard normal random variables for diffusion, shape (num_sims, num_steps)
        rng: Random number generator

    Returns:
        Price paths, shape (num_simulations, num_steps + 1)
    """
    num_sims = Z.shape[0]
    paths = np.zeros((num_sims, num_steps + 1))
    paths[:, 0] = S0

    # Jump compensator: k = E[e^J - 1]
    k = np.exp(mu_j + 0.5 * sigma_j**2) - 1.0

    # Adjusted drift to compensate for jumps
    drift_adj = (mu - 0.5 * sigma**2 - lambda_j * k) * dt
    diffusion = sigma * np.sqrt(dt) * Z

    # Generate Poisson jump counts and jump sizes for each path and step
    num_jumps = rng.poisson(lambda_j * dt, size=(num_sims, num_steps))
    # For each step, the total jump is the sum of individual jump sizes
    # Each individual jump is log-normal: ln(1+J) ~ N(mu_j, sigma_j^2)
    # Total log-jump for the step = sum of num_jumps individual jumps
    jump_component = np.zeros((num_sims, num_steps))
    max_jumps = int(num_jumps.max()) if num_jumps.max() > 0 else 0
    if max_jumps > 0:
        # Generate all possible jump sizes
        all_jumps = rng.normal(mu_j, sigma_j, size=(num_sims, num_steps, max_jumps))
        # Mask: only count jumps up to num_jumps for each (sim, step)
        mask = np.arange(max_jumps)[None, None, :] < num_jumps[:, :, None]
        # Sum the log-jump sizes for active jumps
        jump_component = np.sum(all_jumps * mask, axis=2)

    log_returns = drift_adj + diffusion + jump_component
    paths[:, 1:] = S0 * np.exp(np.cumsum(log_returns, axis=1))

    return paths


def compute_percentiles(
    paths: NDArray[np.float64],
    years: NDArray[np.float64],
) -> list[dict]:
    """Compute percentile statistics across simulation paths."""
    result = []
    for i in range(paths.shape[1]):
        vals = paths[:, i]
        result.append({
            "year": round(float(years[i]), 2),
            "p10": round(float(np.percentile(vals, 10)), 2),
            "p25": round(float(np.percentile(vals, 25)), 2),
            "median": round(float(np.percentile(vals, 50)), 2),
            "p75": round(float(np.percentile(vals, 75)), 2),
            "p90": round(float(np.percentile(vals, 90)), 2),
            "mean": round(float(np.mean(vals)), 2),
        })
    return result


def compute_risk_metrics(
    paths: NDArray[np.float64],
    initial_investment: float,
    num_years: int,
) -> dict:
    """Compute portfolio risk metrics from simulation paths."""
    terminal_values = paths[:, -1]
    total_returns = (terminal_values - initial_investment) / initial_investment
    annualized_returns = (terminal_values / initial_investment) ** (1.0 / num_years) - 1.0

    # VaR: loss at given confidence level
    var_95 = float(-np.percentile(total_returns, 5) * initial_investment)
    var_99 = float(-np.percentile(total_returns, 1) * initial_investment)

    # CVaR: expected loss beyond VaR
    losses = -total_returns * initial_investment
    cvar_95 = float(np.mean(losses[losses >= np.percentile(losses, 95)]))

    # Sharpe ratio (assuming risk-free rate of 4%)
    rf = 0.04
    mean_annual_return = float(np.mean(annualized_returns))
    vol_annual = float(np.std(annualized_returns))
    sharpe = (mean_annual_return - rf) / vol_annual if vol_annual > 0 else 0.0

    # Maximum drawdown across all paths (average)
    max_drawdowns = []
    for path in paths:
        running_max = np.maximum.accumulate(path)
        drawdowns = (running_max - path) / running_max
        max_drawdowns.append(float(np.max(drawdowns)))
    avg_max_drawdown = float(np.mean(max_drawdowns))

    return {
        "var_95": round(var_95, 2),
        "var_99": round(var_99, 2),
        "cvar_95": round(cvar_95, 2),
        "sharpe_ratio": round(sharpe, 4),
        "max_drawdown": round(avg_max_drawdown, 4),
        "expected_return": round(mean_annual_return, 4),
        "volatility": round(vol_annual, 4),
        "median_terminal": round(float(np.median(terminal_values)), 2),
        "mean_terminal": round(float(np.mean(terminal_values)), 2),
    }


def run_simulation(
    assets: list[dict],
    correlation_matrix: list[list[float]],
    num_simulations: int,
    num_years: int,
    model: str,
    initial_investment: float,
    seed: int | None = 42,
) -> dict:
    """
    Run full Monte Carlo simulation for a portfolio of assets.

    Args:
        assets: List of asset configs with ticker, allocation_pct, drift, volatility, etc.
        correlation_matrix: NxN correlation matrix
        num_simulations: Number of simulation paths
        num_years: Simulation horizon in years
        model: 'gbm' or 'merton'
        initial_investment: Starting portfolio value
        seed: Random seed for reproducibility

    Returns:
        Dictionary with portfolio and per-asset results
    """
    rng = np.random.default_rng(seed)
    num_assets = len(assets)
    dt = 1.0 / 12  # Monthly time steps
    num_steps = num_years * 12
    years = np.arange(0, num_steps + 1) * dt

    # Build correlation matrix
    if correlation_matrix and len(correlation_matrix) == num_assets:
        corr = np.array(correlation_matrix, dtype=np.float64)
        # Ensure positive semi-definite
        eigvals = np.linalg.eigvalsh(corr)
        if np.any(eigvals < -1e-8):
            # Fix non-PSD matrix by adding small diagonal
            corr += np.eye(num_assets) * (abs(eigvals.min()) + 1e-6)
    else:
        corr = np.eye(num_assets)

    # Generate correlated normal random variables
    Z_all = generate_correlated_normals(num_assets, num_simulations, num_steps, corr, rng)

    # Simulate each asset
    asset_paths_list = []
    asset_results = []
    weights = []

    for i, asset in enumerate(assets):
        weight = asset["allocation_pct"] / 100.0
        weights.append(weight)
        S0 = initial_investment * weight
        Z = Z_all[:, :, i]

        if model == "merton" and (
            asset.get("jump_intensity", 0) > 0 or
            asset.get("jump_vol", 0) > 0
        ):
            paths = simulate_merton_jump_diffusion(
                S0=S0,
                mu=asset["drift"],
                sigma=asset["volatility"],
                lambda_j=asset.get("jump_intensity", 0),
                mu_j=asset.get("jump_mean", 0),
                sigma_j=asset.get("jump_vol", 0),
                dt=dt,
                num_steps=num_steps,
                Z=Z,
                rng=rng,
            )
        else:
            paths = simulate_gbm(
                S0=S0,
                mu=asset["drift"],
                sigma=asset["volatility"],
                dt=dt,
                num_steps=num_steps,
                Z=Z,
            )

        asset_paths_list.append(paths)

        # Compute per-asset percentiles (annualized view - sample every 12 steps)
        annual_indices = list(range(0, num_steps + 1, 12))
        annual_paths = paths[:, annual_indices]
        annual_years = years[annual_indices]
        pcts = compute_percentiles(annual_paths, annual_years)
        metrics = compute_risk_metrics(paths, S0, num_years)

        # Sample paths for visualization (6 paths, annualized)
        sample_indices = list(range(min(6, num_simulations)))
        sample_paths_data = []
        for si in sample_indices:
            path_data = [
                {"year": round(float(annual_years[j]), 2), "value": round(float(annual_paths[si, j]), 2)}
                for j in range(len(annual_indices))
            ]
            sample_paths_data.append(path_data)

        asset_results.append({
            "ticker": asset["ticker"],
            "name": asset["name"],
            "allocation_pct": asset["allocation_pct"],
            "percentiles": pcts,
            "risk_metrics": metrics,
            "sample_paths": sample_paths_data,
        })

    # Aggregate portfolio paths (sum across assets)
    portfolio_paths = np.sum(np.array(asset_paths_list), axis=0)

    # Portfolio percentiles (annualized view)
    annual_indices = list(range(0, num_steps + 1, 12))
    annual_portfolio = portfolio_paths[:, annual_indices]
    annual_years = years[annual_indices]
    portfolio_pcts = compute_percentiles(annual_portfolio, annual_years)
    portfolio_metrics = compute_risk_metrics(portfolio_paths, initial_investment, num_years)

    # Portfolio sample paths
    sample_indices = list(range(min(6, num_simulations)))
    portfolio_sample_paths = []
    for si in sample_indices:
        path_data = [
            {"year": round(float(annual_years[j]), 2), "value": round(float(annual_portfolio[si, j]), 2)}
            for j in range(len(annual_indices))
        ]
        portfolio_sample_paths.append(path_data)

    return {
        "portfolio_percentiles": portfolio_pcts,
        "portfolio_risk_metrics": portfolio_metrics,
        "portfolio_sample_paths": portfolio_sample_paths,
        "asset_results": asset_results,
        "model_used": model,
        "num_simulations": num_simulations,
        "num_years": num_years,
        "initial_investment": initial_investment,
    }
