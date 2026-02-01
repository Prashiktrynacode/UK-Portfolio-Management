// Portfolio Service
// apps/api/src/services/portfolio-service.ts

interface Position {
  ticker: string;
  name?: string | null;
  quantity: any;
  avgCostBasis: any;
  currentPrice: any;
  marketValue: any;
  unrealizedPL: any;
  unrealizedPLPercent: any;
  dayChangePercent?: any;
  sector?: string | null;
  assetType: string;
  lots?: any[];
  transactions?: any[];
}

interface Portfolio {
  id: string;
  name: string;
  positions: Position[];
}

export class PortfolioService {
  /**
   * Calculate portfolio summary metrics
   */
  async calculateSummary(portfolio: Portfolio) {
    const positions = portfolio.positions;

    // Calculate totals
    const totalMarketValue = positions.reduce((sum, p) => {
      return sum + (Number(p.marketValue) || Number(p.quantity) * Number(p.currentPrice || p.avgCostBasis));
    }, 0);

    const totalCostBasis = positions.reduce((sum, p) => {
      return sum + (Number(p.quantity) * Number(p.avgCostBasis));
    }, 0);

    const totalUnrealizedPL = totalMarketValue - totalCostBasis;
    const totalUnrealizedPLPercent = totalCostBasis > 0 
      ? (totalUnrealizedPL / totalCostBasis) * 100 
      : 0;

    // Calculate day change (sum of position day changes)
    const dayChange = positions.reduce((sum, p) => {
      const positionValue = Number(p.marketValue) || Number(p.quantity) * Number(p.currentPrice || p.avgCostBasis);
      const dayChangePercent = Number(p.dayChangePercent) || 0;
      return sum + (positionValue * dayChangePercent / 100);
    }, 0);

    const dayChangePercent = totalMarketValue > 0 
      ? (dayChange / totalMarketValue) * 100 
      : 0;

    // Top holdings
    const topHoldings = positions
      .map(p => ({
        ticker: p.ticker,
        name: p.name || p.ticker,
        marketValue: Number(p.marketValue) || Number(p.quantity) * Number(p.currentPrice || p.avgCostBasis),
        weight: 0,
        unrealizedPLPercent: Number(p.unrealizedPLPercent) || 0,
      }))
      .sort((a, b) => b.marketValue - a.marketValue)
      .slice(0, 5)
      .map(h => ({
        ...h,
        weight: totalMarketValue > 0 ? (h.marketValue / totalMarketValue) * 100 : 0,
      }));

    // Winners and losers
    const sortedByPL = positions
      .map(p => ({
        ticker: p.ticker,
        unrealizedPL: Number(p.unrealizedPL) || 0,
        unrealizedPLPercent: Number(p.unrealizedPLPercent) || 0,
      }))
      .sort((a, b) => b.unrealizedPL - a.unrealizedPL);

    const topWinners = sortedByPL.filter(p => p.unrealizedPL > 0).slice(0, 3);
    const topLosers = sortedByPL.filter(p => p.unrealizedPL < 0).slice(-3).reverse();

    return {
      totalMarketValue,
      totalCostBasis,
      totalUnrealizedPL,
      totalUnrealizedPLPercent,
      dayChange,
      dayChangePercent,
      positionsCount: positions.length,
      topHoldings,
      topWinners,
      topLosers,
    };
  }

  /**
   * Get recent activity from transactions
   */
  getRecentActivity(positions: Position[]) {
    // Flatten all transactions from positions
    const allTransactions = positions.flatMap(p => 
      (p.transactions || []).map(t => ({
        ...t,
        ticker: p.ticker,
        name: p.name || p.ticker,
      }))
    );

    // Sort by date and take recent
    return allTransactions
      .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
      .slice(0, 10)
      .map(t => ({
        id: t.id,
        type: t.type,
        ticker: t.ticker,
        name: t.name,
        quantity: Number(t.quantity),
        price: Number(t.price),
        totalAmount: Number(t.totalAmount),
        executedAt: t.executedAt,
        timeAgo: this.getTimeAgo(new Date(t.executedAt)),
      }));
  }

  /**
   * Calculate position weights
   */
  calculatePositionWeights(positions: Position[]) {
    const totalValue = positions.reduce((sum, p) => {
      return sum + (Number(p.marketValue) || Number(p.quantity) * Number(p.currentPrice || p.avgCostBasis));
    }, 0);

    return positions.map(p => ({
      ticker: p.ticker,
      weight: totalValue > 0 
        ? ((Number(p.marketValue) || Number(p.quantity) * Number(p.currentPrice || p.avgCostBasis)) / totalValue) * 100
        : 0,
    }));
  }

  /**
   * Check for portfolio alerts/warnings
   */
  checkAlerts(positions: Position[]) {
    const alerts = [];
    
    // Check concentration
    const weights = this.calculatePositionWeights(positions);
    const maxWeight = Math.max(...weights.map(w => w.weight));
    const topPosition = weights.find(w => w.weight === maxWeight);

    if (maxWeight > 25) {
      alerts.push({
        type: 'CONCENTRATION',
        severity: maxWeight > 40 ? 'HIGH' : 'MEDIUM',
        title: 'Position concentration detected',
        message: `${topPosition?.ticker} represents ${maxWeight.toFixed(1)}% of portfolio`,
        ticker: topPosition?.ticker,
      });
    }

    // Check for significant losses
    positions.forEach(p => {
      const plPercent = Number(p.unrealizedPLPercent) || 0;
      if (plPercent < -20) {
        alerts.push({
          type: 'LOSS',
          severity: plPercent < -40 ? 'HIGH' : 'MEDIUM',
          title: 'Significant unrealized loss',
          message: `${p.ticker} is down ${Math.abs(plPercent).toFixed(1)}%`,
          ticker: p.ticker,
        });
      }
    });

    // Sector concentration would require sector data
    // ...

    return alerts;
  }

  /**
   * Helper: Get human-readable time ago
   */
  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
}
