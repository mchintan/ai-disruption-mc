"""AI scenario calibrator — translates natural language scenarios into simulation parameters."""

import json
import os
import re

from google import genai


CALIBRATION_PROMPT = """You are a quantitative risk analyst. A user has described a hypothetical market scenario. Your job is to calibrate realistic simulation parameters for each asset under this scenario.

SCENARIO: {description}
DURATION: {trading_days} trading days

ASSETS TO CALIBRATE:
{assets_text}

For each asset, provide crisis-calibrated parameters. Respond ONLY with valid JSON (no markdown):
{{
  "name": "Short name for this scenario",
  "description": "{description}",
  "trading_days": {trading_days},
  "assets": {{
    "TICKER": {{
      "drift": -0.30,
      "volatility": 0.45,
      "jump_intensity": 1.5,
      "jump_mean": -0.08,
      "jump_vol": 0.12
    }}
  }},
  "correlations": {{
    "TICKER1,TICKER2": 0.85
  }}
}}

PARAMETER GUIDELINES:
- drift: Annualized expected return during the scenario (negative for crashes)
- volatility: Annualized volatility (typically 1.5-3x normal during crises)
- jump_intensity: Average jumps per year (higher during crises, 1.0-4.0)
- jump_mean: Mean log-jump size (negative for crashes, -0.05 to -0.15)
- jump_vol: Jump size volatility (0.05-0.20)
- correlations: Pair-wise correlations (typically increase during crises)

Be realistic. Use historical crisis analogs as calibration benchmarks."""


def calibrate_scenario(description: str, asset_tickers: list[str], trading_days: int = 60) -> dict:
    """Calibrate simulation parameters for a custom scenario using Gemini."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    assets_text = "\n".join(f"  - {t}" for t in asset_tickers)

    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            prompt = CALIBRATION_PROMPT.format(
                description=description, trading_days=trading_days, assets_text=assets_text
            )
            response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
            text = response.text.strip()
            if text.startswith("```"):
                text = re.sub(r"^```(?:json)?\s*", "", text)
                text = re.sub(r"\s*```$", "", text)
            return json.loads(text)
        except Exception as e:
            print(f"Scenario calibration error: {e}")

    # Fallback: generic stress scenario
    return {
        "name": "Custom Stress Scenario",
        "description": description,
        "trading_days": trading_days,
        "assets": {
            t: {"drift": -0.30, "volatility": 0.40, "jump_intensity": 1.5,
                "jump_mean": -0.06, "jump_vol": 0.10}
            for t in asset_tickers
        },
        "correlations": {},
    }
