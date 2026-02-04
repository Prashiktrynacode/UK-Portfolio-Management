'use client';

import { useState, useEffect } from 'react';
import { PieChart, Plus, TrendingUp, TrendingDown, Loader2, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { usePortfolio } from '../layout';
import { api, Position, PositionWithMeta, MutualFundSearchResult, MutualFundNAV } from '@/lib/api-client';
import { cn } from '@/lib/utils';

// Helper function to get currency symbol
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    INR: '₹',
    GBP: '£',
    EUR: '€',
    CAD: 'C$',
    AUD: 'A$',
    JPY: '¥',
  };
  return symbols[currency] || '$';
}

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

  const handleDeletePosition = async (position: PositionWithMeta) => {
    if (!confirm(`Are you sure you want to delete ${position.ticker}? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.positions.delete(position.id);
      toast.success(`${position.ticker} removed from portfolio`);
      setPositions(prev => prev.filter(p => p.id !== position.id));
    } catch (error: any) {
      console.error('Delete position error:', error);
      toast.error(error.message || 'Failed to delete position');
    }
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
                <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {positions.map((position) => {
                const pl = position.unrealizedPL || 0;
                const plPercent = position.unrealizedPLPercent || 0;
                const isPositive = pl >= 0;
                const currencySymbol = getCurrencySymbol(position.currency || 'USD');

                return (
                  <tr key={position.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-semibold">{position.ticker}</div>
                        <div className="text-sm text-muted-foreground">{position.name || position.assetType}</div>
                      </div>
                    </td>
                    <td className="text-right px-4 py-4 font-mono">{Number(position.quantity).toFixed(4)}</td>
                    <td className="text-right px-4 py-4 font-mono">{currencySymbol}{Number(position.avgCostBasis).toFixed(4)}</td>
                    <td className="text-right px-4 py-4 font-mono">
                      {position.currentPrice ? `${currencySymbol}${Number(position.currentPrice).toFixed(4)}` : '-'}
                    </td>
                    <td className="text-right px-4 py-4 font-mono">
                      {position.marketValue ? `${currencySymbol}${Number(position.marketValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className={cn(
                      "text-right px-4 py-4 font-mono",
                      isPositive ? "text-green-500" : "text-red-500"
                    )}>
                      <div className="flex items-center justify-end gap-1">
                        {isPositive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                        <span>{currencySymbol}{Math.abs(pl).toFixed(2)}</span>
                        <span className="text-xs">({isPositive ? '+' : ''}{Number(plPercent).toFixed(2)}%)</span>
                      </div>
                    </td>
                    <td className="text-center px-4 py-4">
                      <button
                        onClick={() => handleDeletePosition(position)}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors group"
                        title="Remove position"
                      >
                        <Trash2 className="size-4 text-muted-foreground group-hover:text-red-500" />
                      </button>
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
  const [mode, setMode] = useState<'stock' | 'mf'>('stock');
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgCostBasis, setAvgCostBasis] = useState('');
  const [assetType, setAssetType] = useState('STOCK');
  const [currency, setCurrency] = useState('USD');
  const [expenseRatio, setExpenseRatio] = useState('');
  const [creating, setCreating] = useState(false);

  // Mutual fund search state
  const [mfSearchQuery, setMfSearchQuery] = useState('');
  const [mfSearchResults, setMfSearchResults] = useState<MutualFundSearchResult[]>([]);
  const [selectedMF, setSelectedMF] = useState<MutualFundNAV | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingNAV, setIsFetchingNAV] = useState(false);

  const handleSearchMF = async () => {
    if (mfSearchQuery.length < 2) {
      toast.error('Please enter at least 2 characters to search');
      return;
    }

    setIsSearching(true);
    try {
      const result = await api.market.searchMutualFunds(mfSearchQuery);
      setMfSearchResults(result.results);
      if (result.results.length === 0) {
        toast.info('No mutual funds found');
      }
    } catch (error: any) {
      console.error('MF search error:', error);
      toast.error(error.message || 'Failed to search mutual funds');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectMF = async (mf: MutualFundSearchResult) => {
    setIsFetchingNAV(true);
    try {
      const navData = await api.market.getMutualFundNAV(mf.schemeCode);
      setSelectedMF(navData);
      setTicker(`MF${mf.schemeCode}`);
      setAvgCostBasis(navData.nav.toString());
      setMfSearchResults([]);
      toast.success(`Current NAV: ₹${navData.nav.toFixed(4)}`);
    } catch (error: any) {
      console.error('NAV fetch error:', error);
      toast.error(error.message || 'Failed to fetch NAV');
    } finally {
      setIsFetchingNAV(false);
    }
  };

  const handleCreate = async () => {
    if (!ticker.trim()) {
      toast.error('Please enter a ticker symbol or select a mutual fund');
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
        name: selectedMF?.schemeName || undefined,
        quantity: parseFloat(quantity),
        avgCostBasis: parseFloat(avgCostBasis),
        assetType: mode === 'mf' ? 'MUTUAL_FUND' : assetType,
        currency: mode === 'mf' ? 'INR' : currency,
        expenseRatio: expenseRatio ? parseFloat(expenseRatio) : undefined,
        schemeCode: selectedMF?.schemeCode || undefined,
      });
      toast.success(`Position ${selectedMF?.schemeName || ticker.toUpperCase()} added successfully!`);
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
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Add Position</h2>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-4 p-1 bg-secondary/30 rounded-lg">
          <button
            onClick={() => { setMode('stock'); setSelectedMF(null); setTicker(''); }}
            className={cn(
              "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              mode === 'stock' ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
            )}
          >
            Stock / ETF
          </button>
          <button
            onClick={() => { setMode('mf'); setTicker(''); setAssetType('MUTUAL_FUND'); }}
            className={cn(
              "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              mode === 'mf' ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
            )}
          >
            🇮🇳 Indian Mutual Fund
          </button>
        </div>

        <div className="space-y-4">
          {mode === 'stock' ? (
            <>
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
            </>
          ) : (
            <>
              {/* Mutual Fund Search */}
              <div>
                <label className="block text-sm font-medium mb-2">Search by Name or Scheme Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={mfSearchQuery}
                    onChange={(e) => setMfSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchMF()}
                    placeholder="e.g., HDFC Flexi Cap, Axis Bluechip, 120503"
                    className="flex-1 px-4 py-3 bg-input border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleSearchMF}
                    disabled={isSearching}
                    className="px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSearching ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" />}
                  </button>
                </div>
              </div>

              {/* Search Results */}
              {mfSearchResults.length > 0 && (
                <div className="border border-border rounded-xl max-h-48 overflow-y-auto">
                  {mfSearchResults.map((mf) => (
                    <button
                      key={mf.schemeCode}
                      onClick={() => handleSelectMF(mf)}
                      disabled={isFetchingNAV}
                      className="w-full text-left px-4 py-3 hover:bg-secondary/50 border-b border-border last:border-0 transition-colors disabled:opacity-50"
                    >
                      <div className="font-medium text-sm">{mf.schemeName}</div>
                      <div className="text-xs text-muted-foreground">Code: {mf.schemeCode}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Mutual Fund */}
              {selectedMF && (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <div className="font-medium text-green-500 text-sm mb-1">Selected Fund</div>
                  <div className="font-semibold">{selectedMF.schemeName}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {selectedMF.fundHouse} • {selectedMF.schemeCategory}
                  </div>
                  <div className="text-sm mt-2">
                    <span className="text-muted-foreground">Current NAV:</span>{' '}
                    <span className="font-mono font-semibold">₹{selectedMF.nav.toFixed(4)}</span>
                    {selectedMF.date && <span className="text-xs text-muted-foreground ml-2">({selectedMF.date})</span>}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                {mode === 'mf' ? 'Units' : 'Quantity'}
              </label>
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
              <label className="block text-sm font-medium mb-2">
                {mode === 'mf' ? 'Avg NAV (₹)' : 'Avg Cost Basis'}
              </label>
              <input
                type="number"
                value={avgCostBasis}
                onChange={(e) => setAvgCostBasis(e.target.value)}
                placeholder="0.00"
                step="0.0001"
                min="0"
                className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {mode === 'stock' && (
              <div>
                <label className="block text-sm font-medium mb-2">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                  <option value="JPY">JPY (¥)</option>
                </select>
              </div>
            )}
            <div className={mode === 'stock' ? '' : 'col-span-2'}>
              <label className="block text-sm font-medium mb-2">
                Expense Ratio (% p.a.)
                <span className="text-xs text-muted-foreground ml-1">Optional</span>
              </label>
              <input
                type="number"
                value={expenseRatio}
                onChange={(e) => setExpenseRatio(e.target.value)}
                placeholder="e.g., 0.75"
                step="0.01"
                min="0"
                max="10"
                className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
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
              disabled={creating || (mode === 'mf' && !selectedMF)}
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
