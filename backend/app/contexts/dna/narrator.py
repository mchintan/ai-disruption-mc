"""AI-generated portfolio personality summary from DNA scores."""

import os
from google import genai


DNA_PROMPT = """You are a portfolio analyst. Given these portfolio DNA scores (each 0-100), write exactly 2 sentences describing this portfolio's personality. Be specific and opinionated. No hedging.

Scores:
- Growth orientation: {growth}/100
- Volatility tolerance: {volatility}/100
- Tail risk exposure: {tail_risk}/100
- Diversification: {diversification}/100
- Concentration risk: {concentration}/100
- Defensive tilt: {defensive}/100
- Momentum exposure: {momentum}/100
- Crisis resilience: {crisis_resilience}/100

Write 2 sentences only. No markdown."""


def generate_personality(scores: dict[str, float]) -> str:
    """Generate a 2-sentence personality summary from DNA scores."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            prompt = DNA_PROMPT.format(**scores)
            response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
            return response.text.strip()
        except Exception as e:
            print(f"DNA narrator error: {e}")

    # Fallback
    if scores["growth"] > 60:
        profile = "growth-oriented"
    elif scores["defensive"] > 50:
        profile = "defensively positioned"
    else:
        profile = "balanced"
    return (
        f"This is a {profile} portfolio with {scores['diversification']:.0f}/100 diversification "
        f"and {scores['crisis_resilience']:.0f}/100 crisis resilience. "
        f"Tail risk exposure sits at {scores['tail_risk']:.0f}/100 with "
        f"{'strong' if scores['momentum'] > 50 else 'moderate'} momentum tilt."
    )
