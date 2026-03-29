"""Portfolio DNA analyzer — computes 8-dimensional portfolio fingerprint."""

import numpy as np


def compute_dna(
    assets: list[dict],
    correlation_matrix: list[list[float]],
) -> dict[str, float]:
    """
    Compute 8 portfolio DNA scores from asset parameters.
    Each score is 0-100. No external dependencies — pure computation.
    """
    if not assets:
        return {k: 0.0 for k in ["growth", "volatility", "tail_risk", "diversification",
                                   "concentration", "defensive", "momentum", "crisis_resilience"]}

    weights = np.array([a["allocation_pct"] / 100.0 for a in assets])
    drifts = np.array([a.get("drift", 0.08) for a in assets])
    vols = np.array([a.get("volatility", 0.20) for a in assets])
    jump_intensities = np.array([a.get("jump_intensity", 0.0) for a in assets])
    jump_means = np.array([abs(a.get("jump_mean", 0.0)) for a in assets])

    n = len(assets)

    # 1. Growth orientation (weighted avg drift, scaled 0-100)
    weighted_drift = float(np.dot(weights, drifts))
    growth = min(100.0, max(0.0, weighted_drift / 0.20 * 100))  # 20% drift = 100

    # 2. Volatility tolerance (weighted avg vol, scaled 0-100)
    weighted_vol = float(np.dot(weights, vols))
    volatility = min(100.0, max(0.0, weighted_vol / 0.60 * 100))  # 60% vol = 100

    # 3. Tail risk exposure (jump intensity × severity)
    jump_severity = jump_intensities * jump_means
    weighted_tail = float(np.dot(weights, jump_severity))
    tail_risk = min(100.0, max(0.0, weighted_tail / 0.20 * 100))  # 0.20 = 100

    # 4. Diversification (1 - avg absolute correlation)
    if correlation_matrix and len(correlation_matrix) == n and n > 1:
        corr = np.array(correlation_matrix)
        mask = ~np.eye(n, dtype=bool)
        avg_abs_corr = float(np.mean(np.abs(corr[mask])))
        diversification = (1.0 - avg_abs_corr) * 100
    else:
        diversification = 50.0  # default if no correlation data

    # 5. Concentration (inverse Herfindahl — equal weight = 100, single asset = 0)
    hhi = float(np.sum(weights ** 2))
    min_hhi = 1.0 / n if n > 0 else 1.0
    concentration = max(0.0, (1.0 - hhi) / (1.0 - min_hhi) * 100) if n > 1 else 0.0

    # 6. Defensive tilt (% in low-vol assets with vol < 0.15)
    defensive_mask = vols < 0.15
    defensive = float(np.sum(weights[defensive_mask]) * 100) if defensive_mask.any() else 0.0

    # 7. Momentum exposure (% in high-drift assets with drift > 0.10)
    momentum_mask = drifts > 0.10
    momentum = float(np.sum(weights[momentum_mask]) * 100) if momentum_mask.any() else 0.0

    # 8. Crisis resilience (estimated max drawdown under stress: lower = more resilient)
    stress_vol = weighted_vol * 2.5  # 2.5x vol in crisis
    stress_drawdown = 1.0 - np.exp(-stress_vol * np.sqrt(0.25))  # ~3 month crisis
    crisis_resilience = max(0.0, (1.0 - stress_drawdown) * 100)

    return {
        "growth": round(growth, 1),
        "volatility": round(volatility, 1),
        "tail_risk": round(tail_risk, 1),
        "diversification": round(diversification, 1),
        "concentration": round(concentration, 1),
        "defensive": round(defensive, 1),
        "momentum": round(momentum, 1),
        "crisis_resilience": round(crisis_resilience, 1),
    }
