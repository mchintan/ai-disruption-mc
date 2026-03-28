import { BacktestPanel } from "./BacktestPanel";
import type { AssetParams, BacktestResponse } from "../types/portfolio";

interface Props {
  assets: AssetParams[];
  lastBacktest: { crisisId: string; config: { numSimulations: number; initialInvestment: number; model: string; rebalance: boolean }; result: BacktestResponse } | null;
  onBacktestComplete: (crisisId: string, config: { numSimulations: number; initialInvestment: number; model: string; rebalance: boolean }, result: BacktestResponse) => void;
  onUseInPortfolio: (assets: AssetParams[]) => void;
}

// BacktestPanel is self-contained with its own state management.
// In a future iteration we will pass props to pre-populate from current portfolio.
export function BacktestTab(_props: Props) {
  void _props;
  return <BacktestPanel />;
}
