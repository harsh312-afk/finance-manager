export interface Account {
  id: number;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment';
  balance_cents: number;
  currency: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  is_custom: number;
  created_at: string;
}

export interface Transaction {
  id: number;
  account_id: number;
  category_id: number;
  amount_cents: number;
  type: 'expense' | 'income' | 'transfer';
  date: string;
  merchant: string;
  notes: string | null;
  is_recurring: number;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  account_name?: string;
}

export interface Budget {
  id: number;
  category_id: number;
  category_name: string;
  category_icon: string;
  category_color: string;
  limit_cents: number;
  spent_cents: number;
  remaining_cents: number;
  percent_spent: number;
  alert_threshold_percent: number;
  status: 'safe' | 'warning' | 'exceeded';
  latest_transactions: Array<{
    id: number;
    amount_cents: number;
    date: string;
    merchant: string;
    notes: string | null;
  }>;
}

export interface Pot {
  id: number;
  name: string;
  target_cents: number;
  current_cents: number;
  remaining_cents: number;
  progress_percent: number;
  color: string;
  target_date: string | null;
  months_remaining?: number | null;
  monthly_target_cents?: number | null;
  transfer_count?: number;
}

export interface PotTransfer {
  id: number;
  pot_id: number;
  account_id: number;
  account_name?: string;
  amount_cents: number;
  type: 'deposit' | 'withdraw';
  notes: string | null;
  date: string;
  created_at: string;
}

export interface RecurringBill {
  id: number;
  category_id: number;
  category_name: string;
  category_icon: string;
  category_color: string;
  name: string;
  amount_cents: number;
  frequency: 'weekly' | 'monthly' | 'yearly';
  due_day: number;
  is_active: number;
  last_paid_date: string | null;
  reminder_email: string | null;
  status: 'paid' | 'due_soon' | 'overdue' | 'upcoming';
}

export interface RecurringPatternSuggestion {
  merchant: string;
  amount_cents: number;
  category_id: number;
  category_name: string;
  suggested_due_day: number;
  frequency: 'monthly';
  occurrence_count: number;
  confidence: number;
  sample_dates: string[];
}

export interface OverviewData {
  summary: {
    totalBalanceCents: number;
    currentIncomeCents: number;
    currentExpenseCents: number;
    currentNetCents: number;
    savingsRate: number;
    expenseChangePercent: number;
    incomeChangePercent: number;
  };
  categorySpending: Array<{
    id: number;
    name: string;
    color: string;
    icon: string;
    total_cents: number;
    transaction_count: number;
    percentage: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    income_cents: number;
    expense_cents: number;
    net_cents: number;
  }>;
  insights: {
    topCategories: Array<any>;
    budgetAlerts: Array<Budget>;
    unusualSpikes: Array<{
      id: number;
      merchant: string;
      amount_cents: number;
      date: string;
      category_name: string;
      category_color: string;
      avg_cents: number;
      multiplier: number;
    }>;
  };
  budgets: Budget[];
  pots: {
    totalTargetCents: number;
    totalSavedCents: number;
    progressPercent: number;
    items: Pot[];
  };
  recurringBills: {
    totalCents: number;
    paidCents: number;
    upcomingCents: number;
    overdueCents: number;
    items: RecurringBill[];
  };
  recentTransactions: Transaction[];
}
