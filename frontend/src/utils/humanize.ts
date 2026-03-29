/**
 * Convert quant metrics to plain language for retail investors.
 * Every function returns a string a non-finance person can understand.
 */

export function humanizeCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function humanizeReturn(initialInvestment: number, terminalValue: number, years: number): string {
  const totalReturn = ((terminalValue - initialInvestment) / initialInvestment) * 100;
  const annualized = (Math.pow(terminalValue / initialInvestment, 1 / years) - 1) * 100;
  return `${humanizeCurrency(terminalValue)} (${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(0)}% total, ${annualized.toFixed(1)}%/yr)`;
}

export function humanizeRisk(volatility: number): { label: string; color: string } {
  if (volatility < 0.10) return { label: "Very Low", color: "text-green-600 dark:text-green-400" };
  if (volatility < 0.18) return { label: "Low", color: "text-emerald-600 dark:text-emerald-400" };
  if (volatility < 0.25) return { label: "Moderate", color: "text-amber-600 dark:text-amber-400" };
  if (volatility < 0.40) return { label: "High", color: "text-orange-600 dark:text-orange-400" };
  return { label: "Very High", color: "text-red-600 dark:text-red-400" };
}

export function humanizeDrift(drift: number): string {
  const pct = (drift * 100).toFixed(0);
  return `${drift >= 0 ? "+" : ""}${pct}%/yr expected`;
}

export function humanizeSharpe(sharpe: number): { label: string; color: string } {
  if (sharpe >= 1.0) return { label: "Excellent", color: "text-green-600 dark:text-green-400" };
  if (sharpe >= 0.5) return { label: "Good", color: "text-emerald-600 dark:text-emerald-400" };
  if (sharpe >= 0.2) return { label: "Fair", color: "text-amber-600 dark:text-amber-400" };
  if (sharpe >= 0) return { label: "Weak", color: "text-orange-600 dark:text-orange-400" };
  return { label: "Poor", color: "text-red-600 dark:text-red-400" };
}

export function humanizeVaR(var95: number): string {
  return `Worst month: -${humanizeCurrency(var95)}`;
}

export function humanizeDrawdown(maxDrawdown: number): string {
  return `Biggest drop: ${(maxDrawdown * 100).toFixed(0)}%`;
}

export function humanizeModel(model: string): string {
  switch (model) {
    case "gbm": return "Standard";
    case "merton": return "With crash modeling";
    case "regime": return "Dynamic market conditions";
    default: return model;
  }
}

export function humanizeGrade(dnaScores: Record<string, number>): { grade: string; explanation: string; color: string } {
  // Weighted score: resilience (30%), diversification (25%), concentration (20%), defensive (15%), growth (10%)
  const score =
    (dnaScores.crisis_resilience ?? 50) * 0.30 +
    (dnaScores.diversification ?? 50) * 0.25 +
    (dnaScores.concentration ?? 50) * 0.20 +
    (dnaScores.defensive ?? 50) * 0.15 +
    (dnaScores.growth ?? 50) * 0.10;

  if (score >= 80) return { grade: "A", explanation: "Well-diversified with strong crisis protection", color: "text-green-600 dark:text-green-400" };
  if (score >= 65) return { grade: "B+", explanation: "Good balance of growth and protection", color: "text-emerald-600 dark:text-emerald-400" };
  if (score >= 50) return { grade: "B", explanation: "Moderate risk with reasonable diversification", color: "text-teal-600 dark:text-teal-400" };
  if (score >= 35) return { grade: "C+", explanation: "Growth-heavy, consider adding diversification", color: "text-amber-600 dark:text-amber-400" };
  if (score >= 20) return { grade: "C", explanation: "Concentrated and vulnerable to downturns", color: "text-orange-600 dark:text-orange-400" };
  return { grade: "D", explanation: "High concentration risk — consider rebalancing", color: "text-red-600 dark:text-red-400" };
}

export function humanizeLossChance(p10: number, initialInvestment: number): string {
  if (p10 >= initialInvestment) return "Very unlikely to lose money";
  const lossPct = ((initialInvestment - p10) / initialInvestment * 100).toFixed(0);
  return `${lossPct}% downside in worst scenarios`;
}
