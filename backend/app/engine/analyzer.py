"""
AI-powered portfolio analyzer using Google Gemini.
Performs first-principles analysis of natural language portfolio descriptions
and calibrates simulation parameters for each recommended asset.
"""

import json
import os
import re

from google import genai


ANALYSIS_PROMPT = """You are an expert quantitative portfolio analyst. A user has described their desired portfolio in plain English. Your job is to:

1. Analyze their goals, risk tolerance, and time horizon
2. Recommend 4-8 specific assets (ETFs, stocks, or asset classes) with allocation percentages that sum to 100%
3. For each asset, provide calibrated simulation parameters based on historical data and forward-looking estimates
4. Provide a correlation matrix between all recommended assets
5. Write a concise first-principles analysis summary

USER DESCRIPTION: {description}
RISK TOLERANCE: {risk_tolerance}
INVESTMENT HORIZON: {horizon_years} years

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks, no explanation outside JSON):
{{
  "assets": [
    {{
      "ticker": "TICKER",
      "name": "Full Name",
      "allocation_pct": 25.0,
      "drift": 0.08,
      "volatility": 0.20,
      "jump_intensity": 0.5,
      "jump_mean": -0.05,
      "jump_vol": 0.10,
      "rationale": "Why this asset fits the portfolio"
    }}
  ],
  "correlation_matrix": [[1.0, 0.3], [0.3, 1.0]],
  "analysis_summary": "2-3 paragraph first-principles analysis of the portfolio construction..."
}}

PARAMETER GUIDELINES:
- drift: Expected annual return as decimal (e.g., 0.08 for 8%). Consider the current macro environment.
- volatility: Annual volatility as decimal (e.g., 0.20 for 20%). Use realistic historical ranges.
- jump_intensity: Average number of jumps per year (0.1-2.0). Higher for volatile/crisis-prone assets.
- jump_mean: Mean log-jump size. Negative for crash-prone assets (e.g., -0.10), positive for upside jumps (e.g., 0.03).
- jump_vol: Jump size volatility (0.02-0.20). Higher means more variable jump sizes.
- correlation_matrix: Must be NxN where N = number of assets. Diagonal = 1.0. Realistic cross-asset correlations.

For risk tolerance:
- "low": Conservative allocations, more bonds/gold, lower vol assets, moderate jump hedging
- "moderate": Balanced growth/defense, diversified across asset classes
- "aggressive": Growth-tilted, higher vol tolerance, more concentrated positions

Allocations MUST sum to exactly 100%. The correlation matrix MUST be symmetric and positive semi-definite."""


