import { Hammer, Play, History, Target, Wallet } from "lucide-react";
import type { AppTab } from "../types/portfolio";

interface Props {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  hasPortfolio: boolean;
  hasSimulation: boolean;
}

const TABS: { key: AppTab; label: string; icon: React.ReactNode; requiresPortfolio: boolean }[] = [
  { key: "build", label: "Build", icon: <Hammer className="w-4 h-4" />, requiresPortfolio: false },
  { key: "simulate", label: "Simulate", icon: <Play className="w-4 h-4" />, requiresPortfolio: true },
  { key: "backtest", label: "Backtest", icon: <History className="w-4 h-4" />, requiresPortfolio: false },
  { key: "optimize", label: "Optimize", icon: <Target className="w-4 h-4" />, requiresPortfolio: true },
  { key: "execute", label: "Execute", icon: <Wallet className="w-4 h-4" />, requiresPortfolio: true },
];

export function WorkspaceTabs({ activeTab, onTabChange, hasPortfolio, hasSimulation }: Props) {
  return (
    <div className="flex gap-1 bg-stone-100 dark:bg-slate-800/50 rounded-lg p-1">
      {TABS.map((tab) => {
        const disabled = tab.requiresPortfolio && !hasPortfolio;
        const active = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            onClick={() => !disabled && onTabChange(tab.key)}
            disabled={disabled}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all relative ${
              active
                ? "bg-white text-teal-700 shadow-sm dark:bg-slate-700 dark:text-cyan-400"
                : disabled
                ? "text-stone-300 dark:text-slate-600 cursor-not-allowed"
                : "text-stone-500 hover:text-stone-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.key === "simulate" && hasSimulation && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 absolute top-1.5 right-1.5" />
            )}
          </button>
        );
      })}
    </div>
  );
}
