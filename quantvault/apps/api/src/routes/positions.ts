// Position Routes
// apps/api/src/routes/positions.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../server';
import { Decimal } from '@prisma/client/runtime/library';
import { getQuote, updatePositionMarketData } from '../services/market-data-service';

interface PositionParams {
  id: string;
}

interface CreatePositionBody {
  portfolioId: string;
  ticker: string;
  assetType?: string;
  name?: string;
  quantity: number;
  avgCostBasis: number;
  purchaseDate?: string;
}

interface UpdatePositionBody {
  quantity?: number;
  avgCostBasis?: number;
}

interface AddLotBody {
  quantity: number;
  costBasis: number;
  purchaseDate: string;
}

export async function positionsRoutes(fastify: FastifyInstance) {
  // Get all positions for a portfolio
  fastify.get<{ Querystring: { portfolioId: string } }>(
    '/',
    async (request, reply) => {
      const { portfolioId } = request.query;
      const userId = request.user!.id;

      // Verify portfolio ownership
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

      const positions = await prisma.position.findMany({
        where: { portfolioId },
        include: {
          lots: {
            orderBy: { purchaseDate: 'asc' },
          },
          priceHistory: {
            orderBy: { date: 'desc' },
            take: 7, // Last week for sparkline
          },
        },
        orderBy: [
          { marketValue: 'desc' },
          { ticker: 'asc' },
        ],
      });

      // Calculate position weight
      const totalValue = positions.reduce((sum, p) => {
        return sum + (Number(p.marketValue) || 0);
      }, 0);

      return positions.map(p => ({
        ...p,
        weight: totalValue > 0 
          ? ((Number(p.marketValue) || 0) / totalValue * 100).toFixed(2)
          : '0.00',
        sparkline: p.priceHistory.map(h => Number(h.close)).reverse(),
        priceHistory: undefined, // Remove raw data
      }));
    }
  );

  // Get single position with full details
  fastify.get<{ Params: PositionParams }>(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.id;

      const position = await prisma.position.findFirst({
        where: { id },
        include: {
          portfolio: {
            select: { userId: true },
          },
          lots: {
            orderBy: { purchaseDate: 'asc' },
          },
          transactions: {
            orderBy: { executedAt: 'desc' },
            take: 20,
          },
          priceHistory: {
            orderBy: { date: 'desc' },
            take: 90, // 3 months
          },
        },
      });

      if (!position || position.portfolio.userId !== userId) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Position not found',
        });
      }

      // Calculate FIFO tax implications
      const fifoAnalysis = calculateFIFOTaxLots(position.lots);

      return {
        ...position,
        portfolio: undefined,
        fifoAnalysis,
      };
    }
  );

  // Create new position (manual entry)
  fastify.post<{ Body: CreatePositionBody }>(
    '/',
    async (request, reply) => {
      const userId = request.user!.id;
      const { 
        portfolioId, 
        ticker, 
        assetType, 
        name,
        quantity, 
        avgCostBasis, 
        purchaseDate 
      } = request.body;

      // Verify portfolio ownership
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

      // Check if position already exists
      const existing = await prisma.position.findFirst({
        where: { portfolioId, ticker: ticker.toUpperCase() },
      });

      if (existing) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Position for ${ticker.toUpperCase()} already exists. Use the update endpoint to modify.`,
        });
      }

      // Create position with initial tax lot
      const position = await prisma.position.create({
        data: {
          portfolioId,
          ticker: ticker.toUpperCase(),
          assetType: assetType as any || 'STOCK',
          name,
          quantity: new Decimal(quantity),
          avgCostBasis: new Decimal(avgCostBasis),
          lots: {
            create: {
              quantity: new Decimal(quantity),
              costBasis: new Decimal(avgCostBasis),
              purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
            },
          },
          transactions: {
            create: {
              type: 'BUY',
              quantity: new Decimal(quantity),
              price: new Decimal(avgCostBasis),
              totalAmount: new Decimal(quantity * avgCostBasis),
              executedAt: purchaseDate ? new Date(purchaseDate) : new Date(),
              source: 'manual',
            },
          },
        },
        include: {
          lots: true,
        },
      });

      // Fetch and update market data for the new position
      try {
        await updatePositionMarketData(position.id);
        const updatedPosition = await prisma.position.findUnique({
          where: { id: position.id },
          include: { lots: true },
        });
        return reply.status(201).send(updatedPosition);
      } catch (err) {
        // If market data fails, still return the position
        return reply.status(201).send(position);
      }
    }
  );

  // Add a new tax lot to existing position
  fastify.post<{ Params: PositionParams; Body: AddLotBody }>(
    '/:id/lots',
    async (request, reply) => {
      const { id } = request.params;
      const { quantity, costBasis, purchaseDate } = request.body;
      const userId = request.user!.id;

      // Verify ownership
      const position = await prisma.position.findFirst({
        where: { id },
        include: {
          portfolio: { select: { userId: true } },
        },
      });

      if (!position || position.portfolio.userId !== userId) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Position not found',
        });
      }

      // Create new lot
      const lot = await prisma.taxLot.create({
        data: {
          positionId: id,
          quantity: new Decimal(quantity),
          costBasis: new Decimal(costBasis),
          purchaseDate: new Date(purchaseDate),
        },
      });

      // Update position totals
      const newTotalQty = Number(position.quantity) + quantity;
      const newTotalCost = Number(position.quantity) * Number(position.avgCostBasis) + quantity * costBasis;
      const newAvgCost = newTotalCost / newTotalQty;

      await prisma.position.update({
        where: { id },
        data: {
          quantity: new Decimal(newTotalQty),
          avgCostBasis: new Decimal(newAvgCost),
        },
      });

      // Record transaction
      await prisma.transaction.create({
        data: {
          positionId: id,
          type: 'BUY',
          quantity: new Decimal(quantity),
          price: new Decimal(costBasis),
          totalAmount: new Decimal(quantity * costBasis),
          executedAt: new Date(purchaseDate),
          source: 'manual',
        },
      });

      return reply.status(201).send(lot);
    }
  );

  // Get FIFO tax lot analysis for a position
  fastify.get<{ Params: PositionParams }>(
    '/:id/tax-lots',
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.id;

      const position = await prisma.position.findFirst({
        where: { id },
        include: {
          portfolio: { select: { userId: true } },
          lots: {
            orderBy: { purchaseDate: 'asc' },
          },
        },
      });

      if (!position || position.portfolio.userId !== userId) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Position not found',
        });
      }

      const analysis = calculateFIFOTaxLots(position.lots, Number(position.currentPrice));

      return {
        ticker: position.ticker,
        currentPrice: position.currentPrice,
        totalQuantity: position.quantity,
        lots: analysis.lots,
        summary: analysis.summary,
      };
    }
  );

  // Delete position
  fastify.delete<{ Params: PositionParams }>(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.id;

      const position = await prisma.position.findFirst({
        where: { id },
        include: {
          portfolio: { select: { userId: true } },
        },
      });

      if (!position || position.portfolio.userId !== userId) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Position not found',
        });
      }

      await prisma.position.delete({
        where: { id },
      });

      return reply.status(204).send();
    }
  );
}

// Helper function to calculate FIFO tax lots
function calculateFIFOTaxLots(lots: any[], currentPrice?: number) {
  const now = new Date();
  let totalShortTermGain = 0;
  let totalLongTermGain = 0;
  let totalShortTermQty = 0;
  let totalLongTermQty = 0;

  const lotsAnalysis = lots
    .filter(lot => Number(lot.quantity) > Number(lot.soldQuantity))
    .map(lot => {
      const remainingQty = Number(lot.quantity) - Number(lot.soldQuantity);
      const costBasis = Number(lot.costBasis);
      const holdingDays = Math.floor((now.getTime() - new Date(lot.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
      const isLongTerm = holdingDays > 365;

      const unrealizedGain = currentPrice 
        ? (currentPrice - costBasis) * remainingQty 
        : 0;

      if (isLongTerm) {
        totalLongTermGain += unrealizedGain;
        totalLongTermQty += remainingQty;
      } else {
        totalShortTermGain += unrealizedGain;
        totalShortTermQty += remainingQty;
      }

      return {
        id: lot.id,
        purchaseDate: lot.purchaseDate,
        quantity: remainingQty,
        costBasis,
        totalCost: costBasis * remainingQty,
        holdingDays,
        isLongTerm,
        unrealizedGain,
        unrealizedGainPercent: currentPrice 
          ? ((currentPrice - costBasis) / costBasis * 100)
          : 0,
        isWashSale: lot.isWashSale,
      };
    });

  return {
    lots: lotsAnalysis,
    summary: {
      shortTermQuantity: totalShortTermQty,
      longTermQuantity: totalLongTermQty,
      shortTermGain: totalShortTermGain,
      longTermGain: totalLongTermGain,
      totalUnrealizedGain: totalShortTermGain + totalLongTermGain,
    },
  };
}