FALLBACK_PORTFOLIOS: dict[str, dict] = {
    "aggressive": {
        "assets": [
            {"ticker": "QQQ", "name": "Nasdaq-100 ETF", "allocation_pct": 30.0, "drift": 0.12, "volatility": 0.22, "jump_intensity": 0.8, "jump_mean": -0.06, "jump_vol": 0.12, "rationale": "Core tech exposure with high growth potential"},
            {"ticker": "NVDA", "name": "NVIDIA Corporation", "allocation_pct": 15.0, "drift": 0.18, "volatility": 0.40, "jump_intensity": 1.2, "jump_mean": -0.08, "jump_vol": 0.15, "rationale": "AI/compute leader with extraordinary growth trajectory"},
            {"ticker": "BTC-USD", "name": "Bitcoin", "allocation_pct": 15.0, "drift": 0.15, "volatility": 0.60, "jump_intensity": 1.5, "jump_mean": -0.10, "jump_vol": 0.20, "rationale": "Digital store of value with asymmetric upside"},
            {"ticker": "BOTZ", "name": "Robotics & AI ETF", "allocation_pct": 10.0, "drift": 0.14, "volatility": 0.28, "jump_intensity": 0.6, "jump_mean": -0.05, "jump_vol": 0.10, "rationale": "Physical automation wave following software AI"},
            {"ticker": "URA", "name": "Uranium/Nuclear ETF", "allocation_pct": 10.0, "drift": 0.10, "volatility": 0.30, "jump_intensity": 0.7, "jump_mean": -0.04, "jump_vol": 0.08, "rationale": "Energy infrastructure for AI compute demand"},
            {"ticker": "GLD", "name": "Gold ETF", "allocation_pct": 10.0, "drift": 0.06, "volatility": 0.15, "jump_intensity": 0.3, "jump_mean": 0.02, "jump_vol": 0.05, "rationale": "Portfolio hedge against tail risk"},
            {"ticker": "ANDURIL", "name": "Defense Tech (Private Proxy)", "allocation_pct": 10.0, "drift": 0.16, "volatility": 0.35, "jump_intensity": 0.5, "jump_mean": -0.03, "jump_vol": 0.08, "rationale": "Government-backed AI/defense growth"},
        ],
        "correlation_matrix": [
            [1.00, 0.80, 0.40, 0.70, 0.30, -0.10, 0.50],
            [0.80, 1.00, 0.45, 0.65, 0.25, -0.15, 0.45],
            [0.40, 0.45, 1.00, 0.35, 0.15, 0.10, 0.20],
            [0.70, 0.65, 0.35, 1.00, 0.30, -0.05, 0.55],
            [0.30, 0.25, 0.15, 0.30, 1.00, 0.20, 0.25],
            [-0.10, -0.15, 0.10, -0.05, 0.20, 1.00, -0.05],
            [0.50, 0.45, 0.20, 0.55, 0.25, -0.05, 1.00],
        ],
        "analysis_summary": "This aggressive growth portfolio is designed to capture the AI-driven technological transformation with concentrated positions in high-conviction themes. The core allocation (45%) targets direct AI beneficiaries through QQQ and NVIDIA, providing exposure to the software AI wave. Bitcoin (15%) offers asymmetric upside as a non-sovereign store of value in an era of monetary expansion. Robotics and nuclear energy provide second-derivative AI exposure through physical automation and compute infrastructure demand. Gold serves as a tail risk hedge, while defense tech captures government-backed AI adoption. The portfolio accepts high volatility in exchange for maximum exposure to the AI disruption thesis. Jump parameters reflect the crash-prone nature of growth assets, with Bitcoin and NVIDIA carrying the highest jump intensity."
    },
    "moderate": {
        "assets": [
            {"ticker": "VTI", "name": "Total Stock Market ETF", "allocation_pct": 25.0, "drift": 0.08, "volatility": 0.18, "jump_intensity": 0.6, "jump_mean": -0.05, "jump_vol": 0.10, "rationale": "Broad US equity market exposure"},
            {"ticker": "QQQ", "name": "Nasdaq-100 ETF", "allocation_pct": 20.0, "drift": 0.12, "volatility": 0.22, "jump_intensity": 0.8, "jump_mean": -0.06, "jump_vol": 0.12, "rationale": "Tech/growth tilt for AI exposure"},
            {"ticker": "GLD", "name": "Gold ETF", "allocation_pct": 15.0, "drift": 0.06, "volatility": 0.15, "jump_intensity": 0.3, "jump_mean": 0.02, "jump_vol": 0.05, "rationale": "Inflation hedge and portfolio stabilizer"},
            {"ticker": "BTC-USD", "name": "Bitcoin", "allocation_pct": 10.0, "drift": 0.15, "volatility": 0.60, "jump_intensity": 1.5, "jump_mean": -0.10, "jump_vol": 0.20, "rationale": "Small allocation for asymmetric upside"},
            {"ticker": "TLT", "name": "20+ Year Treasury Bond ETF", "allocation_pct": 15.0, "drift": 0.03, "volatility": 0.15, "jump_intensity": 0.4, "jump_mean": -0.03, "jump_vol": 0.06, "rationale": "Duration exposure and equity hedge"},
            {"ticker": "VNQ", "name": "Real Estate ETF", "allocation_pct": 15.0, "drift": 0.05, "volatility": 0.20, "jump_intensity": 0.5, "jump_mean": -0.04, "jump_vol": 0.08, "rationale": "Real asset diversification with income"},
        ],
        "correlation_matrix": [
            [1.00, 0.85, -0.05, 0.35, -0.30, 0.60],
            [0.85, 1.00, -0.10, 0.40, -0.35, 0.50],
            [-0.05, -0.10, 1.00, 0.10, 0.20, 0.05],
            [0.35, 0.40, 0.10, 1.00, -0.15, 0.15],
            [-0.30, -0.35, 0.20, -0.15, 1.00, -0.10],
            [0.60, 0.50, 0.05, 0.15, -0.10, 1.00],
        ],
        "analysis_summary": "This balanced portfolio combines growth exposure with defensive hedging. The equity core (45% via VTI + QQQ) captures broad market growth with a tech tilt for AI participation. Gold (15%) and Treasury bonds (15%) provide counter-cyclical protection — gold hedges inflation and systemic risk while bonds hedge equity drawdowns. Bitcoin (10%) is sized small enough to limit downside but large enough to meaningfully contribute if it appreciates significantly. Real estate (15%) adds real asset diversification and income. The correlation structure is designed so that equity drawdowns are partially offset by bond and gold rallies. Jump parameters reflect realistic crash scenarios: equities and Bitcoin face negative jumps, while gold shows slight positive jumps during crises."
    },
    "low": {
        "assets": [
            {"ticker": "BND", "name": "Total Bond Market ETF", "allocation_pct": 35.0, "drift": 0.04, "volatility": 0.06, "jump_intensity": 0.2, "jump_mean": -0.02, "jump_vol": 0.03, "rationale": "Core fixed income for stability and income"},
            {"ticker": "VTI", "name": "Total Stock Market ETF", "allocation_pct": 25.0, "drift": 0.08, "volatility": 0.18, "jump_intensity": 0.6, "jump_mean": -0.05, "jump_vol": 0.10, "rationale": "Moderate equity exposure for long-term growth"},
            {"ticker": "GLD", "name": "Gold ETF", "allocation_pct": 15.0, "drift": 0.06, "volatility": 0.15, "jump_intensity": 0.3, "jump_mean": 0.02, "jump_vol": 0.05, "rationale": "Inflation hedge and crisis protection"},
            {"ticker": "SCHD", "name": "Dividend Equity ETF", "allocation_pct": 15.0, "drift": 0.07, "volatility": 0.14, "jump_intensity": 0.4, "jump_mean": -0.04, "jump_vol": 0.08, "rationale": "Quality dividend stocks for income and lower volatility"},
            {"ticker": "TIPS", "name": "TIPS Bond ETF", "allocation_pct": 10.0, "drift": 0.03, "volatility": 0.05, "jump_intensity": 0.1, "jump_mean": -0.01, "jump_vol": 0.02, "rationale": "Inflation-protected income stream"},
        ],
        "correlation_matrix": [
            [1.00, -0.20, 0.15, -0.10, 0.80],
            [-0.20, 1.00, -0.05, 0.85, -0.15],
            [0.15, -0.05, 1.00, -0.05, 0.20],
            [-0.10, 0.85, -0.05, 1.00, -0.10],
            [0.80, -0.15, 0.20, -0.10, 1.00],
        ],
        "analysis_summary": "This conservative portfolio prioritizes capital preservation with moderate growth. The fixed income core (45% via BND + TIPS) provides stability and income, with TIPS offering explicit inflation protection. Equity exposure (40% via VTI + SCHD) is tilted toward dividend quality to reduce volatility while maintaining real return potential. Gold (15%) serves as the crisis hedge. The correlation structure ensures bonds and equities move somewhat independently, reducing portfolio drawdowns. Jump parameters are conservative — bonds face minimal jump risk while equities carry moderate crash exposure. This portfolio is designed for investors who cannot tolerate significant drawdowns but need returns above inflation."
    },
}


