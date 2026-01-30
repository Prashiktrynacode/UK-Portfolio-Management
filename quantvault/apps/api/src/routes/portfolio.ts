// Portfolio Routes
// apps/api/src/routes/portfolio.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../server';
import { PortfolioService } from '../services/portfolio-service';
import { CalculationService } from '../services/calculation-service';

const portfolioService = new PortfolioService();
const calcService = new CalculationService();

interface PortfolioParams {
  id: string;
}

interface CreatePortfolioBody {
  name: string;
  description?: string;
  accountType?: string;
}

interface UpdatePortfolioBody {
  name?: string;
  description?: string;
  isDefault?: boolean;
}

export async function portfolioRoutes(fastify: FastifyInstance) {
  // Get all portfolios for user
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;

    const portfolios = await prisma.portfolio.findMany({
      where: { userId },
      include: {
        _count: {
          select: { positions: true },
        },
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return portfolios.map(p => ({
      ...p,
      positionsCount: p._count.positions,
      _count: undefined,
    }));
  });

  // Get single portfolio with summary metrics
  fastify.get<{ Params: PortfolioParams }>(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.id;

      const portfolio = await prisma.portfolio.findFirst({
        where: { id, userId },
        include: {
          positions: {
            include: {
              lots: true,
              priceHistory: {
                orderBy: { date: 'desc' },
                take: 30,
              },
            },
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

      // Calculate summary metrics
      const summary = await portfolioService.calculateSummary(portfolio);

      return {
        ...portfolio,
        summary,
      };
    }
  );

  // Get portfolio dashboard data (KPIs, charts, activity)
  fastify.get<{ Params: PortfolioParams }>(
    '/:id/dashboard',
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.id;

      const portfolio = await prisma.portfolio.findFirst({
        where: { id, userId },
        include: {
          positions: {
            include: {
              transactions: {
                orderBy: { executedAt: 'desc' },
                take: 10,
              },
            },
          },
          snapshots: {
            orderBy: { date: 'desc' },
            take: 365, // Last year
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

      // Calculate all dashboard metrics
      const kpis = await calcService.calculateKPIs(portfolio);
      const performanceChart = await calcService.getPerformanceChartData(portfolio);
      const allocations = calcService.calculateAllocations(portfolio.positions);
      const recentActivity = portfolioService.getRecentActivity(portfolio.positions);

      return {
        portfolio: {
          id: portfolio.id,
          name: portfolio.name,
          accountType: portfolio.accountType,
        },
        kpis,
        charts: {
          performance: performanceChart,
          sectorAllocation: allocations.bySector,
          assetAllocation: allocations.byAssetType,
        },
        recentActivity,
      };
    }
  );

  // Create new portfolio
  fastify.post<{ Body: CreatePortfolioBody }>(
    '/',
    async (request, reply) => {
      const userId = request.user!.id;
      const { name, description, accountType } = request.body;

      // Check if name already exists
      const existing = await prisma.portfolio.findFirst({
        where: { userId, name },
      });

      if (existing) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'A portfolio with this name already exists',
        });
      }

      const portfolio = await prisma.portfolio.create({
        data: {
          userId,
          name,
          description,
          accountType: accountType as any || 'BROKERAGE',
        },
      });

      return reply.status(201).send(portfolio);
    }
  );

  // Update portfolio
  fastify.patch<{ Params: PortfolioParams; Body: UpdatePortfolioBody }>(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.id;
      const { name, description, isDefault } = request.body;

      // Verify ownership
      const existing = await prisma.portfolio.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Portfolio not found',
        });
      }

      // If setting as default, unset other defaults first
      if (isDefault) {
        await prisma.portfolio.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const portfolio = await prisma.portfolio.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(isDefault !== undefined && { isDefault }),
        },
      });

      return portfolio;
    }
  );

  // Delete portfolio
  fastify.delete<{ Params: PortfolioParams }>(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.id;

      const portfolio = await prisma.portfolio.findFirst({
        where: { id, userId },
      });

      if (!portfolio) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Portfolio not found',
        });
      }

      // Don't allow deleting the only/default portfolio
      const count = await prisma.portfolio.count({
        where: { userId },
      });

      if (count === 1) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Cannot delete your only portfolio',
        });
      }

      await prisma.portfolio.delete({
        where: { id },
      });

      return reply.status(204).send();
    }
  );

  // Get portfolio history (for charts)
  fastify.get<{ 
    Params: PortfolioParams; 
    Querystring: { period?: string } 
  }>(
    '/:id/history',
    async (request, reply) => {
      const { id } = request.params;
      const { period = '1Y' } = request.query;
      const userId = request.user!.id;

      // Verify ownership
      const portfolio = await prisma.portfolio.findFirst({
        where: { id, userId },
        select: { id: true },
      });

      if (!portfolio) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Portfolio not found',
        });
      }

      // Calculate date range based on period
      const days = {
        '1M': 30,
        '3M': 90,
        '6M': 180,
        '1Y': 365,
        'ALL': 9999,
      }[period] || 365;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const snapshots = await prisma.portfolioSnapshot.findMany({
        where: {
          portfolioId: id,
          date: { gte: startDate },
        },
        orderBy: { date: 'asc' },
        select: {
          date: true,
          totalValue: true,
          cumulativeReturn: true,
          benchmarkValue: true,
          sharpeRatio: true,
          beta: true,
          maxDrawdown: true,
        },
      });

      return snapshots;
    }
  );
}
