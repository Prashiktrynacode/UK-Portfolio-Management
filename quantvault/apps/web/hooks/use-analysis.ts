// Analysis Hooks for What-If Scenarios
// apps/web/hooks/use-analysis.ts

import { useQuery, useMutation } from '@tanstack/react-query';
import { api, SimulationInput, CorrelationMatrix, RiskAnalysis } from '@/lib/api-client';
import { useSimulationStore } from '@/stores';

// Query keys
export const analysisKeys = {
  all: ['analysis'] as const,
  correlation: (portfolioId: string, tickers?: string[]) => 
    [...analysisKeys.all, 'correlation', portfolioId, tickers] as const,
  risk: (portfolioId: string) => [...analysisKeys.all, 'risk', portfolioId] as const,
  optimization: (portfolioId: string, goal?: string) => 
    [...analysisKeys.all, 'optimization', portfolioId, goal] as const,
  breakdown: (portfolioId: string) => [...analysisKeys.all, 'breakdown', portfolioId] as const,
};

// ============================================
// CORRELATION MATRIX
// ============================================

export function useCorrelationMatrix(portfolioId: string | null, additionalTickers?: string[]) {
  return useQuery({
    queryKey: analysisKeys.correlation(portfolioId!, additionalTickers),
    queryFn: () => api.analysis.getCorrelation(portfolioId!, additionalTickers),
    enabled: !!portfolioId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// ============================================
// RISK ANALYSIS
// ============================================

export function useRiskAnalysis(portfolioId: string | null) {
  return useQuery({
    queryKey: analysisKeys.risk(portfolioId!),
    queryFn: () => api.analysis.getRiskAnalysis(portfolioId!),
    enabled: !!portfolioId,
    staleTime: 1000 * 60 * 5,
  });
}

// ============================================
// OPTIMIZATION SUGGESTIONS
// ============================================

export function useOptimization(portfolioId: string | null, goal?: string) {
  return useQuery({
    queryKey: analysisKeys.optimization(portfolioId!, goal),
    queryFn: () => api.analysis.getOptimizations(portfolioId!, goal),
    enabled: !!portfolioId,
    staleTime: 1000 * 60 * 5,
  });
}

// ============================================
// ALLOCATION BREAKDOWN
// ============================================

export function useAllocationBreakdown(portfolioId: string | null) {
  return useQuery({
    queryKey: analysisKeys.breakdown(portfolioId!),
    queryFn: () => api.analysis.getBreakdown(portfolioId!),
    enabled: !!portfolioId,
  });
}

// ============================================
// SIMULATION MUTATION
// ============================================

export function useRunSimulation() {
  const { setSimulationResult, setIsRunning } = useSimulationStore();

  return useMutation({
    mutationFn: async (input: SimulationInput) => {
      setIsRunning(true);
      const result = await api.analysis.simulate(input);
      return result;
    },
    onSuccess: (data) => {
      // Transform API response to store format
      const result = {
        expectedReturn: {
          current: data.current.expectedReturn,
          simulated: data.simulated.expectedReturn,
          delta: data.delta.expectedReturn.change,
        },
        risk: {
          current: data.current.standardDeviation,
          simulated: data.simulated.standardDeviation,
          delta: data.delta.risk.change,
        },
        sharpe: {
          current: data.current.sharpeRatio,
          simulated: data.simulated.sharpeRatio,
          delta: data.delta.sharpe.change,
        },
        maxDrawdown: {
          current: data.current.maxDrawdown,
          simulated: data.simulated.maxDrawdown,
          delta: data.delta.maxDrawdown.change,
        },
        totalValue: {
          current: data.current.totalValue,
          simulated: data.simulated.totalValue,
          delta: data.delta.totalValue.change,
        },
      };
      setSimulationResult(result);
    },
    onSettled: () => {
      setIsRunning(false);
    },
  });
}

// ============================================
// COMBINED SIMULATION HOOK
// ============================================

export function useSimulation(portfolioId: string | null) {
  const {
    isSimulationMode,
    setSimulationMode,
    changes,
    addChange,
    removeChange,
    updateChange,
    clearChanges,
    simulationResult,
    isRunning,
    savedScenarios,
    saveScenario,
    loadScenario,
    deleteScenario,
  } = useSimulationStore();

  const runSimulation = useRunSimulation();
  const { data: correlation } = useCorrelationMatrix(
    portfolioId,
    changes.filter(c => c.action === 'add' && c.isNew).map(c => c.ticker)
  );

  const executeSimulation = async () => {
    if (!portfolioId || changes.length === 0) return;
    
    await runSimulation.mutateAsync({
      portfolioId,
      changes: changes.map(c => ({
        ticker: c.ticker,
        action: c.action,
        quantity: c.quantity,
        price: c.price,
      })),
    });
  };

  return {
    // Mode
    isSimulationMode,
    setSimulationMode,
    
    // Changes
    changes,
    addChange,
    removeChange,
    updateChange,
    clearChanges,
    
    // Results
    simulationResult,
    isRunning,
    executeSimulation,
    
    // Correlation data for new tickers
    correlation,
    
    // Saved scenarios
    savedScenarios,
    saveScenario,
    loadScenario,
    deleteScenario,
  };
}
