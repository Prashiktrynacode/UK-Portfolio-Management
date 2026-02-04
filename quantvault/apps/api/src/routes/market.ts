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

    console.log(`Received refresh request for portfolio: ${portfolioId}`);

    if (!portfolioId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Portfolio ID is required',
      });
    }

    try {
      await updatePortfolioMarketData(portfolioId);
      console.log(`Successfully refreshed market data for portfolio: ${portfolioId}`);
      return { success: true, message: 'Portfolio market data refreshed' };
    } catch (error: any) {
      console.error('Error refreshing portfolio market data:', error);
      console.error('Error stack:', error.stack);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: error.message || 'Failed to refresh market data',
      });
    }
  });

  // ============================================
  // INDIAN MUTUAL FUND ENDPOINTS (using mfapi.in)
  // ============================================

  // Search Indian mutual funds by name
  fastify.get<{
    Querystring: { q: string };
  }>('/mf/search', async (request, reply) => {
    const { q } = request.query;

    if (!q || q.length < 2) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Search query must be at least 2 characters',
      });
    }

    try {
      console.log(`Searching MF API for: ${q}`);
      const url = `https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`;
      console.log(`URL: ${url}`);

      const response = await fetch(url);
      console.log(`MF search response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('MF search failed:', errorText);
        throw new Error(`Failed to search mutual funds: ${response.status}`);
      }

      const data = await response.json() as any;
      console.log(`MF search returned ${Array.isArray(data) ? data.length : 'non-array'} results`);

      // Handle both array and object responses
      const results = Array.isArray(data) ? data : (data.data || []);

      // Return formatted results
      return {
        results: results.slice(0, 50).map((fund: any) => ({
          schemeCode: String(fund.schemeCode),
          schemeName: fund.schemeName,
        })),
      };
    } catch (error: any) {
      console.error('MF search error:', error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: error.message || 'Failed to search mutual funds',
      });
    }
  });

  // Get latest NAV for a mutual fund scheme
  fastify.get<{
    Params: { schemeCode: string };
  }>('/mf/:schemeCode/latest', async (request, reply) => {
    const { schemeCode } = request.params;

    try {
      console.log(`Fetching latest NAV for scheme: ${schemeCode}`);

      // Use the main endpoint which returns latest NAV in data[0]
      const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
      console.log(`MF NAV response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('MF NAV fetch failed:', errorText);
        throw new Error(`Failed to fetch NAV: ${response.status}`);
      }

      const data = await response.json() as any;
      console.log(`MF data meta:`, data.meta);
      console.log(`MF data first entry:`, data.data?.[0]);

      return {
        schemeCode: String(data.meta?.scheme_code || schemeCode),
        schemeName: data.meta?.scheme_name || 'Unknown',
        fundHouse: data.meta?.fund_house || 'Unknown',
        schemeType: data.meta?.scheme_type || 'Unknown',
        schemeCategory: data.meta?.scheme_category || 'Unknown',
        nav: parseFloat(data.data?.[0]?.nav || '0'),
        date: data.data?.[0]?.date || null,
      };
    } catch (error: any) {
      console.error('MF NAV fetch error:', error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch NAV',
      });
    }
  });

  // Get NAV history for a mutual fund scheme
  fastify.get<{
    Params: { schemeCode: string };
  }>('/mf/:schemeCode/history', async (request, reply) => {
    const { schemeCode } = request.params;

    try {
      console.log(`Fetching NAV history for scheme: ${schemeCode}`);
      const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('MF history fetch failed:', errorText);
        throw new Error(`Failed to fetch NAV history: ${response.status}`);
      }

      const data = await response.json() as any;

      return {
        schemeCode: String(data.meta?.scheme_code || schemeCode),
        schemeName: data.meta?.scheme_name || 'Unknown',
        fundHouse: data.meta?.fund_house || 'Unknown',
        schemeType: data.meta?.scheme_type || 'Unknown',
        schemeCategory: data.meta?.scheme_category || 'Unknown',
        data: (data.data || []).slice(0, 365).map((item: any) => ({
          date: item.date,
          nav: parseFloat(item.nav),
        })),
      };
    } catch (error: any) {
      console.error('MF history fetch error:', error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch NAV history',
      });
    }
  });
};