def analyze_portfolio(
    description: str,
    risk_tolerance: str = "moderate",
    horizon_years: int = 10,
) -> dict:
    """
    Analyze a portfolio description using Gemini AI and return structured recommendations.
    Falls back to curated portfolios if API is unavailable.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")

    if api_key:
        try:
            return _analyze_with_gemini(description, risk_tolerance, horizon_years, api_key)
        except Exception as e:
            print(f"Gemini API error: {e}, falling back to curated portfolio")

    return _get_fallback_portfolio(risk_tolerance)


def _analyze_with_gemini(
    description: str,
    risk_tolerance: str,
    horizon_years: int,
    api_key: str,
) -> dict:
    """Call Gemini API for portfolio analysis."""
    client = genai.Client(api_key=api_key)

    prompt = ANALYSIS_PROMPT.format(
        description=description,
        risk_tolerance=risk_tolerance,
        horizon_years=horizon_years,
    )

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
    )
    text = response.text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    result = json.loads(text)

    # Validate structure
    if "assets" not in result or "correlation_matrix" not in result:
        raise ValueError("Invalid response structure from Gemini")

    # Validate allocations sum to ~100%
    total = sum(a["allocation_pct"] for a in result["assets"])
    if abs(total - 100.0) > 1.0:
        # Normalize allocations
        for asset in result["assets"]:
            asset["allocation_pct"] = round(asset["allocation_pct"] * 100.0 / total, 1)

    return result


def _get_fallback_portfolio(risk_tolerance: str) -> dict:
    """Return a curated fallback portfolio based on risk tolerance."""
    key = risk_tolerance.lower()
    if key not in FALLBACK_PORTFOLIOS:
        key = "moderate"
    return FALLBACK_PORTFOLIOS[key]
