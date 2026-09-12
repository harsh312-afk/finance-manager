import React, { useState, useEffect, useRef } from 'react';
import { Transaction, Account, Category } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { getCategoryIcon } from '../utils/icons';
import { TransactionModal } from '../components/transactions/TransactionModal';
import { CSVImportModal } from '../components/transactions/CSVImportModal';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  Download, 
  Upload, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Edit3,
  Calendar,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

interface TransactionsPageProps {
  onOpenNewTransaction: () => void;
  accounts: Account[];
  categories: Category[];
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  accounts,
  categories
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Sorting state
  const [search, setSearch] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [type, setType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'warning'; text: string } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10', // Strictly 10 per page as required
        sortBy,
        sortOrder
      });

      if (search.trim()) params.append('search', search.trim());
      if (categoryId) params.append('category_id', categoryId);
      if (accountId) params.append('account_id', accountId);
      if (type !== 'all') params.append('type', type);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load transactions');
      const data = await res.json();

      setTransactions(data.transactions);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, sortBy, sortOrder, categoryId, accountId, type]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchTransactions();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Keyboard navigation for pagination and search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '[') {
        e.preventDefault();
        setPage(p => Math.max(1, p - 1));
      } else if (e.key === ']') {
        e.preventDefault();
        setPage(p => Math.min(totalPages, p + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this transaction? Account balance will be restored.')) return;
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete transaction');
      setToastMessage({ type: 'success', text: 'Transaction removed and account balance adjusted.' });
      fetchTransactions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (categoryId) params.append('category_id', categoryId);
    if (accountId) params.append('account_id', accountId);
    if (type !== 'all') params.append('type', type);
    window.location.href = `/api/transactions/export-csv?${params.toString()}`;
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(col);
      setSortOrder('DESC');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast alert banner */}
      {toastMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold animate-in fade-in ${
          toastMessage.type === 'warning' ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-emerald-50 text-emerald-900 border-emerald-200'
        }`}>
          <div className="flex items-center space-x-2">
            {toastMessage.type === 'warning' ? <AlertCircle className="w-4 h-4 text-amber-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-500 hover:text-slate-800">Dismiss</button>
        </div>
      )}

      {/* Control Bar: Search, Filters, Actions */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions or notes..."
              className="w-full pl-9 pr-10 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
            />
            <kbd className="absolute right-2.5 top-2 px-1.5 py-0.5 text-[10px] font-mono bg-slate-200/70 text-slate-600 rounded">
              /
            </kbd>
          </div>

          {/* Action buttons: Import, Export, New */}
          <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
            <button
              onClick={() => setIsImportOpen(true)}
              className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-xs"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Import CSV</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => {
                setTransactionToEdit(null);
                setIsModalOpen(true);
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Transaction</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center space-x-1 text-slate-500 font-semibold mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Category Filter */}
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Account Filter */}
          <select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
          >
            <option value="">All Accounts</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
          >
            <option value="all">All Types</option>
            <option value="expense">Expenses Only</option>
            <option value="income">Income Only</option>
          </select>

          {(search || categoryId || accountId || type !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setCategoryId('');
                setAccountId('');
                setType('all');
                setPage(1);
              }}
              className="text-xs text-rose-600 font-semibold hover:underline ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Transactions Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3.5 cursor-pointer hover:text-slate-800" onClick={() => toggleSort('date')}>
                  <div className="flex items-center space-x-1">
                    <span>Date</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-6 py-3.5 cursor-pointer hover:text-slate-800" onClick={() => toggleSort('merchant')}>
                  <div className="flex items-center space-x-1">
                    <span>Merchant / Description</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-6 py-3.5 cursor-pointer hover:text-slate-800" onClick={() => toggleSort('category')}>
                  <div className="flex items-center space-x-1">
                    <span>Category</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-6 py-3.5">Account</th>
                <th className="px-6 py-3.5 text-right cursor-pointer hover:text-slate-800" onClick={() => toggleSort('amount')}>
                  <div className="flex items-center justify-end space-x-1">
                    <span>Amount</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    <span>Loading transactions...</span>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <p className="font-semibold text-sm text-slate-700">No transactions found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search query.</p>
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-600 whitespace-nowrap">
                      {formatDate(tx.date)}
                    </td>
                    <td className="px-6 py-3.5 font-bold text-slate-900">
                      <div>{tx.merchant}</div>
                      {tx.notes && <div className="text-[11px] font-normal text-slate-400">{tx.notes}</div>}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                        style={{
                          backgroundColor: `${tx.category_color}18`,
                          color: tx.category_color
                        }}
                      >
                        {getCategoryIcon(tx.category_icon, 'w-3 h-3')}
                        <span>{tx.category_name}</span>
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 whitespace-nowrap">
                      {tx.account_name}
                    </td>
                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      <span className={`font-extrabold text-sm ${
                        tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                      }`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount_cents)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => {
                            setTransactionToEdit(tx);
                            setIsModalOpen(true);
                          }}
                          aria-label={`Edit transaction ${tx.merchant}`}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          aria-label={`Delete transaction ${tx.merchant}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Strict Pagination (10 per page) with Keyboard Support */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <span>
              Showing <strong className="text-slate-900">{totalCount > 0 ? (page - 1) * 10 + 1 : 0}</strong> to{' '}
              <strong className="text-slate-900">{Math.min(page * 10, totalCount)}</strong> of{' '}
              <strong className="text-slate-900">{totalCount}</strong> transactions (10 per page)
            </span>
            <span className="hidden sm:inline-block text-slate-400 font-mono text-[10px]">
              [Use <kbd className="px-1 bg-white border border-slate-300 rounded font-bold">[</kbd> and <kbd className="px-1 bg-white border border-slate-300 rounded font-bold">]</kbd> to flip pages]
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Previous Page"
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center space-x-1 shadow-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            {/* Page number pill */}
            <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800">
              {page} / {totalPages || 1}
            </div>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Next Page"
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center space-x-1 shadow-xs"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Modal (Create & Edit) */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setTransactionToEdit(null);
        }}
        onSuccess={(budgetAlert) => {
          fetchTransactions();
          if (budgetAlert) {
            setToastMessage({
              type: 'warning',
              text: `Budget Notice: Spending on ${budgetAlert.category_name} reached ${budgetAlert.percent_spent}% of limit!`
            });
          } else {
            setToastMessage({
              type: 'success',
              text: 'Transaction recorded successfully.'
            });
          }
        }}
        transactionToEdit={transactionToEdit}
        accounts={accounts}
        categories={categories}
      />

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={(alerts) => {
          fetchTransactions();
          if (alerts && alerts.length > 0) {
            setToastMessage({
              type: 'warning',
              text: `Import complete! Warning: ${alerts.length} category budget(s) are now at or over limit.`
            });
          } else {
            setToastMessage({
              type: 'success',
              text: 'CSV file imported successfully!'
            });
          }
        }}
        accounts={accounts}
      />
    </div>
  );
};
