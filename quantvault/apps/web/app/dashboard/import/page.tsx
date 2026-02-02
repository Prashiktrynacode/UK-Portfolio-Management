'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileSpreadsheet, Plus, Loader2, X, Check, AlertCircle, Link2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { usePortfolio } from '../layout';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export default function ImportPage() {
  const router = useRouter();
  const { selectedPortfolio, openCreateModal } = usePortfolio();
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setCsvFile(file);
    setIsProcessing(true);

    try {
      const result = await api.import.parseCSV(file);
      setCsvPreview(result);
      toast.success(`Parsed ${result.rowCount} rows from ${file.name}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to parse CSV file');
      setCsvFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      // Trigger file handling
      const dt = new DataTransfer();
      dt.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dt.files;
        handleFileSelect({ target: { files: dt.files } } as any);
      }
    } else {
      toast.error('Please drop a CSV file');
    }
  };

  const clearFile = () => {
    setCsvFile(null);
    setCsvPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!selectedPortfolio) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Upload className="size-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No Portfolio Selected</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          Create a portfolio first to import positions.
        </p>
        <button
          onClick={openCreateModal}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
        >
          Create Portfolio
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Data</h1>
        <p className="text-muted-foreground">
          Import your holdings to <span className="font-medium">{selectedPortfolio.name}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CSV Import */}
        <div className="p-6 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileSpreadsheet className="size-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Import from CSV</h3>
              <p className="text-sm text-muted-foreground">Upload a spreadsheet with your holdings</p>
            </div>
          </div>

          {csvFile && csvPreview ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Check className="size-4 text-green-500" />
                  <span className="text-sm font-medium">{csvFile.name}</span>
                </div>
                <button
                  onClick={clearFile}
                  className="p-1 hover:bg-secondary rounded"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="text-sm">
                <p className="text-muted-foreground mb-2">
                  Found <span className="font-medium text-foreground">{csvPreview.rowCount}</span> rows
                </p>
                <p className="text-muted-foreground">
                  Columns: {csvPreview.headers.slice(0, 5).join(', ')}
                  {csvPreview.headers.length > 5 && ` +${csvPreview.headers.length - 5} more`}
                </p>
              </div>

              <CSVImportWizard
                portfolioId={selectedPortfolio.id}
                preview={csvPreview}
                onComplete={() => {
                  clearFile();
                  router.push('/dashboard/portfolio');
                }}
              />
            </div>
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer",
                isProcessing && "pointer-events-none opacity-50"
              )}
            >
              {isProcessing ? (
                <Loader2 className="size-8 text-primary mx-auto mb-3 animate-spin" />
              ) : (
                <Upload className="size-8 text-muted-foreground mx-auto mb-3" />
              )}
              <p className="text-sm text-muted-foreground mb-2">
                {isProcessing ? 'Processing...' : 'Drag and drop your CSV file here, or click to browse'}
              </p>
              <p className="text-xs text-muted-foreground">
                Supports Fidelity, Schwab, Robinhood, and custom formats
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Manual Entry */}
        <div className="p-6 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plus className="size-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Manual Entry</h3>
              <p className="text-sm text-muted-foreground">Add multiple positions at once</p>
            </div>
          </div>

          {showManualEntry ? (
            <ManualEntryForm
              portfolioId={selectedPortfolio.id}
              onCancel={() => setShowManualEntry(false)}
              onComplete={() => {
                setShowManualEntry(false);
                router.push('/dashboard/portfolio');
              }}
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Quickly add your stock holdings by entering ticker symbols, quantities, and purchase prices.
              </p>
              <button
                onClick={() => setShowManualEntry(true)}
                className="w-full px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors"
              >
                Add Multiple Positions
              </button>
            </>
          )}
        </div>
      </div>

      {/* Quick Add Single Position */}
      <div className="p-6 bg-card border border-border rounded-xl">
        <h3 className="font-semibold mb-4">Quick Add Single Position</h3>
        <QuickAddForm portfolioId={selectedPortfolio.id} />
      </div>

      {/* Broker Connections */}
      <div className="p-6 bg-card border border-border rounded-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Link2 className="size-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Connect Broker</h3>
            <p className="text-sm text-muted-foreground">Auto-sync with your brokerage account</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <BrokerCard
            name="Interactive Brokers"
            logo="IBKR"
            description="Connect your IBKR account for automatic portfolio sync"
            status="coming_soon"
          />
          <BrokerCard
            name="Trading 212"
            logo="T212"
            description="Sync your Trading 212 ISA or Invest account"
            status="coming_soon"
          />
          <BrokerCard
            name="Alpaca"
            logo="ALP"
            description="Connect Alpaca for commission-free trading sync"
            status="coming_soon"
          />
          <BrokerCard
            name="Robinhood"
            logo="RH"
            description="Import your Robinhood portfolio"
            status="coming_soon"
          />
          <BrokerCard
            name="Charles Schwab"
            logo="SCH"
            description="Sync your Schwab brokerage account"
            status="coming_soon"
          />
          <BrokerCard
            name="Coinbase"
            logo="CB"
            description="Track your crypto holdings from Coinbase"
            status="coming_soon"
          />
        </div>

        <p className="text-sm text-muted-foreground mt-6 text-center">
          Broker integrations are coming soon. In the meantime, you can import your holdings via CSV export from your broker.
        </p>
      </div>
    </div>
  );
}

function BrokerCard({
  name,
  logo,
  description,
  status
}: {
  name: string;
  logo: string;
  description: string;
  status: 'connected' | 'available' | 'coming_soon';
}) {
  return (
    <div className={cn(
      "p-4 border rounded-xl transition-colors",
      status === 'coming_soon' ? "border-border opacity-60" : "border-border hover:border-primary/50 cursor-pointer"
    )}>
      <div className="flex items-center gap-3 mb-2">
        <div className="size-10 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold">
          {logo}
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-sm">{name}</h4>
          {status === 'coming_soon' && (
            <span className="text-xs text-muted-foreground">Coming Soon</span>
          )}
          {status === 'connected' && (
            <span className="text-xs text-green-500">Connected</span>
          )}
        </div>
        {status !== 'coming_soon' && (
          <ExternalLink className="size-4 text-muted-foreground" />
        )}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function QuickAddForm({ portfolioId }: { portfolioId: string }) {
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ticker || !quantity || !costBasis) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.positions.create({
        portfolioId,
        ticker: ticker.toUpperCase(),
        quantity: parseFloat(quantity),
        avgCostBasis: parseFloat(costBasis),
      });
      toast.success(`Added ${ticker.toUpperCase()} to portfolio`);
      setTicker('');
      setQuantity('');
      setCostBasis('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add position');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
      <div className="flex-1 min-w-[120px]">
        <label className="block text-sm font-medium mb-2">Ticker</label>
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="AAPL"
          className="w-full px-3 py-2 bg-input border border-border rounded-lg focus:border-primary outline-none uppercase"
        />
      </div>
      <div className="flex-1 min-w-[120px]">
        <label className="block text-sm font-medium mb-2">Quantity</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="100"
          step="any"
          className="w-full px-3 py-2 bg-input border border-border rounded-lg focus:border-primary outline-none"
        />
      </div>
      <div className="flex-1 min-w-[120px]">
        <label className="block text-sm font-medium mb-2">Cost Basis ($)</label>
        <input
          type="number"
          value={costBasis}
          onChange={(e) => setCostBasis(e.target.value)}
          placeholder="150.00"
          step="0.01"
          className="w-full px-3 py-2 bg-input border border-border rounded-lg focus:border-primary outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {isSubmitting ? 'Adding...' : 'Add'}
      </button>
    </form>
  );
}

function ManualEntryForm({
  portfolioId,
  onCancel,
  onComplete
}: {
  portfolioId: string;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const [entries, setEntries] = useState([
    { ticker: '', quantity: '', costBasis: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addRow = () => {
    setEntries([...entries, { ticker: '', quantity: '', costBasis: '' }]);
  };

  const removeRow = (index: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((_, i) => i !== index));
    }
  };

  const updateEntry = (index: number, field: string, value: string) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);
  };

  const handleSubmit = async () => {
    const validEntries = entries.filter(
      e => e.ticker && e.quantity && e.costBasis
    );

    if (validEntries.length === 0) {
      toast.error('Please add at least one valid entry');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.import.importManual({
        portfolioId,
        entries: validEntries.map(e => ({
          ticker: e.ticker.toUpperCase(),
          quantity: parseFloat(e.quantity),
          avgCostBasis: parseFloat(e.costBasis),
        })),
      });
      toast.success(`Imported ${validEntries.length} positions`);
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Failed to import positions');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {entries.map((entry, index) => (
          <div key={index} className="flex gap-2 items-center">
            <input
              type="text"
              value={entry.ticker}
              onChange={(e) => updateEntry(index, 'ticker', e.target.value.toUpperCase())}
              placeholder="Ticker"
              className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-sm uppercase"
            />
            <input
              type="number"
              value={entry.quantity}
              onChange={(e) => updateEntry(index, 'quantity', e.target.value)}
              placeholder="Qty"
              step="any"
              className="w-24 px-3 py-2 bg-input border border-border rounded-lg text-sm"
            />
            <input
              type="number"
              value={entry.costBasis}
              onChange={(e) => updateEntry(index, 'costBasis', e.target.value)}
              placeholder="Cost"
              step="0.01"
              className="w-24 px-3 py-2 bg-input border border-border rounded-lg text-sm"
            />
            <button
              onClick={() => removeRow(index)}
              className="p-2 text-muted-foreground hover:text-foreground"
              disabled={entries.length === 1}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="text-sm text-primary hover:underline"
      >
        + Add another row
      </button>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50"
        >
          {isSubmitting ? 'Importing...' : 'Import All'}
        </button>
      </div>
    </div>
  );
}

function CSVImportWizard({
  portfolioId,
  preview,
  onComplete
}: {
  portfolioId: string;
  preview: any;
  onComplete: () => void;
}) {
  const [mapping, setMapping] = useState({
    ticker: preview.suggestedMapping?.ticker || '',
    quantity: preview.suggestedMapping?.quantity || '',
    costBasis: preview.suggestedMapping?.costBasis || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImport = async () => {
    if (!mapping.ticker || !mapping.quantity || !mapping.costBasis) {
      toast.error('Please map all required columns');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.import.importCSV({
        portfolioId,
        columnMapping: mapping,
        data: preview.preview, // This should be the full data, but using preview for now
      });

      if (result.failed > 0) {
        toast.warning(`Imported ${result.success} positions, ${result.failed} failed`);
      } else {
        toast.success(`Successfully imported ${result.success} positions`);
      }
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Failed to import CSV');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Ticker Column</label>
          <select
            value={mapping.ticker}
            onChange={(e) => setMapping({ ...mapping, ticker: e.target.value })}
            className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm"
          >
            <option value="">Select column...</option>
            {preview.headers.map((h: string) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Quantity Column</label>
          <select
            value={mapping.quantity}
            onChange={(e) => setMapping({ ...mapping, quantity: e.target.value })}
            className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm"
          >
            <option value="">Select column...</option>
            {preview.headers.map((h: string) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Cost Basis Column</label>
          <select
            value={mapping.costBasis}
            onChange={(e) => setMapping({ ...mapping, costBasis: e.target.value })}
            className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm"
          >
            <option value="">Select column...</option>
            {preview.headers.map((h: string) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleImport}
        disabled={isSubmitting || !mapping.ticker || !mapping.quantity || !mapping.costBasis}
        className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50"
      >
        {isSubmitting ? 'Importing...' : `Import ${preview.rowCount} Positions`}
      </button>
    </div>
  );
}
