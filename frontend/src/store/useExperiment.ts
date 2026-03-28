import { useState, useEffect, useCallback } from "react";
import type { AssetParams, SimulateResponse, OptimizeResponse, BacktestResponse, PortfolioExperiment } from "../types/portfolio";
import {
  saveExperiment,
  getExperiment,
  listExperiments,
  deleteExperiment as removeExperiment,
  setActiveExperimentId,
  getActiveExperimentId,
} from "./experiments";

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
}

export function createBlankExperiment(name: string = "New Experiment"): PortfolioExperiment {
  return {
    id: generateId(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    portfolio: {
      assets: [],
      correlationMatrix: [],
      description: "",
      riskTolerance: "moderate",
    },
    lastSimulation: null,
    lastOptimization: null,
    lastBacktest: null,
  };
}

export function useExperiment() {
  const [experiment, setExperiment] = useState<PortfolioExperiment | null>(null);
  const [allExperiments, setAllExperiments] = useState<PortfolioExperiment[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load active experiment on mount
  useEffect(() => {
    (async () => {
      const all = await listExperiments();
      setAllExperiments(all);
      const activeId = getActiveExperimentId();
      if (activeId) {
        const exp = await getExperiment(activeId);
        if (exp) {
          setExperiment(exp);
          setIsLoaded(true);
          return;
        }
      }
      // No active experiment — create a blank one
      const blank = createBlankExperiment();
      await saveExperiment(blank);
      setActiveExperimentId(blank.id);
      setExperiment(blank);
      setAllExperiments(prev => [blank, ...prev]);
      setIsLoaded(true);
    })();
  }, []);

  // Auto-save whenever experiment changes
  const persist = useCallback(async (exp: PortfolioExperiment) => {
    setExperiment(exp);
    await saveExperiment(exp);
    setAllExperiments(prev => {
      const idx = prev.findIndex(e => e.id === exp.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = exp;
        return updated;
      }
      return [exp, ...prev];
    });
  }, []);

  const updatePortfolio = useCallback((assets: AssetParams[], correlationMatrix: number[][], description?: string, riskTolerance?: string) => {
    if (!experiment) return;
    persist({
      ...experiment,
      portfolio: {
        ...experiment.portfolio,
        assets,
        correlationMatrix,
        ...(description !== undefined && { description }),
        ...(riskTolerance !== undefined && { riskTolerance }),
      },
    });
  }, [experiment, persist]);

  const saveSimulation = useCallback((config: { numSimulations: number; numYears: number; model: "gbm" | "merton"; initialInvestment: number; seed: number | null }, result: SimulateResponse) => {
    if (!experiment) return;
    persist({ ...experiment, lastSimulation: { config, result } });
  }, [experiment, persist]);

  const saveOptimization = useCallback((result: OptimizeResponse) => {
    if (!experiment) return;
    persist({ ...experiment, lastOptimization: result });
  }, [experiment, persist]);

  const saveBacktest = useCallback((crisisId: string, config: { numSimulations: number; initialInvestment: number; model: string; rebalance: boolean }, result: BacktestResponse) => {
    if (!experiment) return;
    persist({ ...experiment, lastBacktest: { crisisId, config, result } });
  }, [experiment, persist]);

  const applyOptimizedWeights = useCallback(() => {
    if (!experiment?.lastOptimization) return;
    const newAssets = experiment.portfolio.assets.map(asset => {
      const w = experiment.lastOptimization!.weights.find(w => w.ticker === asset.ticker);
      return w ? { ...asset, allocation_pct: w.optimal_pct } : asset;
    });
    persist({
      ...experiment,
      portfolio: { ...experiment.portfolio, assets: newAssets },
      lastSimulation: null, // invalidate since weights changed
    });
  }, [experiment, persist]);

  const switchExperiment = useCallback(async (id: string) => {
    const exp = await getExperiment(id);
    if (exp) {
      setExperiment(exp);
      setActiveExperimentId(id);
    }
  }, []);

  const createExperiment = useCallback(async (name: string = "New Experiment") => {
    const blank = createBlankExperiment(name);
    await saveExperiment(blank);
    setActiveExperimentId(blank.id);
    setExperiment(blank);
    setAllExperiments(prev => [blank, ...prev]);
  }, []);

  const duplicateExperiment = useCallback(async () => {
    if (!experiment) return;
    const dup: PortfolioExperiment = {
      ...experiment,
      id: generateId(),
      name: `${experiment.name} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveExperiment(dup);
    setActiveExperimentId(dup.id);
    setExperiment(dup);
    setAllExperiments(prev => [dup, ...prev]);
  }, [experiment]);

  const deleteCurrentExperiment = useCallback(async () => {
    if (!experiment) return;
    await removeExperiment(experiment.id);
    const remaining = allExperiments.filter(e => e.id !== experiment.id);
    setAllExperiments(remaining);
    if (remaining.length > 0) {
      setExperiment(remaining[0]);
      setActiveExperimentId(remaining[0].id);
    } else {
      const blank = createBlankExperiment();
      await saveExperiment(blank);
      setActiveExperimentId(blank.id);
      setExperiment(blank);
      setAllExperiments([blank]);
    }
  }, [experiment, allExperiments]);

  const renameExperiment = useCallback((name: string) => {
    if (!experiment) return;
    persist({ ...experiment, name });
  }, [experiment, persist]);

  return {
    experiment,
    allExperiments,
    isLoaded,
    updatePortfolio,
    saveSimulation,
    saveOptimization,
    saveBacktest,
    applyOptimizedWeights,
    switchExperiment,
    createExperiment,
    duplicateExperiment,
    deleteCurrentExperiment,
    renameExperiment,
  };
}
