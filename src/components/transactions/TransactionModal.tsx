import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Account, Category, Transaction } from '../../types';
import { centsToDecimalString, decimalStringToCents } from '../../utils/formatters';
import { Sparkles, AlertCircle } from 'lucide-react';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (budgetAlert?: any) => void;
  transactionToEdit?: Transaction | null;
  accounts: Account[];
  categories: Category[];
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  transactionToEdit,
  accounts,
  categories
}) => {
  const [accountId, setAccountId] = useState<number>(accounts[0]?.id || 1);
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id || 1);
  const [merchant, setMerchant] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [date, setDate] = useState<string>('2026-09-12');
  const [notes, setNotes] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);

  const [suggestion, setSuggestion] = useState<Category | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (transactionToEdit) {
      setAccountId(transactionToEdit.account_id);
      setCategoryId(transactionToEdit.category_id);
      setMerchant(transactionToEdit.merchant);
      setAmountStr(centsToDecimalString(transactionToEdit.amount_cents));
      setType(transactionToEdit.type);
      setDate(transactionToEdit.date);
      setNotes(transactionToEdit.notes || '');
      setIsRecurring(Boolean(transactionToEdit.is_recurring));
      setSuggestion(null);
    } else {
      setAccountId(accounts[0]?.id || 1);
      setCategoryId(categories[0]?.id || 1);
      setMerchant('');
      setAmountStr('');
      setType('expense');
      setDate('2026-09-12');
      setNotes('');
      setIsRecurring(false);
      setSuggestion(null);
    }
    setErrors({});
  }, [transactionToEdit, isOpen, accounts, categories]);

  // Real-time merchant category auto-suggestion
  useEffect(() => {
    if (transactionToEdit || !merchant.trim() || merchant.length < 3) {
      setSuggestion(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/transactions/suggest-category?merchant=${encodeURIComponent(merchant.trim())}`);
        const data = await res.json();
        if (data.category && data.category_id !== categoryId) {
          setSuggestion(data.category);
        } else {
          setSuggestion(null);
        }
      } catch (e) {
        // ignore
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [merchant, transactionToEdit, categoryId]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!merchant.trim()) errs.merchant = 'Merchant or description is required';
    if (!amountStr.trim()) {
      errs.amount = 'Amount is required';
    } else {
      const cents = decimalStringToCents(amountStr);
      if (cents <= 0) errs.amount = 'Amount must be greater than $0.00';
    }
    if (!date) errs.date = 'Date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    const amountCents = decimalStringToCents(amountStr);

    const payload = {
      account_id: accountId,
      category_id: categoryId,
      merchant: merchant.trim(),
      amount_cents: amountCents,
      type,
      date,
      notes: notes.trim() || null,
      is_recurring: isRecurring ? 1 : 0
    };

    try {
      const url = transactionToEdit ? `/api/transactions/${transactionToEdit.id}` : '/api/transactions';
      const method = transactionToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save transaction');
      }

      const data = await res.json();
      onSuccess(data.budgetAlert);
      onClose();
    } catch (err: any) {
      setErrors({ form: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={transactionToEdit ? 'Edit Transaction' : 'New Transaction'}
      description="Record an income or expense transaction with decimal currency precision."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {errors.form && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errors.form}</span>
          </div>
        )}

        {/* Transaction Type Segmented Control */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Transaction Type</label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`py-2 text-xs font-bold rounded-lg transition ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Expense (-)
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`py-2 text-xs font-bold rounded-lg transition ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Income (+)
            </button>
          </div>
        </div>

        {/* Merchant & Auto-suggest */}
        <div>
          <label htmlFor="merchant-input" className="block text-xs font-semibold text-slate-700 mb-1">
            Merchant / Description <span className="text-rose-500">*</span>
          </label>
          <input
            id="merchant-input"
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="e.g. Starbucks, Whole Foods, Netflix"
            aria-invalid={Boolean(errors.merchant)}
            aria-describedby={errors.merchant ? 'merchant-error' : undefined}
            className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 ${
              errors.merchant ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-emerald-500'
            }`}
          />
          {errors.merchant && (
            <p id="merchant-error" className="text-xs text-rose-500 mt-1">{errors.merchant}</p>
          )}

          {/* Auto-suggestion Chip */}
          {suggestion && (
            <div className="mt-1.5 flex items-center justify-between p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 animate-in fade-in">
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Suggested category: <strong>{suggestion.name}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCategoryId(suggestion.id);
                  setSuggestion(null);
                }}
                className="px-2 py-0.5 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 transition"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Amount & Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="amount-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Amount ($ USD) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 text-sm font-semibold">$</span>
              <input
                id="amount-input"
                type="number"
                step="0.01"
                min="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={errors.amount ? 'amount-error' : undefined}
                className={`w-full pl-7 pr-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 ${
                  errors.amount ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-emerald-500'
                }`}
              />
            </div>
            {errors.amount && (
              <p id="amount-error" className="text-xs text-rose-500 mt-1">{errors.amount}</p>
            )}
          </div>

          <div>
            <label htmlFor="date-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Date <span className="text-rose-500">*</span>
            </label>
            <input
              id="date-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={Boolean(errors.date)}
              aria-describedby={errors.date ? 'date-error' : undefined}
              className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 ${
                errors.date ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-emerald-500'
              }`}
            />
            {errors.date && (
              <p id="date-error" className="text-xs text-rose-500 mt-1">{errors.date}</p>
            )}
          </div>
        </div>

        {/* Category & Account */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="category-select" className="block text-xs font-semibold text-slate-700 mb-1">
              Category
            </label>
            <select
              id="category-select"
              value={categoryId}
              onChange={(e) => setCategoryId(parseInt(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="account-select" className="block text-xs font-semibold text-slate-700 mb-1">
              Account
            </label>
            <select
              id="account-select"
              value={accountId}
              onChange={(e) => setAccountId(parseInt(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes-input" className="block text-xs font-semibold text-slate-700 mb-1">
            Notes (Optional)
          </label>
          <input
            id="notes-input"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any extra details..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Is Recurring Checkbox */}
        <div className="flex items-center space-x-2 pt-1">
          <input
            id="recurring-checkbox"
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300"
          />
          <label htmlFor="recurring-checkbox" className="text-xs font-medium text-slate-700">
            Mark as recurring monthly bill
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-sm transition"
          >
            {submitting ? 'Saving...' : transactionToEdit ? 'Update Transaction' : 'Create Transaction'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
