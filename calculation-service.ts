// Calculation Service - Portfolio Metrics Engine
// apps/api/src/services/calculation-service.ts

import { prisma } from '../server';

interface Position {
  ticker: string;
  quantity: any;
  avgCostBasis: any;
  currentPrice: any;
  marketValue: any;
  sector?: string;
  assetType: string;
}

interface Snapshot {
  date: Date;
  totalValue: any;
  cumulativeReturn: any;
  benchmarkValue: any;
}

interface Portfolio {
  id: string;
  positions: Position[];
  snapshots?: Snapshot[];
}

// Risk-free rate (approximate 3-month Treasury yield)
const RISK_FREE_RATE = 0.05; // 5% annually

export class CalculationService {
  /**
   * Calculate all KPI metrics for dashboard display
   */
  async calculateKPIs(portfolio: Portfolio) {
    const positions = portfolio.positions;
    const snapshots = portfolio.snapshots || [];

    // Total Value
    const totalValue = positions.reduce((sum, p) => {
      return sum + (Number(p.marketValue) || Number(p.quantity) * Number(p.currentPrice || p.avgCostBasis));
    }, 0);

    // Total Cost Basis
    const totalCost = positions.reduce((sum, p) => {
      return sum + (Number(p.quantity) * Number(p.avgCostBasis));
    }, 0);

    // Unrealized P/L
    const unrealizedPL = totalValue - totalCost;
    const unrealizedPLPercent = totalCost > 0 ? (unrealizedPL / totalCost) * 100 : 0;

    // Calculate returns from snapshots
    const returns = this.calculateReturnsFromSnapshots(snapshots);
    
    // Sharpe Ratio
    const sharpeRatio = this.calculateSharpeRatio(returns);

    // Beta (vs benchmark)
    const beta = await this.calculateBeta(portfolio.id, returns);

    // Max Drawdown
    const maxDrawdown = this.calculateMaxDrawdown(snapshots);

    // Cash position
    const cashPosition = positions.find(p => p.assetType === 'CASH');
    const cashAvailable = cashPosition ? Number(cashPosition.marketValue) : 0;

    return {
      totalValue: {
        value: totalValue,
        formatted: this.formatCurrency(totalValue),
      },
      unrealizedPL: {
        value: unrealizedPL,
        percent: unrealizedPLPercent,
        formatted: this.formatCurrency(unrealizedPL),
        formattedPercent: `${unrealizedPLPercent >= 0 ? '+' : ''}${unrealizedPLPercent.toFixed(2)}%`,
      },
      sharpeRatio: {
        value: sharpeRatio,
        formatted: sharpeRatio.toFixed(2),
        rating: this.getSharpeRating(sharpeRatio),
      },
      beta: {
        value: beta,
        formatted: beta.toFixed(2),
        interpretation: this.getBetaInterpretation(beta),
      },
      maxDrawdown: {
        value: maxDrawdown,
        formatted: `${(maxDrawdown * 100).toFixed(1)}%`,
      },
      cashAvailable: {
        value: cashAvailable,
        formatted: this.formatCurrency(cashAvailable),
        percent: totalValue > 0 ? (cashAvailable / totalValue * 100).toFixed(1) : '0.0',
      },
    };
  }

  /**
   * Get performance chart data comparing portfolio vs benchmark
   */
  async getPerformanceChartData(portfolio: Portfolio) {
    const snapshots = portfolio.snapshots || [];
    
    if (snapshots.length === 0) {
      // Return mock data for new portfolios
      return this.generateMockPerformanceData();
    }

    // Normalize to starting value of 100
    const startValue = Number(snapshots[snapshots.length - 1]?.totalValue) || 100;
    const startBenchmark = Number(snapshots[snapshots.length - 1]?.benchmarkValue) || 100;

    return snapshots
      .slice()
      .reverse()
      .map(s => ({
        date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: startValue > 0 ? (Number(s.totalValue) / startValue) * 100 : 100,
        benchmark: startBenchmark > 0 ? (Number(s.benchmarkValue) / startBenchmark) * 100 : 100,
        rawValue: Number(s.totalValue),
        rawBenchmark: Number(s.benchmarkValue),
      }));
  }

  /**
   * Calculate sector and asset type allocations
   */
  calculateAllocations(positions: Position[]) {
    const totalValue = positions.reduce((sum, p) => {
      return sum + (Number(p.marketValue) || Number(p.quantity) * Number(p.currentPrice || p.avgCostBasis));
    }, 0);

    // Sector allocation
    const sectorMap = new Map<string, number>();
    positions.forEach(p => {
      const sector = p.sector || 'Other';
      const value = Number(p.marketValue) || Number(p.quantity) * Number(p.currentPrice || p.avgCostBasis);
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + value);
    });

