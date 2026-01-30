// Analysis Page - What-If Scenario Builder
// apps/web/components/analysis/AnalysisPage.tsx

'use client';

import React, { useState, useMemo } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { 
  Search, Plus, X, RotateCcw, TrendingUp, TrendingDown, 
  Activity, Save, Download, Play, Loader2, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSimulation, useCorrelationMatrix } from '@/hooks/use-analysis';
import { useActivePortfolio } from '@/hooks/use-portfolio';

export default function AnalysisPage() {
  const { portfolioId, positions } = useActivePortfolio();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

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
    executeSimulation,
    correlation,
    savedScenarios,
    saveScenario,
    loadScenario,
  } = useSimulation(portfolioId);

  // Current positions with any simulated changes applied
  const displayPositions = useMemo(() => {
    if (!positions) return [];
    
    const positionMap = new Map(positions.map(p => [p.ticker, { ...p, simChange: null }]));
    
    // Apply changes
    changes.forEach(change => {
      if (positionMap.has(change.ticker)) {
        const existing = positionMap.get(change.ticker)!;
        if (change.action === 'adjust') {
          existing.simChange = change.quantity - Number(existing.quantity);
        } else if (change.action === 'remove') {
          existing.simChange = -Number(existing.quantity);
        }
      } else if (change.action === 'add') {
        positionMap.set(change.ticker, {
          ticker: change.ticker,
          quantity: change.quantity,
          currentPrice: change.price,
          simChange: change.quantity,
          isNew: true,
        } as any);
      }
    });

    return Array.from(positionMap.values());
  }, [positions, changes]);

  const handleAddTicker = (ticker: string, price = 100) => {
    const existingPosition = positions?.find(p => p.ticker === ticker.toUpperCase());
    
    addChange({
      ticker: ticker.toUpperCase(),
      quantity: 10,
      price: existingPosition?.currentPrice || price,
      action: existingPosition ? 'adjust' : 'add',
      isNew: !existingPosition,
    });
    setSearchQuery('');
  };

  const handleRunSimulation = async () => {
    if (!portfolioId || changes.length === 0) return;
    await executeSimulation();
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      {/* Left Sidebar - Scenario Builder */}
      <div className="w-80 flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden shrink-0">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold mb-1">Scenario Builder</h2>
          <p className="text-xs text-muted-foreground">
            Adjust holdings to simulate outcomes.
          </p>
        </div>
        
        {/* Search & Actions */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  handleAddTicker(searchQuery.trim());
                }
              }}
              placeholder="Add ticker (e.g., AAPL)..." 
              className="w-full bg-input/50 border border-input rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" 
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={clearChanges}
              className="flex-1 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium py-1.5 rounded transition-colors flex items-center justify-center gap-1"
            >
              <RotateCcw className="size-3" /> Reset
            </button>
            <button 
              onClick={() => setShowSaveModal(true)}
              className="flex-1 bg-accent hover:bg-accent/80 text-accent-foreground text-xs font-medium py-1.5 rounded transition-colors"
            >
              Save Scenario
            </button>
          </div>
        </div>

        {/* Saved Scenarios */}
        {savedScenarios.length > 0 && (
          <div className="p-2 border-b border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 mb-2">Saved Scenarios</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {savedScenarios.slice(0, 3).map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => loadScenario(scenario.id)}
                  className="w-full text-left p-2 text-xs rounded hover:bg-accent/50 transition-colors truncate"
                >
                  {scenario.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Positions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <AnimatePresence>
            {displayPositions.map((position: any) => (
              <motion.div
                key={position.ticker}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 group",
                  position.isNew && "ring-1 ring-primary/50 bg-primary/5"
                )}
              >
                <div className={cn(
                  "size-8 rounded flex items-center justify-center font-bold text-xs",
                  position.isNew ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"
                )}>
                  {position.ticker[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between">
                    <span className="font-medium text-sm">{position.ticker}</span>
                    <span className="text-xs text-muted-foreground">
                      ${position.currentPrice?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input 
                      type="number" 
                      value={
                        changes.find(c => c.ticker === position.ticker)?.quantity 
                        || position.quantity
                      }
                      onChange={(e) => {
                        const newQty = parseInt(e.target.value) || 0;
                        updateChange(position.ticker, { quantity: newQty });
                      }}
                      onFocus={() => {
                        if (!changes.find(c => c.ticker === position.ticker)) {
                          addChange({
                            ticker: position.ticker,
                            quantity: Number(position.quantity),
                            price: Number(position.currentPrice || position.avgCostBasis),
                            action: 'adjust',
                          });
                        }
                      }}
                      className="w-16 bg-input border border-border rounded px-1 text-xs py-0.5 text-right" 
                    />
                    <span className="text-[10px] text-muted-foreground">shares</span>
                    {position.simChange !== null && position.simChange !== 0 && (
                      <span className={cn(
                        "text-[10px] font-medium",
                        position.simChange > 0 ? "text-emerald-500" : "text-red-500"
                      )}>
                        {position.simChange > 0 ? '+' : ''}{position.simChange}
                      </span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => removeChange(position.ticker)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                >
                  <X className="size-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Run Button */}
        <div className="p-4 border-t border-border bg-muted/20">
          <button 
            onClick={handleRunSimulation}
            disabled={isRunning || changes.length === 0}
            className={cn(
              "w-full py-2 rounded-lg font-medium transition-colors shadow-lg flex items-center justify-center gap-2",
              changes.length === 0 
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
            )}
          >
            {isRunning ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="size-4" />
                Run Simulation
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Stage */}
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2">
        
        {/* Delta Comparison */}
        <motion.div 
          className="bg-card border border-border rounded-xl p-6 shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Projected Performance Impact</h3>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary px-3 py-1.5 rounded-lg transition-colors">
                <Save className="size-3.5" /> Save Scenario
              </button>
              <button className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary px-3 py-1.5 rounded-lg transition-colors">
                <Download className="size-3.5" /> Report
              </button>
            </div>
          </div>

          {simulationResult ? (
            <div className="grid grid-cols-4 gap-4">
              <DeltaMetric 
                label="Exp. Return" 
                current={`${(simulationResult.expectedReturn.current * 100).toFixed(1)}%`}
                simulated={`${(simulationResult.expectedReturn.simulated * 100).toFixed(1)}%`}
                delta={`${simulationResult.expectedReturn.delta >= 0 ? '+' : ''}${(simulationResult.expectedReturn.delta * 100).toFixed(2)}%`}
                trend={simulationResult.expectedReturn.delta >= 0 ? 'up' : 'down'}
              />
              <DeltaMetric 
                label="Risk (Std Dev)" 
                current={`${(simulationResult.risk.current * 100).toFixed(1)}%`}
                simulated={`${(simulationResult.risk.simulated * 100).toFixed(1)}%`}
                delta={`${simulationResult.risk.delta >= 0 ? '+' : ''}${(simulationResult.risk.delta * 100).toFixed(2)}%`}
                trend={simulationResult.risk.delta >= 0 ? 'up' : 'down'}
                good={simulationResult.risk.delta < 0}
              />
              <DeltaMetric 
                label="Sharpe" 
                current={simulationResult.sharpe.current.toFixed(2)}
                simulated={simulationResult.sharpe.simulated.toFixed(2)}
                delta={`${simulationResult.sharpe.delta >= 0 ? '+' : ''}${simulationResult.sharpe.delta.toFixed(2)}`}
                trend={simulationResult.sharpe.delta >= 0 ? 'up' : 'down'}
              />
              <DeltaMetric 
                label="Max Drawdown" 
                current={`${(simulationResult.maxDrawdown.current * 100).toFixed(1)}%`}
                simulated={`${(simulationResult.maxDrawdown.simulated * 100).toFixed(1)}%`}
                delta={`${simulationResult.maxDrawdown.delta >= 0 ? '+' : ''}${(simulationResult.maxDrawdown.delta * 100).toFixed(2)}%`}
                trend={simulationResult.maxDrawdown.delta >= 0 ? 'up' : 'down'}
                good={simulationResult.maxDrawdown.delta < 0}
              />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {['Exp. Return', 'Risk (Std Dev)', 'Sharpe', 'Max Drawdown'].map((label) => (
                <div key={label} className="bg-background/50 rounded-lg p-4 border border-border">
                  <span className="text-xs text-muted-foreground block mb-2">{label}</span>
                  <div className="text-2xl font-bold text-muted-foreground/30">--</div>
                  <p className="text-xs text-muted-foreground mt-2">Run simulation to see results</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-96">
          {/* Efficient Frontier */}
          <motion.div 
            className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-sm font-semibold mb-4">Efficient Frontier</h3>
            <div className="flex-1 w-full min-h-0">
              <EfficientFrontierChart />
            </div>
          </motion.div>

          {/* Correlation Heatmap */}
          <motion.div 
            className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-sm font-semibold mb-4">Correlation Matrix</h3>
            <CorrelationHeatmap 
              tickers={displayPositions.slice(0, 6).map((p: any) => p.ticker)}
              matrix={correlation?.matrix}
            />
          </motion.div>
        </div>
        
        {/* AI Recommendations */}
        <motion.div 
          className="bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 rounded-xl p-4 flex items-start gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="p-2 bg-primary/20 rounded-lg text-primary mt-1">
            <Sparkles className="size-5" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-primary mb-1">Optimization Suggestion</h4>
            <p className="text-sm text-muted-foreground">
              {simulationResult 
                ? `Based on your simulation, ${simulationResult.sharpe.delta >= 0 ? 'these changes would improve' : 'consider adjusting the allocation to improve'} your risk-adjusted returns.`
                : 'Add tickers and run a simulation to receive AI-powered optimization suggestions for your portfolio.'
              }
            </p>
          </div>
          {simulationResult && (
            <button className="ml-auto bg-primary text-primary-foreground text-xs font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
              Apply Changes
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface DeltaMetricProps {
  label: string;
  current: string;
  simulated: string;
  delta: string;
  trend: 'up' | 'down';
  good?: boolean;
}

function DeltaMetric({ label, current, simulated, delta, trend, good }: DeltaMetricProps) {
  const isPositive = delta.includes('+');
  const isGood = good !== undefined ? good : isPositive;

  return (
    <div className="bg-background/50 rounded-lg p-4 border border-border">
      <span className="text-xs text-muted-foreground block mb-2">{label}</span>
      <div className="flex items-end gap-3 mb-1">
        <span className="text-2xl font-bold">{simulated}</span>
        <span className="text-sm text-muted-foreground line-through mb-1 opacity-50">{current}</span>
      </div>
      <div className={cn(
        "text-xs font-medium flex items-center gap-1",
        isGood ? "text-emerald-500" : "text-destructive"
      )}>
        {trend === 'up' ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
        {delta}
      </div>
    </div>
  );
}

function EfficientFrontierChart() {
  // Mock data for efficient frontier
  const frontierData = [
    { x: 5, y: 4 }, { x: 8, y: 7 }, { x: 10, y: 8.5 }, 
    { x: 12, y: 9.5 }, { x: 15, y: 10.5 }, { x: 18, y: 11 }
  ];
  const currentPortfolio = [{ x: 12.5, y: 8.2, name: 'Current' }];
  const simulatedPortfolio = [{ x: 11.8, y: 9.4, name: 'Simulated' }];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
        <XAxis 
          type="number" 
          dataKey="x" 
          name="Risk" 
          unit="%" 
          stroke="#94a3b8" 
          fontSize={12} 
          domain={[0, 20]} 
        />
        <YAxis 
          type="number" 
          dataKey="y" 
          name="Return" 
          unit="%" 
          stroke="#94a3b8" 
          fontSize={12} 
          domain={[0, 15]} 
        />
        <Tooltip 
          cursor={{ strokeDasharray: '3 3' }} 
          contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }} 
          itemStyle={{ color: '#f8fafc' }} 
        />
        <Scatter name="Efficient Frontier" data={frontierData} fill="#3b82f6" line />
        <Scatter name="Current Portfolio" data={currentPortfolio} fill="#94a3b8" shape="square" />
        <Scatter name="Simulated" data={simulatedPortfolio} fill="#10b981" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

interface CorrelationHeatmapProps {
  tickers: string[];
  matrix?: number[][];
}

function CorrelationHeatmap({ tickers, matrix }: CorrelationHeatmapProps) {
  // Generate mock matrix if not provided
  const displayMatrix = matrix || tickers.map((_, i) => 
    tickers.map((_, j) => i === j ? 1 : Math.random() * 2 - 1)
  );

  const getColor = (val: number) => {
    if (val > 0.7) return 'bg-red-500';
    if (val > 0.3) return 'bg-red-500/60';
    if (val > -0.3) return 'bg-slate-500/40';
    if (val > -0.7) return 'bg-blue-500/60';
    return 'bg-blue-500';
  };

  if (tickers.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Add positions to see correlation
      </div>
    );
  }

  return (
    <div className="flex-1">
      {/* Column headers */}
      <div className="flex gap-1 mb-1">
        <div className="w-12" /> {/* Spacer for row labels */}
        {tickers.map((ticker) => (
          <div 
            key={ticker} 
            className="flex-1 text-[10px] text-muted-foreground text-center truncate"
          >
            {ticker}
          </div>
        ))}
      </div>
      
      {/* Matrix rows */}
      <div className="space-y-1">
        {tickers.map((rowTicker, i) => (
          <div key={rowTicker} className="flex gap-1 items-center">
            <div className="w-12 text-[10px] text-muted-foreground truncate">
              {rowTicker}
            </div>
            {tickers.map((colTicker, j) => {
              const val = displayMatrix[i]?.[j] || 0;
              return (
                <div
                  key={`${rowTicker}-${colTicker}`}
                  className={cn(
                    "flex-1 aspect-square rounded-sm flex items-center justify-center text-[9px] text-white/80 cursor-default",
                    getColor(val)
                  )}
                  title={`${rowTicker} vs ${colTicker}: ${val.toFixed(2)}`}
                >
                  {val.toFixed(1)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="size-3 bg-blue-500 rounded" />
          <span>Negative</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="size-3 bg-slate-500/40 rounded" />
          <span>Neutral</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="size-3 bg-red-500 rounded" />
          <span>Positive</span>
        </div>
      </div>
    </div>
  );
}
