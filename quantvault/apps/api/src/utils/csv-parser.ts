// CSV Parser Utility
// apps/api/src/utils/csv-parser.ts

export interface ColumnMapping {
  ticker: string;
  quantity: string;
  costBasis: string;
  purchaseDate?: string;
  assetType?: string;
  name?: string;
}

interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  suggestedMapping: Partial<ColumnMapping>;
}

// Common column name variations for auto-detection
const TICKER_PATTERNS = ['ticker', 'symbol', 'stock', 'instrument', 'security', 'name', 'asset'];
const QUANTITY_PATTERNS = ['quantity', 'qty', 'shares', 'units', 'amount', 'position'];
const COST_PATTERNS = ['cost', 'price', 'basis', 'average', 'avg', 'purchase'];
const DATE_PATTERNS = ['date', 'acquired', 'purchase', 'bought', 'opened'];

/**
 * Parse CSV content into structured data
 */
export function parseCSV(content: string): ParsedCSV {
  // Handle different line endings
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Detect delimiter (comma, semicolon, or tab)
  const delimiter = detectDelimiter(lines[0]);

  // Parse headers
  const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim());
  
  if (headers.length === 0) {
    throw new Error('No headers found in CSV');
  }

  // Parse data rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    if (values.length === 0 || values.every(v => !v.trim())) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });
    rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error('No data rows found in CSV');
  }

  // Auto-detect column mapping
  const suggestedMapping = detectColumnMapping(headers);

  return {
    headers,
    rows,
    suggestedMapping,
  };
}

/**
 * Detect the delimiter used in CSV
 */
