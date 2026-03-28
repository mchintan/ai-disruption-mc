import { Pencil } from "lucide-react";
import type { AssetParams } from "../types/portfolio";

const ASSET_CHIP_COLORS = [
  { bg: "bg-teal-100 dark:bg-cyan-500/15", text: "text-teal-700 dark:text-cyan-400", border: "border-teal-200 dark:border-cyan-500/30" },
  { bg: "bg-violet-100 dark:bg-violet-500/15", text: "text-violet-700 dark:text-violet-400", border: "border-violet-200 dark:border-violet-500/30" },
  { bg: "bg-amber-100 dark:bg-amber-500/15", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-500/30" },
  { bg: "bg-emerald-100 dark:bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-500/30" },
  { bg: "bg-pink-100 dark:bg-pink-500/15", text: "text-pink-700 dark:text-pink-400", border: "border-pink-200 dark:border-pink-500/30" },
  { bg: "bg-blue-100 dark:bg-blue-500/15", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-500/30" },
  { bg: "bg-orange-100 dark:bg-orange-500/15", text: "text-orange-700 dark:text-orange-400", border: "border-orange-200 dark:border-orange-500/30" },
  { bg: "bg-cyan-100 dark:bg-teal-500/15", text: "text-cyan-700 dark:text-teal-400", border: "border-cyan-200 dark:border-teal-500/30" },
];

interface Props {
  assets: AssetParams[];
  totalAllocation: number;
  onEditClick: () => void;
}

export function PortfolioBar({ assets, totalAllocation, onEditClick }: Props) {
  const allocationOk = Math.abs(totalAllocation - 100) < 0.5;

  return (
    <div className="border-b border-stone-200 dark:border-slate-800/50 bg-white/60 dark:bg-slate-900/30 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-3">
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          {assets.map((asset, i) => {
            const color = ASSET_CHIP_COLORS[i % ASSET_CHIP_COLORS.length];
            return (
              <span
                key={`${asset.ticker}-${i}`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-semibold border ${color.bg} ${color.text} ${color.border}`}
              >
                {asset.ticker}
                <span className="opacity-60">{asset.allocation_pct.toFixed(0)}%</span>
              </span>
            );
          })}
        </div>

        <span
          className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
            allocationOk
              ? "bg-green-50 text-green-700 border border-green-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
              : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
          }`}
        >
          {totalAllocation.toFixed(1)}%
        </span>

        <button
          onClick={onEditClick}
          className="text-xs text-stone-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-cyan-400 transition-colors flex items-center gap-1"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      </div>
    </div>
  );
}
