'use client';

import { PieChart, Plus } from 'lucide-react';

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-muted-foreground">Manage your holdings and positions</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
          <Plus className="size-4" />
          Add Position
        </button>
      </div>

      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <PieChart className="size-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No Positions Yet</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          Start building your portfolio by adding your first position or importing from a CSV file.
        </p>
      </div>
    </div>
  );
}
