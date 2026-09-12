import { dbManager } from '../db/database.ts';

export interface BudgetActual {
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

export class AnalyticsService {
  /**
   * Complex SQL query demonstrating Window Functions:
   * ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY date DESC) <= 3
   */
  public getLatestTransactionsPerBudgetCategory(limit: number = 3) {
    const sql = `
      WITH RankedTransactions AS (
        SELECT 
          t.id,
          t.account_id,
          t.category_id,
          t.amount_cents,
          t.type,
          t.date,
          t.merchant,
          t.notes,
          c.name as category_name,
          c.icon as category_icon,
          c.color as category_color,
          ROW_NUMBER() OVER (PARTITION BY t.category_id ORDER BY t.date DESC, t.id DESC) as rn
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.type = 'expense'
      )
      SELECT * 
      FROM RankedTransactions 
      WHERE rn <= ?
      ORDER BY category_id, rn ASC
    `;
    return dbManager.query(sql, [limit]);
  }

  /**
   * Budget vs. Actual comparisons for a specific month (e.g., '2026-09')
   * Uses GROUP BY and joins latest 3 transactions via window function.
   */
  public getBudgetsWithActuals(monthPrefix: string = '2026-09'): BudgetActual[] {
    const latestTxRows = this.getLatestTransactionsPerBudgetCategory(3);
    const txByCategory: Record<number, any[]> = {};
    for (const row of latestTxRows) {
      if (!txByCategory[row.category_id]) {
        txByCategory[row.category_id] = [];
      }
      txByCategory[row.category_id].push({
        id: row.id,
        amount_cents: row.amount_cents,
        date: row.date,
        merchant: row.merchant,
        notes: row.notes
      });
    }

    const sql = `
      SELECT 
        b.id,
        b.category_id,
        b.period,
        b.limit_cents,
        b.alert_threshold_percent,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color,
        COALESCE(SUM(t.amount_cents), 0) as spent_cents
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      LEFT JOIN transactions t 
        ON t.category_id = b.category_id 
        AND t.type = 'expense'
        AND t.date LIKE ?
      GROUP BY b.id, b.category_id, c.name, c.icon, c.color, b.limit_cents, b.alert_threshold_percent
      ORDER BY spent_cents DESC
    `;

    const rows = dbManager.query(sql, [`${monthPrefix}%`]);

    return rows.map((r) => {
      const limit = Number(r.limit_cents);
      const spent = Number(r.spent_cents);
      const remaining = limit - spent;
      const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      const threshold = Number(r.alert_threshold_percent) || 80;

      let status: 'safe' | 'warning' | 'exceeded' = 'safe';
      if (percent >= 100) {
        status = 'exceeded';
      } else if (percent >= threshold) {
        status = 'warning';
      }

      return {
        id: Number(r.id),
        category_id: Number(r.category_id),
        category_name: r.category_name,
        category_icon: r.category_icon,
        category_color: r.category_color,
        limit_cents: limit,
        spent_cents: spent,
        remaining_cents: remaining,
        percent_spent: percent,
        alert_threshold_percent: threshold,
        status,
        latest_transactions: txByCategory[Number(r.category_id)] || []
      };
    });
  }

  /**
   * Month-over-Month Spending Aggregation using SQL Common Table Expressions (CTE)
   */
  public getMonthOverMonthComparison(currentMonth: string = '2026-09', previousMonth: string = '2026-08') {
    const sql = `
      WITH MonthlyAgg AS (
        SELECT 
          substr(date, 1, 7) as month,
          type,
          SUM(amount_cents) as total_cents
        FROM transactions
        WHERE date LIKE ? OR date LIKE ?
        GROUP BY substr(date, 1, 7), type
      )
      SELECT 
        month,
        type,
        total_cents
      FROM MonthlyAgg
      ORDER BY month ASC, type ASC;
    `;
    const rows = dbManager.query(sql, [`${currentMonth}%`, `${previousMonth}%`]);

    let currIncome = 0;
    let currExpense = 0;
    let prevIncome = 0;
    let prevExpense = 0;

    for (const r of rows) {
      const total = Number(r.total_cents);
      if (r.month === currentMonth) {
        if (r.type === 'income') currIncome = total;
        if (r.type === 'expense') currExpense = total;
      } else if (r.month === previousMonth) {
        if (r.type === 'income') prevIncome = total;
        if (r.type === 'expense') prevExpense = total;
      }
    }

    const expenseChangePercent = prevExpense > 0 
      ? Number((((currExpense - prevExpense) / prevExpense) * 100).toFixed(1))
      : 0;
    const incomeChangePercent = prevIncome > 0
      ? Number((((currIncome - prevIncome) / prevIncome) * 100).toFixed(1))
      : 0;

    return {
      current: { month: currentMonth, income_cents: currIncome, expense_cents: currExpense, net_cents: currIncome - currExpense },
      previous: { month: previousMonth, income_cents: prevIncome, expense_cents: prevExpense, net_cents: prevIncome - prevExpense },
      expenseChangePercent,
      incomeChangePercent
    };
  }

