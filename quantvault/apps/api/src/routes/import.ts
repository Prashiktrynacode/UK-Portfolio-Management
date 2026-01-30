// Import Routes - CSV Parser & Data Onboarding
// apps/api/src/routes/import.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import { prisma } from '../server';
import { Decimal } from '@prisma/client/runtime/library';
import { parseCSV, validateColumnMapping, ColumnMapping } from '../utils/csv-parser';

interface ImportBody {
  portfolioId: string;
  columnMapping: ColumnMapping;
  data: Array<Record<string, any>>;
}

interface ManualEntryBody {
  portfolioId: string;
  entries: Array<{
    ticker: string;
    quantity: number;
    avgCostBasis: number;
    purchaseDate?: string;
    assetType?: string;
    accountTag?: string;
  }>;
}

export async function importRoutes(fastify: FastifyInstance) {
  // Register multipart for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // Parse CSV file and return preview
  fastify.post(
    '/parse-csv',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      const file = await request.file();
      if (!file) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'No file uploaded',
        });
      }

      // Validate file type
      const allowedTypes = ['text/csv', 'application/vnd.ms-excel'];
      if (!allowedTypes.includes(file.mimetype) && !file.filename.endsWith('.csv')) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'File must be a CSV',
        });
      }

      try {
        // Read and parse file
        const buffer = await file.toBuffer();
        const content = buffer.toString('utf-8');
        const { headers, rows, suggestedMapping } = parseCSV(content);

        return {
          filename: file.filename,
          headers,
          rowCount: rows.length,
          preview: rows.slice(0, 10), // First 10 rows for preview
          suggestedMapping,
        };
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Parse Error',
          message: err.message || 'Failed to parse CSV file',
        });
      }
    }
  );

  // Import data with column mapping
  fastify.post<{ Body: ImportBody }>(
    '/csv',
    async (request, reply) => {
      const userId = request.user!.id;
      const { portfolioId, columnMapping, data } = request.body;

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

      // Validate column mapping
      const mappingErrors = validateColumnMapping(columnMapping);
      if (mappingErrors.length > 0) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Invalid Mapping',
          message: 'Column mapping validation failed',
          details: mappingErrors,
        });
      }

      // Create import history record
      const importRecord = await prisma.importHistory.create({
        data: {
          userId,
          source: 'csv',
          sourceName: 'CSV Upload',
          status: 'PROCESSING',
          recordsTotal: data.length,
          columnMapping: columnMapping as any,
        },
      });

      // Process rows
      const results = {
        success: 0,
        failed: 0,
        errors: [] as Array<{ row: number; error: string }>,
      };

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          await processImportRow(portfolioId, row, columnMapping);
          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: err.message,
          });
        }
      }

      // Update import record
      await prisma.importHistory.update({
        where: { id: importRecord.id },
        data: {
          status: results.failed > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED',
          recordsSuccess: results.success,
          recordsFailed: results.failed,
          errors: results.errors.length > 0 ? results.errors : undefined,
          completedAt: new Date(),
        },
      });

      return {
        importId: importRecord.id,
        ...results,
      };
    }
  );

  // Manual bulk entry
  fastify.post<{ Body: ManualEntryBody }>(
    '/manual',
    async (request, reply) => {
      const userId = request.user!.id;
      const { portfolioId, entries } = request.body;

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

      // Validate entries
      const validationErrors = [];
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (!entry.ticker || entry.ticker.trim() === '') {
          validationErrors.push({ row: i + 1, field: 'ticker', error: 'Ticker is required' });
        }
        if (!entry.quantity || entry.quantity <= 0) {
          validationErrors.push({ row: i + 1, field: 'quantity', error: 'Quantity must be positive' });
        }
        if (!entry.avgCostBasis || entry.avgCostBasis <= 0) {
          validationErrors.push({ row: i + 1, field: 'avgCostBasis', error: 'Cost basis must be positive' });
        }
      }

      if (validationErrors.length > 0) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation Error',
          message: 'Some entries have validation errors',
          details: validationErrors,
        });
      }

      // Create import record
      const importRecord = await prisma.importHistory.create({
        data: {
          userId,
          source: 'manual',
          sourceName: 'Manual Entry',
          status: 'PROCESSING',
          recordsTotal: entries.length,
        },
      });

      // Process entries
      const results = {
        success: 0,
        failed: 0,
        errors: [] as Array<{ row: number; error: string }>,
        created: [] as string[],
        updated: [] as string[],
      };

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        try {
          const ticker = entry.ticker.toUpperCase().trim();
          
          // Check if position exists
          const existingPosition = await prisma.position.findFirst({
            where: { portfolioId, ticker },
          });

          if (existingPosition) {
            // Update existing position
            const newTotalQty = Number(existingPosition.quantity) + entry.quantity;
            const currentTotalCost = Number(existingPosition.quantity) * Number(existingPosition.avgCostBasis);
            const newTotalCost = currentTotalCost + (entry.quantity * entry.avgCostBasis);
            const newAvgCost = newTotalCost / newTotalQty;

            await prisma.position.update({
              where: { id: existingPosition.id },
              data: {
                quantity: new Decimal(newTotalQty),
                avgCostBasis: new Decimal(newAvgCost),
              },
            });

            // Add tax lot
            await prisma.taxLot.create({
              data: {
                positionId: existingPosition.id,
                quantity: new Decimal(entry.quantity),
                costBasis: new Decimal(entry.avgCostBasis),
                purchaseDate: entry.purchaseDate ? new Date(entry.purchaseDate) : new Date(),
              },
            });

            // Add transaction
            await prisma.transaction.create({
              data: {
                positionId: existingPosition.id,
                type: 'BUY',
                quantity: new Decimal(entry.quantity),
                price: new Decimal(entry.avgCostBasis),
                totalAmount: new Decimal(entry.quantity * entry.avgCostBasis),
                executedAt: entry.purchaseDate ? new Date(entry.purchaseDate) : new Date(),
                source: 'manual',
              },
            });

            results.updated.push(ticker);
          } else {
            // Create new position
            await prisma.position.create({
              data: {
                portfolioId,
                ticker,
                assetType: (entry.assetType as any) || 'STOCK',
                quantity: new Decimal(entry.quantity),
                avgCostBasis: new Decimal(entry.avgCostBasis),
                lots: {
                  create: {
                    quantity: new Decimal(entry.quantity),
                    costBasis: new Decimal(entry.avgCostBasis),
                    purchaseDate: entry.purchaseDate ? new Date(entry.purchaseDate) : new Date(),
                  },
                },
                transactions: {
                  create: {
                    type: 'BUY',
                    quantity: new Decimal(entry.quantity),
                    price: new Decimal(entry.avgCostBasis),
                    totalAmount: new Decimal(entry.quantity * entry.avgCostBasis),
                    executedAt: entry.purchaseDate ? new Date(entry.purchaseDate) : new Date(),
                    source: 'manual',
                  },
                },
              },
            });

            results.created.push(ticker);
          }

          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: err.message,
          });
        }
      }

      // Update import record
      await prisma.importHistory.update({
        where: { id: importRecord.id },
        data: {
          status: results.failed > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED',
          recordsSuccess: results.success,
          recordsFailed: results.failed,
          errors: results.errors.length > 0 ? results.errors : undefined,
          completedAt: new Date(),
        },
      });

      return {
        importId: importRecord.id,
        ...results,
      };
    }
  );

  // Get import history
  fastify.get(
    '/history',
    async (request, reply) => {
      const userId = request.user!.id;

      const history = await prisma.importHistory.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        take: 20,
      });

      return history;
    }
  );

  // Get available CSV templates
  fastify.get(
    '/templates',
    async (request, reply) => {
      return {
        templates: [
          {
            id: 'generic',
            name: 'Generic CSV Template',
            description: 'Standard format with Ticker, Quantity, Cost Basis, Date',
            columns: ['ticker', 'quantity', 'cost_basis', 'purchase_date'],
            sampleUrl: '/templates/generic-template.csv',
          },
          {
            id: 'fidelity',
            name: 'Fidelity Export',
            description: 'Compatible with Fidelity brokerage exports',
            columns: ['Symbol', 'Quantity', 'Cost Basis Total', 'Acquisition Date'],
          },
          {
            id: 'schwab',
            name: 'Charles Schwab Export',
            description: 'Compatible with Schwab account exports',
            columns: ['Symbol', 'Qty', 'Cost Basis', 'Date Acquired'],
          },
          {
            id: 'robinhood',
            name: 'Robinhood Export',
            description: 'Compatible with Robinhood account exports',
            columns: ['Instrument', 'Quantity', 'Average Cost', 'Date'],
          },
        ],
      };
    }
  );
}

