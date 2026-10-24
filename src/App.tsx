import React, { useState, useEffect } from 'react';
import { Account, Category } from './types';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { OverviewPage } from './pages/OverviewPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { BudgetsPage } from './pages/BudgetsPage';
import { PotsPage } from './pages/PotsPage';
import { RecurringBillsPage } from './pages/RecurringBillsPage';
import { TransactionModal } from './components/transactions/TransactionModal';
import { KeyboardShortcutsModal } from './components/common/KeyboardShortcutsModal';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>('overview');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetAlertsCount, setBudgetAlertsCount] = useState<number>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Global Modals
  const [isNewTxOpen, setIsNewTxOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  // Keyboard navigation sequence tracking (e.g. 'g' then 'o')
  const [lastKey, setLastKey] = useState<{ key: string; time: number } | null>(null);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBudgetAlertsCount = async () => {
    try {
      const res = await fetch('/api/budgets?month=2026-09');
      if (res.ok) {
        const budgets = await res.json();
        const alertCount = budgets.filter((b: any) => b.status === 'warning' || b.status === 'exceeded').length;
        setBudgetAlertsCount(alertCount);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
    fetchBudgetAlertsCount();
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const now = Date.now();

      // Check chord 'g' then key
      if (lastKey && lastKey.key === 'g' && now - lastKey.time < 1200) {
        if (e.key === 'o') {
          e.preventDefault();
          setCurrentPage('overview');
          setLastKey(null);
          return;
        }
        if (e.key === 't') {
          e.preventDefault();
          setCurrentPage('transactions');
          setLastKey(null);
          return;
        }
        if (e.key === 'b') {
          e.preventDefault();
          setCurrentPage('budgets');
          setLastKey(null);
          return;
        }
        if (e.key === 'p') {
          e.preventDefault();
          setCurrentPage('pots');
          setLastKey(null);
          return;
        }
        if (e.key === 'r') {
          e.preventDefault();
          setCurrentPage('recurring');
          setLastKey(null);
          return;
        }
      }

      if (e.key === 'g') {
        setLastKey({ key: 'g', time: now });
        return;
      }

      // Single key shortcuts
      if (e.key === 'n') {
        e.preventDefault();
        setIsNewTxOpen(true);
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lastKey]);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        alertCount={budgetAlertsCount}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          currentPage={currentPage}
          onOpenNewTransaction={() => setIsNewTxOpen(true)}
          budgetAlertsCount={budgetAlertsCount}
          onViewAlerts={() => setCurrentPage('budgets')}
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
        />

        <main className="flex-1 px-8 py-6 overflow-y-auto max-w-7xl mx-auto w-full">
          {currentPage === 'overview' && (
            <OverviewPage
              onNavigate={setCurrentPage}
              onOpenNewTransaction={() => setIsNewTxOpen(true)}
            />
          )}

          {currentPage === 'transactions' && (
            <TransactionsPage
              onOpenNewTransaction={() => setIsNewTxOpen(true)}
              accounts={accounts}
              categories={categories}
            />
          )}

          {currentPage === 'budgets' && (
            <BudgetsPage
              categories={categories}
              onRefreshCategories={fetchCategories}
            />
          )}

          {currentPage === 'pots' && (
            <PotsPage
              accounts={accounts}
              onRefreshAccounts={fetchAccounts}
            />
          )}

          {currentPage === 'recurring' && (
            <RecurringBillsPage
              categories={categories}
              accounts={accounts}
              onRefreshAccounts={fetchAccounts}
            />
          )}
        </main>
      </div>

      {/* Global New Transaction Modal */}
      <TransactionModal
        isOpen={isNewTxOpen}
        onClose={() => setIsNewTxOpen(false)}
        onSuccess={() => {
          fetchAccounts();
          fetchBudgetAlertsCount();
        }}
        accounts={accounts}
        categories={categories}
      />

      {/* Global Keyboard Shortcuts Cheat Sheet */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
};
