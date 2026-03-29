import { FulfillPanel } from "./FulfillPanel";
import { CommunityTab } from "./CommunityTab";
import type { AssetParams } from "../types/portfolio";

interface Props {
  assets: AssetParams[];
  investmentAmount: number;
  onFork: (portfolio: Record<string, unknown>) => void;
}

export function ActPhase({ assets, investmentAmount, onFork }: Props) {
  return (
    <div className="space-y-8">
      {/* Execute Section */}
      {assets.length > 0 && (
        <FulfillPanel
          targets={assets.map(a => ({ ticker: a.ticker, name: a.name, target_pct: a.allocation_pct }))}
          investmentAmount={investmentAmount}
        />
      )}

      {/* Community Section */}
      <div className="border-t border-stone-200 dark:border-slate-800/50 pt-8">
        <CommunityTab onFork={onFork} />
      </div>
    </div>
  );
}
