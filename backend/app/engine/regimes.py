"""Regime definitions and default configuration for regime-switching simulation."""

from dataclasses import dataclass, field
import numpy as np


@dataclass
class Regime:
    name: str
    drift_multiplier: float
    volatility_multiplier: float
    jump_intensity_multiplier: float
    avg_duration_months: int


@dataclass
class RegimeConfig:
    regimes: list[Regime]
    transition_matrix: list[list[float]]
    initial_regime: int = 0


def _build_transition_matrix(regimes: list[Regime], dt_months: float = 1.0) -> list[list[float]]:
    """Build monthly transition matrix from average regime durations."""
    n = len(regimes)
    matrix = []
    for i, r in enumerate(regimes):
        row = [0.0] * n
        p_stay = 1.0 - (dt_months / r.avg_duration_months)
        p_stay = max(0.1, min(0.99, p_stay))
        p_leave = 1.0 - p_stay
        row[i] = p_stay
        # Distribute exit probability to other regimes
        others = [j for j in range(n) if j != i]
        for j in others:
            row[j] = p_leave / len(others)
        matrix.append(row)
    return matrix


DEFAULT_REGIMES = [
    Regime(name="bull", drift_multiplier=1.3, volatility_multiplier=0.7,
           jump_intensity_multiplier=0.3, avg_duration_months=24),
    Regime(name="bear", drift_multiplier=0.4, volatility_multiplier=1.5,
           jump_intensity_multiplier=1.2, avg_duration_months=12),
    Regime(name="crisis", drift_multiplier=-2.0, volatility_multiplier=3.0,
           jump_intensity_multiplier=4.0, avg_duration_months=3),
    Regime(name="recovery", drift_multiplier=1.8, volatility_multiplier=1.2,
           jump_intensity_multiplier=0.5, avg_duration_months=6),
]

DEFAULT_REGIME_CONFIG = RegimeConfig(
    regimes=DEFAULT_REGIMES,
    transition_matrix=_build_transition_matrix(DEFAULT_REGIMES),
    initial_regime=0,
)
