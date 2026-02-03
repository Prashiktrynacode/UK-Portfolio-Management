// Analysis Routes - What-If Scenarios & Portfolio Analytics
// apps/api/src/routes/analysis.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../server';
import { CalculationService } from '../services/calculation-service';

const calcService = new CalculationService();

interface SimulationBody {
  portfolioId: string;
  changes: Array<{
    ticker: string;
    action: 'add' | 'remove' | 'adjust';
    quantity: number;
    price?: number;
  }>;
}

interface CorrelationQuery {
  portfolioId: string;
  additionalTickers?: string;
}

export async function analysisRoutes(fastify: FastifyInstance) {
  // Run "What-If" simulation
  fastify.post<{ Body: SimulationBody }>(
    '/simulate',
    async (request, reply) => {
      const userId = request.user!.id;
      const { portfolioId, changes } = request.body;

      // Get current portfolio
      const portfolio = await prisma.portfolio.findFirst({
        where: { id: portfolioId, userId },
        include: {
          positions: true,
          snapshots: {
            orderBy: { date: 'desc' },
            take: 252, // ~1 year of trading days
          },
        },
      });

      if (!portfolio) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Portfolio not found',
        });
      }

      // Calculate current metrics
      const currentMetrics = await calcService.calculatePortfolioMetrics(portfolio);

      // Apply simulated changes to create virtual portfolio
      const simulatedPositions = applySimulatedChanges(
        portfolio.positions,
        changes
      );

      // Calculate simulated metrics
      const simulatedMetrics = await calcService.calculateSimulatedMetrics(
        simulatedPositions,
        portfolio.snapshots
      );

      // Calculate deltas
      const delta = {
        expectedReturn: {
          current: currentMetrics.expectedReturn,
          simulated: simulatedMetrics.expectedReturn,
          change: simulatedMetrics.expectedReturn - currentMetrics.expectedReturn,
        },
        risk: {
          current: currentMetrics.standardDeviation,
          simulated: simulatedMetrics.standardDeviation,
          change: simulatedMetrics.standardDeviation - currentMetrics.standardDeviation,
        },
        sharpe: {
          current: currentMetrics.sharpeRatio,
          simulated: simulatedMetrics.sharpeRatio,
          change: simulatedMetrics.sharpeRatio - currentMetrics.sharpeRatio,
        },
        maxDrawdown: {
          current: currentMetrics.maxDrawdown,
          simulated: simulatedMetrics.maxDrawdown,
          change: simulatedMetrics.maxDrawdown - currentMetrics.maxDrawdown,
        },
        beta: {
          current: currentMetrics.beta,
          simulated: simulatedMetrics.beta,
          change: simulatedMetrics.beta - currentMetrics.beta,
        },
        totalValue: {
          current: currentMetrics.totalValue,
          simulated: simulatedMetrics.totalValue,
          change: simulatedMetrics.totalValue - currentMetrics.totalValue,
        },
      };

      // Generate efficient frontier data points
      const efficientFrontier = calcService.calculateEfficientFrontier(
        simulatedPositions
      );

      return {
        current: currentMetrics,
        simulated: simulatedMetrics,
        delta,
        efficientFrontier,
        simulatedPositions: simulatedPositions.map(p => ({
          ticker: p.ticker,
          quantity: p.quantity,
          weight: p.weight,
          isNew: p.isNew,
          isRemoved: p.isRemoved,
        })),
      };
    }
  );

  // Get correlation matrix for portfolio + optional additional tickers
  fastify.get<{ Querystring: CorrelationQuery }>(
    '/correlation',
    async (request, reply) => {
      const userId = request.user!.id;
      const { portfolioId, additionalTickers } = request.query;

      // Get portfolio positions
      const portfolio = await prisma.portfolio.findFirst({
        where: { id: portfolioId, userId },
        include: {
          positions: {
            select: { ticker: true },
          },
        },
      });

      if (!portfolio) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Portfolio not found',
        });
      }

      // Combine current tickers with additional ones
      const currentTickers = portfolio.positions.map(p => p.ticker);
      const additional = additionalTickers 
        ? additionalTickers.split(',').map(t => t.trim().toUpperCase())
        : [];
      
      const allTickers = [...new Set([...currentTickers, ...additional])];

      // Calculate correlation matrix
      const correlationMatrix = await calcService.calculateCorrelationMatrix(allTickers);

      return {
        tickers: allTickers,
        matrix: correlationMatrix,
        newTickers: additional,
      };
    }
  );

  // Get portfolio risk analysis
  fastify.get<{ Querystring: { portfolioId: string } }>(
    '/risk',
    async (request, reply) => {
      const userId = request.user!.id;
      const { portfolioId } = request.query;

      const portfolio = await prisma.portfolio.findFirst({
        where: { id: portfolioId, userId },
        include: {
          positions: true,
          snapshots: {
            orderBy: { date: 'desc' },
            take: 252,
          },
        },
      });

      if (!portfolio) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Portfolio not found',
        });
      }

      const riskAnalysis = await calcService.performRiskAnalysis(portfolio);

      return {
        volatility: riskAnalysis.volatility,
        beta: riskAnalysis.beta,
        alpha: riskAnalysis.alpha,
        sharpeRatio: riskAnalysis.sharpeRatio,
        sortinoRatio: riskAnalysis.sortinoRatio,
        maxDrawdown: riskAnalysis.maxDrawdown,
        valueAtRisk: riskAnalysis.valueAtRisk,
        sectorConcentration: riskAnalysis.sectorConcentration,
        recommendations: riskAnalysis.recommendations,
      };
    }
  );

  // Get optimization suggestions
  fastify.get<{ Querystring: { portfolioId: string; goal?: string } }>(
    '/optimize',
    async (request, reply) => {
      const userId = request.user!.id;
      const { portfolioId, goal = 'sharpe' } = request.query;

      const portfolio = await prisma.portfolio.findFirst({
        where: { id: portfolioId, userId },
        include: {
          positions: true,
        },
      });

      if (!portfolio) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Portfolio not found',
        });
      }

      // Generate optimization suggestions based on goal
      const suggestions = await calcService.generateOptimizationSuggestions(
        portfolio.positions,
        goal as 'sharpe' | 'minRisk' | 'maxReturn'
      );

      return {
        goal,
        currentMetrics: suggestions.currentMetrics,
        optimizedMetrics: suggestions.optimizedMetrics,
        recommendations: suggestions.recommendations,
      };
    }
  );

  // Sector/Asset breakdown analysis
  fastify.get<{ Querystring: { portfolioId: string } }>(
    '/breakdown',
    async (request, reply) => {
      const userId = request.user!.id;
      const { portfolioId } = request.query;

      const portfolio = await prisma.portfolio.findFirst({
        where: { id: portfolioId, userId },
        include: {
          positions: true,
        },
      });

      if (!portfolio) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Portfolio not found',
        });
      }

      const breakdown = calcService.calculateAllocations(portfolio.positions);

      // Check for imbalances
      const alerts = [];
      
      // Check sector concentration
      const maxSectorWeight = Math.max(...breakdown.bySector.map(s => s.weight));
      if (maxSectorWeight > 40) {
        const topSector = breakdown.bySector.find(s => s.weight === maxSectorWeight);
        alerts.push({
          type: 'concentration',
          severity: maxSectorWeight > 50 ? 'high' : 'medium',
          message: `${topSector?.name} sector represents ${maxSectorWeight.toFixed(1)}% of portfolio`,
          suggestion: `Consider reducing ${topSector?.name} exposure by ${(maxSectorWeight - 30).toFixed(1)}%`,
        });
      }

      return {
        ...breakdown,
        alerts,
      };
    }
  );

  // Get fees summary for portfolio
  fastify.get<{ Querystring: { portfolioId: string } }>(
    '/fees',
    async (request, reply) => {
      const userId = request.user!.id;
      const { portfolioId } = request.query;

      const portfolio = await prisma.portfolio.findFirst({
        where: { id: portfolioId, userId },
      });

      if (!portfolio) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Portfolio not found',
        });
      }

      const feesSummary = await calculateFeesSummary(portfolioId);

      return feesSummary;
    }
  );
}

