import { useState, useEffect } from "react";
import { Users, GitFork, Loader2 } from "lucide-react";
import { getCommunityFeed, forkExperiment } from "../api";

interface Props {
  onFork: (portfolio: Record<string, unknown>) => void;
}

export function CommunityTab({ onFork }: Props) {
  const [feed, setFeed] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState("published_at");

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const data = await getCommunityFeed(sort);
        setFeed(data as any[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load feed");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [sort]);

  const handleFork = async (id: string) => {
    try {
      const exp = await forkExperiment(id);
      onFork(exp.portfolio as Record<string, unknown>);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fork failed");
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/20 mb-4">
          <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 tracking-wide">COMMUNITY</span>
        </div>
        <h2 className="text-2xl font-bold text-stone-900 dark:text-slate-100 mb-2">Published Experiments</h2>
        <p className="text-stone-500 dark:text-slate-400 text-sm">Discover portfolios from the community. Fork any experiment to make it yours.</p>
      </div>

      <div className="flex gap-2 mb-6">
        {["published_at", "sharpe"].map(s => (
          <button key={s} onClick={() => setSort(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono ${sort === s
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/30"
              : "bg-white text-stone-500 border border-stone-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/50"
            }`}>
            {s === "published_at" ? "Recent" : "Top Sharpe"}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-stone-400 dark:text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading feed...
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm mb-4">{error}</div>
      )}

      {!isLoading && feed.length === 0 && (
        <div className="text-center py-16 text-stone-400 dark:text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No published experiments yet. Be the first to publish!</p>
        </div>
      )}

      <div className="space-y-3">
        {feed.map((exp: any) => (
          <div key={exp.id} className="bg-white dark:bg-slate-900/50 border border-stone-200 dark:border-slate-700/30 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-stone-900 dark:text-slate-100">{exp.name}</h3>
                <p className="text-xs text-stone-400 dark:text-slate-500 mt-1">
                  {new Date(exp.published_at * 1000).toLocaleDateString()} · {Object.keys(exp.portfolio?.assets || {}).length || "?"} assets
                </p>
              </div>
              <button onClick={() => handleFork(exp.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/30 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors">
                <GitFork className="w-3.5 h-3.5" /> Fork
              </button>
            </div>
            {exp.metrics?.sharpe_ratio !== undefined && (
              <div className="flex gap-4 mt-3">
                <div className="text-xs"><span className="text-stone-400 dark:text-slate-500">Sharpe</span> <span className="font-mono font-semibold text-stone-700 dark:text-slate-300">{exp.metrics.sharpe_ratio?.toFixed(2)}</span></div>
                <div className="text-xs"><span className="text-stone-400 dark:text-slate-500">Return</span> <span className="font-mono font-semibold text-stone-700 dark:text-slate-300">{exp.metrics.expected_return ? (exp.metrics.expected_return * 100).toFixed(1) + "%" : "\u2014"}</span></div>
                <div className="text-xs"><span className="text-stone-400 dark:text-slate-500">Drawdown</span> <span className="font-mono font-semibold text-stone-700 dark:text-slate-300">{exp.metrics.max_drawdown ? (exp.metrics.max_drawdown * 100).toFixed(1) + "%" : "\u2014"}</span></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
