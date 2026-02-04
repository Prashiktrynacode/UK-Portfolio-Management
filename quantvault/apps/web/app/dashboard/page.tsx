'use client';

import { useState, useEffect } from 'react';
import { Plus, Briefcase, TrendingUp, TrendingDown, DollarSign, PieChart, RefreshCw, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { usePortfolio } from './layout';
import { api, PositionWithMeta } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { selectedPortfolio, portfolios, isLoading: portfolioLoading, openCreateModal } = usePortfolio();
  const [positions, setPositions] = useState<PositionWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPositions = async () => {
    if (!selectedPortfolio) return;

    setIsLoading(true);
    try {
      const data = await api.positions.list(selectedPortfolio.id);
      setPositions(data);
    } catch (error: any) {
      console.error('Failed to fetch positions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!selectedPortfolio) return;

    setIsRefreshing(true);
    try {
      await api.market.refreshPortfolio(selectedPortfolio.id);
      await fetchPositions();
      toast.success('Portfolio refreshed!');
    } catch (error: any) {
      console.error('Refresh error:', error);
      toast.error(error.message || 'Failed to refresh prices');
      // Still fetch positions even if refresh fails
      await fetchPositions();
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedPortfolio) {
      fetchPositions();
    }
  }, [selectedPortfolio?.id]);

  // Show loading state
  if (portfolioLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show welcome screen if no portfolios
  if (portfolios.length === 0) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center h-[60vh] text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <Briefcase className="size-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Welcome to QuantVault!</h1>
        <p className="text-muted-foreground mb-8 max-w-md">
          Get started by creating your first portfolio to track your investments,
          analyze performance, and optimize your strategy.
        </p>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-5" />
          Create Your First Portfolio
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 max-w-2xl">
          <FeatureCard icon={TrendingUp} title="Track Performance" description="Real-time portfolio tracking" />
          <FeatureCard icon={PieChart} title="Asset Allocation" description="Visualize your holdings" />
          <FeatureCard icon={DollarSign} title="Tax Optimization" description="FIFO lot tracking" />
        </div>
      </motion.div>
    );
  }

  // Loading positions
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show empty state if no positions
  if (positions.length === 0) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center h-[60vh] text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <PieChart className="size-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Your Portfolio is Empty</h1>
        <p className="text-muted-foreground mb-8 max-w-md">
          Add your first position to start tracking your investments and see your portfolio performance.
        </p>
        <a
          href="/dashboard/portfolio"
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-5" />
          Add Your First Position
        </a>
      </motion.div>
    );
  }

  // Calculate totals
  const totalValue = positions.reduce((sum, p) => sum + (Number(p.marketValue) || 0), 0);
  const totalCost = positions.reduce((sum, p) => sum + (Number(p.quantity) * Number(p.avgCostBasis)), 0);
  const totalPL = totalValue - totalCost;
  const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  const totalDayChange = positions.reduce((sum, p) => sum + (Number(p.quantity) * (Number(p.dayChange) || 0)), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{selectedPortfolio?.name || 'Dashboard'}</h1>
          <p className="text-muted-foreground">Portfolio overview and performance</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Value"
          value={`$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <KPICard
          label="Total P&L"
          value={`${totalPL >= 0 ? '+' : ''}$${Math.abs(totalPL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subValue={`${totalPLPercent >= 0 ? '+' : ''}${totalPLPercent.toFixed(2)}%`}
          isPositive={totalPL >= 0}
        />
        <KPICard
          label="Day Change"
          value={`${totalDayChange >= 0 ? '+' : ''}$${Math.abs(totalDayChange).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          isPositive={totalDayChange >= 0}
        />
        <KPICard
          label="Positions"
          value={positions.length.toString()}
        />
      </div>

      {/* Holdings Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold">Holdings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/30">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Symbol</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Shares</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Price</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Value</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">P&L</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {positions.map((position) => {
                const pl = Number(position.unrealizedPL) || 0;
                const plPercent = Number(position.unrealizedPLPercent) || 0;
                const dayChange = Number(position.dayChangePercent) || 0;
                const isPositive = pl >= 0;
                const isDayPositive = dayChange >= 0;

                return (
                  <tr key={position.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-semibold">{position.ticker}</div>
                        <div className="text-sm text-muted-foreground">{position.name || position.assetType}</div>
                      </div>
                    </td>
                    <td className="text-right px-4 py-4 font-mono">
                      {Number(position.quantity).toFixed(2)}
                    </td>
                    <td className="text-right px-4 py-4 font-mono">
                      ${position.currentPrice ? Number(position.currentPrice).toFixed(2) : '-'}
                    </td>
                    <td className="text-right px-4 py-4 font-mono">
                      ${position.marketValue ? Number(position.marketValue).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className={cn("text-right px-4 py-4 font-mono", isPositive ? "text-green-500" : "text-red-500")}>
                      <div className="flex items-center justify-end gap-1">
                        {isPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                        <span>${Math.abs(pl).toFixed(2)}</span>
                      </div>
                      <div className="text-xs">({isPositive ? '+' : ''}{plPercent.toFixed(1)}%)</div>
                    </td>
                    <td className={cn("text-right px-4 py-4 font-mono text-sm", isDayPositive ? "text-green-500" : "text-red-500")}>
                      {isDayPositive ? '+' : ''}{dayChange.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="p-4 bg-card border border-border rounded-xl text-left">
      <Icon className="size-6 text-primary mb-2" />
      <h3 className="font-medium text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
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
