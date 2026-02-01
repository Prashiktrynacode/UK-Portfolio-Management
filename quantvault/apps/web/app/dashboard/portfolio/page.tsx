'use client';

import { useState, useEffect } from 'react';
import { PieChart, Plus, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePortfolio } from '../layout';
import { api, Position, PositionWithMeta } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export default function PortfolioPage() {
  const { selectedPortfolio, isLoading: portfolioLoading, openCreateModal } = usePortfolio();
  const [positions, setPositions] = useState<PositionWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchPositions = async () => {
    if (!selectedPortfolio) return;

    setIsLoading(true);
    try {
      const data = await api.positions.list(selectedPortfolio.id);
      setPositions(data);
    } catch (error: any) {
      console.error('Failed to fetch positions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPortfolio) {
      fetchPositions();
    }
  }, [selectedPortfolio?.id]);

  const handlePositionCreated = (newPosition: Position) => {
    setPositions(prev => [...prev, newPosition as PositionWithMeta]);
    setShowAddModal(false);
    fetchPositions(); // Refresh to get full position data
  };

  if (portfolioLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!selectedPortfolio) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <PieChart className="size-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No Portfolio Selected</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          Create a portfolio first to start adding positions.
        </p>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-5" />
          Create Portfolio
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{selectedPortfolio.name}</h1>
          <p className="text-muted-foreground">Manage your holdings and positions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-4" />
          Add Position
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <PieChart className="size-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No Positions Yet</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            Start building your portfolio by adding your first position or importing from a CSV file.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="size-5" />
            Add Your First Position
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary/30">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Symbol</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Quantity</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Avg Cost</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Current</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Market Value</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {positions.map((position) => {
                const pl = position.unrealizedPL || 0;
                const plPercent = position.unrealizedPLPercent || 0;
                const isPositive = pl >= 0;

                return (
                  <tr key={position.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-semibold">{position.ticker}</div>
                        <div className="text-sm text-muted-foreground">{position.name || position.assetType}</div>
                      </div>
                    </td>
                    <td className="text-right px-4 py-4 font-mono">{Number(position.quantity).toFixed(2)}</td>
                    <td className="text-right px-4 py-4 font-mono">${Number(position.avgCostBasis).toFixed(2)}</td>
                    <td className="text-right px-4 py-4 font-mono">
                      ${position.currentPrice ? Number(position.currentPrice).toFixed(2) : '-'}
                    </td>
                    <td className="text-right px-4 py-4 font-mono">
                      ${position.marketValue ? Number(position.marketValue).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className={cn(
                      "text-right px-4 py-4 font-mono",
                      isPositive ? "text-green-500" : "text-red-500"
                    )}>
                      <div className="flex items-center justify-end gap-1">
                        {isPositive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                        <span>${Math.abs(pl).toFixed(2)}</span>
                        <span className="text-xs">({isPositive ? '+' : ''}{Number(plPercent).toFixed(2)}%)</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Position Modal */}
      {showAddModal && (
        <AddPositionModal
          portfolioId={selectedPortfolio.id}
          onClose={() => setShowAddModal(false)}
          onCreated={handlePositionCreated}
        />
      )}
    </div>
  );
}

function AddPositionModal({
  portfolioId,
  onClose,
  onCreated
}: {
  portfolioId: string;
  onClose: () => void;
  onCreated: (position: Position) => void;
}) {
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgCostBasis, setAvgCostBasis] = useState('');
  const [assetType, setAssetType] = useState('STOCK');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!ticker.trim()) {
      toast.error('Please enter a ticker symbol');
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    if (!avgCostBasis || parseFloat(avgCostBasis) <= 0) {
      toast.error('Please enter a valid cost basis');
      return;
    }

    setCreating(true);
    try {
      const newPosition = await api.positions.create({
        portfolioId,
        ticker: ticker.trim().toUpperCase(),
        quantity: parseFloat(quantity),
        avgCostBasis: parseFloat(avgCostBasis),
        assetType,
      });
      toast.success(`Position ${ticker.toUpperCase()} added successfully!`);
      onCreated(newPosition);
    } catch (error: any) {
      console.error('Create position error:', error);
      toast.error(error.message || 'Failed to add position');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-xl font-bold mb-4">Add Position</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Ticker Symbol</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="e.g., AAPL, MSFT, GOOGL"
              className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none uppercase"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                step="any"
                min="0"
                className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Avg Cost Basis ($)</label>
              <input
                type="number"
                value={avgCostBasis}
                onChange={(e) => setAvgCostBasis(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Asset Type</label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            >
              <option value="STOCK">Stock</option>
              <option value="ETF">ETF</option>
              <option value="MUTUAL_FUND">Mutual Fund</option>
              <option value="BOND">Bond</option>
              <option value="CRYPTO">Crypto</option>
              <option value="OPTION">Option</option>
              <option value="REIT">REIT</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {creating ? 'Adding...' : 'Add Position'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
