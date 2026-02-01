// API Client with TanStack Query Integration
// apps/web/lib/api-client.ts

import { QueryClient } from '@tanstack/react-query';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

// Create query client with optimized defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Types
interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

// Get auth token from Supabase session
async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const supabase = createClientComponentClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// Base fetch wrapper with auth and error handling
async function apiFetch<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  // Build URL with query params
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // Add auth header
  const token = await getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  // Handle non-JSON responses
  const contentType = response.headers.get('content-type');
  if (response.status === 204) {
    return undefined as T;
  }

  const data = contentType?.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = data as ApiError;
    throw new Error(error.message || 'API request failed');
  }

  return data as T;
}

// ============================================
// API METHODS
// ============================================

export const api = {
  // Portfolio endpoints
  portfolios: {
    list: () => apiFetch<Portfolio[]>('/portfolios'),
    
    get: (id: string) => apiFetch<PortfolioDetail>(`/portfolios/${id}`),
    
    getDashboard: (id: string) => apiFetch<DashboardData>(`/portfolios/${id}/dashboard`),
    
    getHistory: (id: string, period = '1Y') => 
      apiFetch<HistoryData[]>(`/portfolios/${id}/history`, { params: { period } }),
    
    create: (data: CreatePortfolioInput) =>
      apiFetch<Portfolio>('/portfolios', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    update: (id: string, data: UpdatePortfolioInput) =>
      apiFetch<Portfolio>(`/portfolios/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    
    delete: (id: string) =>
      apiFetch<void>(`/portfolios/${id}`, { method: 'DELETE' }),
  },

  // Position endpoints
  positions: {
    list: (portfolioId: string) =>
      apiFetch<PositionWithMeta[]>('/positions', { params: { portfolioId } }),
    
    get: (id: string) => apiFetch<PositionDetail>(`/positions/${id}`),
    
    getTaxLots: (id: string) => apiFetch<TaxLotAnalysis>(`/positions/${id}/tax-lots`),
    
    create: (data: CreatePositionInput) =>
      apiFetch<Position>('/positions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    addLot: (id: string, data: AddLotInput) =>
      apiFetch<TaxLot>(`/positions/${id}/lots`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    delete: (id: string) =>
      apiFetch<void>(`/positions/${id}`, { method: 'DELETE' }),
  },

  // Transaction endpoints
  transactions: {
    list: (filters: TransactionFilters) =>
      apiFetch<TransactionListResponse>('/transactions', { params: filters as any }),
    
    get: (id: string) => apiFetch<Transaction>(`/transactions/${id}`),
    
    getSummary: (portfolioId?: string, year?: number) =>
      apiFetch<TransactionSummary>('/transactions/summary', {
        params: { portfolioId, year },
      }),
    
    create: (data: CreateTransactionInput) =>
      apiFetch<Transaction>('/transactions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    delete: (id: string) =>
      apiFetch<void>(`/transactions/${id}`, { method: 'DELETE' }),
  },

  // Analysis endpoints
  analysis: {
    simulate: (data: SimulationInput) =>
      apiFetch<SimulationResult>('/analysis/simulate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    getCorrelation: (portfolioId: string, additionalTickers?: string[]) =>
      apiFetch<CorrelationMatrix>('/analysis/correlation', {
        params: { portfolioId, additionalTickers: additionalTickers?.join(',') },
      }),
    
    getRiskAnalysis: (portfolioId: string) =>
      apiFetch<RiskAnalysis>('/analysis/risk', { params: { portfolioId } }),
    
    getOptimizations: (portfolioId: string, goal?: string) =>
      apiFetch<OptimizationResult>('/analysis/optimize', { params: { portfolioId, goal } }),
    
    getBreakdown: (portfolioId: string) =>
      apiFetch<AllocationBreakdown>('/analysis/breakdown', { params: { portfolioId } }),
  },

  // Import endpoints
  import: {
    parseCSV: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/import/parse-csv`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json() as Promise<CSVParseResult>;
    },
    
    importCSV: (data: CSVImportInput) =>
      apiFetch<ImportResult>('/import/csv', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    importManual: (data: ManualImportInput) =>
      apiFetch<ImportResult>('/import/manual', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    getHistory: () => apiFetch<ImportHistoryItem[]>('/import/history'),
    
    getTemplates: () => apiFetch<{ templates: CSVTemplate[] }>('/import/templates'),
  },
};

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  accountType: string;
  isDefault: boolean;
  totalValue?: number;
  totalCost?: number;
  dayChange?: number;
  dayChangePercent?: number;
  positionsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioDetail extends Portfolio {
  positions: Position[];
  summary: PortfolioSummary;
}

export interface PortfolioSummary {
  totalMarketValue: number;
  totalCostBasis: number;
  totalUnrealizedPL: number;
  totalUnrealizedPLPercent: number;
  dayChange: number;
  dayChangePercent: number;
  positionsCount: number;
  topHoldings: { ticker: string; name: string; marketValue: number; weight: number }[];
  topWinners: { ticker: string; unrealizedPL: number; unrealizedPLPercent: number }[];
  topLosers: { ticker: string; unrealizedPL: number; unrealizedPLPercent: number }[];
}

export interface DashboardData {
  portfolio: { id: string; name: string; accountType: string };
  kpis: {
    totalValue: { value: number; formatted: string };
    unrealizedPL: { value: number; percent: number; formatted: string; formattedPercent: string };
    sharpeRatio: { value: number; formatted: string; rating: string };
    beta: { value: number; formatted: string; interpretation: string };
    maxDrawdown: { value: number; formatted: string };
    cashAvailable: { value: number; formatted: string; percent: string };
  };
  charts: {
    performance: { date: string; value: number; benchmark: number }[];
    sectorAllocation: { name: string; value: number; weight: number; color: string }[];
    assetAllocation: { name: string; value: number; weight: number; color: string }[];
  };
  recentActivity: {
    id: string;
    type: string;
    ticker: string;
    name: string;
    quantity: number;
    price: number;
    totalAmount: number;
    executedAt: string;
    timeAgo: string;
  }[];
}

export interface HistoryData {
  date: string;
  totalValue: number;
  cumulativeReturn: number;
  benchmarkValue: number;
  sharpeRatio?: number;
  beta?: number;
  maxDrawdown?: number;
}

export interface Position {
  id: string;
  ticker: string;
  name?: string;
  assetType: string;
  quantity: number;
  avgCostBasis: number;
  currentPrice?: number;
  dayChange?: number;
  dayChangePercent?: number;
  marketValue?: number;
  unrealizedPL?: number;
  unrealizedPLPercent?: number;
  sector?: string;
}

export interface PositionWithMeta extends Position {
  weight: string;
  sparkline: number[];
  lots: TaxLot[];
}

export interface PositionDetail extends Position {
  lots: TaxLot[];
  transactions: Transaction[];
  priceHistory: { date: string; close: number }[];
  fifoAnalysis: TaxLotAnalysis;
}

export interface TaxLot {
  id: string;
  quantity: number;
  costBasis: number;
  purchaseDate: string;
  soldQuantity: number;
  isWashSale: boolean;
}

export interface TaxLotAnalysis {
  ticker: string;
  currentPrice: number;
  totalQuantity: number;
  lots: {
    id: string;
    purchaseDate: string;
    quantity: number;
    costBasis: number;
    totalCost: number;
    holdingDays: number;
    isLongTerm: boolean;
    unrealizedGain: number;
    unrealizedGainPercent: number;
    isWashSale: boolean;
  }[];
  summary: {
    shortTermQuantity: number;
    longTermQuantity: number;
    shortTermGain: number;
    longTermGain: number;
    totalUnrealizedGain: number;
  };
}

export interface Transaction {
  id: string;
  positionId: string;
  type: string;
  quantity: number;
  price: number;
  totalAmount: number;
  fees: number;
  executedAt: string;
  notes?: string;
  position?: { ticker: string; name?: string };
}

export interface TransactionFilters {
  portfolioId?: string;
  positionId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface TransactionListResponse {
  data: Transaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface TransactionSummary {
  year: number;
  totalBuys: number;
  totalSells: number;
  totalDividends: number;
  buyCount: number;
  sellCount: number;
  dividendCount: number;
  netInflow: number;
}

export interface SimulationInput {
  portfolioId: string;
  changes: {
    ticker: string;
    action: 'add' | 'remove' | 'adjust';
    quantity: number;
    price?: number;
  }[];
}

export interface SimulationResult {
  current: MetricSet;
  simulated: MetricSet;
  delta: {
    [key: string]: {
      current: number;
      simulated: number;
      change: number;
    };
  };
  efficientFrontier: {
    frontier: { risk: number; return: number }[];
    currentPortfolio: { risk: number; return: number };
  };
  simulatedPositions: {
    ticker: string;
    quantity: number;
    weight: number;
    isNew?: boolean;
    isRemoved?: boolean;
  }[];
}

export interface MetricSet {
  totalValue: number;
  expectedReturn: number;
  standardDeviation: number;
  sharpeRatio: number;
  maxDrawdown: number;
  beta: number;
}

export interface CorrelationMatrix {
  tickers: string[];
  matrix: number[][];
  newTickers: string[];
}

export interface RiskAnalysis {
  volatility: number;
  beta: number;
  alpha: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  valueAtRisk: { percent: number; amount: number };
  sectorConcentration: { name: string; weight: number; color: string }[];
  recommendations: {
    type: string;
    message: string;
    action: string;
  }[];
}

export interface OptimizationResult {
  goal: string;
  currentMetrics: { sharpeRatio: number; expectedReturn: number; volatility: number };
  optimizedMetrics: { sharpeRatio: number; expectedReturn: number; volatility: number };
  recommendations: {
    ticker: string;
    action: string;
    shares: number;
    reason: string;
    impact: string;
  }[];
}

export interface AllocationBreakdown {
  bySector: { name: string; value: number; weight: number; color: string }[];
  byAssetType: { name: string; value: number; weight: number; color: string }[];
  alerts: {
    type: string;
    severity: string;
    message: string;
    suggestion: string;
  }[];
}

export interface CSVParseResult {
  filename: string;
  headers: string[];
  rowCount: number;
  preview: Record<string, string>[];
  suggestedMapping: {
    ticker?: string;
    quantity?: string;
    costBasis?: string;
    purchaseDate?: string;
  };
}

export interface CSVImportInput {
  portfolioId: string;
  columnMapping: {
    ticker: string;
    quantity: string;
    costBasis: string;
    purchaseDate?: string;
  };
  data: Record<string, any>[];
}

export interface ManualImportInput {
  portfolioId: string;
  entries: {
    ticker: string;
    quantity: number;
    avgCostBasis: number;
    purchaseDate?: string;
    assetType?: string;
  }[];
}

export interface ImportResult {
  importId: string;
  success: number;
  failed: number;
  errors: { row: number; error: string }[];
  created?: string[];
  updated?: string[];
}

export interface ImportHistoryItem {
  id: string;
  source: string;
  sourceName?: string;
  status: string;
  recordsTotal: number;
  recordsSuccess: number;
  recordsFailed: number;
  startedAt: string;
  completedAt?: string;
}

export interface CSVTemplate {
  id: string;
  name: string;
  description: string;
  columns: string[];
  sampleUrl?: string;
}

export interface CreatePortfolioInput {
  name: string;
  description?: string;
  accountType?: string;
}

export interface UpdatePortfolioInput {
  name?: string;
  description?: string;
  isDefault?: boolean;
}

export interface CreatePositionInput {
  portfolioId: string;
  ticker: string;
  assetType?: string;
  name?: string;
  quantity: number;
  avgCostBasis: number;
  purchaseDate?: string;
}

export interface AddLotInput {
  quantity: number;
  costBasis: number;
  purchaseDate: string;
}

export interface CreateTransactionInput {
  positionId: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'DIVIDEND_REINVEST';
  quantity: number;
  price: number;
  fees?: number;
  executedAt?: string;
  notes?: string;
}
