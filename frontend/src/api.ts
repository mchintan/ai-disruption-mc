import type {
  AnalyzeRequest, AnalyzeResponse,
  BacktestAssetInfo, BacktestRequest, BacktestResponse,
  CrisisPeriodSummary,
  OptimizeRequest, OptimizeResponse,
  SimulateRequest, SimulateResponse,
} from "./types/portfolio";
import { getSessionId } from "./telemetry";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Session-ID": getSessionId(),
  };
}

export async function analyzePortfolio(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/api/analyze-portfolio`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Analysis failed: ${err}`);
  }
  return res.json();
}

export async function runSimulation(request: SimulateRequest): Promise<SimulateResponse> {
  const res = await fetch(`${API_BASE}/api/simulate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Simulation failed: ${err}`);
  }
  return res.json();
}

export async function optimizeWeights(request: OptimizeRequest): Promise<OptimizeResponse> {
  const res = await fetch(`${API_BASE}/api/optimize-weights`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Optimization failed: ${err}`);
  }
  return res.json();
}

export async function fetchCrisisPeriods(): Promise<CrisisPeriodSummary[]> {
  const res = await fetch(`${API_BASE}/api/crisis-periods`, { headers: headers() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch crisis periods: ${err}`);
  }
  return res.json();
}

export async function fetchBacktestAssets(): Promise<BacktestAssetInfo[]> {
  const res = await fetch(`${API_BASE}/api/backtest-assets`, { headers: headers() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch backtest assets: ${err}`);
  }
  return res.json();
}

export async function runBacktest(request: BacktestRequest): Promise<BacktestResponse> {
  const res = await fetch(`${API_BASE}/api/backtest`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Backtest failed: ${err}`);
  }
  return res.json();
}