function detectDelimiter(line: string): string {
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  const tabCount = (line.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Auto-detect column mapping based on header names
 */
function detectColumnMapping(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  // Find ticker column
  const tickerIndex = normalizedHeaders.findIndex(h => 
    TICKER_PATTERNS.some(p => h.includes(p))
  );
  if (tickerIndex >= 0) mapping.ticker = headers[tickerIndex];

  // Find quantity column
  const qtyIndex = normalizedHeaders.findIndex(h => 
    QUANTITY_PATTERNS.some(p => h.includes(p))
  );
  if (qtyIndex >= 0) mapping.quantity = headers[qtyIndex];

  // Find cost basis column
  const costIndex = normalizedHeaders.findIndex(h => 
    COST_PATTERNS.some(p => h.includes(p))
  );
  if (costIndex >= 0) mapping.costBasis = headers[costIndex];

  // Find purchase date column
  const dateIndex = normalizedHeaders.findIndex(h => 
    DATE_PATTERNS.some(p => h.includes(p))
  );
  if (dateIndex >= 0) mapping.purchaseDate = headers[dateIndex];

  return mapping;
}

/**
 * Validate column mapping
 */
export function validateColumnMapping(mapping: ColumnMapping): string[] {
  const errors: string[] = [];

  if (!mapping.ticker) {
    errors.push('Ticker column is required');
  }

  if (!mapping.quantity) {
    errors.push('Quantity column is required');
  }

  if (!mapping.costBasis) {
    errors.push('Cost basis column is required');
  }

  return errors;
}

/**
 * Clean and validate a single value
 */
export function cleanValue(value: string, type: 'string' | 'number' | 'date'): any {
  const trimmed = value.trim();

  switch (type) {
    case 'string':
      return trimmed;

    case 'number':
      // Remove currency symbols and commas
      const cleaned = trimmed.replace(/[$€£¥,]/g, '').replace(/\s/g, '');
      const num = parseFloat(cleaned);
      if (isNaN(num)) {
        throw new Error(`Invalid number: ${value}`);
      }
      return num;

    case 'date':
      if (!trimmed) return null;
      const date = new Date(trimmed);
      if (isNaN(date.getTime())) {
        // Try common date formats
        const formats = [
          /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
          /(\d{1,2})-(\d{1,2})-(\d{4})/,   // MM-DD-YYYY
          /(\d{4})-(\d{1,2})-(\d{1,2})/,   // YYYY-MM-DD
        ];
        
        for (const format of formats) {
          const match = trimmed.match(format);
          if (match) {
            const parsed = new Date(trimmed);
            if (!isNaN(parsed.getTime())) {
              return parsed;
            }
          }
        }
        throw new Error(`Invalid date: ${value}`);
      }
      return date;

    default:
      return trimmed;
  }
}

/**
 * Generate CSV template content
 */
export function generateTemplate(): string {
  const headers = ['ticker', 'quantity', 'cost_basis', 'purchase_date', 'asset_type'];
  const sampleRows = [
    ['AAPL', '100', '150.00', '2024-01-15', 'STOCK'],
    ['MSFT', '50', '380.00', '2024-02-20', 'STOCK'],
    ['VTI', '200', '225.00', '2024-03-10', 'ETF'],
  ];

  return [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
}

/**
 * Trading 212 specific transaction types
 */
const TRADING_212_BUY_ACTIONS = ['market buy', 'limit buy'];
const TRADING_212_SELL_ACTIONS = ['market sell', 'limit sell'];
const TRADING_212_IGNORE_ACTIONS = [
  'interest on cash',
  'dividend',
  'deposit',
  'withdrawal',
  'dividend (dividends paid by issuers)',
  'dividend (ordinary)',
  'currency conversion',
  'new card cost',
  'lending interest',
];

export interface Trading212Transaction {
  action: string;
  time: string;
  isin: string;
  ticker: string;
  name: string;
  shares: number;
  pricePerShare: number;
  currency: string;
  exchangeRate: number;
  total: number;
  resultCurrency: string;
}

export interface AggregatedPosition {
  ticker: string;
  name: string;
  totalShares: number;
  totalCost: number;
  avgCostBasis: number;
  currency: string;
  firstPurchaseDate: string;
  transactions: Array<{
    type: 'BUY' | 'SELL';
    shares: number;
    price: number;
    date: string;
    total: number;
  }>;
}

/**
 * Parse Trading 212 CSV export and aggregate into current positions
 */
export function parseTrading212CSV(content: string): {
  positions: AggregatedPosition[];
  summary: {
    totalBuys: number;
    totalSells: number;
    ignoredTransactions: number;
    positionsWithHoldings: number;
    positionsFullySold: number;
  };
} {
  const { headers, rows } = parseCSV(content);

  // Normalize headers to lowercase for matching
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  // Find column indices - handle Trading 212 specific column names
  const actionIdx = normalizedHeaders.findIndex(h => h === 'action');
  const timeIdx = normalizedHeaders.findIndex(h => h === 'time');
  const isinIdx = normalizedHeaders.findIndex(h => h === 'isin');
  const tickerIdx = normalizedHeaders.findIndex(h => h === 'ticker');
  const nameIdx = normalizedHeaders.findIndex(h => h === 'name');
  const sharesIdx = normalizedHeaders.findIndex(h => h.includes('no. of shares') || h.includes('shares'));
  const priceIdx = normalizedHeaders.findIndex(h => h.includes('price / share') || h === 'price');
  const currencyPriceIdx = normalizedHeaders.findIndex(h => h.includes('currency (price'));
  const exchangeRateIdx = normalizedHeaders.findIndex(h => h.includes('exchange rate'));
  const totalIdx = normalizedHeaders.findIndex(h => h.includes('total') && !h.includes('currency'));
  const resultCurrencyIdx = normalizedHeaders.findIndex(h => h.includes('currency (result') || h.includes('result'));

  if (actionIdx === -1 || tickerIdx === -1) {
    throw new Error('Could not find required columns (Action, Ticker) in Trading 212 CSV');
  }

  // Parse transactions
  const transactions: Trading212Transaction[] = [];
  let totalBuys = 0;
  let totalSells = 0;
  let ignoredTransactions = 0;

  for (const row of rows) {
    const values = Object.values(row);
    const action = (values[actionIdx] || '').toString().toLowerCase().trim();

    // Check if this is a buy or sell transaction
    const isBuy = TRADING_212_BUY_ACTIONS.some(a => action.includes(a));
    const isSell = TRADING_212_SELL_ACTIONS.some(a => action.includes(a));

    if (!isBuy && !isSell) {
      // Check if it's a known ignore action or just skip
      const isIgnored = TRADING_212_IGNORE_ACTIONS.some(a => action.includes(a));
      if (isIgnored || action) {
        ignoredTransactions++;
      }
      continue;
    }

    const ticker = (values[tickerIdx] || '').toString().trim();
    if (!ticker) continue;

    const shares = parseFloat((values[sharesIdx] || '0').toString().replace(/[^0-9.-]/g, '')) || 0;
    const pricePerShare = parseFloat((values[priceIdx] || '0').toString().replace(/[^0-9.-]/g, '')) || 0;
    const total = parseFloat((values[totalIdx] || '0').toString().replace(/[^0-9.-]/g, '')) || 0;

    if (shares === 0) continue;

    if (isBuy) totalBuys++;
    if (isSell) totalSells++;

    transactions.push({
      action: isBuy ? 'BUY' : 'SELL',
      time: (values[timeIdx] || '').toString().trim(),
      isin: isinIdx >= 0 ? (values[isinIdx] || '').toString().trim() : '',
      ticker,
      name: nameIdx >= 0 ? (values[nameIdx] || '').toString().trim() : ticker,
      shares: isBuy ? shares : -shares, // Negative for sells
      pricePerShare,
      currency: currencyPriceIdx >= 0 ? (values[currencyPriceIdx] || 'GBP').toString().trim() : 'GBP',
      exchangeRate: exchangeRateIdx >= 0 ? parseFloat((values[exchangeRateIdx] || '1').toString()) || 1 : 1,
      total: isBuy ? total : -total, // Negative for sells
      resultCurrency: resultCurrencyIdx >= 0 ? (values[resultCurrencyIdx] || 'GBP').toString().trim() : 'GBP',
    });
  }

  // Aggregate transactions by ticker
  const positionMap = new Map<string, AggregatedPosition>();

  for (const tx of transactions) {
    let position = positionMap.get(tx.ticker);

    if (!position) {
      position = {
        ticker: tx.ticker,
        name: tx.name,
        totalShares: 0,
        totalCost: 0,
        avgCostBasis: 0,
        currency: tx.currency,
        firstPurchaseDate: tx.time,
        transactions: [],
      };
      positionMap.set(tx.ticker, position);
    }

    // Track transaction
    position.transactions.push({
      type: tx.shares > 0 ? 'BUY' : 'SELL',
      shares: Math.abs(tx.shares),
      price: tx.pricePerShare,
      date: tx.time,
      total: Math.abs(tx.total),
    });

    // For cost basis calculation, we use FIFO-like approach
    if (tx.shares > 0) {
      // Buy: add to total cost
      position.totalCost += tx.shares * tx.pricePerShare;
      position.totalShares += tx.shares;
    } else {
      // Sell: reduce shares but proportionally reduce cost basis
      const sellShares = Math.abs(tx.shares);
      if (position.totalShares > 0) {
        const proportionSold = sellShares / position.totalShares;
        position.totalCost -= position.totalCost * proportionSold;
      }
      position.totalShares += tx.shares; // tx.shares is negative for sells
    }

    // Update first purchase date if this is earlier
    if (tx.shares > 0 && new Date(tx.time) < new Date(position.firstPurchaseDate)) {
      position.firstPurchaseDate = tx.time;
    }
  }

  // Calculate final avg cost basis and filter out fully sold positions
  const positions: AggregatedPosition[] = [];
  let positionsFullySold = 0;

  for (const position of positionMap.values()) {
    // Round to avoid floating point issues
    position.totalShares = Math.round(position.totalShares * 10000) / 10000;

    if (position.totalShares <= 0.0001) {
      // Position fully sold
      positionsFullySold++;
      continue;
    }

    // Calculate avg cost basis per share
    position.avgCostBasis = position.totalCost / position.totalShares;
    positions.push(position);
  }

  // Sort by ticker
  positions.sort((a, b) => a.ticker.localeCompare(b.ticker));

  return {
    positions,
    summary: {
      totalBuys,
      totalSells,
      ignoredTransactions,
      positionsWithHoldings: positions.length,
      positionsFullySold,
    },
  };
}
