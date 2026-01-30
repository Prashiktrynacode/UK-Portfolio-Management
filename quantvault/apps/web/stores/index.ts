// Zustand Stores for UI and Simulation State
// apps/web/stores/index.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================
// UI STATE STORE
// ============================================

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  activePortfolioId: string | null;
  setActivePortfolioId: (id: string | null) => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  modals: {
    addPosition: boolean;
    addTransaction: boolean;
    importCSV: boolean;
    settings: boolean;
  };
  openModal: (modal: keyof UIState['modals']) => void;
  closeModal: (modal: keyof UIState['modals']) => void;
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: Date;
  duration?: number;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      activePortfolioId: null,
      setActivePortfolioId: (id) => set({ activePortfolioId: id }),
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      modals: {
        addPosition: false,
        addTransaction: false,
        importCSV: false,
        settings: false,
      },
      openModal: (modal) => set((state) => ({
        modals: { ...state.modals, [modal]: true }
      })),
      closeModal: (modal) => set((state) => ({
        modals: { ...state.modals, [modal]: false }
      })),
      notifications: [],
      addNotification: (notification) => set((state) => ({
        notifications: [
          ...state.notifications,
          { ...notification, id: crypto.randomUUID(), timestamp: new Date() }
        ]
      })),
      dismissNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id)
      })),
      clearNotifications: () => set({ notifications: [] }),
    }),
    {
      name: 'quantvault-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        activePortfolioId: state.activePortfolioId,
        theme: state.theme,
      }),
    }
  )
);

// ============================================
// SIMULATION STATE STORE (What-If Analysis)
// ============================================

interface SimulatedPosition {
  ticker: string;
  quantity: number;
  price: number;
  action: 'add' | 'remove' | 'adjust';
  isNew?: boolean;
}

interface SimulationResult {
  expectedReturn: { current: number; simulated: number; delta: number };
  risk: { current: number; simulated: number; delta: number };
  sharpe: { current: number; simulated: number; delta: number };
  maxDrawdown: { current: number; simulated: number; delta: number };
  totalValue: { current: number; simulated: number; delta: number };
}

interface SavedScenario {
  id: string;
  name: string;
  changes: SimulatedPosition[];
  createdAt: Date;
}

interface SimulationState {
  isSimulationMode: boolean;
  setSimulationMode: (active: boolean) => void;
  changes: SimulatedPosition[];
  addChange: (change: SimulatedPosition) => void;
  removeChange: (ticker: string) => void;
  updateChange: (ticker: string, updates: Partial<SimulatedPosition>) => void;
  clearChanges: () => void;
  simulationResult: SimulationResult | null;
  setSimulationResult: (result: SimulationResult | null) => void;
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
  savedScenarios: SavedScenario[];
  saveScenario: (name: string) => void;
  loadScenario: (id: string) => void;
  deleteScenario: (id: string) => void;
}

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set, get) => ({
      isSimulationMode: false,
      setSimulationMode: (active) => set({ isSimulationMode: active }),
      changes: [],
      addChange: (change) => set((state) => {
        const existing = state.changes.find(c => c.ticker === change.ticker);
        if (existing) {
          return {
            changes: state.changes.map(c =>
              c.ticker === change.ticker ? { ...c, ...change } : c
            )
          };
        }
        return { changes: [...state.changes, change] };
      }),
      removeChange: (ticker) => set((state) => ({
        changes: state.changes.filter(c => c.ticker !== ticker)
      })),
      updateChange: (ticker, updates) => set((state) => ({
        changes: state.changes.map(c =>
          c.ticker === ticker ? { ...c, ...updates } : c
        )
      })),
      clearChanges: () => set({ changes: [], simulationResult: null }),
      simulationResult: null,
      setSimulationResult: (result) => set({ simulationResult: result }),
      isRunning: false,
      setIsRunning: (running) => set({ isRunning: running }),
      savedScenarios: [],
      saveScenario: (name) => {
        const { changes } = get();
        set((state) => ({
          savedScenarios: [
            ...state.savedScenarios,
            { id: crypto.randomUUID(), name, changes: [...changes], createdAt: new Date() }
          ]
        }));
      },
      loadScenario: (id) => {
        const { savedScenarios } = get();
        const scenario = savedScenarios.find(s => s.id === id);
        if (scenario) {
          set({ changes: [...scenario.changes], isSimulationMode: true, simulationResult: null });
        }
      },
      deleteScenario: (id) => set((state) => ({
        savedScenarios: state.savedScenarios.filter(s => s.id !== id)
      })),
    }),
    {
      name: 'quantvault-simulation',
      partialize: (state) => ({ savedScenarios: state.savedScenarios }),
    }
  )
);

// ============================================
// FILTER STATE STORE
// ============================================

interface FilterState {
  portfolioFilters: {
    search: string;
    sortBy: 'name' | 'value' | 'change' | 'weight';
    sortOrder: 'asc' | 'desc';
    assetTypes: string[];
    sectors: string[];
  };
  setPortfolioFilter: <K extends keyof FilterState['portfolioFilters']>(
    key: K,
    value: FilterState['portfolioFilters'][K]
  ) => void;
  resetPortfolioFilters: () => void;
  chartSettings: {
    period: '1M' | '3M' | '6M' | '1Y' | 'ALL';
    showBenchmark: boolean;
    chartType: 'area' | 'line' | 'candle';
  };
  setChartSetting: <K extends keyof FilterState['chartSettings']>(
    key: K,
    value: FilterState['chartSettings'][K]
  ) => void;
}

const defaultPortfolioFilters = {
  search: '',
  sortBy: 'value' as const,
  sortOrder: 'desc' as const,
  assetTypes: [] as string[],
  sectors: [] as string[],
};

const defaultChartSettings = {
  period: '1Y' as const,
  showBenchmark: true,
  chartType: 'area' as const,
};

export const useFilterStore = create<FilterState>()((set) => ({
  portfolioFilters: defaultPortfolioFilters,
  setPortfolioFilter: (key, value) => set((state) => ({
    portfolioFilters: { ...state.portfolioFilters, [key]: value }
  })),
  resetPortfolioFilters: () => set({ portfolioFilters: defaultPortfolioFilters }),
  chartSettings: defaultChartSettings,
  setChartSetting: (key, value) => set((state) => ({
    chartSettings: { ...state.chartSettings, [key]: value }
  })),
}));
