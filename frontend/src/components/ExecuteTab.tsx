import { FulfillPanel } from "./FulfillPanel";
import type { AssetParams } from "../types/portfolio";

interface Props {
  assets: AssetParams[];
  investmentAmount: number;
}

export function ExecuteTab({ assets, investmentAmount }: Props) {
  return (
    <FulfillPanel
      targets={assets.map(a => ({ ticker: a.ticker, name: a.name, target_pct: a.allocation_pct }))}
      investmentAmount={investmentAmount}
    />
  );
}
