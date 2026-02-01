'use client';

import { LineChart, TrendingUp, Activity, Target } from 'lucide-react';

export default function AnalysisPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analysis</h1>
        <p className="text-muted-foreground">What-if scenarios and portfolio optimization</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 bg-card border border-border rounded-xl">
          <TrendingUp className="size-8 text-primary mb-3" />
          <h3 className="font-semibold mb-1">Performance Analysis</h3>
          <p className="text-sm text-muted-foreground">Track returns, Sharpe ratio, and compare to benchmarks</p>
        </div>
        <div className="p-6 bg-card border border-border rounded-xl">
          <Activity className="size-8 text-primary mb-3" />
          <h3 className="font-semibold mb-1">Risk Metrics</h3>
          <p className="text-sm text-muted-foreground">Analyze volatility, beta, and maximum drawdown</p>
        </div>
        <div className="p-6 bg-card border border-border rounded-xl">
          <Target className="size-8 text-primary mb-3" />
          <h3 className="font-semibold mb-1">What-If Scenarios</h3>
          <p className="text-sm text-muted-foreground">Simulate changes before making trades</p>
        </div>
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
