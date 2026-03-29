"""AI thesis critique — evaluates whether investment theses still hold."""

import json
import os
import re

from google import genai


CRITIQUE_PROMPT = """You are a skeptical investment analyst. Evaluate each investment thesis against the portfolio's simulation results.

Portfolio risk metrics:
- Expected annual return: {expected_return:.2%}
- Volatility: {volatility:.2%}
- Sharpe ratio: {sharpe_ratio:.3f}
- Max drawdown: {max_drawdown:.2%}
- VaR 95%: ${var_95:,.0f}

Theses to evaluate:
{theses_text}

For each thesis, respond with valid JSON (no markdown):
{{
  "critiques": [
    {{
      "asset_ticker": "TICKER",
      "status": "valid" or "weakening" or "invalidated",
      "critique": "2-3 sentence analysis of whether the thesis still holds and why"
    }}
  ]
}}"""


def critique_theses(theses: list[dict], risk_metrics: dict) -> list[dict]:
    """Critique investment theses against portfolio metrics using Gemini."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    theses_text = "\n".join(
        f"  {t['asset_ticker']}: {t['narrative']}\n"
        f"    Assumptions: {', '.join(t.get('key_assumptions', []))}\n"
        f"    Triggers: {', '.join(t.get('invalidation_triggers', []))}"
        for t in theses
    )

    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            prompt = CRITIQUE_PROMPT.format(
                theses_text=theses_text,
                expected_return=risk_metrics.get("expected_return", 0),
                volatility=risk_metrics.get("volatility", 0),
                sharpe_ratio=risk_metrics.get("sharpe_ratio", 0),
                max_drawdown=risk_metrics.get("max_drawdown", 0),
                var_95=risk_metrics.get("var_95", 0),
            )
            response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
            text = response.text.strip()
            if text.startswith("```"):
                text = re.sub(r"^```(?:json)?\s*", "", text)
                text = re.sub(r"\s*```$", "", text)
            result = json.loads(text)
            critiques = {c["asset_ticker"]: c for c in result.get("critiques", [])}

            import time
            for t in theses:
                c = critiques.get(t["asset_ticker"])
                if c:
                    t["status"] = c["status"]
                    t["critique"] = c["critique"]
                    t["last_critiqued_at"] = time.time()
            return theses
        except Exception as e:
            print(f"Thesis critique error: {e}")

    return theses
