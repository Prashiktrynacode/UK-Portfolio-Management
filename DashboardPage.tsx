// Enhanced Dashboard Page
// apps/web/app/(dashboard)/page.tsx

'use client';

import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Activity, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, Bell, RefreshCw, ChevronDown
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useActivePortfolio, usePortfolioHistory } from '@/hooks/use-portfolio';
import { useFilterStore } from '@/stores';

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function DashboardPage() {
  const { dashboard, portfolios, portfolioId, setActivePortfolioId, isLoading } = useActivePortfolio();
  const { chartSettings, setChartSetting } = useFilterStore();
  const { data: historyData } = usePortfolioHistory(portfolioId, chartSettings.period);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Portfolio Selected</h2>
          <p className="text-muted-foreground">Create a portfolio to get started.</p>
        </div>
      </div>
    );
  }

  const { kpis, charts, recentActivity } = dashboard;

  return (
    <motion.div 
      className="space-y-6 pb-10"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Portfolio Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={portfolioId || ''}
            onChange={(e) => setActivePortfolioId(e.target.value)}
            className="bg-card border border-border rounded-lg px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
          >
            {portfolios?.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground px-2 py-1 bg-accent rounded-full">
            {dashboard.portfolio.accountType}
          </span>
        </div>
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="size-4" />
          Refresh
        </button>
      </div>

      {/* KPI Ribbon */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
        variants={staggerContainer}
      >
        <KpiCard 
          title="Total Portfolio Value" 
          value={kpis.totalValue.formatted}
          change={kpis.unrealizedPL.formattedPercent}
          trend={kpis.unrealizedPL.percent >= 0 ? 'up' : 'down'} 
          icon={DollarSign}
        />
        <KpiCard 
          title="Sharpe Ratio" 
          value={kpis.sharpeRatio.formatted}
          change={kpis.sharpeRatio.rating}
          trend="neutral" 
          icon={Activity}
          subtitle={`${kpis.sharpeRatio.rating}`}
        />
        <KpiCard 
          title="Max Drawdown" 
          value={kpis.maxDrawdown.formatted}
          change="Last 1Y" 
          trend="neutral" 
          icon={TrendingDown}
          color="text-destructive"
        />
        <KpiCard 
          title="Portfolio Beta" 
          value={kpis.beta.formatted}
          change={kpis.beta.interpretation}
          trend="neutral" 
          icon={TrendingUp}
        />
        <KpiCard 
          title="Cash Available" 
          value={kpis.cashAvailable.formatted}
          change={`${kpis.cashAvailable.percent}% alloc`}
          trend="neutral" 
          icon={DollarSign}
        />
      </motion.div>

      {/* Main Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm"
          variants={fadeInUp}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold">Portfolio Growth</h3>
              <p className="text-sm text-muted-foreground">
                Comparative performance vs S&P 500
              </p>
            </div>
            <div className="flex gap-2">
              <select 
                value={chartSettings.period}
                onChange={(e) => setChartSetting('period', e.target.value as any)}
                className="bg-input/50 border border-input rounded-md text-sm px-2 py-1 outline-none"
              >
                <option value="1M">1M</option>
                <option value="3M">3M</option>
                <option value="6M">6M</option>
                <option value="1Y">1Y</option>
                <option value="ALL">ALL</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={chartSettings.showBenchmark}
                  onChange={(e) => setChartSetting('showBenchmark', e.target.checked)}
                  className="rounded"
                />
                Benchmark
              </label>
            </div>
          </div>
          
          <PerformanceChart 
            data={charts.performance || []}
            showBenchmark={chartSettings.showBenchmark}
          />
        </motion.div>

        {/* Recent Activity Feed */}
        <motion.div 
          className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col"
          variants={fadeInUp}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Activity</h3>
            <button className="text-primary text-sm hover:underline">View All</button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3">
            {recentActivity.map((item) => (
              <ActivityItem key={item.id} item={item} />
            ))}
            
            {recentActivity.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No recent activity
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Allocation Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div 
          className="bg-card border border-border rounded-xl p-6 shadow-sm"
          variants={fadeInUp}
        >
          <h3 className="text-lg font-semibold mb-4">Sector Exposure</h3>
          <AllocationChart data={charts.sectorAllocation} />
        </motion.div>

        <motion.div 
          className="bg-card border border-border rounded-xl p-6 shadow-sm"
          variants={fadeInUp}
        >
          <h3 className="text-lg font-semibold mb-4">Asset Class</h3>
          <AllocationChart data={charts.assetAllocation} />
        </motion.div>

        <motion.div 
          className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col"
          variants={fadeInUp}
        >
          <h3 className="text-lg font-semibold mb-4">Alerts</h3>
          <div className="flex-1 space-y-3">
            <AlertCard 
              type="warning"
              title="Portfolio imbalance detected"
              message="Tech sector exceeds 40% allocation target."
            />
            <AlertCard 
              type="info"
              title="Dividend incoming"
              message="AAPL dividend of $0.24/share on Jan 15"
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface KpiCardProps {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  subtitle?: string;
  color?: string;
}

function KpiCard({ title, value, change, trend, icon: Icon, subtitle, color }: KpiCardProps) {
  return (
    <motion.div 
      className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
      variants={fadeInUp}
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm text-muted-foreground font-medium">{title}</span>
        <Icon className={cn("size-4 text-muted-foreground", color)} />
      </div>
      <div className="space-y-1">
        <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-xs font-medium px-1.5 py-0.5 rounded",
            trend === 'up' ? "bg-emerald-500/10 text-emerald-500" :
            trend === 'down' ? "bg-red-500/10 text-red-500" :
            "bg-slate-500/10 text-slate-400"
          )}>
            {change}
          </span>
          {subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
        </div>
      </div>
    </motion.div>
  );
}

interface PerformanceChartProps {
  data: { date: string; value: number; benchmark?: number }[];
  showBenchmark: boolean;
}

function PerformanceChart({ data, showBenchmark }: PerformanceChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorBenchmark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
          <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
            itemStyle={{ color: '#f8fafc' }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke="#10b981" 
            strokeWidth={2} 
            fillOpacity={1} 
            fill="url(#colorValue)"
            name="Portfolio"
          />
          {showBenchmark && (
            <Area 
              type="monotone" 
              dataKey="benchmark" 
              stroke="#3b82f6" 
              strokeWidth={2} 
              strokeDasharray="4 4" 
              fillOpacity={1} 
              fill="url(#colorBenchmark)"
              name="S&P 500"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface AllocationChartProps {
  data: { name: string; value: number; weight: number; color: string }[];
}

function AllocationChart({ data }: AllocationChartProps) {
  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="weight"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
            itemStyle={{ color: '#f8fafc' }}
            formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
          />
          <Legend iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ActivityItemProps {
  item: {
    id: string;
    type: string;
    ticker: string;
    name: string;
    quantity: number;
    totalAmount: number;
    timeAgo: string;
  };
}

function ActivityItem({ item }: ActivityItemProps) {
  const typeConfig = {
    BUY: { icon: ArrowDownRight, color: 'bg-emerald-500/20 text-emerald-500' },
    SELL: { icon: ArrowUpRight, color: 'bg-blue-500/20 text-blue-500' },
    DIVIDEND: { icon: DollarSign, color: 'bg-amber-500/20 text-amber-500' },
  };
  
  const config = typeConfig[item.type as keyof typeof typeConfig] || typeConfig.BUY;
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors border border-transparent hover:border-border">
      <div className="flex items-center gap-3">
        <div className={cn("size-8 rounded-full flex items-center justify-center", config.color)}>
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{item.type} {item.ticker}</p>
          <p className="text-xs text-muted-foreground">{item.timeAgo}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">
          {item.quantity} Shares
        </p>
        <p className="text-xs text-muted-foreground">
          ${item.totalAmount.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

interface AlertCardProps {
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  message: string;
}

function AlertCard({ type, title, message }: AlertCardProps) {
  const typeConfig = {
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-500', icon: AlertTriangle },
    error: { bg: 'bg-destructive/10', border: 'border-destructive/20', text: 'text-destructive', icon: AlertTriangle },
    info: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-500', icon: Bell },
    success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-500', icon: TrendingUp },
  };
  
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div className={cn("p-3 rounded-lg flex items-start gap-3 border", config.bg, config.border)}>
      <Icon className={cn("size-4 shrink-0 mt-0.5", config.text)} />
      <div>
        <p className={cn("text-xs font-medium", config.text)}>{title}</p>
        <p className={cn("text-[10px]", config.text, "opacity-80")}>{message}</p>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-10 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 h-96" />
        <div className="bg-card border border-border rounded-xl p-6 h-96" />
      </div>
    </div>
  );
}
