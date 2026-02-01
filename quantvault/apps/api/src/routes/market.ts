// Market Data Routes
// apps/api/src/routes/market.ts

import { FastifyPluginAsync } from 'fastify';
import { getQuote, getQuotes, getHistoricalData, searchTickers, updatePortfolioMarketData } from '../services/market-data-service';

export const marketRoutes: FastifyPluginAsync = async (fastify) => {
  // Get quote for a single ticker
  fastify.get<{
    Params: { ticker: string };
  }>('/quote/:ticker', async (request, reply) => {
    const { ticker } = request.params;

    const quote = await getQuote(ticker);

    if (!quote) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `No quote found for ticker: ${ticker}`,
      });
    }

    return quote;
  });

  // Get quotes for multiple tickers
  fastify.post<{
    Body: { tickers: string[] };
  }>('/quotes', async (request, reply) => {
    const { tickers } = request.body;

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Tickers array is required',
      });
    }

    if (tickers.length > 50) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Maximum 50 tickers allowed per request',
      });
    }

    const quotes = await getQuotes(tickers);

    return Object.fromEntries(quotes);
  });

  // Get historical price data
  fastify.get<{
    Params: { ticker: string };
    Querystring: { range?: string };
  }>('/history/:ticker', async (request, reply) => {
    const { ticker } = request.params;
    const range = (request.query.range || '1Y') as '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '5Y';

    const history = await getHistoricalData(ticker, range);

    return {
      ticker,
      range,
      data: history,
    };
  });

  // Search for tickers
  fastify.get<{
    Querystring: { q: string };
  }>('/search', async (request, reply) => {
    const { q } = request.query;

    if (!q || q.length < 1) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Search query is required',
      });
    }

    const results = await searchTickers(q);

    return { results };
  });

  // Refresh market data for a portfolio
  fastify.post<{
    Params: { portfolioId: string };
  }>('/refresh/:portfolioId', async (request, reply) => {
    const { portfolioId } = request.params;

    await updatePortfolioMarketData(portfolioId);

    return { success: true, message: 'Portfolio market data refreshed' };
  });
};
