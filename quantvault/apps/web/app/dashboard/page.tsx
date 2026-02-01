'use client';

import { useState } from 'react';
import { Plus, Briefcase, TrendingUp, DollarSign, PieChart } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePortfolios, useCreatePortfolio } from '@/hooks/use-portfolio';
import { toast } from 'sonner';
import DashboardPage from '@/components/dashboard/DashboardPage';

export default function Dashboard() {
  const { data: portfolios, isLoading } = usePortfolios();
  const createPortfolio = useCreatePortfolio();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreatePortfolio = async () => {
    if (!newPortfolioName.trim()) {
      toast.error('Please enter a portfolio name');
      return;
    }

    setCreating(true);
    try {
      await createPortfolio.mutateAsync({
        name: newPortfolioName.trim(),
        accountType: 'BROKERAGE',
      });
      toast.success('Portfolio created successfully!');
      setShowCreateModal(false);
      setNewPortfolioName('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create portfolio');
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show welcome screen if no portfolios
  if (!portfolios || portfolios.length === 0) {
    return (
      <>
        <motion.div
          className="flex flex-col items-center justify-center h-[60vh] text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
            <Briefcase className="size-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Welcome to QuantVault!</h1>
          <p className="text-muted-foreground mb-8 max-w-md">
            Get started by creating your first portfolio to track your investments,
            analyze performance, and optimize your strategy.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="size-5" />
            Create Your First Portfolio
          </button>

          {/* Features preview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 max-w-2xl">
            <div className="p-4 bg-card border border-border rounded-xl text-left">
              <TrendingUp className="size-6 text-primary mb-2" />
              <h3 className="font-medium text-sm">Track Performance</h3>
              <p className="text-xs text-muted-foreground">Real-time portfolio tracking</p>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl text-left">
              <PieChart className="size-6 text-primary mb-2" />
              <h3 className="font-medium text-sm">Asset Allocation</h3>
              <p className="text-xs text-muted-foreground">Visualize your holdings</p>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl text-left">
              <DollarSign className="size-6 text-primary mb-2" />
              <h3 className="font-medium text-sm">Tax Optimization</h3>
              <p className="text-xs text-muted-foreground">FIFO lot tracking</p>
            </div>
          </div>
        </motion.div>

        {/* Create Portfolio Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <h2 className="text-xl font-bold mb-4">Create New Portfolio</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Portfolio Name</label>
                  <input
                    type="text"
                    value={newPortfolioName}
                    onChange={(e) => setNewPortfolioName(e.target.value)}
                    placeholder="e.g., Main Brokerage, Retirement Account"
                    className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreatePortfolio();
                    }}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreatePortfolio}
                    disabled={creating}
                    className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Portfolio'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </>
    );
  }

  // Show main dashboard if portfolios exist
  return <DashboardPage />;
}
