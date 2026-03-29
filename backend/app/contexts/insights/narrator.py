"""AI-powered narrative generation for simulation and optimization results."""

import os
import json
import re

from google import genai


# Objective labels (local copy to avoid circular import with optimizer)
OBJECTIVE_LABELS = {
    "max_sharpe": "Max Sharpe Ratio",
    "min_var": "Min VaR (95%)",
    "min_cvar": "Min CVaR (95%)",
    "min_max_drawdown": "Min Max Drawdown",
    "max_return": "Max Expected Return",
}

OPTIMIZATION_EXPLAIN_PROMPT = """You are an expert quantitative portfolio analyst. The user ran a portfolio weight optimization using Monte Carlo simulation. Explain the results clearly and concisely.

OPTIMIZATION OBJECTIVE: {objective_label}

ORIGINAL WEIGHTS:
{original_weights_text}

OPTIMIZED WEIGHTS:
{optimal_weights_text}

ORIGINAL METRICS:
- Expected Annual Return: {orig_return:.2%}
- Annual Volatility: {orig_vol:.2%}
- Sharpe Ratio: {orig_sharpe:.3f}
- VaR (95%): ${orig_var:,.0f}
- CVaR (95%): ${orig_cvar:,.0f}
- Max Drawdown: {orig_dd:.2%}

OPTIMIZED METRICS:
- Expected Annual Return: {opt_return:.2%}
- Annual Volatility: {opt_vol:.2%}
- Sharpe Ratio: {opt_sharpe:.3f}
- VaR (95%): ${opt_var:,.0f}
- CVaR (95%): ${opt_cvar:,.0f}
- Max Drawdown: {opt_dd:.2%}

Write a 2-3 paragraph analysis explaining:
1. What the optimizer changed and why those shifts make sense for the chosen objective
2. The trade-offs involved (e.g., higher return at the cost of more risk, or lower risk at the cost of lower returns)
3. Any notable insights about the portfolio construction

Keep the tone professional and data-driven. Do not use markdown formatting."""


def explain_optimization(
    weights: list[dict],
    original_metrics: dict,
    optimized_metrics: dict,
    objective: str,
) -> str:
    """Generate an AI narrative explaining the optimization results."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    obj_label = OBJECTIVE_LABELS.get(objective, objective)

    original_weights_text = "\n".join(
        f"  {w['ticker']} ({w['name']}): {w['original_pct']:.1f}%" for w in weights
    )
    optimal_weights_text = "\n".join(
        f"  {w['ticker']} ({w['name']}): {w['optimal_pct']:.1f}%" for w in weights
    )

    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            prompt = OPTIMIZATION_EXPLAIN_PROMPT.format(
                objective_label=obj_label,
                original_weights_text=original_weights_text,
                optimal_weights_text=optimal_weights_text,
                orig_return=original_metrics["expected_return"],
                orig_vol=original_metrics["volatility"],
                orig_sharpe=original_metrics["sharpe_ratio"],
                orig_var=original_metrics["var_95"],
                orig_cvar=original_metrics["cvar_95"],
                orig_dd=original_metrics["max_drawdown"],
                opt_return=optimized_metrics["expected_return"],
                opt_vol=optimized_metrics["volatility"],
                opt_sharpe=optimized_metrics["sharpe_ratio"],
                opt_var=optimized_metrics["var_95"],
                opt_cvar=optimized_metrics["cvar_95"],
                opt_dd=optimized_metrics["max_drawdown"],
            )
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
            return response.text.strip()
        except Exception as e:
            print(f"Gemini optimization explain error: {e}")

    # Fallback: template-based explanation
    biggest_increase = max(weights, key=lambda w: w["optimal_pct"] - w["original_pct"])
    biggest_decrease = min(weights, key=lambda w: w["optimal_pct"] - w["original_pct"])
    sharpe_change = optimized_metrics["sharpe_ratio"] - original_metrics["sharpe_ratio"]

    return (
        f"The optimizer targeted {obj_label} and shifted portfolio weights significantly. "
        f"The largest increase was {biggest_increase['ticker']} "
        f"({biggest_increase['original_pct']:.1f}% \u2192 {biggest_increase['optimal_pct']:.1f}%), "
        f"while {biggest_decrease['ticker']} saw the largest decrease "
        f"({biggest_decrease['original_pct']:.1f}% \u2192 {biggest_decrease['optimal_pct']:.1f}%). "
        f"The Sharpe ratio moved from {original_metrics['sharpe_ratio']:.3f} to "
        f"{optimized_metrics['sharpe_ratio']:.3f} ({'+' if sharpe_change >= 0 else ''}{sharpe_change:.3f})."
    )
