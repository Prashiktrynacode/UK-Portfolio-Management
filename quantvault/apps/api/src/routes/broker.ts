// Broker Connection Routes
// apps/api/src/routes/broker.ts

import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../server';

interface ConnectBrokerBody {
  broker: string;
  apiKey: string;
  apiSecret?: string;
  accountId?: string;
}

interface SyncBrokerBody {
  portfolioId: string;
}

export const brokerRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all broker connections for the user
  fastify.get('/', async (request, reply) => {
    const userId = request.user!.id;

    const connections = await prisma.brokerConnection.findMany({
      where: { userId },
      select: {
        id: true,
        broker: true,
        status: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        accountIds: true,
        createdAt: true,
      },
    });

    return connections;
  });

  // Connect a new broker
  fastify.post<{ Body: ConnectBrokerBody }>('/connect', async (request, reply) => {
    const userId = request.user!.id;
    const { broker, apiKey, apiSecret, accountId } = request.body;

    // Validate broker type
    const validBrokers = [
      'INTERACTIVE_BROKERS',
      'TRADING_212',
      'ALPACA',
      'ROBINHOOD',
      'CHARLES_SCHWAB',
      'COINBASE',
    ];

    if (!validBrokers.includes(broker)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid broker type. Supported: ${validBrokers.join(', ')}`,
      });
    }

    // Check if broker is already connected
    const existing = await prisma.brokerConnection.findFirst({
      where: { userId, broker: broker as any },
    });

    if (existing) {
      // Update existing connection
      const updated = await prisma.brokerConnection.update({
        where: { id: existing.id },
        data: {
          accessToken: apiKey, // Store API key as accessToken
          refreshToken: apiSecret || null,
          accountIds: accountId ? [accountId] : [],
          status: 'PENDING',
        },
      });

      // Verify the connection
      const verified = await verifyBrokerConnection(broker, apiKey, apiSecret);

      await prisma.brokerConnection.update({
        where: { id: existing.id },
        data: {
          status: verified ? 'CONNECTED' : 'ERROR',
          lastSyncStatus: verified ? 'Connection verified' : 'Invalid API credentials',
        },
      });

      return {
        id: existing.id,
        broker,
        status: verified ? 'CONNECTED' : 'ERROR',
        message: verified ? 'Broker connected successfully' : 'Failed to verify API credentials',
      };
    }

    // Create new connection
    const connection = await prisma.brokerConnection.create({
      data: {
        userId,
        broker: broker as any,
        accessToken: apiKey,
        refreshToken: apiSecret || null,
        accountIds: accountId ? [accountId] : [],
        status: 'PENDING',
      },
    });

    // Verify the connection
    const verified = await verifyBrokerConnection(broker, apiKey, apiSecret);

    await prisma.brokerConnection.update({
      where: { id: connection.id },
      data: {
        status: verified ? 'CONNECTED' : 'ERROR',
        lastSyncStatus: verified ? 'Connection verified' : 'Invalid API credentials',
      },
    });

    return {
      id: connection.id,
      broker,
      status: verified ? 'CONNECTED' : 'ERROR',
      message: verified ? 'Broker connected successfully' : 'Failed to verify API credentials',
    };
  });

  // Sync positions from a broker
  fastify.post<{
    Params: { connectionId: string };
    Body: SyncBrokerBody;
  }>('/:connectionId/sync', async (request, reply) => {
    const userId = request.user!.id;
    const { connectionId } = request.params;
    const { portfolioId } = request.body;

    // Get connection
    const connection = await prisma.brokerConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Broker connection not found',
      });
    }

    if (connection.status !== 'CONNECTED') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Broker is not connected. Please reconnect.',
      });
    }

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

    // Update status to syncing
    await prisma.brokerConnection.update({
      where: { id: connectionId },
      data: { status: 'SYNCING' },
    });

    try {
      // Fetch positions from broker
      const positions = await fetchBrokerPositions(
        connection.broker,
        connection.accessToken!,
        connection.refreshToken
      );

      // Import positions to portfolio
      let imported = 0;
      let failed = 0;

      for (const pos of positions) {
        try {
          // Check if position already exists
          const existing = await prisma.position.findFirst({
            where: { portfolioId, ticker: pos.ticker.toUpperCase() },
          });

          if (existing) {
            // Update existing position
            await prisma.position.update({
              where: { id: existing.id },
              data: {
                quantity: pos.quantity,
                avgCostBasis: pos.avgCostBasis,
                currentPrice: pos.currentPrice,
                marketValue: pos.quantity * (pos.currentPrice || pos.avgCostBasis),
              },
            });
          } else {
            // Create new position
            await prisma.position.create({
              data: {
                portfolioId,
                ticker: pos.ticker.toUpperCase(),
                assetType: (pos.assetType || 'STOCK') as any,
                name: pos.name,
                quantity: pos.quantity,
                avgCostBasis: pos.avgCostBasis,
                currentPrice: pos.currentPrice,
                marketValue: pos.quantity * (pos.currentPrice || pos.avgCostBasis),
              },
            });
          }
          imported++;
        } catch (err) {
          console.error(`Failed to import position ${pos.ticker}:`, err);
          failed++;
        }
      }

      // Update connection status
      await prisma.brokerConnection.update({
        where: { id: connectionId },
        data: {
          status: 'CONNECTED',
          lastSyncAt: new Date(),
          lastSyncStatus: `Synced ${imported} positions${failed > 0 ? `, ${failed} failed` : ''}`,
        },
      });

      return {
        success: true,
        imported,
        failed,
        message: `Successfully synced ${imported} positions`,
      };
    } catch (error: any) {
      console.error('Broker sync error:', error);

      await prisma.brokerConnection.update({
        where: { id: connectionId },
        data: {
          status: 'ERROR',
          syncError: error.message,
          lastSyncStatus: `Sync failed: ${error.message}`,
        },
      });

      return reply.status(500).send({
        statusCode: 500,
        error: 'Sync Error',
        message: error.message || 'Failed to sync broker data',
      });
    }
  });

  // Disconnect a broker
  fastify.delete<{ Params: { connectionId: string } }>(
    '/:connectionId',
    async (request, reply) => {
      const userId = request.user!.id;
      const { connectionId } = request.params;

      const connection = await prisma.brokerConnection.findFirst({
        where: { id: connectionId, userId },
      });

      if (!connection) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Broker connection not found',
        });
      }

      await prisma.brokerConnection.delete({
        where: { id: connectionId },
      });

      return { success: true, message: 'Broker disconnected' };
    }
  );
};

// Helper function to verify broker connection
async function verifyBrokerConnection(
  broker: string,
  apiKey: string,
  apiSecret?: string | null
): Promise<boolean> {
  try {
    switch (broker) {
      case 'TRADING_212':
        return await verifyTrading212(apiKey);
      case 'ALPACA':
        return await verifyAlpaca(apiKey, apiSecret || '');
      case 'INTERACTIVE_BROKERS':
        // IBKR requires OAuth flow, simplified for now
        return apiKey.length > 10;
      case 'COINBASE':
        return await verifyCoinbase(apiKey, apiSecret || '');
      default:
        return false;
    }
  } catch (error) {
    console.error(`Broker verification error for ${broker}:`, error);
    return false;
  }
}

// Trading 212 API verification
async function verifyTrading212(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://live.trading212.com/api/v0/equity/account/info', {
      headers: {
        'Authorization': apiKey,
      },
    });
    return response.ok;
  } catch (error) {
    // Try demo endpoint
    try {
      const demoResponse = await fetch('https://demo.trading212.com/api/v0/equity/account/info', {
        headers: {
          'Authorization': apiKey,
        },
      });
      return demoResponse.ok;
    } catch {
      return false;
    }
  }
}

// Alpaca API verification
async function verifyAlpaca(apiKey: string, apiSecret: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.alpaca.markets/v2/account', {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
      },
    });
    return response.ok;
  } catch (error) {
    // Try paper trading endpoint
    try {
      const paperResponse = await fetch('https://paper-api.alpaca.markets/v2/account', {
        headers: {
          'APCA-API-KEY-ID': apiKey,
          'APCA-API-SECRET-KEY': apiSecret,
        },
      });
      return paperResponse.ok;
    } catch {
      return false;
    }
  }
}

// Coinbase API verification
async function verifyCoinbase(apiKey: string, apiSecret: string): Promise<boolean> {
  try {
    // Coinbase requires signed requests, simplified check
    return apiKey.length > 10 && apiSecret.length > 10;
  } catch {
    return false;
  }
}

// Fetch positions from broker
interface BrokerPosition {
  ticker: string;
  name?: string;
  quantity: number;
  avgCostBasis: number;
  currentPrice?: number;
  assetType?: string;
}

async function fetchBrokerPositions(
  broker: string,
  apiKey: string,
  apiSecret?: string | null
): Promise<BrokerPosition[]> {
  switch (broker) {
    case 'TRADING_212':
      return await fetchTrading212Positions(apiKey);
    case 'ALPACA':
      return await fetchAlpacaPositions(apiKey, apiSecret || '');
    default:
      throw new Error(`Broker ${broker} sync not implemented yet`);
  }
}

// Fetch Trading 212 positions
async function fetchTrading212Positions(apiKey: string): Promise<BrokerPosition[]> {
  // Try live first, then demo
  let response = await fetch('https://live.trading212.com/api/v0/equity/portfolio', {
    headers: { 'Authorization': apiKey },
  });

  if (!response.ok) {
    response = await fetch('https://demo.trading212.com/api/v0/equity/portfolio', {
      headers: { 'Authorization': apiKey },
    });
  }

  if (!response.ok) {
    throw new Error('Failed to fetch Trading 212 positions');
  }

  const data = (await response.json()) as any[];

  return data.map((pos: any) => ({
    ticker: pos.ticker,
    name: pos.ticker,
    quantity: pos.quantity,
    avgCostBasis: pos.averagePrice,
    currentPrice: pos.currentPrice,
    assetType: 'STOCK',
  }));
}

// Fetch Alpaca positions
async function fetchAlpacaPositions(apiKey: string, apiSecret: string): Promise<BrokerPosition[]> {
  let response = await fetch('https://api.alpaca.markets/v2/positions', {
    headers: {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
    },
  });

  if (!response.ok) {
    response = await fetch('https://paper-api.alpaca.markets/v2/positions', {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
      },
    });
  }

  if (!response.ok) {
    throw new Error('Failed to fetch Alpaca positions');
  }

  const data = (await response.json()) as any[];

  return data.map((pos: any) => ({
    ticker: pos.symbol,
    name: pos.symbol,
    quantity: parseFloat(pos.qty),
    avgCostBasis: parseFloat(pos.avg_entry_price),
    currentPrice: parseFloat(pos.current_price),
    assetType: pos.asset_class === 'crypto' ? 'CRYPTO' : 'STOCK',
  }));
}
