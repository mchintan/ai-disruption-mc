import { Lightbulb, FlaskConical, Rocket } from "lucide-react";
import type { AppTab } from "../types/portfolio";

interface Props {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  hasPortfolio: boolean;
}

const PHASES: { key: AppTab; label: string; icon: React.ReactNode; requiresPortfolio: boolean }[] = [
  { key: "plan", label: "Plan", icon: <Lightbulb className="w-4 h-4" />, requiresPortfolio: false },
  { key: "test", label: "Test", icon: <FlaskConical className="w-4 h-4" />, requiresPortfolio: true },
  { key: "act", label: "Act", icon: <Rocket className="w-4 h-4" />, requiresPortfolio: true },
];

export function WorkspaceTabs({ activeTab, onTabChange, hasPortfolio }: Props) {
  return (
    <div className="flex gap-1 bg-stone-100 dark:bg-slate-800/50 rounded-lg p-1">
      {PHASES.map((phase) => {
        const disabled = phase.requiresPortfolio && !hasPortfolio;
        const active = activeTab === phase.key;
        return (
          <button
            key={phase.key}
            onClick={() => !disabled && onTabChange(phase.key)}
            disabled={disabled}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
              active
                ? "bg-white text-teal-700 shadow-sm dark:bg-slate-700 dark:text-cyan-400"
                : disabled
                ? "text-stone-300 dark:text-slate-600 cursor-not-allowed"
                : "text-stone-500 hover:text-stone-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {phase.icon}
            <span>{phase.label}</span>
            {disabled && <span className="text-[10px] text-stone-300 dark:text-slate-600 hidden sm:inline">(build a portfolio first)</span>}
          </button>
        );
      })}
    </div>
  );
}
