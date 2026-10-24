import React, { useState, useEffect } from 'react';
import { Budget, Category } from '../types';
import { formatCurrency, formatDate, centsToDecimalString, decimalStringToCents } from '../utils/formatters';
import { getCategoryIcon } from '../utils/icons';
import { Modal } from '../components/common/Modal';
import { 
  Plus, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Trash2, 
  Edit3, 
  ArrowRight,
  Sparkles,
  PieChart,
  Calendar
} from 'lucide-react';

interface BudgetsPageProps {
  categories: Category[];
  onRefreshCategories: () => void;
}

export const BudgetsPage: React.FC<BudgetsPageProps> = ({ categories, onRefreshCategories }) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [budgetToEdit, setBudgetToEdit] = useState<Budget | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');

  const availableMonths = [
    { value: '2026-09', label: 'September 2026 (Current)' },
    { value: '2026-08', label: 'August 2026' },
    { value: '2026-07', label: 'July 2026' }
  ];

  // Custom Category & Budget Creation state
  const [isCreatingCustomCat, setIsCreatingCustomCat] = useState<boolean>(false);
  const [customCatName, setCustomCatName] = useState<string>('');
  const [customCatColor, setCustomCatColor] = useState<string>('#3b82f6');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(categories[0]?.id || 1);
  const [limitStr, setLimitStr] = useState<string>('');
  const [thresholdPercent, setThresholdPercent] = useState<number>(80);
  const [modalError, setModalError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/budgets?month=${selectedMonth}`);
      if (!res.ok) throw new Error('Failed to load budgets');
      const data = await res.json();
      setBudgets(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, [selectedMonth]);

  const openCreateModal = () => {
    setBudgetToEdit(null);
    setSelectedCategoryId(categories[0]?.id || 1);
    setLimitStr('');
    setThresholdPercent(80);
    setIsCreatingCustomCat(false);
    setCustomCatName('');
    setModalError('');
    setIsModalOpen(true);
  };

  const openEditModal = (budget: Budget) => {
    setBudgetToEdit(budget);
    setSelectedCategoryId(budget.category_id);
    setLimitStr(centsToDecimalString(budget.limit_cents));
    setThresholdPercent(budget.alert_threshold_percent);
    setIsCreatingCustomCat(false);
    setModalError('');
    setIsModalOpen(true);
  };

  const handleDeleteBudget = async (id: number, categoryName: string) => {
    if (!confirm(`Remove monthly budget for ${categoryName}? Historical transactions will remain preserved.`)) return;
    try {
      const res = await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete budget');
      fetchBudgets();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setSubmitting(true);

    try {
      let targetCatId = selectedCategoryId;

      // 1. Create custom category if chosen
      if (isCreatingCustomCat && !budgetToEdit) {
        if (!customCatName.trim()) {
          throw new Error('Please enter a name for the new category');
        }
        const catRes = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: customCatName.trim(),
            color: customCatColor,
            icon: 'Tag'
          })
        });
        if (!catRes.ok) {
          const errData = await catRes.json();
          throw new Error(errData.error || 'Failed to create category');
        }
        const newCat = await catRes.json();
        targetCatId = newCat.id;
        onRefreshCategories();
      }

      const limitCents = decimalStringToCents(limitStr);
      if (limitCents <= 0) {
        throw new Error('Please enter a valid spending limit greater than $0.00');
      }

      if (budgetToEdit) {
        // Edit
        const res = await fetch(`/api/budgets/${budgetToEdit.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            limit_cents: limitCents,
            alert_threshold_percent: thresholdPercent,
            period: 'monthly'
          })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to update budget');
        }
      } else {
        // Create
        const res = await fetch('/api/budgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category_id: targetCatId,
            limit_cents: limitCents,
            alert_threshold_percent: thresholdPercent,
            period: 'monthly'
          })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to create budget');
        }
      }

      setIsModalOpen(false);
      fetchBudgets();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Aggregated totals
  const totalBudgetedCents = budgets.reduce((sum, b) => sum + b.limit_cents, 0);
  const totalSpentCents = budgets.reduce((sum, b) => sum + b.spent_cents, 0);
  const totalRemainingCents = Math.max(0, totalBudgetedCents - totalSpentCents);
  const totalPercent = totalBudgetedCents > 0 ? Math.round((totalSpentCents / totalBudgetedCents) * 100) : 0;

  const alertBudgets = budgets.filter(b => b.status === 'warning' || b.status === 'exceeded');

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Threshold Alerts Banner */}
      {alertBudgets.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start space-x-3 text-xs text-amber-900 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm text-amber-950">Active Budget Threshold Alerts</h4>
            <div className="mt-1 space-y-1">
              {alertBudgets.map(b => (
                <div key={b.id} className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${b.status === 'exceeded' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                  <span>
                    <strong>{b.category_name}</strong> is at <strong>{b.percent_spent}%</strong> of its {formatCurrency(b.limit_cents)} monthly limit ({formatCurrency(b.spent_cents)} spent).
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Top Summary Card & Create Action */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 w-full md:w-2/3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Overall Budget Consumption</span>
            <span className="font-extrabold text-slate-800">{totalPercent}% Spent</span>
          </div>

          {/* Master Progress Bar */}
          <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                totalPercent >= 100 ? 'bg-rose-500' : totalPercent >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, totalPercent)}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <div>
              <span className="text-slate-400">Total Spent:</span>{' '}
              <strong className="text-slate-900">{formatCurrency(totalSpentCents)}</strong>
            </div>
            <div>
              <span className="text-slate-400">Total Limit:</span>{' '}
              <strong className="text-slate-900">{formatCurrency(totalBudgetedCents)}</strong>
            </div>
            <div>
              <span className="text-slate-400">Remaining:</span>{' '}
              <strong className="text-emerald-600">{formatCurrency(totalRemainingCents)}</strong>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center space-x-1.5 w-full sm:w-auto">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full sm:w-auto text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
            >
              {availableMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={openCreateModal}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2 transition shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Set Category Budget</span>
          </button>
        </div>
      </div>

      {/* 3. Budget Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {budgets.map((b) => {
          let progressColor = 'bg-emerald-500';
          let badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
          let badgeText = 'On Track';

          if (b.status === 'warning') {
            progressColor = 'bg-amber-500';
            badgeBg = 'bg-amber-50 text-amber-800 border-amber-200';
            badgeText = `Warning (${b.percent_spent}%)`;
          } else if (b.status === 'exceeded') {
            progressColor = 'bg-rose-500';
            badgeBg = 'bg-rose-50 text-rose-800 border-rose-200';
            badgeText = `Over Limit (${b.percent_spent}%)`;
          }

          return (
            <div
              key={b.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition flex flex-col justify-between overflow-hidden"
            >
              <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                      style={{ backgroundColor: b.category_color }}
                    >
                      {getCategoryIcon(b.category_icon, 'w-4 h-4')}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{b.category_name}</h4>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Monthly</p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeBg}`}>
                    {badgeText}
                  </span>
                </div>

                {/* Progress Bar & Amounts */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Spent: <strong className="text-slate-900">{formatCurrency(b.spent_cents)}</strong></span>
                    <span className="text-slate-400">Limit: {formatCurrency(b.limit_cents)}</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
                      style={{ width: `${Math.min(100, b.percent_spent)}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                    <span>
                      {b.remaining_cents >= 0 ? (
                        <span className="text-emerald-600 font-semibold">{formatCurrency(b.remaining_cents)} left</span>
                      ) : (
                        <span className="text-rose-600 font-semibold">{formatCurrency(Math.abs(b.remaining_cents))} overspent</span>
                      )}
                    </span>
                    <span className="text-slate-400">Alert at {b.alert_threshold_percent}%</span>
                  </div>
                </div>

                {/* Latest 3 Transactions in Category (Window Function) */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Latest 3 Transactions (SQL Window Query)
                  </span>
                  {b.latest_transactions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No transactions recorded yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {b.latest_transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50">
                          <div className="min-w-0 pr-2">
                            <span className="font-semibold text-slate-800 truncate block">{tx.merchant}</span>
                            <span className="text-[10px] text-slate-400">{formatDate(tx.date)}</span>
                          </div>
                          <span className="font-bold text-slate-900 shrink-0">
                            {formatCurrency(tx.amount_cents)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">Monthly Budget</span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openEditModal(b)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
                    aria-label={`Edit ${b.category_name} budget`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteBudget(b.id, b.category_name)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                    aria-label={`Delete ${b.category_name} budget`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Budget Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={budgetToEdit ? `Edit Budget: ${budgetToEdit.category_name}` : 'Set Category Budget'}
        description="Allocate monthly limits and configure threshold warning alerts."
      >
        <form onSubmit={handleSaveBudget} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          {/* Category selection */}
          {!budgetToEdit && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Category</label>
                <button
                  type="button"
                  onClick={() => setIsCreatingCustomCat(!isCreatingCustomCat)}
                  className="text-xs text-emerald-600 hover:underline font-medium"
                >
                  {isCreatingCustomCat ? 'Select Existing' : '+ Custom Category'}
                </button>
              </div>

              {isCreatingCustomCat ? (
                <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl animate-in fade-in">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category Name</label>
                    <input
                      type="text"
                      value={customCatName}
                      onChange={(e) => setCustomCatName(e.target.value)}
                      placeholder="e.g. Pet Care, Hobbies, Gym"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Badge Color</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={customCatColor}
                        onChange={(e) => setCustomCatColor(e.target.value)}
                        className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5"
                      />
                      <span className="text-xs text-slate-600 font-mono">{customCatColor}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Spending Limit */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Monthly Spending Limit ($ USD) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 text-sm font-semibold">$</span>
              <input
                type="number"
                step="1"
                min="1"
                value={limitStr}
                onChange={(e) => setLimitStr(e.target.value)}
                placeholder="500"
                className="w-full pl-7 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Alert Threshold */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Warning Alert Threshold ({thresholdPercent}%)
            </label>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={thresholdPercent}
              onChange={(e) => setThresholdPercent(parseInt(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>50% (Early Warning)</span>
              <span>80% (Recommended)</span>
              <span>95% (Near Breach)</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : budgetToEdit ? 'Save Changes' : 'Create Budget'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