// Helper function to apply simulated changes
function applySimulatedChanges(
  currentPositions: any[],
  changes: SimulationBody['changes']
) {
  // Create a map of current positions
  const positionMap = new Map(
    currentPositions.map(p => [p.ticker, { ...p, isNew: false, isRemoved: false }])
  );

  // Apply changes
  for (const change of changes) {
    const ticker = change.ticker.toUpperCase();

    switch (change.action) {
      case 'add':
        if (positionMap.has(ticker)) {
          // Increase existing position
          const existing = positionMap.get(ticker)!;
          existing.quantity = Number(existing.quantity) + change.quantity;
          if (change.price) {
            // Recalculate avg cost
            const oldValue = Number(existing.quantity) * Number(existing.avgCostBasis);
            const newValue = change.quantity * change.price;
            existing.avgCostBasis = (oldValue + newValue) / (Number(existing.quantity) + change.quantity);
          }
        } else {
          // New position
          positionMap.set(ticker, {
            ticker,
            quantity: change.quantity,
            avgCostBasis: change.price || 0,
            currentPrice: change.price || 0,
            marketValue: change.quantity * (change.price || 0),
            sector: 'Unknown',
            assetType: 'STOCK',
            isNew: true,
            isRemoved: false,
          });
        }
        break;

      case 'remove':
        if (positionMap.has(ticker)) {
          positionMap.get(ticker)!.isRemoved = true;
          positionMap.get(ticker)!.quantity = 0;
        }
        break;

      case 'adjust':
        if (positionMap.has(ticker)) {
          positionMap.get(ticker)!.quantity = change.quantity;
        }
        break;
    }
  }

  // Calculate weights
  const positions = Array.from(positionMap.values()).filter(p => !p.isRemoved);
  const totalValue = positions.reduce((sum, p) => {
    return sum + (Number(p.quantity) * Number(p.currentPrice || p.avgCostBasis));
  }, 0);

  return positions.map(p => ({
    ...p,
    marketValue: Number(p.quantity) * Number(p.currentPrice || p.avgCostBasis),
    weight: totalValue > 0
      ? ((Number(p.quantity) * Number(p.currentPrice || p.avgCostBasis)) / totalValue * 100)
      : 0,
  }));
}

