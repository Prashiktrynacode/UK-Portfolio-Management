'use client';

import { useState, createContext, useContext, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  LayoutDashboard,
  PieChart,
  LineChart,
  Upload,
  Settings,
  LogOut,
  Menu,
  X,
  TrendingUp,
  Plus,
  ChevronDown,
  Check,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { api, Portfolio } from '@/lib/api-client';

// Context to share portfolio state with child pages
const PortfolioContext = createContext<{
  portfolios: Portfolio[];
  selectedPortfolio: Portfolio | null;
  setSelectedPortfolio: (p: Portfolio) => void;
  refreshPortfolios: () => void;
  openCreateModal: () => void;
  isLoading: boolean;
}>({
  portfolios: [],
  selectedPortfolio: null,
  setSelectedPortfolio: () => {},
  refreshPortfolios: () => {},
  openCreateModal: () => {},
  isLoading: true,
});

export const usePortfolio = () => useContext(PortfolioContext);
export const useCreatePortfolioModal = () => {
  const { openCreateModal } = useContext(PortfolioContext);
  return { openCreateModal };
};

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Portfolio', href: '/dashboard/portfolio', icon: PieChart },
  { name: 'Analysis', href: '/dashboard/analysis', icon: LineChart },
  { name: 'Import', href: '/dashboard/import', icon: Upload },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPortfolioDropdown, setShowPortfolioDropdown] = useState(false);

  const fetchPortfolios = async () => {
    try {
      const data = await api.portfolios.list();
      setPortfolios(data);
      // Select default or first portfolio
      if (data.length > 0) {
        const defaultPortfolio = data.find(p => p.isDefault) || data[0];
        setSelectedPortfolio(defaultPortfolio);
      }
    } catch (error: any) {
      console.error('Failed to fetch portfolios:', error);
      // Don't show error toast on initial load if not authenticated
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolios();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    router.push('/');
    router.refresh();
  };

  const openCreateModal = () => setShowCreateModal(true);

  const handleDeletePortfolio = async (portfolio: Portfolio) => {
    if (!confirm(`Are you sure you want to delete "${portfolio.name}"? This will permanently delete all positions and transactions in this portfolio.`)) {
      return;
    }

    try {
      await api.portfolios.delete(portfolio.id);
      toast.success('Portfolio deleted successfully');

      // Remove from local state
      const updatedPortfolios = portfolios.filter(p => p.id !== portfolio.id);
      setPortfolios(updatedPortfolios);

      // If deleted portfolio was selected, switch to another
      if (selectedPortfolio?.id === portfolio.id) {
        setSelectedPortfolio(updatedPortfolios.length > 0 ? updatedPortfolios[0] : null);
      }

      setShowPortfolioDropdown(false);
    } catch (error: any) {
      console.error('Delete portfolio error:', error);
      toast.error(error.message || 'Failed to delete portfolio');
    }
  };

  const handlePortfolioCreated = (newPortfolio: Portfolio) => {
    setPortfolios(prev => [...prev, newPortfolio]);
    setSelectedPortfolio(newPortfolio);
    setShowCreateModal(false);
  };

  return (
    <PortfolioContext.Provider value={{
      portfolios,
      selectedPortfolio,
      setSelectedPortfolio,
      refreshPortfolios: fetchPortfolios,
      openCreateModal,
      isLoading,
    }}>
      <div className="min-h-screen bg-background">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-border">
              <Link href="/dashboard" className="flex items-center gap-2">
                <TrendingUp className="size-6 text-primary" />
                <span className="font-bold text-lg">QuantVault</span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Portfolio Selector */}
            {portfolios.length > 0 && (
              <div className="p-4 border-b border-border">
                <div className="relative">
                  <button
                    onClick={() => setShowPortfolioDropdown(!showPortfolioDropdown)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-secondary/50 rounded-lg text-sm hover:bg-secondary transition-colors"
                  >
                    <span className="truncate font-medium">
                      {selectedPortfolio?.name || 'Select Portfolio'}
                    </span>
                    <ChevronDown className={cn(
                      "size-4 transition-transform",
                      showPortfolioDropdown && "rotate-180"
                    )} />
                  </button>

                  {showPortfolioDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {portfolios.map((portfolio) => (
                        <div
                          key={portfolio.id}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 text-sm hover:bg-secondary/50 transition-colors group",
                            selectedPortfolio?.id === portfolio.id && "bg-primary/10 text-primary"
                          )}
                        >
                          <button
                            onClick={() => {
                              setSelectedPortfolio(portfolio);
                              setShowPortfolioDropdown(false);
                            }}
                            className="flex-1 text-left truncate"
                          >
                            {portfolio.name}
                          </button>
                          <div className="flex items-center gap-1">
                            {selectedPortfolio?.id === portfolio.id && (
                              <Check className="size-4" />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePortfolio(portfolio);
                              }}
                              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
                              title="Delete portfolio"
                            >
                              <Trash2 className="size-3.5 text-red-500" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Create Portfolio Button */}
            <div className="p-4">
              <button
                onClick={openCreateModal}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="size-4" />
                New Portfolio
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
              {navigation.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="size-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* User Section */}
            <div className="p-4 border-t border-border">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <LogOut className="size-5" />
                Log Out
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="lg:pl-64">
          {/* Top header */}
          <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur-sm border-b border-border">
            <div className="flex items-center justify-between h-full px-4 lg:px-6">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-muted-foreground hover:text-foreground"
              >
                <Menu className="size-6" />
              </button>

              <div className="flex-1 lg:flex-none" />

              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground hidden sm:block">
                  Welcome back!
                </span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="p-4 lg:p-6">
            {children}
          </main>
        </div>

        {/* Create Portfolio Modal */}
        {showCreateModal && (
          <CreatePortfolioModal
            onClose={() => setShowCreateModal(false)}
            onCreated={handlePortfolioCreated}
          />
        )}
      </div>
    </PortfolioContext.Provider>
  );
}

function CreatePortfolioModal({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated: (portfolio: Portfolio) => void;
}) {
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('BROKERAGE');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter a portfolio name');
      return;
    }

    setCreating(true);
    try {
      const newPortfolio = await api.portfolios.create({
        name: name.trim(),
        accountType,
      });
      toast.success('Portfolio created successfully!');
      onCreated(newPortfolio);
    } catch (error: any) {
      console.error('Create portfolio error:', error);
      toast.error(error.message || 'Failed to create portfolio');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-xl font-bold mb-4">Create New Portfolio</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Portfolio Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Main Brokerage, Retirement Account"
              className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') onClose();
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Account Type</label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            >
              <option value="BROKERAGE">Brokerage</option>
              <option value="IRA">IRA</option>
              <option value="ROTH_IRA">Roth IRA</option>
              <option value="K401">401(k)</option>
              <option value="HSA">HSA</option>
              <option value="CRYPTO">Crypto</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="flex gap-3">
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
              {creating ? 'Creating...' : 'Create Portfolio'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
