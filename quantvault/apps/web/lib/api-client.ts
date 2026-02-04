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
    console.error('API Error:', { status: response.status, url, error: data });
    throw new Error(error.message || `API request failed: ${response.status}`);
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

    getFeesSummary: (portfolioId: string) =>
      apiFetch<FeesSummary>('/analysis/fees', { params: { portfolioId } }),
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

    // Trading 212 specific import
    parseTrading212CSV: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/import/parse-trading212`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json() as Promise<Trading212ParseResult>;
    },

    importTrading212: (data: Trading212ImportInput) =>
      apiFetch<ImportResult>('/import/trading212', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Market data endpoints
  market: {
    getQuote: (ticker: string) => apiFetch<MarketQuote>(`/market/quote/${ticker}`),

    getQuotes: (tickers: string[]) =>
      apiFetch<Record<string, MarketQuote>>('/market/quotes', {
        method: 'POST',
        body: JSON.stringify({ tickers }),
      }),

    getHistory: (ticker: string, range = '1Y') =>
      apiFetch<{ ticker: string; range: string; data: { date: string; close: number }[] }>(
        `/market/history/${ticker}`,
        { params: { range } }
      ),

    search: (query: string) =>
      apiFetch<{ results: TickerSearchResult[] }>('/market/search', { params: { q: query } }),

    refreshPortfolio: (portfolioId: string) =>
      apiFetch<{ success: boolean }>(`/market/refresh/${portfolioId}`, { method: 'POST' }),

    // Indian Mutual Fund endpoints
    searchMutualFunds: (query: string) =>
      apiFetch<{ results: MutualFundSearchResult[] }>('/market/mf/search', { params: { q: query } }),

    getMutualFundNAV: (schemeCode: string) =>
      apiFetch<MutualFundNAV>(`/market/mf/${schemeCode}/latest`),

    getMutualFundHistory: (schemeCode: string) =>
      apiFetch<MutualFundHistory>(`/market/mf/${schemeCode}/history`),
  },

  // Broker connection endpoints
  brokers: {
    list: () => apiFetch<BrokerConnection[]>('/brokers'),

    connect: (data: ConnectBrokerInput) =>
      apiFetch<BrokerConnectResult>('/brokers/connect', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    sync: (connectionId: string, portfolioId: string) =>
      apiFetch<BrokerSyncResult>(`/brokers/${connectionId}/sync`, {
        method: 'POST',
        body: JSON.stringify({ portfolioId }),
      }),

    disconnect: (connectionId: string) =>
      apiFetch<{ success: boolean }>(`/brokers/${connectionId}`, { method: 'DELETE' }),
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
  currency?: string;
  expenseRatio?: number;
  schemeCode?: string;
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
  currency?: string;      // USD, INR, GBP, EUR, etc.
  expenseRatio?: number;  // Annual expense ratio as percentage
  schemeCode?: string;    // For Indian mutual funds
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

export interface MarketQuote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  weekHigh52: number | null;
  weekLow52: number | null;
  marketCap: number | null;
  peRatio: number | null;
  dividendYield: number | null;
  name: string | null;
  sector: string | null;
  industry: string | null;
  exchange: string | null;
}

export interface TickerSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export interface BrokerConnection {
  id: string;
  broker: string;
  status: 'PENDING' | 'CONNECTED' | 'SYNCING' | 'ERROR' | 'DISCONNECTED';
  lastSyncAt?: string;
  lastSyncStatus?: string;
  accountIds: string[];
  createdAt: string;
}

export interface ConnectBrokerInput {
  broker: string;
  apiKey: string;
  apiSecret?: string;
  accountId?: string;
}

export interface BrokerConnectResult {
  id: string;
  broker: string;
  status: string;
  message: string;
}

export interface BrokerSyncResult {
  success: boolean;
  imported: number;
  failed: number;
  message: string;
}

// Indian Mutual Fund types
export interface MutualFundSearchResult {
  schemeCode: string;
  schemeName: string;
}

export interface MutualFundNAV {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  schemeType: string;
  schemeCategory: string;
  nav: number;
  date: string | null;
}

export interface MutualFundHistory {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  schemeType: string;
  schemeCategory: string;
  data: { date: string; nav: number }[];
}

// Trading 212 Import types
export interface Trading212AggregatedPosition {
  ticker: string;
  name: string;
  totalShares: number;
  totalCost: number;
  avgCostBasis: number;
  currency: string;
  firstPurchaseDate: string;
  transactions: Array<{
    type: 'BUY' | 'SELL';
    shares: number;
    price: number;
    date: string;
    total: number;
  }>;
}

export interface Trading212ParseResult {
  filename: string;
  positions: Trading212AggregatedPosition[];
  summary: {
    totalBuys: number;
    totalSells: number;
    ignoredTransactions: number;
    positionsWithHoldings: number;
    positionsFullySold: number;
  };
}

export interface Trading212ImportInput {
  portfolioId: string;
  positions: Trading212AggregatedPosition[];
}

// Fees tracking types
export interface PositionFee {
  ticker: string;
  name: string | null;
  currency: string;
  marketValue: number;
  expenseRatio: number;
  annualFee: number;
  monthlyFee: number;
  assetType: string;
}

export interface FeesSummary {
  positions: PositionFee[];
  summary: {
    totalAnnualFeesUSD: number;
    totalAnnualFeesINR: number;
    totalMonthlyFeesUSD: number;
    totalMonthlyFeesINR: number;
    positionsWithFees: number;
    totalPositions: number;
  };
}
