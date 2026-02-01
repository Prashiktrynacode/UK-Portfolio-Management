'use client';

import { Upload, FileSpreadsheet, Database, Plus } from 'lucide-react';

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Data</h1>
        <p className="text-muted-foreground">Import your holdings from CSV files or connect brokers</p>
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
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
            <Upload className="size-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop your CSV file here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Supports Fidelity, Schwab, Robinhood, and custom formats
            </p>
          </div>
        </div>

        {/* Manual Entry */}
        <div className="p-6 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plus className="size-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Manual Entry</h3>
              <p className="text-sm text-muted-foreground">Add positions one by one</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Manually enter your stock ticker, quantity, and purchase price.
          </p>
          <button className="w-full px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors">
            Add Position Manually
          </button>
        </div>
      </div>

      {/* Broker Connections - Coming Soon */}
      <div className="p-6 bg-card border border-border rounded-xl opacity-60">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-12 rounded-xl bg-muted flex items-center justify-center">
            <Database className="size-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">Connect Broker</h3>
            <p className="text-sm text-muted-foreground">Coming soon - Auto-sync with your brokerage</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          We&apos;re working on direct integrations with popular brokerages like Interactive Brokers, Robinhood, and more.
        </p>
      </div>
    </div>
  );
}
