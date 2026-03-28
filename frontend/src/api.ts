import type { AnalyzeRequest, AnalyzeResponse, SimulateRequest, SimulateResponse } from "./types/portfolio";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function analyzePortfolio(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/api/analyze-portfolio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Simulation failed: ${err}`);
  }
  return res.json();
}
