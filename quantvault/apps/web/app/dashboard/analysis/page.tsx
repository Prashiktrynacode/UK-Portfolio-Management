'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  PieChart,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { usePortfolio } from '../layout';
import { api, RiskAnalysis, AllocationBreakdown, PositionWithMeta } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export default function AnalysisPage() {
  const { selectedPortfolio, isLoading: portfolioLoading, openCreateModal } = usePortfolio();
  const [positions, setPositions] = useState<PositionWithMeta[]>([]);
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysis | null>(null);
  const [allocation, setAllocation] = useState<AllocationBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    if (!selectedPortfolio) return;

    setIsLoading(true);
    try {
      // Fetch positions first
      const positionsData = await api.positions.list(selectedPortfolio.id);
      setPositions(positionsData);

      // Only fetch analysis if there are positions
      if (positionsData.length > 0) {
        try {
          const [riskData, allocationData] = await Promise.all([
            api.analysis.getRiskAnalysis(selectedPortfolio.id).catch(() => null),
            api.analysis.getBreakdown(selectedPortfolio.id).catch(() => null),
          ]);
          setRiskAnalysis(riskData);
          setAllocation(allocationData);
        } catch (err) {
          console.error('Analysis fetch error:', err);
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshMarketData = async () => {
    if (!selectedPortfolio) return;

    setIsRefreshing(true);
    try {
      await api.market.refreshPortfolio(selectedPortfolio.id);
      toast.success('Market data refreshed!');
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh market data');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedPortfolio) {
      fetchData();
    }
  }, [selectedPortfolio?.id]);

  if (portfolioLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!selectedPortfolio) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <LineChart className="size-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No Portfolio Selected</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          Create a portfolio first to access analysis tools.
        </p>
        <button
          onClick={openCreateModal}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
        >
          Create Portfolio
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Analysis</h1>
          <p className="text-muted-foreground">What-if scenarios and portfolio optimization</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            icon={TrendingUp}
            title="Performance Analysis"
            description="Track returns, Sharpe ratio, and compare to benchmarks"
          />
          <FeatureCard
            icon={Activity}
            title="Risk Metrics"
            description="Analyze volatility, beta, and maximum drawdown"
          />
          <FeatureCard
            icon={Target}
            title="What-If Scenarios"
            description="Simulate changes before making trades"
          />
        </div>

        <div className="flex flex-col items-center justify-center h-[40vh] text-center">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <LineChart className="size-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Add Positions to Analyze</h2>
          <p className="text-muted-foreground max-w-md">
            Add positions to your portfolio to unlock powerful analysis tools and what-if scenarios.
          </p>
        </div>
      </div>
    );
  }

  // Calculate portfolio metrics from positions
  const totalValue = positions.reduce((sum, p) => sum + (Number(p.marketValue) || 0), 0);
  const totalCost = positions.reduce((sum, p) => sum + (Number(p.quantity) * Number(p.avgCostBasis)), 0);
  const totalPL = totalValue - totalCost;
  const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  const totalDayChange = positions.reduce((sum, p) => sum + (Number(p.quantity) * (Number(p.dayChange) || 0)), 0);

  // Group by sector for allocation
  const sectorAllocation = positions.reduce((acc, p) => {
    const sector = p.sector || 'Unknown';
    if (!acc[sector]) {
      acc[sector] = 0;
    }
    acc[sector] += Number(p.marketValue) || 0;
    return acc;
  }, {} as Record<string, number>);

  const sectorData = Object.entries(sectorAllocation)
    .map(([name, value]) => ({
      name,
      value,
      percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analysis</h1>
          <p className="text-muted-foreground">Portfolio metrics and insights for {selectedPortfolio.name}</p>
        </div>
        <button
          onClick={handleRefreshMarketData}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
          Refresh Prices
        </button>
      </div>

      {/* Portfolio Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Total Value"
          value={`$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
        />
        <KPICard
          label="Total P&L"
          value={`${totalPL >= 0 ? '+' : ''}$${totalPL.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subValue={`${totalPLPercent >= 0 ? '+' : ''}${totalPLPercent.toFixed(2)}%`}
          isPositive={totalPL >= 0}
        />
        <KPICard
          label="Day Change"
          value={`${totalDayChange >= 0 ? '+' : ''}$${totalDayChange.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          isPositive={totalDayChange >= 0}
        />
        <KPICard
          label="Positions"
          value={positions.length.toString()}
        />
      </div>

      {/* Top Holdings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Holdings Table */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Top Holdings</h3>
          <div className="space-y-3">
            {positions.slice(0, 5).map((position) => {
              const weight = totalValue > 0 ? (Number(position.marketValue) / totalValue) * 100 : 0;
              const pl = Number(position.unrealizedPL) || 0;
              const isPositive = pl >= 0;

              return (
                <div key={position.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {position.ticker.slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{position.ticker}</div>
                      <div className="text-xs text-muted-foreground">{weight.toFixed(1)}% of portfolio</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-sm">
                      ${Number(position.marketValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div className={cn(
                      "text-xs flex items-center justify-end gap-1",
                      isPositive ? "text-green-500" : "text-red-500"
                    )}>
                      {isPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                      {isPositive ? '+' : ''}{pl.toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sector Allocation */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Sector Allocation</h3>
          <div className="space-y-3">
            {sectorData.slice(0, 6).map((sector, i) => (
              <div key={sector.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{sector.name}</span>
                  <span className="font-medium">{sector.percent.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${sector.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Winners and Losers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Winners */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="size-5 text-green-500" />
            <h3 className="font-semibold">Top Winners</h3>
          </div>
          <div className="space-y-2">
            {positions
              .filter(p => (Number(p.unrealizedPL) || 0) > 0)
              .sort((a, b) => (Number(b.unrealizedPL) || 0) - (Number(a.unrealizedPL) || 0))
              .slice(0, 3)
              .map((position) => (
                <div key={position.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <span className="font-medium">{position.ticker}</span>
                  <span className="text-green-500 font-medium">
                    +${Number(position.unrealizedPL).toFixed(2)} (+{Number(position.unrealizedPLPercent).toFixed(1)}%)
                  </span>
                </div>
              ))}
            {positions.filter(p => (Number(p.unrealizedPL) || 0) > 0).length === 0 && (
              <p className="text-sm text-muted-foreground">No winning positions yet</p>
            )}
          </div>
        </div>

        {/* Top Losers */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="size-5 text-red-500" />
            <h3 className="font-semibold">Top Losers</h3>
          </div>
          <div className="space-y-2">
            {positions
              .filter(p => (Number(p.unrealizedPL) || 0) < 0)
              .sort((a, b) => (Number(a.unrealizedPL) || 0) - (Number(b.unrealizedPL) || 0))
              .slice(0, 3)
              .map((position) => (
                <div key={position.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <span className="font-medium">{position.ticker}</span>
                  <span className="text-red-500 font-medium">
                    ${Number(position.unrealizedPL).toFixed(2)} ({Number(position.unrealizedPLPercent).toFixed(1)}%)
                  </span>
                </div>
              ))}
            {positions.filter(p => (Number(p.unrealizedPL) || 0) < 0).length === 0 && (
              <p className="text-sm text-muted-foreground">No losing positions</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-card border border-border rounded-xl">
      <Icon className="size-8 text-primary mb-3" />
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function KPICard({
  label,
  value,
  subValue,
  isPositive
}: {
  label: string;
  value: string;
  subValue?: string;
  isPositive?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      <div className={cn(
        "text-xl font-bold",
        isPositive !== undefined && (isPositive ? "text-green-500" : "text-red-500")
      )}>
        {value}
      </div>
      {subValue && (
        <div className={cn(
          "text-sm",
          isPositive !== undefined && (isPositive ? "text-green-500" : "text-red-500")
        )}>
          {subValue}
        </div>
      )}
    </div>
  );
}
