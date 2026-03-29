import type {
  AnalyzeRequest, AnalyzeResponse,
  BacktestAssetInfo, BacktestRequest, BacktestResponse,
  CrisisPeriodSummary,
  OptimizeRequest, OptimizeResponse,
  SimulateRequest, SimulateResponse,
} from "./types/portfolio";
import type { BrokerType, BrokerConnectionStatus, TradeListRequest, TradeListResponse, ExecuteTradesRequest, ExecuteTradesResponse, OrderStatusItem } from "./types/fulfill";
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

export async function initOAuth(broker: BrokerType): Promise<{ auth_url: string; state: string }> {
  const res = await fetch(`${API_BASE}/api/fulfill/oauth/init`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ broker }),
  });
  if (!res.ok) throw new Error(`OAuth init failed: ${await res.text()}`);
  return res.json();
}

export async function checkBrokerConnection(broker: BrokerType): Promise<BrokerConnectionStatus> {
  const res = await fetch(`${API_BASE}/api/fulfill/connection/${broker}`, { headers: headers() });
  if (!res.ok) throw new Error(`Connection check failed: ${await res.text()}`);
  return res.json();
}

export async function disconnectBroker(broker: BrokerType): Promise<void> {
  const res = await fetch(`${API_BASE}/api/fulfill/connection/${broker}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Disconnect failed: ${await res.text()}`);
}

export async function generateTradeList(request: TradeListRequest): Promise<TradeListResponse> {
  const res = await fetch(`${API_BASE}/api/fulfill/trade-list`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`Trade list generation failed: ${await res.text()}`);
  return res.json();
}

export async function executeTrades(request: ExecuteTradesRequest): Promise<ExecuteTradesResponse> {
  const res = await fetch(`${API_BASE}/api/fulfill/execute`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`Trade execution failed: ${await res.text()}`);
  return res.json();
}

export async function getOrderStatus(broker: BrokerType): Promise<OrderStatusItem[]> {
  const res = await fetch(`${API_BASE}/api/fulfill/orders/${broker}`, { headers: headers() });
  if (!res.ok) throw new Error(`Order status check failed: ${await res.text()}`);
  return res.json();
}

// DNA
export async function analyzeDNA(request: { assets: unknown[]; correlation_matrix: number[][] }): Promise<{ scores: Record<string, number>; personality: string }> {
  const res = await fetch(`${API_BASE}/api/dna/analyze`, { method: "POST", headers: headers(), body: JSON.stringify(request) });
  if (!res.ok) throw new Error(`DNA analysis failed: ${await res.text()}`);
  return res.json();
}

// Thesis
export async function generateTheses(request: { assets: unknown[]; description: string; risk_tolerance: string }): Promise<{ theses: unknown[] }> {
  const res = await fetch(`${API_BASE}/api/thesis/generate`, { method: "POST", headers: headers(), body: JSON.stringify(request) });
  if (!res.ok) throw new Error(`Thesis generation failed: ${await res.text()}`);
  return res.json();
}

export async function critiqueTheses(request: { theses: unknown[]; risk_metrics: Record<string, number> }): Promise<{ theses: unknown[] }> {
  const res = await fetch(`${API_BASE}/api/thesis/critique`, { method: "POST", headers: headers(), body: JSON.stringify(request) });
  if (!res.ok) throw new Error(`Thesis critique failed: ${await res.text()}`);
  return res.json();
}

// Scenarios
export async function calibrateScenario(request: { description: string; asset_tickers: string[]; trading_days: number }): Promise<{ scenario: Record<string, unknown> }> {
  const res = await fetch(`${API_BASE}/api/scenarios/calibrate`, { method: "POST", headers: headers(), body: JSON.stringify(request) });
  if (!res.ok) throw new Error(`Scenario calibration failed: ${await res.text()}`);
  return res.json();
}

export async function runScenario(request: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/api/scenarios/run`, { method: "POST", headers: headers(), body: JSON.stringify(request) });
  if (!res.ok) throw new Error(`Scenario run failed: ${await res.text()}`);
  return res.json();
}

// Community
export async function publishExperiment(request: { name: string; portfolio: Record<string, unknown>; metrics: Record<string, unknown>; dna: Record<string, unknown> }): Promise<{ id: string; published_at: number }> {
  const res = await fetch(`${API_BASE}/api/community/publish`, { method: "POST", headers: headers(), body: JSON.stringify(request) });
  if (!res.ok) throw new Error(`Publish failed: ${await res.text()}`);
  return res.json();
}

export async function getCommunityFeed(sort: string = "published_at", limit: number = 20): Promise<unknown[]> {
  const res = await fetch(`${API_BASE}/api/community/feed?sort=${sort}&limit=${limit}`, { headers: headers() });
  if (!res.ok) throw new Error(`Feed failed: ${await res.text()}`);
  return res.json();
}

export async function forkExperiment(expId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/api/community/experiment/${expId}`, { headers: headers() });
  if (!res.ok) throw new Error(`Fork failed: ${await res.text()}`);
  return res.json();
}
