// Market Data Service - Yahoo Finance Integration
// apps/api/src/services/market-data-service.ts

import { prisma } from '../server';

interface YahooQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  marketCap: number;
  trailingPE: number;
  dividendYield: number;
  shortName: string;
  longName: string;
  sector: string;
  industry: string;
  exchange: string;
}

interface QuoteResult {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  weekHigh52: number | null;
  weekLow52: number | null;
  marketCap: number | null;
  peRatio: number | null;
  dividendYield: number | null;
  name: string | null;
  sector: string | null;
  industry: string | null;
  exchange: string | null;
}

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;
const quoteCache = new Map<string, { data: QuoteResult; timestamp: number }>();

/**
 * Fetch quote from Yahoo Finance API
 */
async function fetchYahooQuote(ticker: string): Promise<QuoteResult | null> {
  try {
    // Use Yahoo Finance v8 API
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.error(`Yahoo Finance API error for ${ticker}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      console.error(`No data found for ${ticker}`);
      return null;
    }

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];

    const currentPrice = meta.regularMarketPrice || meta.previousClose || 0;
    const previousClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
    const change = currentPrice - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;

    return {
      ticker: meta.symbol,
      price: currentPrice,
      change: change,
      changePercent: changePercent,
      dayHigh: quote?.high?.[0] || meta.regularMarketDayHigh || null,
      dayLow: quote?.low?.[0] || meta.regularMarketDayLow || null,
      volume: meta.regularMarketVolume || null,
      weekHigh52: meta.fiftyTwoWeekHigh || null,
      weekLow52: meta.fiftyTwoWeekLow || null,
      marketCap: null, // Not available in chart API
      peRatio: null,
      dividendYield: null,
      name: meta.shortName || meta.longName || ticker,
      sector: null,
      industry: null,
      exchange: meta.exchangeName || meta.exchange || null,
    };
  } catch (error) {
    console.error(`Error fetching quote for ${ticker}:`, error);
    return null;
  }
}

/**
 * Get quote with caching
 */
export async function getQuote(ticker: string): Promise<QuoteResult | null> {
  const normalizedTicker = ticker.toUpperCase();

  // Check memory cache first
  const cached = quoteCache.get(normalizedTicker);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  // Check database cache
  const dbCache = await prisma.marketDataCache.findUnique({
    where: { ticker: normalizedTicker },
  });

  if (dbCache && Date.now() - dbCache.updatedAt.getTime() < CACHE_DURATION) {
    const result: QuoteResult = {
      ticker: dbCache.ticker,
      price: Number(dbCache.price),
      change: Number(dbCache.change),
      changePercent: Number(dbCache.changePercent),
      dayHigh: dbCache.dayHigh ? Number(dbCache.dayHigh) : null,
      dayLow: dbCache.dayLow ? Number(dbCache.dayLow) : null,
      volume: dbCache.volume ? Number(dbCache.volume) : null,
      weekHigh52: dbCache.weekHigh52 ? Number(dbCache.weekHigh52) : null,
      weekLow52: dbCache.weekLow52 ? Number(dbCache.weekLow52) : null,
      marketCap: dbCache.marketCap ? Number(dbCache.marketCap) : null,
      peRatio: dbCache.peRatio ? Number(dbCache.peRatio) : null,
      dividendYield: dbCache.dividendYield ? Number(dbCache.dividendYield) : null,
      name: dbCache.name,
      sector: dbCache.sector,
      industry: dbCache.industry,
      exchange: dbCache.exchange,
    };

    quoteCache.set(normalizedTicker, { data: result, timestamp: Date.now() });
    return result;
  }

  // Fetch fresh data
  const quote = await fetchYahooQuote(normalizedTicker);

  if (quote) {
    // Update database cache
    await prisma.marketDataCache.upsert({
      where: { ticker: normalizedTicker },
      update: {
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        dayHigh: quote.dayHigh,
        dayLow: quote.dayLow,
        volume: quote.volume,
        weekHigh52: quote.weekHigh52,
        weekLow52: quote.weekLow52,
        marketCap: quote.marketCap,
        peRatio: quote.peRatio,
        dividendYield: quote.dividendYield,
        name: quote.name,
        sector: quote.sector,
        industry: quote.industry,
        exchange: quote.exchange,
      },
      create: {
        ticker: normalizedTicker,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        dayHigh: quote.dayHigh,
        dayLow: quote.dayLow,
        volume: quote.volume,
        weekHigh52: quote.weekHigh52,
        weekLow52: quote.weekLow52,
        marketCap: quote.marketCap,
        peRatio: quote.peRatio,
        dividendYield: quote.dividendYield,
        name: quote.name,
        sector: quote.sector,
        industry: quote.industry,
        exchange: quote.exchange,
      },
    });

    quoteCache.set(normalizedTicker, { data: quote, timestamp: Date.now() });
  }

  return quote;
}

/**
 * Get quotes for multiple tickers
 */
export async function getQuotes(tickers: string[]): Promise<Map<string, QuoteResult>> {
  const results = new Map<string, QuoteResult>();

  // Fetch all quotes in parallel
  const promises = tickers.map(async (ticker) => {
    const quote = await getQuote(ticker);
    if (quote) {
      results.set(ticker.toUpperCase(), quote);
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Update position with latest market data
 */
export async function updatePositionMarketData(positionId: string): Promise<void> {
  const position = await prisma.position.findUnique({
    where: { id: positionId },
  });

  if (!position) return;

  const quote = await getQuote(position.ticker);
  if (!quote) return;

  const quantity = Number(position.quantity);
  const avgCostBasis = Number(position.avgCostBasis);
  const currentPrice = quote.price;
  const marketValue = quantity * currentPrice;
  const totalCost = quantity * avgCostBasis;
  const unrealizedPL = marketValue - totalCost;
  const unrealizedPLPercent = totalCost > 0 ? (unrealizedPL / totalCost) * 100 : 0;

  await prisma.position.update({
    where: { id: positionId },
    data: {
      currentPrice: currentPrice,
      dayChange: quote.change,
      dayChangePercent: quote.changePercent,
      marketValue: marketValue,
      unrealizedPL: unrealizedPL,
      unrealizedPLPercent: unrealizedPLPercent,
      name: quote.name || position.name,
      sector: quote.sector || position.sector,
      exchange: quote.exchange || position.exchange,
    },
  });
}

/**
 * Update all positions in a portfolio with latest market data
 */
export async function updatePortfolioMarketData(portfolioId: string): Promise<void> {
  const positions = await prisma.position.findMany({
    where: { portfolioId },
  });

  // Get unique tickers
  const tickers = [...new Set(positions.map(p => p.ticker))];

  // Fetch all quotes
  const quotes = await getQuotes(tickers);

  // Update each position
  let totalValue = 0;
  let totalCost = 0;
  let totalDayChange = 0;

  for (const position of positions) {
    const quote = quotes.get(position.ticker.toUpperCase());
    if (!quote) continue;

    const quantity = Number(position.quantity);
    const avgCostBasis = Number(position.avgCostBasis);
    const currentPrice = quote.price;
    const marketValue = quantity * currentPrice;
    const positionCost = quantity * avgCostBasis;
    const unrealizedPL = marketValue - positionCost;
    const unrealizedPLPercent = positionCost > 0 ? (unrealizedPL / positionCost) * 100 : 0;
    const dayChange = quantity * quote.change;

    await prisma.position.update({
      where: { id: position.id },
      data: {
        currentPrice: currentPrice,
        dayChange: quote.change,
        dayChangePercent: quote.changePercent,
        marketValue: marketValue,
        unrealizedPL: unrealizedPL,
        unrealizedPLPercent: unrealizedPLPercent,
        name: quote.name || position.name,
        sector: quote.sector || position.sector,
        exchange: quote.exchange || position.exchange,
      },
    });

    totalValue += marketValue;
    totalCost += positionCost;
    totalDayChange += dayChange;
  }

  // Update portfolio totals
  const dayChangePercent = totalValue > 0 ? (totalDayChange / totalValue) * 100 : 0;

  await prisma.portfolio.update({
    where: { id: portfolioId },
    data: {
      totalValue: totalValue,
      totalCost: totalCost,
      dayChange: totalDayChange,
      dayChangePercent: dayChangePercent,
    },
  });
}

/**
 * Get historical price data for a ticker
 */
export async function getHistoricalData(
  ticker: string,
  range: '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '5Y' = '1Y'
): Promise<{ date: string; close: number }[]> {
  try {
    const intervalMap: Record<string, string> = {
      '1D': '5m',
      '5D': '15m',
      '1M': '1d',
      '3M': '1d',
      '6M': '1d',
      '1Y': '1d',
      '5Y': '1wk',
    };

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${intervalMap[range]}&range=${range.toLowerCase()}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      return [];
    }

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    return timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      close: closes[i] || 0,
    })).filter((d: any) => d.close > 0);
  } catch (error) {
    console.error(`Error fetching historical data for ${ticker}:`, error);
    return [];
  }
}

/**
 * Search for tickers
 */
export async function searchTickers(query: string): Promise<{
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const quotes = data.quotes || [];

    return quotes.map((q: any) => ({
      symbol: q.symbol,
      name: q.shortname || q.longname || q.symbol,
      exchange: q.exchange || '',
      type: q.quoteType || 'EQUITY',
    }));
  } catch (error) {
    console.error(`Error searching tickers:`, error);
    return [];
  }
}
