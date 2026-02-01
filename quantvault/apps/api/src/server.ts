// QuantVault API Server
// apps/api/src/server.ts

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import { portfolioRoutes } from './routes/portfolio';
import { positionsRoutes } from './routes/positions';
import { transactionsRoutes } from './routes/transactions';
import { analysisRoutes } from './routes/analysis';
import { importRoutes } from './routes/import';
import { marketRoutes } from './routes/market';
import { authMiddleware } from './middleware/auth';

// Initialize Prisma
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Create Fastify instance
const server: FastifyInstance = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' 
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

// Register plugins
async function registerPlugins() {
  // Security headers
  await server.register(helmet, {
    contentSecurityPolicy: false,
  });

  // CORS configuration for Vercel frontend
  await server.register(cors, {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      /\.vercel\.app$/,
      /localhost:\d+$/,
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  // Rate limiting
  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please slow down.',
    }),
  });
}

// Health check route
server.get('/health', async () => ({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
}));

// API version prefix
server.register(async (app) => {
  // Apply auth middleware to all /api routes
  app.addHook('preHandler', authMiddleware);

  // Register route modules
  app.register(portfolioRoutes, { prefix: '/portfolios' });
  app.register(positionsRoutes, { prefix: '/positions' });
  app.register(transactionsRoutes, { prefix: '/transactions' });
  app.register(analysisRoutes, { prefix: '/analysis' });
  app.register(importRoutes, { prefix: '/import' });
  app.register(marketRoutes, { prefix: '/market' });
}, { prefix: '/api/v1' });

// Global error handler
server.setErrorHandler((error, request, reply) => {
  server.log.error(error);

  // Prisma errors
  if (error.code?.startsWith('P')) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Database Error',
      message: 'Invalid request data',
    });
  }

  // Validation errors
  if (error.validation) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Validation Error',
      message: error.message,
      details: error.validation,
    });
  }

  // Default error response
  return reply.status(error.statusCode || 500).send({
    statusCode: error.statusCode || 500,
    error: error.name || 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : error.message,
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  server.log.info('Shutting down gracefully...');
  await server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
async function start() {
  try {
    await registerPlugins();
    
    // Connect to database
    await prisma.$connect();
    server.log.info('Database connected');

    const port = parseInt(process.env.PORT || '4000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await server.listen({ port, host });
    server.log.info(`Server running at http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();

export { server };