// Fees summary calculation helper
export async function calculateFeesSummary(portfolioId: string) {
  const positions = await prisma.position.findMany({
    where: { portfolioId },
    select: {
      ticker: true,
      name: true,
      currency: true,
      marketValue: true,
      expenseRatio: true,
      annualFees: true,
      assetType: true,
    },
  });

  let totalAnnualFeesUSD = 0;
  let totalAnnualFeesINR = 0;

  const positionFees = positions.map(p => {
    const marketValue = Number(p.marketValue) || 0;
    const expenseRatio = Number(p.expenseRatio) || 0;
    const annualFee = expenseRatio > 0 ? (marketValue * expenseRatio) / 100 : 0;
    const monthlyFee = annualFee / 12;

    if (p.currency === 'INR') {
      totalAnnualFeesINR += annualFee;
    } else {
      totalAnnualFeesUSD += annualFee;
    }

    return {
      ticker: p.ticker,
      name: p.name,
      currency: p.currency,
      marketValue,
      expenseRatio,
      annualFee,
      monthlyFee,
      assetType: p.assetType,
    };
  }).filter(p => p.expenseRatio > 0);

  return {
    positions: positionFees,
    summary: {
      totalAnnualFeesUSD,
      totalAnnualFeesINR,
      totalMonthlyFeesUSD: totalAnnualFeesUSD / 12,
      totalMonthlyFeesINR: totalAnnualFeesINR / 12,
      positionsWithFees: positionFees.length,
      totalPositions: positions.length,
    },
  };
}
