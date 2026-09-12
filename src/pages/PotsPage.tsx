import React, { useState, useEffect } from 'react';
import { Pot, PotTransfer, Account } from '../types';
import { formatCurrency, formatDate, centsToDecimalString, decimalStringToCents } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import { 
  PiggyBank, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  Calendar, 
  Target, 
  Trash2, 
  Edit3,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

interface PotsPageProps {
  accounts: Account[];
  onRefreshAccounts: () => void;
}

export const PotsPage: React.FC<PotsPageProps> = ({ accounts, onRefreshAccounts }) => {
  const [pots, setPots] = useState<Pot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [isPotModalOpen, setIsPotModalOpen] = useState<boolean>(false);
  const [potToEdit, setPotToEdit] = useState<Pot | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [activePotForTransfer, setActivePotForTransfer] = useState<Pot | null>(null);
  const [transferType, setTransferType] = useState<'deposit' | 'withdraw'>('deposit');
  const [selectedAccountId, setSelectedAccountId] = useState<number>(accounts[0]?.id || 1);
  const [transferAmountStr, setTransferAmountStr] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');

  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [potHistory, setPotHistory] = useState<PotTransfer[]>([]);
  const [historyPotName, setHistoryPotName] = useState<string>('');

  // Form states
  const [potName, setPotName] = useState<string>('');
  const [targetStr, setTargetStr] = useState<string>('');
  const [potColor, setPotColor] = useState<string>('#22c55e');
  const [targetDate, setTargetDate] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchPots = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/pots');
      if (!res.ok) throw new Error('Failed to load pots');
      const data = await res.json();
      setPots(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPots();
  }, []);

  const openCreateModal = () => {
    setPotToEdit(null);
    setPotName('');
    setTargetStr('');
    setPotColor('#22c55e');
    setTargetDate('');
    setErrorMsg('');
    setIsPotModalOpen(true);
  };

  const openEditModal = (pot: Pot) => {
    setPotToEdit(pot);
    setPotName(pot.name);
    setTargetStr(centsToDecimalString(pot.target_cents));
    setPotColor(pot.color);
    setTargetDate(pot.target_date || '');
    setErrorMsg('');
    setIsPotModalOpen(true);
  };

  const openTransferModal = (pot: Pot, type: 'deposit' | 'withdraw') => {
    setActivePotForTransfer(pot);
    setTransferType(type);
    setSelectedAccountId(accounts[0]?.id || 1);
    setTransferAmountStr('');
    setTransferNotes('');
    setErrorMsg('');
    setIsTransferModalOpen(true);
  };

  const openHistory = async (pot: Pot) => {
    try {
      setHistoryPotName(pot.name);
      const res = await fetch(`/api/pots/${pot.id}/transfers`);
      if (!res.ok) throw new Error('Failed to load transfers');
      const data = await res.json();
      setPotHistory(data);
      setIsHistoryOpen(true);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSavePot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!potName.trim()) {
      setErrorMsg('Pot name is required');
      return;
    }
    const targetCents = decimalStringToCents(targetStr);
    if (targetCents <= 0) {
      setErrorMsg('Target amount must be greater than $0.00');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const url = potToEdit ? `/api/pots/${potToEdit.id}` : '/api/pots';
      const method = potToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: potName.trim(),
          target_cents: targetCents,
          color: potColor,
          target_date: targetDate || null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save pot');
      }

      setIsPotModalOpen(false);
      fetchPots();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePot = async (pot: Pot) => {
    if (pot.current_cents > 0) {
      alert(`Cannot delete pot with funds ($${(pot.current_cents / 100).toFixed(2)}). Please withdraw the remaining funds first.`);
      return;
    }
    if (!confirm(`Delete pot "${pot.name}"?`)) return;

    try {
      const res = await fetch(`/api/pots/${pot.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete pot');
      }
      fetchPots();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePotForTransfer) return;

    const amountCents = decimalStringToCents(transferAmountStr);
    if (amountCents <= 0) {
      setErrorMsg('Amount must be greater than $0.00');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/pots/${activePotForTransfer.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: selectedAccountId,
          amount_cents: amountCents,
          type: transferType,
          notes: transferNotes.trim() || undefined,
          date: '2026-09-12'
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Transfer failed');
      }

      setIsTransferModalOpen(false);
      fetchPots();
      onRefreshAccounts();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalSavedAllPots = pots.reduce((sum, p) => sum + p.current_cents, 0);
  const totalTargetAllPots = pots.reduce((sum, p) => sum + p.target_cents, 0);
  const overallProgress = totalTargetAllPots > 0 ? Math.round((totalSavedAllPots / totalTargetAllPots) * 100) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Overall Pots Summary Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 w-full md:w-2/3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span className="flex items-center space-x-1.5">
              <PiggyBank className="w-4 h-4 text-emerald-600" />
              <span>Total Goal Savings Progress</span>
            </span>
            <span className="font-extrabold text-slate-900">{overallProgress}% Achieved</span>
          </div>

          <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, overallProgress)}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <div>
              <span className="text-slate-400">Total Saved:</span>{' '}
              <strong className="text-emerald-700">{formatCurrency(totalSavedAllPots)}</strong>
            </div>
            <div>
              <span className="text-slate-400">Total Target:</span>{' '}
              <strong className="text-slate-900">{formatCurrency(totalTargetAllPots)}</strong>
            </div>
            <div>
              <span className="text-slate-400">Remaining to Save:</span>{' '}
              <strong className="text-slate-700">{formatCurrency(Math.max(0, totalTargetAllPots - totalSavedAllPots))}</strong>
            </div>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="w-full md:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2 transition shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Saving Pot</span>
        </button>
      </div>

      {/* 2. Pots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
        {pots.map((pot) => (
          <div
            key={pot.id}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition p-6 flex flex-col justify-between"
          >
            <div>
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: pot.color }}
                  >
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">{pot.name}</h3>
                    {pot.target_date ? (
                      <p className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Target: {formatDate(pot.target_date)}</span>
                        {pot.months_remaining && pot.months_remaining > 0 && (
                          <span className="text-slate-400 font-medium">({pot.months_remaining} mo left)</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-0.5">Ongoing reserve</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => openEditModal(pot)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                    aria-label={`Edit ${pot.name}`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeletePot(pot)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    aria-label={`Delete ${pot.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress & Balances */}
              <div className="mt-6 space-y-2">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-extrabold text-slate-900">
                      {formatCurrency(pot.current_cents)}
                    </span>
                    <span className="text-xs text-slate-400 ml-1.5">saved</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-600">
                      Target: {formatCurrency(pot.target_cents)}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pot.progress_percent}%`, backgroundColor: pot.color }}
                  ></div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
                  <span className="font-bold text-slate-700">{pot.progress_percent}% completed</span>
                  <span>{formatCurrency(pot.remaining_cents)} remaining</span>
                </div>
              </div>

              {/* Recommendation chip if target date set */}
              {pot.monthly_target_cents && pot.remaining_cents > 0 && (
                <div className="mt-4 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                  <span>Suggested monthly contribution:</span>
                  <strong className="text-slate-900 font-bold">
                    {formatCurrency(pot.monthly_target_cents)} / month
                  </strong>
                </div>
              )}
            </div>

            {/* Actions: Add Money, Withdraw, History */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openTransferModal(pot, 'deposit')}
                  className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+ Add Money</span>
                </button>

                <button
                  onClick={() => openTransferModal(pot, 'withdraw')}
                  disabled={pot.current_cents <= 0}
                  className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center space-x-1 disabled:opacity-40"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 text-slate-500" />
                  <span>Withdraw</span>
                </button>
              </div>

              <button
                onClick={() => openHistory(pot)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center space-x-1 p-1"
              >
                <History className="w-3.5 h-3.5" />
                <span>History</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pot Create / Edit Modal */}
      <Modal
        isOpen={isPotModalOpen}
        onClose={() => setIsPotModalOpen(false)}
        title={potToEdit ? 'Edit Saving Pot' : 'Create New Saving Pot'}
        description="Pots let you earmark savings for specific goals without opening separate bank accounts."
      >
        <form onSubmit={handleSavePot} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Pot Name <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={potName}
              onChange={(e) => setPotName(e.target.value)}
              placeholder="e.g. New Car Downpayment, Vacation, Laptop"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Amount ($ USD) <span className="text-rose-500">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 text-sm font-semibold">$</span>
              <input
                type="number"
                step="1"
                min="1"
                value={targetStr}
                onChange={(e) => setTargetStr(e.target.value)}
                placeholder="2,500"
                className="w-full pl-7 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Date (Optional)</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Theme Color</label>
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="color"
                  value={potColor}
                  onChange={(e) => setPotColor(e.target.value)}
                  className="w-9 h-9 rounded-xl border border-slate-300 cursor-pointer p-0.5"
                />
                <span className="text-xs text-slate-600 font-mono">{potColor}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsPotModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : potToEdit ? 'Save Changes' : 'Create Pot'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer Modal (Deposit / Withdraw) */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title={`${transferType === 'deposit' ? 'Add Money to' : 'Withdraw Money from'} ${activePotForTransfer?.name}`}
        description={
          transferType === 'deposit'
            ? 'Transfers money from your account balance into this savings goal.'
            : 'Transfers money from this pot back into your account balance.'
        }
      >
        <form onSubmit={handleExecuteTransfer} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {transferType === 'deposit' ? 'Transfer From Account' : 'Transfer To Account'}
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(parseInt(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (Available: {formatCurrency(a.balance_cents)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Amount ($ USD) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 text-sm font-semibold">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={transferAmountStr}
                onChange={(e) => setTransferAmountStr(e.target.value)}
                placeholder="50.00"
                className="w-full pl-7 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Memo / Notes (Optional)
            </label>
            <input
              type="text"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              placeholder="e.g. Monthly paycheck transfer"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              {submitting ? 'Transferring...' : `Confirm ${transferType === 'deposit' ? 'Deposit' : 'Withdrawal'}`}
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer History Ledger Modal */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title={`Transfer History: ${historyPotName}`}
        description="Immutable ledger of all deposits and withdrawals for this pot."
      >
        <div className="space-y-3">
          {potHistory.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-6 text-center">No transfers recorded yet for this pot.</p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {potHistory.map((h) => (
                <div key={h.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        h.type === 'deposit' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {h.type}
                      </span>
                      <span className="font-semibold text-slate-800">{h.account_name}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {formatDate(h.date)} {h.notes ? `• ${h.notes}` : ''}
                    </p>
                  </div>
                  <span className={`font-extrabold ${h.type === 'deposit' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {h.type === 'deposit' ? '+' : '-'}{formatCurrency(h.amount_cents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