  /**
   * Spending Breakdown by Category for a given month
   */
  public getCategorySpending(monthPrefix: string = '2026-09') {
    const sql = `
      SELECT 
        c.id,
        c.name,
        c.color,
        c.icon,
        COALESCE(SUM(t.amount_cents), 0) as total_cents,
        COUNT(t.id) as transaction_count
      FROM categories c
      JOIN transactions t ON t.category_id = c.id
      WHERE t.type = 'expense' AND t.date LIKE ?
      GROUP BY c.id, c.name, c.color, c.icon
      ORDER BY total_cents DESC
    `;
    const rows = dbManager.query(sql, [`${monthPrefix}%`]);
    const grandTotal = rows.reduce((sum, r) => sum + Number(r.total_cents), 0);

    return rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      color: r.color,
      icon: r.icon,
      total_cents: Number(r.total_cents),
      transaction_count: Number(r.transaction_count),
      percentage: grandTotal > 0 ? Number(((Number(r.total_cents) / grandTotal) * 100).toFixed(1)) : 0
    }));
  }

  /**
   * Historical Cashflow Trend for the last 6 months
   */
  public getMonthlyTrend(monthsCount: number = 6) {
    const sql = `
      SELECT 
        substr(date, 1, 7) as month,
        SUM(CASE WHEN type = 'income' THEN amount_cents ELSE 0 END) as income_cents,
        SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END) as expense_cents
      FROM transactions
      GROUP BY substr(date, 1, 7)
      ORDER BY month DESC
      LIMIT ?
    `;
    const rows = dbManager.query(sql, [monthsCount]);
    // reverse to chronological order
    return rows.reverse().map((r) => ({
      month: r.month,
      income_cents: Number(r.income_cents),
      expense_cents: Number(r.expense_cents),
      net_cents: Number(r.income_cents) - Number(r.expense_cents)
    }));
  }

  /**
   * Spending Insights: Top categories, unusual spending anomalies, threshold alerts
   */
  public getSpendingInsights(monthPrefix: string = '2026-09') {
    // 1. Top categories
    const categories = this.getCategorySpending(monthPrefix);
    const topCategories = categories.slice(0, 3);

    // 2. Budget Alerts
    const budgets = this.getBudgetsWithActuals(monthPrefix);
    const budgetAlerts = budgets.filter((b) => b.status === 'warning' || b.status === 'exceeded');

    // 3. Unusual Spending Spike Query (transactions > 2x average expense for their category)
    const anomalySql = `
      WITH CategoryAvg AS (
        SELECT category_id, AVG(amount_cents) as avg_cents
        FROM transactions
        WHERE type = 'expense'
        GROUP BY category_id
      )
      SELECT 
        t.id,
        t.merchant,
        t.amount_cents,
        t.date,
        c.name as category_name,
        c.color as category_color,
        ROUND(ca.avg_cents) as avg_cents,
        ROUND(CAST(t.amount_cents AS FLOAT) / ca.avg_cents, 1) as multiplier
      FROM transactions t
      JOIN CategoryAvg ca ON t.category_id = ca.category_id
      JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'expense' 
        AND t.date LIKE ?
        AND t.amount_cents > (ca.avg_cents * 2.0)
      ORDER BY multiplier DESC
      LIMIT 4
    `;
    const unusualSpikes = dbManager.query(anomalySql, [`${monthPrefix}%`]);

    return {
      topCategories,
      budgetAlerts,
      unusualSpikes
    };
  }

  /**
   * Complete Overview Dashboard Data
   */
  public getOverview(monthPrefix: string = '2026-09') {
    // Total account balance
    const accounts = dbManager.query('SELECT * FROM accounts');
    const totalBalanceCents = accounts.reduce((sum, acc) => sum + Number(acc.balance_cents), 0);

    const mom = this.getMonthOverMonthComparison(monthPrefix, '2026-08');
    const categorySpending = this.getCategorySpending(monthPrefix);
    const monthlyTrend = this.getMonthlyTrend(6);
    const insights = this.getSpendingInsights(monthPrefix);
    const budgets = this.getBudgetsWithActuals(monthPrefix);

    // Pots progress
    const pots = dbManager.query('SELECT * FROM pots ORDER BY target_cents DESC');
    const totalPotsTarget = pots.reduce((sum, p) => sum + Number(p.target_cents), 0);
    const totalPotsSaved = pots.reduce((sum, p) => sum + Number(p.current_cents), 0);

    // Recurring bills preview
    const billsSql = `
      SELECT b.*, c.name as category_name, c.color as category_color
      FROM recurring_bills b
      JOIN categories c ON b.category_id = c.id
      WHERE b.is_active = 1
      ORDER BY b.due_day ASC
    `;
    const recurringBills = dbManager.query(billsSql);

    // Calculate recurring bill status for current month
    const currentDay = 12; // Sept 12, 2026 from environment context
    let totalBillsCents = 0;
    let paidBillsCents = 0;
    let upcomingBillsCents = 0;
    let overdueBillsCents = 0;

    const billsWithStatus = recurringBills.map((bill) => {
      const amount = Number(bill.amount_cents);
      totalBillsCents += amount;
      const isPaid = bill.last_paid_date && bill.last_paid_date.startsWith(monthPrefix);
      let status: 'paid' | 'due_soon' | 'overdue' | 'upcoming' = 'upcoming';

      if (isPaid) {
        status = 'paid';
        paidBillsCents += amount;
      } else if (bill.due_day < currentDay) {
        status = 'overdue';
        overdueBillsCents += amount;
      } else if (bill.due_day <= currentDay + 5) {
        status = 'due_soon';
        upcomingBillsCents += amount;
      } else {
        status = 'upcoming';
        upcomingBillsCents += amount;
      }

      return {
        ...bill,
        amount_cents: amount,
        status
      };
    });

    // Recent 5 transactions
    const recentTxSql = `
      SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color, a.name as account_name
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      JOIN accounts a ON t.account_id = a.id
      ORDER BY t.date DESC, t.id DESC
      LIMIT 5
    `;
    const recentTransactions = dbManager.query(recentTxSql);

    const savingsRate = mom.current.income_cents > 0
      ? Math.max(0, Number((((mom.current.income_cents - mom.current.expense_cents) / mom.current.income_cents) * 100).toFixed(1)))
      : 0;

    return {
      summary: {
        totalBalanceCents,
        currentIncomeCents: mom.current.income_cents,
        currentExpenseCents: mom.current.expense_cents,
        currentNetCents: mom.current.net_cents,
        savingsRate,
        expenseChangePercent: mom.expenseChangePercent,
        incomeChangePercent: mom.incomeChangePercent
      },
      categorySpending,
      monthlyTrend,
      insights,
      budgets,
      pots: {
        totalTargetCents: totalPotsTarget,
        totalSavedCents: totalPotsSaved,
        progressPercent: totalPotsTarget > 0 ? Math.round((totalPotsSaved / totalPotsTarget) * 100) : 0,
        items: pots
      },
      recurringBills: {
        totalCents: totalBillsCents,
        paidCents: paidBillsCents,
        upcomingCents: upcomingBillsCents,
        overdueCents: overdueBillsCents,
        items: billsWithStatus
      },
      recentTransactions
    };
  }
}

export const analyticsService = new AnalyticsService();
