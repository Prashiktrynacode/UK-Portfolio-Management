// TanStack Query Hooks
// apps/web/hooks/use-portfolio.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Portfolio, DashboardData, PositionWithMeta, CreatePositionInput, CreateTransactionInput } from '@/lib/api-client';
import { useUIStore } from '@/stores';

// Query keys factory
export const portfolioKeys = {
  all: ['portfolios'] as const,
  lists: () => [...portfolioKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...portfolioKeys.lists(), filters] as const,
  details: () => [...portfolioKeys.all, 'detail'] as const,
  detail: (id: string) => [...portfolioKeys.details(), id] as const,
  dashboard: (id: string) => [...portfolioKeys.detail(id), 'dashboard'] as const,
  history: (id: string, period?: string) => [...portfolioKeys.detail(id), 'history', period] as const,
  positions: (id: string) => [...portfolioKeys.detail(id), 'positions'] as const,
};

// ============================================
// PORTFOLIO QUERIES
// ============================================

export function usePortfolios() {
  return useQuery({
    queryKey: portfolioKeys.lists(),
    queryFn: api.portfolios.list,
  });
}

export function usePortfolio(id: string | null) {
  return useQuery({
    queryKey: portfolioKeys.detail(id!),
    queryFn: () => api.portfolios.get(id!),
    enabled: !!id,
  });
}

export function useDashboard(id: string | null) {
  return useQuery({
    queryKey: portfolioKeys.dashboard(id!),
    queryFn: () => api.portfolios.getDashboard(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function usePortfolioHistory(id: string | null, period = '1Y') {
  return useQuery({
    queryKey: portfolioKeys.history(id!, period),
    queryFn: () => api.portfolios.getHistory(id!, period),
    enabled: !!id,
  });
}

export function usePositions(portfolioId: string | null) {
  return useQuery({
    queryKey: portfolioKeys.positions(portfolioId!),
    queryFn: () => api.positions.list(portfolioId!),
    enabled: !!portfolioId,
  });
}

// ============================================
// PORTFOLIO MUTATIONS
// ============================================

export function useCreatePortfolio() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.portfolios.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.lists() });
    },
  });
}

export function useUpdatePortfolio() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.portfolios.update>[1] }) =>
      api.portfolios.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: portfolioKeys.lists() });
    },
  });
}

export function useDeletePortfolio() {
  const queryClient = useQueryClient();
  const { activePortfolioId, setActivePortfolioId } = useUIStore();
  
  return useMutation({
    mutationFn: api.portfolios.delete,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.lists() });
      if (activePortfolioId === deletedId) {
        setActivePortfolioId(null);
      }
    },
  });
}

// ============================================
// POSITION MUTATIONS
// ============================================

export function useCreatePosition() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreatePositionInput) => api.positions.create(data),
    onSuccess: (_, { portfolioId }) => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.positions(portfolioId) });
      queryClient.invalidateQueries({ queryKey: portfolioKeys.dashboard(portfolioId) });
    },
  });
}

export function useAddLot() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ positionId, data }: { positionId: string; data: Parameters<typeof api.positions.addLot>[1] }) =>
      api.positions.addLot(positionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.all });
    },
  });
}

export function useDeletePosition() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.positions.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.all });
    },
  });
}

// ============================================
// TRANSACTION MUTATIONS
// ============================================

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateTransactionInput) => api.transactions.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.all });
    },
  });
}

// ============================================
// ACTIVE PORTFOLIO HOOK
// ============================================

export function useActivePortfolio() {
  const { activePortfolioId, setActivePortfolioId } = useUIStore();
  const { data: portfolios } = usePortfolios();
  
  // Auto-select default portfolio if none selected
  const portfolioId = activePortfolioId || portfolios?.find(p => p.isDefault)?.id || portfolios?.[0]?.id || null;
  
  const { data: dashboard, isLoading, error } = useDashboard(portfolioId);
  const { data: positions } = usePositions(portfolioId);
  
  return {
    portfolioId,
    setActivePortfolioId,
    portfolios,
    dashboard,
    positions,
    isLoading,
    error,
  };
}
