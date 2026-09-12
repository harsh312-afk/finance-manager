import React, { useState, useEffect } from 'react';
import { RecurringBill, RecurringPatternSuggestion, Category, Account } from '../types';
import { formatCurrency, formatDate, centsToDecimalString, decimalStringToCents } from '../utils/formatters';
import { getCategoryIcon } from '../utils/icons';
import { Modal } from '../components/common/Modal';
import { 
  CalendarClock, 
  Search, 
  ArrowUpDown, 
  Plus, 
  Sparkles, 
  Mail, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Trash2, 
  Edit3,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

interface RecurringBillsPageProps {
  categories: Category[];
  accounts: Account[];
  onRefreshAccounts: () => void;
}

export const RecurringBillsPage: React.FC<RecurringBillsPageProps> = ({
  categories,
  accounts,
  onRefreshAccounts
}) => {
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [summary, setSummary] = useState<any>({ totalCents: 0, paidCents: 0, overdueCents: 0, upcomingCents: 0 });
  const [detectedPatterns, setDetectedPatterns] = useState<RecurringPatternSuggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Sort state
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('due_day');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [billToEdit, setBillToEdit] = useState<RecurringBill | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [simulatedEmail, setSimulatedEmail] = useState<any>(null);

  // Bill form state
  const [name, setName] = useState<string>('');
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id || 1);
  const [amountStr, setAmountStr] = useState<string>('');
  const [dueDay, setDueDay] = useState<number>(1);
  const [frequency, setFrequency] = useState<'monthly'>('monthly');
  const [emailReminder, setEmailReminder] = useState<string>('alex@example.com');
  const [modalError, setModalError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ sortBy, sortOrder });
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/recurring?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load recurring bills');
      const data = await res.json();
      setBills(data.bills);
      setSummary(data.summary);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatterns = async () => {
    try {
      const res = await fetch('/api/recurring/detect-patterns');
      if (res.ok) {
        const data = await res.json();
        setDetectedPatterns(data);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchBills();
  }, [sortBy, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBills();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchPatterns();
  }, []);

  const openCreateModal = () => {
    setBillToEdit(null);
    setName('');
    setCategoryId(categories[0]?.id || 1);
    setAmountStr('');
    setDueDay(15);
    setFrequency('monthly');
    setEmailReminder('alex@example.com');
    setModalError('');
    setIsModalOpen(true);
  };

  const openEditModal = (bill: RecurringBill) => {
    setBillToEdit(bill);
    setName(bill.name);
    setCategoryId(bill.category_id);
    setAmountStr(centsToDecimalString(bill.amount_cents));
    setDueDay(bill.due_day);
    setFrequency('monthly');
    setEmailReminder(bill.reminder_email || 'alex@example.com');
    setModalError('');
    setIsModalOpen(true);
  };

  const handlePromoteDetected = async (pattern: RecurringPatternSuggestion) => {
    try {
      const res = await fetch('/api/recurring/promote-detected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pattern.merchant,
          category_id: pattern.category_id,
          amount_cents: pattern.amount_cents,
          due_day: pattern.suggested_due_day,
          reminder_email: 'alex@example.com'
        })
      });

      if (!res.ok) throw new Error('Failed to promote detected bill');
      fetchBills();
      fetchPatterns();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMarkPaid = async (bill: RecurringBill) => {
    try {
      const res = await fetch(`/api/recurring/${bill.id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '2026-09-12', account_id: 1 })
      });
      if (!res.ok) throw new Error('Failed to mark bill as paid');
      fetchBills();
      onRefreshAccounts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTestEmailReminder = async (bill: RecurringBill) => {
    try {
      const res = await fetch('/api/recurring/test-email-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bill_id: bill.id })
      });
      if (!res.ok) throw new Error('Failed to trigger email notification');
      const data = await res.json();
      setSimulatedEmail(data.email);
      setIsEmailModalOpen(true);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteBill = async (id: number) => {
    if (!confirm('Remove this recurring bill tracker?')) return;
    try {
      const res = await fetch(`/api/recurring/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete bill');
      fetchBills();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setModalError('Bill name is required');
      return;
    }
    const cents = decimalStringToCents(amountStr);
    if (cents <= 0) {
      setModalError('Amount must be greater than $0.00');
      return;
    }

    setSubmitting(true);
    setModalError('');

    try {
      const url = billToEdit ? `/api/recurring/${billToEdit.id}` : '/api/recurring';
      const method = billToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category_id: categoryId,
          amount_cents: cents,
          frequency,
          due_day: dueDay,
          reminder_email: emailReminder.trim() || null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save bill');
      }

      setIsModalOpen(false);
      fetchBills();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Monthly Bills</span>
          <span className="text-2xl font-extrabold text-slate-900">{formatCurrency(summary.totalCents)}</span>
          <p className="text-xs text-slate-500 mt-1">{summary.count} active recurring commitments</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">Paid in September</span>
          <span className="text-2xl font-extrabold text-emerald-600">{formatCurrency(summary.paidCents)}</span>
          <p className="text-xs text-slate-500 mt-1">Successfully logged</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block mb-1">Due Soon / Upcoming</span>
          <span className="text-2xl font-extrabold text-amber-600">{formatCurrency(summary.upcomingCents)}</span>
          <p className="text-xs text-slate-500 mt-1">Scheduled for this month</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 block mb-1">Past Due / Overdue</span>
          <span className="text-2xl font-extrabold text-rose-600">{formatCurrency(summary.overdueCents)}</span>
          <p className="text-xs text-slate-500 mt-1">Action required</p>
        </div>
      </div>

      {/* 2. AI Recurring Cadence Detection Banner */}
      {detectedPatterns.length > 0 && (
        <div className="p-5 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl text-white shadow-md border border-purple-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h4 className="font-bold text-sm text-white">
                Smart Recurring Detection: {detectedPatterns.length} Repeating Subscriptions Discovered
              </h4>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-purple-800/80 text-purple-200 rounded">
              Pattern Recognition
            </span>
          </div>

          <p className="text-xs text-purple-200 mb-4">
            Our historical cadence algorithm detected repeating 30-day transactions in your bank records that aren't yet tracked as recurring bills:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {detectedPatterns.map((pattern, idx) => (
              <div key={idx} className="p-3.5 bg-white/10 backdrop-blur-xs rounded-xl border border-white/15 flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-sm text-white">{pattern.merchant}</h5>
                  <p className="text-xs text-purple-200 mt-0.5">
                    {formatCurrency(pattern.amount_cents)} • Occurs every ~30 days around day {pattern.suggested_due_day}
                  </p>
                  <p className="text-[10px] text-purple-300/80 mt-1">
                    Detected {pattern.occurrence_count} times ({pattern.confidence}% confidence)
                  </p>
                </div>
                <button
                  onClick={() => handlePromoteDetected(pattern)}
                  className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-lg text-xs transition shadow-sm shrink-0"
                >
                  Track Bill
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Search, Sort and Add Bill */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recurring bills..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
          />
        </div>

        <button
          onClick={openCreateModal}
          className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Recurring Bill</span>
        </button>
      </div>

      {/* 4. Recurring Bills Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3.5 cursor-pointer hover:text-slate-800" onClick={() => toggleSort('name')}>
                  <div className="flex items-center space-x-1">
                    <span>Bill Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5 cursor-pointer hover:text-slate-800" onClick={() => toggleSort('due_day')}>
                  <div className="flex items-center space-x-1">
                    <span>Due Date (Monthly)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-6 py-3.5 cursor-pointer hover:text-slate-800" onClick={() => toggleSort('amount_cents')}>
                  <div className="flex items-center space-x-1">
                    <span>Amount</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-6 py-3.5 cursor-pointer hover:text-slate-800" onClick={() => toggleSort('status')}>
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {bills.map((b) => {
                let badgeClass = 'bg-slate-100 text-slate-700';
                if (b.status === 'paid') badgeClass = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
                if (b.status === 'overdue') badgeClass = 'bg-rose-100 text-rose-800 border border-rose-200';
                if (b.status === 'due_soon') badgeClass = 'bg-amber-100 text-amber-800 border border-amber-200';

                return (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-slate-900">
                      <div>{b.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">Reminder: {b.reminder_email || 'No email set'}</div>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span
                        className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold"
                        style={{ backgroundColor: `${b.category_color}18`, color: b.category_color }}
                      >
                        {getCategoryIcon(b.category_icon, 'w-3 h-3')}
                        <span>{b.category_name}</span>
                      </span>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-slate-600 font-medium">
                      Every {b.due_day}th of month
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap font-extrabold text-sm text-slate-900">
                      {formatCurrency(b.amount_cents)}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}>
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* Mark Paid button if not paid */}
                        {b.status !== 'paid' && (
                          <button
                            onClick={() => handleMarkPaid(b)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Mark Paid</span>
                          </button>
                        )}

                        {/* Test Email Notification */}
                        <button
                          onClick={() => handleTestEmailReminder(b)}
                          title="Simulate sending email notification"
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                          aria-label={`Test email reminder for ${b.name}`}
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => openEditModal(b)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                          aria-label={`Edit ${b.name}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteBill(b.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          aria-label={`Delete ${b.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={billToEdit ? 'Edit Recurring Bill' : 'Track New Recurring Bill'}
        description="Monitor automated subscriptions and scheduled obligations."
      >
        <form onSubmit={handleSaveBill} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Bill Name <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Netflix, Rent, Electricity"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ($ USD) <span className="text-rose-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 text-sm font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="50.00"
                  className="w-full pl-7 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Due Day of Month <span className="text-rose-500">*</span></label>
              <input
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(parseInt(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(parseInt(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reminder Email Address</label>
            <input
              type="email"
              value={emailReminder}
              onChange={(e) => setEmailReminder(e.target.value)}
              placeholder="alex@example.com"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

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
              {submitting ? 'Saving...' : billToEdit ? 'Update Bill' : 'Save Bill'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Simulated Email Notification Preview Modal */}
      <Modal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        title="Simulated Email Notification Delivery"
        description="Live preview of automated payment alert sent to the subscriber."
        maxWidth="max-w-xl"
      >
        {simulatedEmail && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-500">
                <span><strong>To:</strong> {simulatedEmail.to}</span>
                <span><strong>Sent:</strong> Just now</span>
              </div>
              <div className="text-slate-500">
                <strong>Subject:</strong> <span className="text-slate-900 font-semibold">{simulatedEmail.subject}</span>
              </div>
            </div>

            {/* Email Body Rendering */}
            <div 
              className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs"
              dangerouslySetInnerHTML={{ __html: simulatedEmail.bodyHtml }}
            />

            <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
              <span className="flex items-center space-x-1.5 text-emerald-600 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>SMTP simulation payload verified</span>
              </span>
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