// Helper to process a single import row
async function processImportRow(
  portfolioId: string,
  row: Record<string, any>,
  mapping: ColumnMapping
) {
  const ticker = String(row[mapping.ticker] || '').toUpperCase().trim();
  const quantity = parseFloat(row[mapping.quantity]);
  const costBasis = parseFloat(row[mapping.costBasis]);
  const purchaseDate = mapping.purchaseDate 
    ? new Date(row[mapping.purchaseDate])
    : new Date();

  if (!ticker) throw new Error('Missing ticker symbol');
  if (isNaN(quantity) || quantity <= 0) throw new Error('Invalid quantity');
  if (isNaN(costBasis) || costBasis <= 0) throw new Error('Invalid cost basis');

  // Check if position exists
  const existingPosition = await prisma.position.findFirst({
    where: { portfolioId, ticker },
  });

  if (existingPosition) {
    // Update existing
    const newTotalQty = Number(existingPosition.quantity) + quantity;
    const currentTotalCost = Number(existingPosition.quantity) * Number(existingPosition.avgCostBasis);
    const newTotalCost = currentTotalCost + (quantity * costBasis);
    const newAvgCost = newTotalCost / newTotalQty;

    await prisma.position.update({
      where: { id: existingPosition.id },
      data: {
        quantity: new Decimal(newTotalQty),
        avgCostBasis: new Decimal(newAvgCost),
      },
    });

    await prisma.taxLot.create({
      data: {
        positionId: existingPosition.id,
        quantity: new Decimal(quantity),
        costBasis: new Decimal(costBasis),
        purchaseDate,
      },
    });

    await prisma.transaction.create({
      data: {
        positionId: existingPosition.id,
        type: 'BUY',
        quantity: new Decimal(quantity),
        price: new Decimal(costBasis),
        totalAmount: new Decimal(quantity * costBasis),
        executedAt: purchaseDate,
        source: 'csv',
      },
    });
  } else {
    // Create new position
    await prisma.position.create({
      data: {
        portfolioId,
        ticker,
        assetType: 'STOCK',
        quantity: new Decimal(quantity),
        avgCostBasis: new Decimal(costBasis),
        lots: {
          create: {
            quantity: new Decimal(quantity),
            costBasis: new Decimal(costBasis),
            purchaseDate,
          },
        },
        transactions: {
          create: {
            type: 'BUY',
            quantity: new Decimal(quantity),
            price: new Decimal(costBasis),
            totalAmount: new Decimal(quantity * costBasis),
            executedAt: purchaseDate,
            source: 'csv',
          },
        },
      },
    });
  }
}
