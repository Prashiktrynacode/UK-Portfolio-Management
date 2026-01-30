// Transaction Routes
// apps/api/src/routes/transactions.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../server';
import { Decimal } from '@prisma/client/runtime/library';

interface TransactionParams {
  id: string;
}

interface CreateTransactionBody {
  positionId: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'DIVIDEND_REINVEST';
  quantity: number;
  price: number;
  fees?: number;
  executedAt?: string;
  notes?: string;
}

interface TransactionQuery {
  portfolioId?: string;
  positionId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  limit?: string;
  offset?: string;
}

export async function transactionsRoutes(fastify: FastifyInstance) {
  // Get transactions with filters
  fastify.get<{ Querystring: TransactionQuery }>(
    '/',
    async (request, reply) => {
      const userId = request.user!.id;
      const { 
        portfolioId, 
        positionId, 
        type, 
        startDate, 
        endDate,
        limit = '50',
        offset = '0',
      } = request.query;

      // Build where clause
      const where: any = {
        position: {
          portfolio: {
            userId,
          },
        },
      };

      if (positionId) {
        where.positionId = positionId;
      }

      if (portfolioId) {
        where.position.portfolioId = portfolioId;
      }

      if (type) {
        where.type = type;
      }

      if (startDate || endDate) {
        where.executedAt = {};
        if (startDate) where.executedAt.gte = new Date(startDate);
        if (endDate) where.executedAt.lte = new Date(endDate);
      }

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          include: {
            position: {
              select: {
                ticker: true,
                name: true,
                currentPrice: true,
              },
            },
          },
          orderBy: { executedAt: 'desc' },
          take: parseInt(limit),
          skip: parseInt(offset),
        }),
        prisma.transaction.count({ where }),
      ]);

      return {
        data: transactions,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + transactions.length < total,
        },
      };
    }
  );

  // Get single transaction
  fastify.get<{ Params: TransactionParams }>(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.id;

      const transaction = await prisma.transaction.findFirst({
        where: { id },
        include: {
          position: {
            include: {
              portfolio: {
                select: { userId: true },
              },
            },
          },
        },
      });

      if (!transaction || transaction.position.portfolio.userId !== userId) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Transaction not found',
        });
      }

      return transaction;
    }
  );

  // Create transaction (buy/sell/dividend)
  fastify.post<{ Body: CreateTransactionBody }>(
    '/',
    async (request, reply) => {
      const userId = request.user!.id;
      const { 
        positionId, 
        type, 
        quantity, 
        price, 
        fees = 0, 
        executedAt, 
        notes 
      } = request.body;

      // Verify position ownership
      const position = await prisma.position.findFirst({
        where: { id: positionId },
        include: {
          portfolio: { select: { userId: true, id: true } },
          lots: { orderBy: { purchaseDate: 'asc' } },
        },
      });

      if (!position || position.portfolio.userId !== userId) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Position not found',
        });
      }

      const executionDate = executedAt ? new Date(executedAt) : new Date();
      const totalAmount = quantity * price + fees;

      // Handle different transaction types
      if (type === 'SELL') {
        // Validate sufficient quantity
        if (quantity > Number(position.quantity)) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: `Insufficient shares. Current position: ${position.quantity}`,
          });
        }

        // Process FIFO lot sales
        await processFIFOSale(position.id, position.lots, quantity);

        // Update position quantity
        const newQty = Number(position.quantity) - quantity;
        
        if (newQty === 0) {
          // Delete position if fully sold
          await prisma.position.delete({
            where: { id: positionId },
          });
        } else {
          await prisma.position.update({
            where: { id: positionId },
            data: { quantity: new Decimal(newQty) },
          });
        }
      } else if (type === 'BUY' || type === 'DIVIDEND_REINVEST') {
        // Create new tax lot
        await prisma.taxLot.create({
          data: {
            positionId,
            quantity: new Decimal(quantity),
            costBasis: new Decimal(price),
            purchaseDate: executionDate,
          },
        });

        // Update position totals
        const newTotalQty = Number(position.quantity) + quantity;
        const currentTotalCost = Number(position.quantity) * Number(position.avgCostBasis);
        const newTotalCost = currentTotalCost + (quantity * price);
        const newAvgCost = newTotalCost / newTotalQty;

        await prisma.position.update({
          where: { id: positionId },
          data: {
            quantity: new Decimal(newTotalQty),
            avgCostBasis: new Decimal(newAvgCost),
          },
        });
      }

      // Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          positionId,
          type,
          quantity: new Decimal(quantity),
          price: new Decimal(price),
          totalAmount: new Decimal(totalAmount),
          fees: new Decimal(fees),
          executedAt: executionDate,
          source: 'manual',
          notes,
        },
        include: {
          position: {
            select: {
              ticker: true,
              name: true,
            },
          },
        },
      });

      return reply.status(201).send(transaction);
    }
  );

  // Delete transaction (and reverse its effects)
  fastify.delete<{ Params: TransactionParams }>(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.id;

      const transaction = await prisma.transaction.findFirst({
        where: { id },
        include: {
          position: {
            include: {
              portfolio: { select: { userId: true } },
            },
          },
        },
      });

      if (!transaction || transaction.position.portfolio.userId !== userId) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Transaction not found',
        });
      }

      // Note: Reversing transaction effects would require complex logic
      // For now, we only allow deleting if it's the most recent transaction
      const moreRecent = await prisma.transaction.count({
        where: {
          positionId: transaction.positionId,
          executedAt: { gt: transaction.executedAt },
        },
      });

      if (moreRecent > 0) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Can only delete the most recent transaction for a position',
        });
      }

      await prisma.transaction.delete({
        where: { id },
      });

      return reply.status(204).send();
    }
  );

  // Get transaction summary/stats
  fastify.get<{ Querystring: { portfolioId?: string; year?: string } }>(
    '/summary',
    async (request, reply) => {
      const userId = request.user!.id;
      const { portfolioId, year } = request.query;

      const currentYear = year ? parseInt(year) : new Date().getFullYear();
      const startDate = new Date(currentYear, 0, 1);
      const endDate = new Date(currentYear, 11, 31, 23, 59, 59);

      const where: any = {
        executedAt: {
          gte: startDate,
          lte: endDate,
        },
        position: {
          portfolio: {
            userId,
          },
        },
      };

      if (portfolioId) {
        where.position.portfolioId = portfolioId;
      }

      // Get aggregated stats by transaction type
      const transactions = await prisma.transaction.findMany({
        where,
        select: {
          type: true,
          totalAmount: true,
          quantity: true,
        },
      });

      const summary = {
        year: currentYear,
        totalBuys: 0,
        totalSells: 0,
        totalDividends: 0,
        buyCount: 0,
        sellCount: 0,
        dividendCount: 0,
        netInflow: 0,
      };

      transactions.forEach(t => {
        const amount = Number(t.totalAmount);
        switch (t.type) {
          case 'BUY':
          case 'DIVIDEND_REINVEST':
            summary.totalBuys += amount;
            summary.buyCount++;
            summary.netInflow -= amount;
            break;
          case 'SELL':
            summary.totalSells += amount;
            summary.sellCount++;
            summary.netInflow += amount;
            break;
          case 'DIVIDEND':
            summary.totalDividends += amount;
            summary.dividendCount++;
            summary.netInflow += amount;
            break;
        }
      });

      return summary;
    }
  );
}

// Helper to process FIFO sales
async function processFIFOSale(positionId: string, lots: any[], quantityToSell: number) {
  let remainingToSell = quantityToSell;

  for (const lot of lots) {
    if (remainingToSell <= 0) break;

    const availableQty = Number(lot.quantity) - Number(lot.soldQuantity);
    if (availableQty <= 0) continue;

    const sellFromThisLot = Math.min(availableQty, remainingToSell);
    
    await prisma.taxLot.update({
      where: { id: lot.id },
      data: {
        soldQuantity: new Decimal(Number(lot.soldQuantity) + sellFromThisLot),
      },
    });

    remainingToSell -= sellFromThisLot;
  }
}
