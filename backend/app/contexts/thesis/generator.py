"""AI thesis generation — creates structured investment theses per asset."""

import json
import os
import re

from google import genai


THESIS_PROMPT = """You are an investment analyst. For each asset in this portfolio, generate a structured investment thesis.

Portfolio context: {description}
Risk tolerance: {risk_tolerance}

Assets:
{assets_text}

For EACH asset, respond with valid JSON (no markdown):
{{
  "theses": [
    {{
      "asset_ticker": "TICKER",
      "narrative": "2-3 sentence thesis explaining why this asset is held",
      "key_assumptions": ["assumption 1", "assumption 2", "assumption 3"],
      "risk_factors": ["risk 1", "risk 2"],
      "invalidation_triggers": ["trigger that would invalidate this thesis"]
    }}
  ]
}}"""


def generate_theses(assets: list[dict], description: str, risk_tolerance: str) -> list[dict]:
    """Generate investment theses for each asset using Gemini."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    assets_text = "\n".join(
        f"  {a['ticker']} ({a.get('name', a['ticker'])}): {a.get('allocation_pct', 0):.1f}% allocation, "
        f"drift={a.get('drift', 0):.2f}, vol={a.get('volatility', 0):.2f}"
        for a in assets
    )

    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            prompt = THESIS_PROMPT.format(
                description=description, risk_tolerance=risk_tolerance, assets_text=assets_text
            )
            response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
            text = response.text.strip()
            if text.startswith("```"):
                text = re.sub(r"^```(?:json)?\s*", "", text)
                text = re.sub(r"\s*```$", "", text)
            result = json.loads(text)
            theses = result.get("theses", [])
            for t in theses:
                t["status"] = "valid"
                t["critique"] = ""
                t["last_critiqued_at"] = 0
            return theses
        except Exception as e:
            print(f"Thesis generation error: {e}")

    # Fallback
    return [
        {
            "asset_ticker": a["ticker"],
            "narrative": a.get("rationale", f"{a['ticker']} provides portfolio exposure."),
            "key_assumptions": ["Market conditions remain favorable", "No major regulatory changes"],
            "risk_factors": ["Market downturn", "Sector-specific risk"],
            "invalidation_triggers": ["Fundamental deterioration in core business"],
            "status": "valid",
            "critique": "",
            "last_critiqued_at": 0,
        }
        for a in assets
    ]
