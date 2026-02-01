'use client';

import { useState } from 'react';
import { Plus, Briefcase, TrendingUp, DollarSign, PieChart } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useCreatePortfolioModal } from './layout';

export default function Dashboard() {
  const { openCreateModal } = useCreatePortfolioModal();

  // For now, show the welcome screen since backend isn't connected yet
  return (
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
        onClick={openCreateModal}
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
  );
}