    const bySector = Array.from(sectorMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        weight: totalValue > 0 ? (value / totalValue) * 100 : 0,
        color: this.getSectorColor(name),
      }))
      .sort((a, b) => b.weight - a.weight);

    // Asset type allocation
    const assetMap = new Map<string, number>();
    positions.forEach(p => {
      const assetType = p.assetType || 'OTHER';
      const value = Number(p.marketValue) || Number(p.quantity) * Number(p.currentPrice || p.avgCostBasis);
      assetMap.set(assetType, (assetMap.get(assetType) || 0) + value);
    });

    const byAssetType = Array.from(assetMap.entries())
      .map(([name, value]) => ({
        name: this.formatAssetType(name),
        value,
        weight: totalValue > 0 ? (value / totalValue) * 100 : 0,
        color: this.getAssetTypeColor(name),
      }))
      .sort((a, b) => b.weight - a.weight);

    return { bySector, byAssetType };
  }

  /**
   * Calculate correlation matrix between tickers
   */
  async calculateCorrelationMatrix(tickers: string[]): Promise<number[][]> {
    // In production, fetch historical prices and calculate actual correlations
    // For now, return simulated correlation matrix
    const n = tickers.length;
    const matrix: number[][] = [];

    for (let i = 0; i < n; i++) {
      matrix[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1; // Perfect correlation with self
        } else if (i < j) {
          // Generate semi-realistic correlation
          // Same sector = higher correlation
          const samePrefix = tickers[i][0] === tickers[j][0];
          const baseCorr = samePrefix ? 0.5 : 0.2;
          matrix[i][j] = baseCorr + (Math.random() * 0.4 - 0.2);
          matrix[i][j] = Math.max(-1, Math.min(1, matrix[i][j]));
        } else {
          matrix[i][j] = matrix[j][i]; // Symmetric
        }
      }
    }

    return matrix;
  }

  /**
   * Calculate portfolio metrics for simulation
   */
  async calculatePortfolioMetrics(portfolio: Portfolio) {
    const positions = portfolio.positions;
    const snapshots = portfolio.snapshots || [];
    const returns = this.calculateReturnsFromSnapshots(snapshots);

    const totalValue = positions.reduce((sum, p) => {
      return sum + (Number(p.marketValue) || Number(p.quantity) * Number(p.currentPrice || p.avgCostBasis));
    }, 0);

    return {
      totalValue,
      expectedReturn: this.calculateExpectedReturn(returns),
      standardDeviation: this.calculateStandardDeviation(returns),
      sharpeRatio: this.calculateSharpeRatio(returns),
      maxDrawdown: this.calculateMaxDrawdown(snapshots),
      beta: await this.calculateBeta(portfolio.id, returns),
    };
  }

  /**
   * Calculate metrics for simulated portfolio changes
   */
  async calculateSimulatedMetrics(simulatedPositions: any[], snapshots: Snapshot[]) {
    // For simulation, we estimate changes based on position modifications
    const totalValue = simulatedPositions.reduce((sum, p) => {
      return sum + (p.marketValue || 0);
    }, 0);

    const returns = this.calculateReturnsFromSnapshots(snapshots);
    
    // Adjust metrics based on new position weights
    const hasNewPositions = simulatedPositions.some(p => p.isNew);
    const hasRemovedPositions = simulatedPositions.some(p => p.isRemoved);

    // Estimate impact - in production, use Monte Carlo simulation
    let expectedReturn = this.calculateExpectedReturn(returns);
    let stdDev = this.calculateStandardDeviation(returns);

    // Diversification effect
    if (hasNewPositions) {
      stdDev *= 0.95; // Reduced volatility from diversification
      expectedReturn *= 1.02; // Slight expected return improvement
    }

    return {
      totalValue,
      expectedReturn,
      standardDeviation: stdDev,
      sharpeRatio: stdDev > 0 ? (expectedReturn - RISK_FREE_RATE) / stdDev : 0,
      maxDrawdown: this.calculateMaxDrawdown(snapshots) * 0.9,
      beta: 1.1, // Estimated
    };
  }

  /**
   * Calculate efficient frontier data points
   */
  calculateEfficientFrontier(positions: any[]) {
    // Generate efficient frontier curve
    // In production, use mean-variance optimization
    const points = [];
    for (let risk = 5; risk <= 20; risk += 2) {
      const expectedReturn = 3 + (risk * 0.5) + (Math.random() * 2 - 1);
      points.push({
        risk,
        return: Math.max(0, expectedReturn),
      });
    }

    // Current portfolio point
    const totalValue = positions.reduce((sum, p) => sum + (p.marketValue || 0), 0);
    const currentRisk = 12 + Math.random() * 3;
    const currentReturn = 8 + Math.random() * 2;

    return {
      frontier: points,
      currentPortfolio: { risk: currentRisk, return: currentReturn },
    };
  }

  /**
   * Perform comprehensive risk analysis
   */
  async performRiskAnalysis(portfolio: Portfolio) {
    const positions = portfolio.positions;
    const snapshots = portfolio.snapshots || [];
    const returns = this.calculateReturnsFromSnapshots(snapshots);

    const volatility = this.calculateStandardDeviation(returns) * Math.sqrt(252); // Annualized
    const beta = await this.calculateBeta(portfolio.id, returns);
    const sharpeRatio = this.calculateSharpeRatio(returns);
    
    // Sortino Ratio (uses downside deviation)
    const downsideReturns = returns.filter(r => r < 0);
    const downsideStdDev = this.calculateStandardDeviation(downsideReturns);
    const sortinoRatio = downsideStdDev > 0 
      ? (this.calculateExpectedReturn(returns) - RISK_FREE_RATE) / downsideStdDev 
      : 0;

    // Value at Risk (95% confidence)
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const varIndex = Math.floor(returns.length * 0.05);
    const valueAtRisk = sortedReturns[varIndex] || 0;

    // Sector concentration
    const allocations = this.calculateAllocations(positions);
    const topSector = allocations.bySector[0];

    // Generate recommendations
    const recommendations = [];
    
    if (beta > 1.3) {
      recommendations.push({
        type: 'risk',
        message: 'High beta indicates elevated market sensitivity. Consider adding defensive positions.',
        action: 'Add VIG or defensive ETFs',
      });
    }

    if (topSector && topSector.weight > 40) {
      recommendations.push({
        type: 'concentration',
        message: `${topSector.name} sector at ${topSector.weight.toFixed(1)}% exceeds recommended 40% limit.`,
        action: `Reduce ${topSector.name} exposure by ${(topSector.weight - 30).toFixed(1)}%`,
      });
    }

    if (sharpeRatio < 1) {
      recommendations.push({
        type: 'efficiency',
        message: 'Risk-adjusted returns below optimal. Consider rebalancing.',
        action: 'Review underperforming positions',
      });
    }

    return {
      volatility,
      beta,
      alpha: (this.calculateExpectedReturn(returns) * 100) - (beta * 10), // Simplified alpha
      sharpeRatio,
      sortinoRatio,
      maxDrawdown: this.calculateMaxDrawdown(snapshots),
      valueAtRisk: {
        percent: valueAtRisk * 100,
        amount: positions.reduce((sum, p) => sum + (Number(p.marketValue) || 0), 0) * Math.abs(valueAtRisk),
      },
      sectorConcentration: allocations.bySector.slice(0, 5),
      recommendations,
    };
  }

  /**
   * Generate optimization suggestions
   */
  async generateOptimizationSuggestions(
    positions: Position[],
    goal: 'sharpe' | 'minRisk' | 'maxReturn'
  ) {
    // Current metrics
    const totalValue = positions.reduce((sum, p) => {
      return sum + (Number(p.marketValue) || Number(p.quantity) * Number(p.currentPrice || p.avgCostBasis));
    }, 0);

    const currentMetrics = {
      sharpeRatio: 1.5 + Math.random() * 0.5,
      expectedReturn: 8 + Math.random() * 4,
      volatility: 12 + Math.random() * 5,
    };

    // Optimized metrics (simulated)
    let optimizedMetrics;
    const recommendations = [];

    switch (goal) {
      case 'sharpe':
        optimizedMetrics = {
          sharpeRatio: currentMetrics.sharpeRatio * 1.15,
          expectedReturn: currentMetrics.expectedReturn * 1.05,
          volatility: currentMetrics.volatility * 0.92,
        };
        recommendations.push({
          ticker: 'VTI',
          action: 'buy',
          shares: 50,
          reason: 'Broad market exposure improves diversification',
          impact: '+0.15 Sharpe',
        });
        break;

      case 'minRisk':
        optimizedMetrics = {
          sharpeRatio: currentMetrics.sharpeRatio * 0.95,
          expectedReturn: currentMetrics.expectedReturn * 0.9,
          volatility: currentMetrics.volatility * 0.75,
        };
        recommendations.push({
          ticker: 'BND',
          action: 'buy',
          shares: 100,
          reason: 'Bond allocation reduces portfolio volatility',
          impact: '-25% volatility',
        });
        break;

      case 'maxReturn':
        optimizedMetrics = {
          sharpeRatio: currentMetrics.sharpeRatio * 0.9,
          expectedReturn: currentMetrics.expectedReturn * 1.25,
          volatility: currentMetrics.volatility * 1.3,
        };
        recommendations.push({
          ticker: 'QQQ',
          action: 'buy',
          shares: 30,
          reason: 'Growth-focused tech exposure',
          impact: '+25% expected return',
        });
        break;
    }

    return {
      currentMetrics,
      optimizedMetrics,
      recommendations,
    };
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private calculateReturnsFromSnapshots(snapshots: Snapshot[]): number[] {
    if (snapshots.length < 2) return [];

    const returns = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prev = Number(snapshots[i].totalValue);
      const curr = Number(snapshots[i - 1].totalValue);
      if (prev > 0) {
        returns.push((curr - prev) / prev);
      }
    }
    return returns;
  }

  private calculateExpectedReturn(returns: number[]): number {
    if (returns.length === 0) return 0.08; // Default 8%
    const sum = returns.reduce((a, b) => a + b, 0);
    return (sum / returns.length) * 252; // Annualized
  }

  private calculateStandardDeviation(returns: number[]): number {
    if (returns.length < 2) return 0.15; // Default 15%
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (returns.length - 1);
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized
  }

  private calculateSharpeRatio(returns: number[]): number {
    const expectedReturn = this.calculateExpectedReturn(returns);
    const stdDev = this.calculateStandardDeviation(returns);
    
    if (stdDev === 0) return 0;
    return (expectedReturn - RISK_FREE_RATE) / stdDev;
  }

  private async calculateBeta(portfolioId: string, returns: number[]): Promise<number> {
    // In production, calculate covariance with benchmark
    // Simplified: assume moderate correlation with market
    if (returns.length < 10) return 1.0;

    // Mock beta calculation
    const marketReturns = returns.map(r => r * 0.9 + (Math.random() * 0.02 - 0.01));
    
    const portfolioMean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const marketMean = marketReturns.reduce((a, b) => a + b, 0) / marketReturns.length;

    let covariance = 0;
    let marketVariance = 0;

    for (let i = 0; i < returns.length; i++) {
      covariance += (returns[i] - portfolioMean) * (marketReturns[i] - marketMean);
      marketVariance += Math.pow(marketReturns[i] - marketMean, 2);
    }

    if (marketVariance === 0) return 1.0;
    return covariance / marketVariance;
  }

  private calculateMaxDrawdown(snapshots: Snapshot[]): number {
    if (snapshots.length < 2) return 0;

    let maxDrawdown = 0;
    let peak = Number(snapshots[0].totalValue);

    for (const snapshot of snapshots) {
      const value = Number(snapshot.totalValue);
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private getSharpeRating(sharpe: number): string {
    if (sharpe >= 2) return 'Excellent';
    if (sharpe >= 1.5) return 'Very Good';
    if (sharpe >= 1) return 'Good';
    if (sharpe >= 0.5) return 'Acceptable';
    return 'Poor';
  }

  private getBetaInterpretation(beta: number): string {
    if (beta > 1.5) return 'Very High Volatility';
    if (beta > 1.2) return 'High Volatility';
    if (beta >= 0.8) return 'Market-Like';
    if (beta >= 0.5) return 'Low Volatility';
    return 'Very Low Volatility';
  }

  private getSectorColor(sector: string): string {
    const colors: Record<string, string> = {
      'Technology': '#10b981',
      'Finance': '#3b82f6',
      'Healthcare': '#8b5cf6',
      'Energy': '#f59e0b',
      'Consumer': '#ef4444',
      'Industrial': '#14b8a6',
      'Real Estate': '#ec4899',
      'Utilities': '#84cc16',
      'Materials': '#f97316',
      'Communication': '#06b6d4',
      'Other': '#64748b',
    };
    return colors[sector] || '#64748b';
  }

  private getAssetTypeColor(assetType: string): string {
    const colors: Record<string, string> = {
      'STOCK': '#10b981',
      'ETF': '#3b82f6',
      'BOND': '#8b5cf6',
      'CRYPTO': '#ef4444',
      'REIT': '#f59e0b',
      'CASH': '#64748b',
      'MUTUAL_FUND': '#14b8a6',
      'OPTION': '#ec4899',
      'OTHER': '#94a3b8',
    };
    return colors[assetType] || '#94a3b8';
  }

  private formatAssetType(assetType: string): string {
    const names: Record<string, string> = {
      'STOCK': 'Stocks',
      'ETF': 'ETFs',
      'BOND': 'Bonds',
      'CRYPTO': 'Crypto',
      'REIT': 'REITs',
      'CASH': 'Cash',
      'MUTUAL_FUND': 'Mutual Funds',
      'OPTION': 'Options',
      'OTHER': 'Other',
    };
    return names[assetType] || assetType;
  }

  private generateMockPerformanceData() {
    const data = [];
    let portfolioValue = 100;
    let benchmarkValue = 100;
    const today = new Date();

    for (let i = 180; i >= 0; i -= 5) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      portfolioValue *= (1 + (Math.random() * 0.04 - 0.015));
      benchmarkValue *= (1 + (Math.random() * 0.03 - 0.01));

      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: portfolioValue,
        benchmark: benchmarkValue,
      });
    }

    return data;
  }
}
