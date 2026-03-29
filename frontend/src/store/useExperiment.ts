import { useState, useEffect, useCallback, useRef } from "react";
import type { AssetParams, SimulateResponse, OptimizeResponse, BacktestResponse, PortfolioExperiment, DNAResponse, Thesis, CustomScenario } from "../types/portfolio";
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
    lastDNA: null,
    theses: null,
    lastScenario: null,
    publishedId: null,
  };
}

export function useExperiment() {
  const [experiment, setExperiment] = useState<PortfolioExperiment | null>(null);
  const experimentRef = useRef<PortfolioExperiment | null>(null);
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
          experimentRef.current = exp;
          setExperiment(exp);
          setIsLoaded(true);
          return;
        }
      }
      // No active experiment — create a blank one
      const blank = createBlankExperiment();
      await saveExperiment(blank);
      setActiveExperimentId(blank.id);
      experimentRef.current = blank;
      setExperiment(blank);
      setAllExperiments(prev => [blank, ...prev]);
      setIsLoaded(true);
    })();
  }, []);

  // Auto-save whenever experiment changes
  const persist = useCallback(async (exp: PortfolioExperiment) => {
    experimentRef.current = exp;
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
    const current = experimentRef.current;
    if (!current) return;
    persist({
      ...current,
      portfolio: {
        ...current.portfolio,
        assets,
        correlationMatrix,
        ...(description !== undefined && { description }),
        ...(riskTolerance !== undefined && { riskTolerance }),
      },
    });
  }, [persist]);

  const saveSimulation = useCallback((config: { numSimulations: number; numYears: number; model: "gbm" | "merton" | "regime"; initialInvestment: number; seed: number | null }, result: SimulateResponse) => {
    const current = experimentRef.current;
    if (!current) return;
    persist({ ...current, lastSimulation: { config, result } });
  }, [persist]);

  const saveOptimization = useCallback((result: OptimizeResponse) => {
    const current = experimentRef.current;
    if (!current) return;
    persist({ ...current, lastOptimization: result });
  }, [persist]);

  const saveBacktest = useCallback((crisisId: string, config: { numSimulations: number; initialInvestment: number; model: string; rebalance: boolean }, result: BacktestResponse) => {
    const current = experimentRef.current;
    if (!current) return;
    persist({ ...current, lastBacktest: { crisisId, config, result } });
  }, [persist]);

  const saveDNA = useCallback((dna: DNAResponse) => {
    const current = experimentRef.current;
    if (!current) return;
    persist({ ...current, lastDNA: dna });
  }, [persist]);

  const saveTheses = useCallback((theses: Thesis[]) => {
    const current = experimentRef.current;
    if (!current) return;
    persist({ ...current, theses });
  }, [persist]);

  const saveScenario = useCallback((description: string, scenario: CustomScenario, result: BacktestResponse) => {
    const current = experimentRef.current;
    if (!current) return;
    persist({ ...current, lastScenario: { description, scenario, result } });
  }, [persist]);

  const setPublishedId = useCallback((id: string) => {
    const current = experimentRef.current;
    if (!current) return;
    persist({ ...current, publishedId: id });
  }, [persist]);

  const applyOptimizedWeights = useCallback(() => {
    const current = experimentRef.current;
    if (!current?.lastOptimization) return;
    const newAssets = current.portfolio.assets.map(asset => {
      const w = current.lastOptimization!.weights.find(w => w.ticker === asset.ticker);
      return w ? { ...asset, allocation_pct: w.optimal_pct } : asset;
    });
    persist({
      ...current,
      portfolio: { ...current.portfolio, assets: newAssets },
      lastSimulation: null, // invalidate since weights changed
    });
  }, [persist]);

  const switchExperiment = useCallback(async (id: string) => {
    const exp = await getExperiment(id);
    if (exp) {
      experimentRef.current = exp;
      setExperiment(exp);
      setActiveExperimentId(id);
    }
  }, []);

  const createExperiment = useCallback(async (name: string = "New Experiment") => {
    const blank = createBlankExperiment(name);
    await saveExperiment(blank);
    setActiveExperimentId(blank.id);
    experimentRef.current = blank;
    setExperiment(blank);
    setAllExperiments(prev => [blank, ...prev]);
  }, []);

  const duplicateExperiment = useCallback(async () => {
    const experiment = experimentRef.current;
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
    experimentRef.current = dup;
    setExperiment(dup);
    setAllExperiments(prev => [dup, ...prev]);
  }, []);

  const deleteCurrentExperiment = useCallback(async () => {
    const current = experimentRef.current;
    if (!current) return;
    await removeExperiment(current.id);
    const remaining = allExperiments.filter(e => e.id !== current.id);
    setAllExperiments(remaining);
    if (remaining.length > 0) {
      experimentRef.current = remaining[0];
      setExperiment(remaining[0]);
      setActiveExperimentId(remaining[0].id);
    } else {
      const blank = createBlankExperiment();
      await saveExperiment(blank);
      setActiveExperimentId(blank.id);
      experimentRef.current = blank;
      setExperiment(blank);
      setAllExperiments([blank]);
    }
  }, [allExperiments]);

  const renameExperiment = useCallback((name: string) => {
    const current = experimentRef.current;
    if (!current) return;
    persist({ ...current, name });
  }, [persist]);

  return {
    experiment,
    allExperiments,
    isLoaded,
    updatePortfolio,
    saveSimulation,
    saveOptimization,
    saveBacktest,
    saveDNA,
    saveTheses,
    saveScenario,
    setPublishedId,
    applyOptimizedWeights,
    switchExperiment,
    createExperiment,
    duplicateExperiment,
    deleteCurrentExperiment,
    renameExperiment,
  };
}
