"""
Portfolio weight optimizer using scipy SLSQP.
Finds optimal asset allocations by running Monte Carlo simulations
with different weight combinations and optimizing for a chosen objective.
"""

import copy

import numpy as np
from scipy.optimize import minimize

from app.engine.monte_carlo import run_simulation


OBJECTIVES = {
    "max_sharpe": {"metric": "sharpe_ratio", "direction": "maximize", "label": "Max Sharpe Ratio"},
    "min_var": {"metric": "var_95", "direction": "minimize", "label": "Min VaR (95%)"},
    "min_cvar": {"metric": "cvar_95", "direction": "minimize", "label": "Min CVaR (95%)"},
    "min_max_drawdown": {"metric": "max_drawdown", "direction": "minimize", "label": "Min Max Drawdown"},
    "max_return": {"metric": "expected_return", "direction": "maximize", "label": "Max Expected Return"},
}


def optimize_weights(
    assets: list[dict],
    correlation_matrix: list[list[float]],
    num_simulations_trial: int,
    num_simulations_final: int,
    num_years: int,
    model: str,
    initial_investment: float,
    objective: str,
    seed: int | None = 42,
) -> dict:
    """
    Find optimal portfolio weights by running Monte Carlo trials under scipy SLSQP.

    Uses a fixed seed for trial simulations so the objective function is
    deterministic from the optimizer's perspective (avoids noise-contaminated gradients).
    """
    if objective not in OBJECTIVES:
        raise ValueError(f"Unknown objective '{objective}'. Must be one of: {list(OBJECTIVES.keys())}")

    obj_config = OBJECTIVES[objective]
    n_assets = len(assets)

    # Store original weights
    original_weights = [a["allocation_pct"] for a in assets]
    x0 = np.array([w / 100.0 for w in original_weights])

    # Run original simulation for comparison metrics
    original_result = run_simulation(
        assets=assets,
        correlation_matrix=correlation_matrix,
        num_simulations=num_simulations_final,
        num_years=num_years,
        model=model,
        initial_investment=initial_investment,
        seed=seed,
    )
    original_metrics = original_result["portfolio_risk_metrics"]

    def _objective(weight_vector: np.ndarray) -> float:
        """Objective function: run a lightweight simulation and return the target metric."""
        trial_assets = copy.deepcopy(assets)
        for i, w in enumerate(weight_vector):
            trial_assets[i]["allocation_pct"] = float(w * 100.0)

        result = run_simulation(
            assets=trial_assets,
            correlation_matrix=correlation_matrix,
            num_simulations=num_simulations_trial,
            num_years=num_years,
            model=model,
            initial_investment=initial_investment,
            seed=seed,  # fixed seed for determinism
        )

        metric_value = result["portfolio_risk_metrics"][obj_config["metric"]]

        # Negate for maximization objectives (scipy minimizes)
        if obj_config["direction"] == "maximize":
            return -metric_value
        return metric_value

    # Constraints: weights must sum to 1.0
    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]

    # Bounds: each weight between 0% and 100%
    bounds = [(0.0, 1.0)] * n_assets

    result = minimize(
        _objective,
        x0,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"maxiter": 50, "ftol": 1e-6, "eps": 0.02},
    )

    optimal_weights_raw = result.x
    # Ensure they sum to exactly 1.0 after optimization
    optimal_weights_raw = optimal_weights_raw / optimal_weights_raw.sum()

    # Build optimized asset list and run final full simulation
    optimized_assets = copy.deepcopy(assets)
    for i, w in enumerate(optimal_weights_raw):
        optimized_assets[i]["allocation_pct"] = round(float(w * 100.0), 2)

    optimized_result = run_simulation(
        assets=optimized_assets,
        correlation_matrix=correlation_matrix,
        num_simulations=num_simulations_final,
        num_years=num_years,
        model=model,
        initial_investment=initial_investment,
        seed=seed,
    )

    # Build weight comparison
    weights_comparison = []
    for i, asset in enumerate(assets):
        weights_comparison.append({
            "ticker": asset["ticker"],
            "name": asset["name"],
            "original_pct": round(original_weights[i], 2),
            "optimal_pct": round(float(optimal_weights_raw[i] * 100.0), 2),
        })

    return {
        "weights": weights_comparison,
        "original_risk_metrics": original_metrics,
        "optimized_risk_metrics": optimized_result["portfolio_risk_metrics"],
        "objective": objective,
        "converged": result.success,
        "optimized_simulation": optimized_result,
    }
