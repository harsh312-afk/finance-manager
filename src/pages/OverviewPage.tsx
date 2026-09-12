import React, { useEffect, useState } from 'react';
import { OverviewData } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { getCategoryIcon } from '../utils/icons';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldAlert,
  Calendar,
  PiggyBank,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

interface OverviewPageProps {
  onNavigate: (page: string) => void;
  onOpenNewTransaction: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate, onOpenNewTransaction }) => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/overview?month=2026-09');
      if (!res.ok) throw new Error('Failed to load financial overview');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-slate-500">Calculating financial analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm">
        <p className="font-bold">Failed to load overview data</p>
        <p className="text-xs mt-1">{error}</p>
        <button
          onClick={fetchOverview}
          className="mt-3 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { summary, categorySpending, monthlyTrend, insights, budgets, pots, recurringBills, recentTransactions } = data;

  // Chart data formatting
  const trendChartData = monthlyTrend.map(m => ({
    name: m.month,
    Income: m.income_cents / 100,
    Expenses: m.expense_cents / 100,
    Net: m.net_cents / 100
  }));

  const pieChartData = categorySpending.map(c => ({
    name: c.name,
    value: c.total_cents / 100,
    color: c.color,
    percentage: c.percentage
  }));

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Stat Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Net Balance */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Net Balance</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {formatCurrency(summary.totalBalanceCents)}
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500">
            <span>Across 3 verified accounts</span>
          </div>
        </div>

        {/* Monthly Income */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">September Income</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 tracking-tight">
            {formatCurrency(summary.currentIncomeCents)}
          </div>
          <div className="mt-2 flex items-center text-xs space-x-1">
            <span className={`flex items-center font-bold ${summary.incomeChangePercent >= 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
              {summary.incomeChangePercent >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {Math.abs(summary.incomeChangePercent)}%
            </span>
            <span className="text-slate-400">vs last month</span>
          </div>
        </div>

        {/* Monthly Spending */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">September Spending</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {formatCurrency(summary.currentExpenseCents)}
          </div>
          <div className="mt-2 flex items-center text-xs space-x-1">
            <span className={`flex items-center font-bold ${summary.expenseChangePercent > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {summary.expenseChangePercent > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {Math.abs(summary.expenseChangePercent)}%
            </span>
            <span className="text-slate-400">vs last month</span>
          </div>
        </div>

        {/* Savings Rate */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Net Savings Rate</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-blue-600 tracking-tight">
            {summary.savingsRate}%
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500">
            <span>Net cashflow: <strong className="text-slate-700 ml-1">{formatCurrency(summary.currentNetCents)}</strong></span>
          </div>
        </div>
      </div>

      {/* 2. Visual Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income vs Expenses Cashflow Trend */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Cash Flow History</h3>
              <p className="text-xs text-slate-500">Monthly income vs expenses over time</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-lg text-slate-600">
              6 Months Trend
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, '']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spending Breakdown Donut Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Spending by Category</h3>
              <p className="text-xs text-slate-500">Distribution for September</p>
            </div>
          </div>

          <div className="h-44 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`$${Number(val).toFixed(2)}`, 'Total']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Category Legends */}
          <div className="mt-3 space-y-1.5 overflow-y-auto max-h-36 pr-1">
            {categorySpending.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                  <span className="font-medium text-slate-700 truncate max-w-[120px]">{cat.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-900">{formatCurrency(cat.total_cents)}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({cat.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Spending Insights & Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending Insights Widget */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white p-6 rounded-2xl shadow-md border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold tracking-tight">Spending Insights & Anomalies</h3>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-slate-800 text-slate-300 rounded">
              AI Analytics
            </span>
          </div>

          <div className="space-y-3">
            {/* Top Spending Categories */}
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Top Spending Categories This Month
              </span>
              <div className="flex flex-wrap gap-2">
                {insights.topCategories.map((tc: any, i: number) => (
                  <span key={i} className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-slate-700/70 rounded-lg text-xs font-medium">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tc.color }}></span>
                    <span>{tc.name}: <strong>{formatCurrency(tc.total_cents)}</strong></span>
                  </span>
                ))}
              </div>
            </div>

            {/* Unusual Spikes Alert */}
            {insights.unusualSpikes.length > 0 ? (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
                  ⚠️ Unusual Spending Spikes Detected (&gt;2x Category Avg)
                </span>
                {insights.unusualSpikes.map((spike) => (
                  <div key={spike.id} className="flex items-center justify-between p-2.5 bg-amber-950/40 border border-amber-800/40 rounded-xl text-xs">
                    <div>
                      <p className="font-bold text-amber-200">{spike.merchant}</p>
                      <p className="text-[10px] text-amber-300/80">
                        {spike.category_name} • {spike.multiplier}x higher than average ({formatCurrency(spike.avg_cents)})
                      </p>
                    </div>
                    <span className="font-extrabold text-amber-400">
                      {formatCurrency(spike.amount_cents)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-slate-800/40 rounded-xl text-xs text-slate-400 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>No unusual spending anomalies detected this billing cycle.</span>
              </div>
            )}
          </div>
        </div>

        {/* Budgets Progress Summary */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Budget Progress</h3>
                <p className="text-xs text-slate-500">Limits vs September actuals</p>
              </div>
              <button
                onClick={() => onNavigate('budgets')}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center space-x-1"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3.5">
              {budgets.slice(0, 4).map((b) => {
                let barColor = 'bg-emerald-500';
                if (b.status === 'warning') barColor = 'bg-amber-500';
                if (b.status === 'exceeded') barColor = 'bg-rose-500';

                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.category_color }}></span>
                        <span className="font-semibold text-slate-800">{b.category_name}</span>
                        {b.status !== 'safe' && (
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            b.status === 'exceeded' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {b.status === 'exceeded' ? 'Over Limit' : `${b.percent_spent}% Used`}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900">{formatCurrency(b.spent_cents)}</span>
                        <span className="text-slate-400 ml-1">/ {formatCurrency(b.limit_cents)}</span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${Math.min(100, b.percent_spent)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Budgets update automatically upon transaction entry</span>
            <span className="font-semibold text-slate-700">{budgets.length} Active Budgets</span>
          </div>
        </div>
      </div>

      {/* 4. Bottom Row: Pots, Upcoming Bills, and Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Saving Pots Widget */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <PiggyBank className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">Saving Pots</h3>
            </div>
            <button
              onClick={() => onNavigate('pots')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center space-x-0.5"
            >
              <span>Manage</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-xl mb-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-emerald-800 font-semibold block">Total Saved Across Pots</span>
              <span className="text-lg font-extrabold text-emerald-900">{formatCurrency(pots.totalSavedCents)}</span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-emerald-700 block">Overall Target</span>
              <span className="text-xs font-bold text-emerald-800">{formatCurrency(pots.totalTargetCents)}</span>
            </div>
          </div>

          <div className="space-y-3">
            {pots.items.slice(0, 3).map((p) => (
              <div key={p.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{p.name}</span>
                  <span className="font-bold text-slate-900">
                    {p.progress_percent}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${p.progress_percent}%`, backgroundColor: p.color }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Recurring Bills */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-900">Recurring Bills</h3>
            </div>
            <button
              onClick={() => onNavigate('recurring')}
              className="text-xs text-purple-600 hover:text-purple-700 font-bold flex items-center space-x-0.5"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {recurringBills.items.slice(0, 4).map((bill) => (
              <div key={bill.id} className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition text-xs">
                <div>
                  <p className="font-bold text-slate-800">{bill.name}</p>
                  <p className="text-[10px] text-slate-500">Due day {bill.due_day} • {bill.category_name}</p>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-slate-900 block">{formatCurrency(bill.amount_cents)}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                    bill.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                    bill.status === 'overdue' ? 'bg-rose-100 text-rose-800' :
                    bill.status === 'due_soon' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {bill.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions Preview */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Recent Transactions</h3>
            <button
              onClick={() => onNavigate('transactions')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center space-x-0.5"
            >
              <span>Full List</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {recentTransactions.slice(0, 4).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition text-xs">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${tx.category_color}15`, color: tx.category_color }}
                  >
                    {getCategoryIcon(tx.category_icon, 'w-3.5 h-3.5')}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{tx.merchant}</p>
                    <p className="text-[10px] text-slate-400">{formatDate(tx.date)}</p>
                  </div>
                </div>
                <span className={`font-bold shrink-0 ${
                  tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                }`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount_cents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
