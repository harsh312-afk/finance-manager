import React from 'react';
import { Plus, ShieldAlert, Menu } from 'lucide-react';
import { BrandIcon } from '../common/BrandIcon';

interface NavbarProps {
  currentPage: string;
  onOpenNewTransaction: () => void;
  budgetAlertsCount: number;
  onViewAlerts: () => void;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onOpenNewTransaction,
  budgetAlertsCount,
  onViewAlerts,
  onToggleMobileMenu
}) => {
  const titles: Record<string, { title: string; subtitle: string }> = {
    overview: { title: 'Financial Overview', subtitle: 'Real-time balances, analytics & cashflow' },
    transactions: { title: 'Transactions', subtitle: 'Filter, sort & manage income and expenses' },
    budgets: { title: 'Budgets & Spending', subtitle: 'Category limits and threshold alert tracking' },
    pots: { title: 'Saving Pots', subtitle: 'Target-based goal planning & deposits' },
    recurring: { title: 'Recurring Bills', subtitle: 'Cadence detection & automated reminders' }
  };

  const current = titles[currentPage] || { title: 'VaultFlow', subtitle: 'Personal Finance' };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center space-x-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="md:hidden">
          <BrandIcon className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight leading-tight">{current.title}</h2>
          <p className="text-[11px] md:text-xs text-slate-500 font-normal hidden sm:block">{current.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center space-x-2 md:space-x-3">
        {/* Budget Alerts Button */}
        {budgetAlertsCount > 0 && (
          <button
            onClick={onViewAlerts}
            className="flex items-center space-x-1.5 px-2.5 md:px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 text-xs font-semibold transition"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="hidden sm:inline">{budgetAlertsCount} Budget Warning{budgetAlertsCount > 1 ? 's' : ''}</span>
            <span className="sm:hidden">{budgetAlertsCount}</span>
          </button>
        )}

        {/* Quick New Transaction Action */}
        <button
          onClick={onOpenNewTransaction}
          className="flex items-center space-x-1.5 md:space-x-2 px-3 md:px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>New Transaction</span>
          <kbd className="hidden sm:inline px-1.5 py-0.2 text-[10px] font-mono bg-emerald-800/60 text-emerald-100 rounded">
            n
          </kbd>
        </button>
      </div>
    </header>
  );
};
