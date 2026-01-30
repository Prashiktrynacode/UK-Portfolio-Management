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
