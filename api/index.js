// server/app.ts
import express from "express";
import cors from "cors";
import path2 from "node:path";
import fs2 from "node:fs";

// server/db/database.ts
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
var isVercel = !!process.env.VERCEL;
var DB_PATH = process.env.DB_PATH || (isVercel ? "/tmp/finance.db" : path.join(process.cwd(), "finance.db"));
var INLINE_SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('checking', 'savings', 'credit', 'investment')),
    balance_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL DEFAULT 'Tag',
    color TEXT NOT NULL DEFAULT '#64748b',
    is_custom INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    amount_cents INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('expense', 'income', 'transfer')),
    date TEXT NOT NULL,
    merchant TEXT NOT NULL,
    notes TEXT,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL UNIQUE REFERENCES categories(id) ON DELETE CASCADE,
    period TEXT NOT NULL DEFAULT 'monthly',
    limit_cents INTEGER NOT NULL,
    alert_threshold_percent INTEGER NOT NULL DEFAULT 80,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    target_cents INTEGER NOT NULL,
    current_cents INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#22c55e',
    target_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pot_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pot_id INTEGER NOT NULL REFERENCES pots(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('deposit', 'withdraw')),
    notes TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recurring_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'monthly' CHECK(frequency IN ('weekly', 'monthly', 'yearly')),
    due_day INTEGER NOT NULL CHECK(due_day BETWEEN 1 AND 31),
    is_active INTEGER NOT NULL DEFAULT 1,
    last_paid_date TEXT,
    reminder_email TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS merchant_category_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL UNIQUE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_recurring_due_day ON recurring_bills(due_day);
`;
var DatabaseManager = class {
  db;
  constructor(filePath = DB_PATH) {
    this.db = new DatabaseSync(filePath);
    this.init();
  }
  init() {
    this.db.exec("PRAGMA foreign_keys = ON;");
    let applied = false;
    try {
      const schemaPath = path.join(process.cwd(), "server", "db", "schema.sql");
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, "utf8");
        this.db.exec(schemaSql);
        applied = true;
      }
    } catch {
    }
    if (!applied) {
      this.db.exec(INLINE_SCHEMA);
    }
  }
  getDb() {
    return this.db;
  }
  query(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }
  get(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params);
  }
  run(sql, params = []) {
    const stmt = this.db.prepare(sql);
    const info = stmt.run(...params);
    return {
      changes: Number(info.changes),
      lastInsertRowid: Number(info.lastInsertRowid)
    };
  }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE TRANSACTION;");
    try {
      const result = fn();
      this.db.exec("COMMIT;");
      return result;
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }
  }
  close() {
    this.db.close();
  }
};
var dbManager = new DatabaseManager();
var db = dbManager.getDb();

// server/db/seed.ts
function seedDatabase() {
  console.log("\u{1F331} Starting database seeding...");
  dbManager.transaction(() => {
    dbManager.run("DELETE FROM pot_transfers");
    dbManager.run("DELETE FROM recurring_bills");
    dbManager.run("DELETE FROM budgets");
    dbManager.run("DELETE FROM transactions");
    dbManager.run("DELETE FROM pots");
    dbManager.run("DELETE FROM merchant_category_rules");
    dbManager.run("DELETE FROM categories");
    dbManager.run("DELETE FROM accounts");
    dbManager.run(`
      INSERT INTO accounts (id, name, type, balance_cents, currency) VALUES
      (1, 'Primary Checking', 'checking', 485050, 'USD'),
      (2, 'High-Yield Savings', 'savings', 1840000, 'USD'),
      (3, 'Apex Rewards Card', 'credit', -62040, 'USD')
    `);
    dbManager.run(`
      INSERT INTO categories (id, name, icon, color, is_custom) VALUES
      (1, 'Housing', 'Home', '#3b82f6', 0),
      (2, 'Food & Dining', 'Utensils', '#f97316', 0),
      (3, 'Transportation', 'Car', '#8b5cf6', 0),
      (4, 'Entertainment', 'Film', '#ec4899', 0),
      (5, 'Utilities', 'Zap', '#06b6d4', 0),
      (6, 'Healthcare', 'HeartPulse', '#10b981', 0),
      (7, 'Shopping', 'ShoppingBag', '#eab308', 0),
      (8, 'Personal Care', 'Sparkles', '#14b8a6', 0),
      (9, 'Income & Salary', 'Briefcase', '#22c55e', 0)
    `);
    dbManager.run(`
      INSERT INTO merchant_category_rules (pattern, category_id) VALUES
      ('starbucks', 2),
      ('trader joe', 2),
      ('whole foods', 2),
      ('chipotle', 2),
      ('sweetgreen', 2),
      ('uber', 3),
      ('lyft', 3),
      ('shell', 3),
      ('chevron', 3),
      ('mta subway', 3),
      ('netflix', 4),
      ('spotify', 4),
      ('amc theaters', 4),
      ('steam', 4),
      ('electric', 5),
      ('conedison', 5),
      ('internet', 5),
      ('verizon', 5),
      ('cvs pharmacy', 6),
      ('walgreens', 6),
      ('quest diagnostics', 6),
      ('amazon', 7),
      ('target', 7),
      ('apple store', 7),
      ('nike', 7),
      ('equinox gym', 8),
      ('planet fitness', 8),
      ('sephora', 8),
      ('barber shop', 8),
      ('employer payroll', 9),
      ('freelance client', 9)
    `);
    dbManager.run(`
      INSERT INTO budgets (id, category_id, period, limit_cents, alert_threshold_percent) VALUES
      (1, 2, 'monthly', 65000, 80),  -- Food & Dining: $650 limit
      (2, 3, 'monthly', 28000, 80),  -- Transportation: $280 limit
      (3, 4, 'monthly', 16000, 80),  -- Entertainment: $160 limit (near threshold)
      (4, 5, 'monthly', 22000, 80),  -- Utilities: $220 limit
      (5, 7, 'monthly', 30000, 80)   -- Shopping: $300 limit
    `);
    dbManager.run(`
      INSERT INTO pots (id, name, target_cents, current_cents, color, target_date) VALUES
      (1, 'Emergency Safety Net', 1000000, 825000, '#22c55e', '2026-12-31'),
      (2, 'Japan Cherry Blossom Trip', 450000, 295000, '#ec4899', '2027-04-01'),
      (3, 'MacBook Pro M-Series', 220000, 185000, '#3b82f6', '2026-11-15'),
      (4, 'Home Renovation Fund', 2500000, 1240000, '#f59e0b', '2027-08-30')
    `);
    dbManager.run(`
      INSERT INTO pot_transfers (pot_id, account_id, amount_cents, type, notes, date) VALUES
      (1, 1, 50000, 'deposit', 'Monthly emergency allocation', '2026-09-02'),
      (2, 1, 25000, 'deposit', 'Saved flight deal savings', '2026-09-05'),
      (3, 1, 15000, 'deposit', 'Freelance milestone bonus', '2026-09-08'),
      (1, 1, 10000, 'withdraw', 'Urgent car brake repair', '2026-08-15'),
      (2, 1, 30000, 'deposit', 'August trip fund transfer', '2026-08-05')
    `);
    dbManager.run(`
      INSERT INTO recurring_bills (id, category_id, name, amount_cents, frequency, due_day, is_active, last_paid_date, reminder_email) VALUES
      (1, 5, 'Fiber Gigabit Internet', 7500, 'monthly', 4, 1, '2026-09-04', 'alex@example.com'),
      (2, 8, 'Equinox Health & Fitness', 5500, 'monthly', 8, 1, '2026-09-08', 'alex@example.com'),
      (3, 4, 'Netflix Premium 4K', 2299, 'monthly', 14, 1, '2026-08-14', 'alex@example.com'),
      (4, 5, 'City Clean Power & Light', 9540, 'monthly', 16, 1, '2026-08-16', 'alex@example.com'),
      (5, 1, 'Apartment Lease Rent', 165000, 'monthly', 1, 1, '2026-08-01', 'alex@example.com'),
      (6, 4, 'Spotify Family Tier', 1699, 'monthly', 28, 1, '2026-08-28', 'alex@example.com')
    `);
    const transactions = [
      // September 2026 (Current Month)
      { acc: 1, cat: 9, amount: 325e3, type: "income", date: "2026-09-01", merchant: "Employer Payroll", notes: "Bi-weekly salary deposit", rec: 0 },
      { acc: 1, cat: 5, amount: 7500, type: "expense", date: "2026-09-04", merchant: "Fiber Gigabit Internet", notes: "Monthly recurring bill", rec: 1 },
      { acc: 1, cat: 8, amount: 5500, type: "expense", date: "2026-09-08", merchant: "Equinox Health & Fitness", notes: "Gym membership", rec: 1 },
      { acc: 1, cat: 2, amount: 8450, type: "expense", date: "2026-09-02", merchant: "Whole Foods Market", notes: "Weekly grocery run", rec: 0 },
      { acc: 1, cat: 2, amount: 1420, type: "expense", date: "2026-09-03", merchant: "Chipotle Mexican Grill", notes: "Burrito bowl lunch", rec: 0 },
      { acc: 1, cat: 3, amount: 3450, type: "expense", date: "2026-09-04", merchant: "Uber Technologies", notes: "Ride to airport", rec: 0 },
      { acc: 1, cat: 2, amount: 4680, type: "expense", date: "2026-09-05", merchant: "Trader Joe's", notes: "Pantry restocking", rec: 0 },
      { acc: 1, cat: 7, amount: 12900, type: "expense", date: "2026-09-06", merchant: "Amazon Marketplace", notes: "Desk ergonomic chair cushion & lamp", rec: 0 },
      { acc: 1, cat: 2, amount: 650, type: "expense", date: "2026-09-07", merchant: "Starbucks Coffee", notes: "Iced caramel macchiato", rec: 0 },
      { acc: 1, cat: 4, amount: 6500, type: "expense", date: "2026-09-08", merchant: "AMC Theaters", notes: "IMAX movie tickets and snacks", rec: 0 },
      { acc: 1, cat: 2, amount: 3820, type: "expense", date: "2026-09-09", merchant: "Sweetgreen Salad", notes: "Harvest bowl dinner", rec: 0 },
      { acc: 1, cat: 3, amount: 4800, type: "expense", date: "2026-09-10", merchant: "Shell Oil Station", notes: "Full tank unleaded fuel", rec: 0 },
      { acc: 1, cat: 4, amount: 5999, type: "expense", date: "2026-09-11", merchant: "Steam Video Games", notes: "New RPG release", rec: 0 },
      { acc: 1, cat: 6, amount: 3500, type: "expense", date: "2026-09-11", merchant: "CVS Pharmacy", notes: "Prescription refill & vitamins", rec: 0 },
      { acc: 1, cat: 2, amount: 7200, type: "expense", date: "2026-09-12", merchant: "Trader Joe's", notes: "Weekend groceries and produce", rec: 0 },
      { acc: 1, cat: 7, amount: 8500, type: "expense", date: "2026-09-12", merchant: "Nike Direct", notes: "Running shoes on sale", rec: 0 },
      // Subscriptions that repeat every ~30 days (will trigger Recurring Bill Pattern Detection!)
      { acc: 1, cat: 4, amount: 299, type: "expense", date: "2026-09-05", merchant: "Apple iCloud Storage", notes: "Cloud 200GB tier", rec: 0 },
      { acc: 1, cat: 8, amount: 4500, type: "expense", date: "2026-09-09", merchant: "Downtown Barber Shop", notes: "Monthly haircut & trim", rec: 0 },
      // August 2026
      { acc: 1, cat: 9, amount: 325e3, type: "income", date: "2026-08-01", merchant: "Employer Payroll", notes: "Bi-weekly salary deposit", rec: 0 },
      { acc: 1, cat: 9, amount: 325e3, type: "income", date: "2026-08-15", merchant: "Employer Payroll", notes: "Bi-weekly salary deposit", rec: 0 },
      { acc: 1, cat: 9, amount: 95e3, type: "income", date: "2026-08-20", merchant: "Freelance Client UX", notes: "Design consulting invoice", rec: 0 },
      { acc: 1, cat: 1, amount: 165e3, type: "expense", date: "2026-08-01", merchant: "Apartment Lease Rent", notes: "August rent payment", rec: 1 },
      { acc: 1, cat: 5, amount: 7500, type: "expense", date: "2026-08-04", merchant: "Fiber Gigabit Internet", notes: "Monthly internet", rec: 1 },
      { acc: 1, cat: 8, amount: 5500, type: "expense", date: "2026-08-08", merchant: "Equinox Health & Fitness", notes: "Gym fee", rec: 1 },
      { acc: 1, cat: 4, amount: 2299, type: "expense", date: "2026-08-14", merchant: "Netflix Premium 4K", notes: "Streaming subscription", rec: 1 },
      { acc: 1, cat: 5, amount: 9240, type: "expense", date: "2026-08-16", merchant: "City Clean Power & Light", notes: "Electric utility bill", rec: 1 },
      { acc: 1, cat: 4, amount: 1699, type: "expense", date: "2026-08-28", merchant: "Spotify Family Tier", notes: "Music streaming", rec: 1 },
      // Cadence detection pairs in August:
      { acc: 1, cat: 4, amount: 299, type: "expense", date: "2026-08-05", merchant: "Apple iCloud Storage", notes: "Cloud 200GB tier", rec: 0 },
      { acc: 1, cat: 8, amount: 4500, type: "expense", date: "2026-08-09", merchant: "Downtown Barber Shop", notes: "Monthly haircut & trim", rec: 0 },
      // August standard expenses
      { acc: 1, cat: 2, amount: 14500, type: "expense", date: "2026-08-03", merchant: "Whole Foods Market", notes: "Large family grocery shop", rec: 0 },
      { acc: 1, cat: 2, amount: 6230, type: "expense", date: "2026-08-10", merchant: "Trader Joe's", notes: "Weekly groceries", rec: 0 },
      { acc: 1, cat: 2, amount: 8900, type: "expense", date: "2026-08-17", merchant: "Whole Foods Market", notes: "Organic groceries", rec: 0 },
      { acc: 1, cat: 2, amount: 5410, type: "expense", date: "2026-08-24", merchant: "Trader Joe's", notes: "Produce and frozen meals", rec: 0 },
      { acc: 1, cat: 2, amount: 4200, type: "expense", date: "2026-08-12", merchant: "Sweetgreen Salad", notes: "Team lunch", rec: 0 },
      { acc: 1, cat: 2, amount: 3100, type: "expense", date: "2026-08-19", merchant: "Chipotle Mexican Grill", notes: "Dinner with friends", rec: 0 },
      { acc: 1, cat: 3, amount: 5200, type: "expense", date: "2026-08-07", merchant: "Shell Oil Station", notes: "Full tank gas", rec: 0 },
      { acc: 1, cat: 3, amount: 2850, type: "expense", date: "2026-08-15", merchant: "Uber Technologies", notes: "Late ride home", rec: 0 },
      { acc: 1, cat: 3, amount: 3300, type: "expense", date: "2026-08-22", merchant: "MTA Subway Pass", notes: "Monthly transit reload", rec: 0 },
      { acc: 1, cat: 7, amount: 16500, type: "expense", date: "2026-08-11", merchant: "Amazon Marketplace", notes: "Kitchen blender & filters", rec: 0 },
      { acc: 1, cat: 7, amount: 7800, type: "expense", date: "2026-08-25", merchant: "Target Department Store", notes: "Household essentials & detergents", rec: 0 },
      { acc: 1, cat: 6, amount: 4200, type: "expense", date: "2026-08-18", merchant: "Walgreens Pharmacy", notes: "First aid and skincare", rec: 0 },
      // July 2026
      { acc: 1, cat: 9, amount: 325e3, type: "income", date: "2026-07-01", merchant: "Employer Payroll", notes: "Bi-weekly salary deposit", rec: 0 },
      { acc: 1, cat: 9, amount: 325e3, type: "income", date: "2026-07-15", merchant: "Employer Payroll", notes: "Bi-weekly salary deposit", rec: 0 },
      { acc: 1, cat: 1, amount: 165e3, type: "expense", date: "2026-07-01", merchant: "Apartment Lease Rent", notes: "July rent payment", rec: 1 },
      { acc: 1, cat: 5, amount: 7500, type: "expense", date: "2026-07-04", merchant: "Fiber Gigabit Internet", notes: "Monthly internet", rec: 1 },
      { acc: 1, cat: 8, amount: 5500, type: "expense", date: "2026-07-08", merchant: "Equinox Health & Fitness", notes: "Gym fee", rec: 1 },
      { acc: 1, cat: 4, amount: 2299, type: "expense", date: "2026-07-14", merchant: "Netflix Premium 4K", notes: "Streaming subscription", rec: 1 },
      { acc: 1, cat: 5, amount: 8950, type: "expense", date: "2026-07-16", merchant: "City Clean Power & Light", notes: "Electric utility bill", rec: 1 },
      { acc: 1, cat: 4, amount: 1699, type: "expense", date: "2026-07-28", merchant: "Spotify Family Tier", notes: "Music streaming", rec: 1 },
      // Cadence detection pairs in July:
      { acc: 1, cat: 4, amount: 299, type: "expense", date: "2026-07-05", merchant: "Apple iCloud Storage", notes: "Cloud 200GB tier", rec: 0 },
      { acc: 1, cat: 8, amount: 4500, type: "expense", date: "2026-07-09", merchant: "Downtown Barber Shop", notes: "Monthly haircut & trim", rec: 0 },
      { acc: 1, cat: 2, amount: 11200, type: "expense", date: "2026-07-08", merchant: "Whole Foods Market", notes: "July groceries", rec: 0 },
      { acc: 1, cat: 2, amount: 5900, type: "expense", date: "2026-07-20", merchant: "Trader Joe's", notes: "Snacks & groceries", rec: 0 },
      { acc: 1, cat: 3, amount: 4900, type: "expense", date: "2026-07-12", merchant: "Shell Oil Station", notes: "Gas refill", rec: 0 }
    ];
    const insertTx = dbManager.getDb().prepare(`
      INSERT INTO transactions (account_id, category_id, amount_cents, type, date, merchant, notes, is_recurring)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const t of transactions) {
      insertTx.run(t.acc, t.cat, t.amount, t.type, t.date, t.merchant, t.notes, t.rec);
    }
  });
  console.log("\u2705 Database seeded successfully with multi-month accounts, transactions, budgets, pots, and bills.");
}
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}

// server/routes/overview.ts
import { Router } from "express";

// server/services/analyticsService.ts
var AnalyticsService = class {
  /**
   * Complex SQL query demonstrating Window Functions:
   * ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY date DESC) <= 3
   */
  getLatestTransactionsPerBudgetCategory(limit = 3) {
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
  getBudgetsWithActuals(monthPrefix = "2026-09") {
    const latestTxRows = this.getLatestTransactionsPerBudgetCategory(3);
    const txByCategory = {};
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
      const percent = limit > 0 ? Math.round(spent / limit * 100) : 0;
      const threshold = Number(r.alert_threshold_percent) || 80;
      let status = "safe";
      if (percent >= 100) {
        status = "exceeded";
      } else if (percent >= threshold) {
        status = "warning";
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
  getMonthOverMonthComparison(currentMonth = "2026-09", previousMonth = "2026-08") {
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
        if (r.type === "income") currIncome = total;
        if (r.type === "expense") currExpense = total;
      } else if (r.month === previousMonth) {
        if (r.type === "income") prevIncome = total;
        if (r.type === "expense") prevExpense = total;
      }
    }
    const expenseChangePercent = prevExpense > 0 ? Number(((currExpense - prevExpense) / prevExpense * 100).toFixed(1)) : 0;
    const incomeChangePercent = prevIncome > 0 ? Number(((currIncome - prevIncome) / prevIncome * 100).toFixed(1)) : 0;
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
  getCategorySpending(monthPrefix = "2026-09") {
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
      percentage: grandTotal > 0 ? Number((Number(r.total_cents) / grandTotal * 100).toFixed(1)) : 0
    }));
  }
  /**
   * Historical Cashflow Trend for the last 6 months
   */
  getMonthlyTrend(monthsCount = 6) {
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
  getSpendingInsights(monthPrefix = "2026-09") {
    const categories = this.getCategorySpending(monthPrefix);
    const topCategories = categories.slice(0, 3);
    const budgets = this.getBudgetsWithActuals(monthPrefix);
    const budgetAlerts = budgets.filter((b) => b.status === "warning" || b.status === "exceeded");
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
  getOverview(monthPrefix = "2026-09") {
    const accounts = dbManager.query("SELECT * FROM accounts");
    const totalBalanceCents = accounts.reduce((sum, acc) => sum + Number(acc.balance_cents), 0);
    const mom = this.getMonthOverMonthComparison(monthPrefix, "2026-08");
    const categorySpending = this.getCategorySpending(monthPrefix);
    const monthlyTrend = this.getMonthlyTrend(6);
    const insights = this.getSpendingInsights(monthPrefix);
    const budgets = this.getBudgetsWithActuals(monthPrefix);
    const pots = dbManager.query("SELECT * FROM pots ORDER BY target_cents DESC");
    const totalPotsTarget = pots.reduce((sum, p) => sum + Number(p.target_cents), 0);
    const totalPotsSaved = pots.reduce((sum, p) => sum + Number(p.current_cents), 0);
    const billsSql = `
      SELECT b.*, c.name as category_name, c.color as category_color
      FROM recurring_bills b
      JOIN categories c ON b.category_id = c.id
      WHERE b.is_active = 1
      ORDER BY b.due_day ASC
    `;
    const recurringBills = dbManager.query(billsSql);
    const currentDay = 12;
    let totalBillsCents = 0;
    let paidBillsCents = 0;
    let upcomingBillsCents = 0;
    let overdueBillsCents = 0;
    const billsWithStatus = recurringBills.map((bill) => {
      const amount = Number(bill.amount_cents);
      totalBillsCents += amount;
      const isPaid = bill.last_paid_date && bill.last_paid_date.startsWith(monthPrefix);
      let status = "upcoming";
      if (isPaid) {
        status = "paid";
        paidBillsCents += amount;
      } else if (bill.due_day < currentDay) {
        status = "overdue";
        overdueBillsCents += amount;
      } else if (bill.due_day <= currentDay + 5) {
        status = "due_soon";
        upcomingBillsCents += amount;
      } else {
        status = "upcoming";
        upcomingBillsCents += amount;
      }
      return {
        ...bill,
        amount_cents: amount,
        status
      };
    });
    const recentTxSql = `
      SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color, a.name as account_name
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      JOIN accounts a ON t.account_id = a.id
      ORDER BY t.date DESC, t.id DESC
      LIMIT 5
    `;
    const recentTransactions = dbManager.query(recentTxSql);
    const savingsRate = mom.current.income_cents > 0 ? Math.max(0, Number(((mom.current.income_cents - mom.current.expense_cents) / mom.current.income_cents * 100).toFixed(1))) : 0;
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
        progressPercent: totalPotsTarget > 0 ? Math.round(totalPotsSaved / totalPotsTarget * 100) : 0,
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
};
var analyticsService = new AnalyticsService();

// server/routes/overview.ts
var router = Router();
router.get("/", (req, res) => {
  try {
    const month = req.query.month || "2026-09";
    const data = analyticsService.getOverview(month);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var overview_default = router;

// server/routes/transactions.ts
import { Router as Router2 } from "express";
import multer from "multer";

// server/services/csvService.ts
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
var CSVService = class {
  /**
   * Parses string amount into exact integer cents to avoid floating point inaccuracies
   * e.g. "$1,234.56" -> 123456
   */
  parseAmountToCents(amountStr) {
    if (typeof amountStr === "number") {
      return Math.round(amountStr * 100);
    }
    if (!amountStr || typeof amountStr !== "string") return 0;
    const cleanStr = amountStr.replace(/[$,\s]/g, "").trim();
    if (!cleanStr) return 0;
    const parsedFloat = parseFloat(cleanStr);
    if (isNaN(parsedFloat)) return 0;
    return Math.round(parsedFloat * 100);
  }
  /**
   * Formats integer cents into currency string
   * e.g. 123456 -> "$1,234.56"
   */
  formatCentsToCurrency(cents) {
    return (cents / 100).toFixed(2);
  }
  /**
   * Suggests category ID based on merchant name using merchant_category_rules
   */
  suggestCategory(merchant) {
    const lower = merchant.toLowerCase();
    const rules = dbManager.query("SELECT pattern, category_id FROM merchant_category_rules");
    for (const rule of rules) {
      if (lower.includes(rule.pattern.toLowerCase())) {
        return Number(rule.category_id);
      }
    }
    return 7;
  }
  /**
   * Parses and validates raw CSV content
   */
  parseAndValidate(csvContent, defaultAccountId = 1) {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    const categories = dbManager.query("SELECT id, LOWER(name) as name FROM categories");
    const categoryMap = /* @__PURE__ */ new Map();
    categories.forEach((c) => categoryMap.set(c.name, Number(c.id)));
    const validRows = [];
    const invalidRows = [];
    records.forEach((record, index) => {
      const lineNum = index + 2;
      const errors = [];
      const keys = Object.keys(record);
      const findKey = (candidates) => {
        const found = keys.find((k) => candidates.includes(k.toLowerCase().trim()));
        return found ? record[found] : "";
      };
      const dateStr = findKey(["date", "transaction_date", "posted_date", "timestamp"]);
      const merchantStr = findKey(["merchant", "description", "payee", "name", "title"]);
      const amountRaw = findKey(["amount", "price", "total", "amount_cents"]);
      const typeStr = findKey(["type", "transaction_type", "direction"])?.toLowerCase();
      const categoryStr = findKey(["category", "category_name"])?.toLowerCase();
      const notesStr = findKey(["notes", "memo", "comment"]);
      let normalizedDate = "";
      if (!dateStr) {
        errors.push("Date is missing");
      } else {
        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          errors.push(`Invalid date format: "${dateStr}". Expected YYYY-MM-DD or MM/DD/YYYY`);
        } else {
          normalizedDate = parsedDate.toISOString().split("T")[0];
        }
      }
      if (!merchantStr || !merchantStr.trim()) {
        errors.push("Merchant/Description is missing");
      }
      const amountCents = Math.abs(this.parseAmountToCents(amountRaw));
      if (amountCents <= 0) {
        errors.push(`Amount must be greater than $0.00 (received "${amountRaw}")`);
      }
      let txType = "expense";
      if (typeStr) {
        if (["income", "deposit", "credit"].includes(typeStr)) {
          txType = "income";
        } else if (["transfer"].includes(typeStr)) {
          txType = "transfer";
        }
      } else {
        const rawNum = parseFloat(String(amountRaw).replace(/[$,\s]/g, ""));
        if (!isNaN(rawNum) && rawNum > 0 && String(amountRaw).includes("+")) {
          txType = "income";
        }
      }
      let categoryId = 7;
      if (categoryStr && categoryMap.has(categoryStr)) {
        categoryId = categoryMap.get(categoryStr);
      } else if (merchantStr) {
        categoryId = this.suggestCategory(merchantStr);
      }
      if (errors.length > 0) {
        invalidRows.push({ line: lineNum, row: record, errors });
      } else {
        validRows.push({
          date: normalizedDate,
          merchant: merchantStr.trim(),
          amount_cents: amountCents,
          type: txType,
          category_id: categoryId,
          account_id: defaultAccountId,
          notes: notesStr ? notesStr.trim() : "Imported via CSV",
          raw_line: lineNum
        });
      }
    });
    return {
      totalParsed: records.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      validRows,
      invalidRows
    };
  }
  /**
   * Commits valid rows into database and detects if any budget alerts were triggered
   */
  importTransactions(rows) {
    if (rows.length === 0) return { insertedCount: 0, budgetAlerts: [] };
    dbManager.transaction(() => {
      const insertStmt = dbManager.getDb().prepare(`
        INSERT INTO transactions (account_id, category_id, amount_cents, type, date, merchant, notes, is_recurring)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `);
      for (const row of rows) {
        insertStmt.run(
          row.account_id,
          row.category_id,
          row.amount_cents,
          row.type,
          row.date,
          row.merchant,
          row.notes || null
        );
        const multiplier = row.type === "income" ? 1 : -1;
        dbManager.run(
          "UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?",
          [row.amount_cents * multiplier, row.account_id]
        );
      }
    });
    const budgets = analyticsService.getBudgetsWithActuals("2026-09");
    const newAlerts = budgets.filter((b) => b.status === "warning" || b.status === "exceeded");
    return {
      insertedCount: rows.length,
      budgetAlerts: newAlerts
    };
  }
  /**
   * Generates formatted CSV string for backup export
   */
  exportTransactionsToCsv(filters = {}) {
    let sql = `
      SELECT 
        t.id,
        t.date,
        t.merchant,
        c.name as category,
        a.name as account,
        t.type,
        t.amount_cents,
        t.notes,
        t.is_recurring
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      JOIN accounts a ON t.account_id = a.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.accountId) {
      sql += " AND t.account_id = ?";
      params.push(filters.accountId);
    }
    if (filters.categoryId) {
      sql += " AND t.category_id = ?";
      params.push(filters.categoryId);
    }
    if (filters.type && filters.type !== "all") {
      sql += " AND t.type = ?";
      params.push(filters.type);
    }
    if (filters.startDate) {
      sql += " AND t.date >= ?";
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += " AND t.date <= ?";
      params.push(filters.endDate);
    }
    sql += " ORDER BY t.date DESC, t.id DESC";
    const rows = dbManager.query(sql, params);
    const formattedRows = rows.map((r) => ({
      ID: r.id,
      Date: r.date,
      Merchant: r.merchant,
      Category: r.category,
      Account: r.account,
      Type: r.type,
      Amount: (Number(r.amount_cents) / 100).toFixed(2),
      Recurring: r.is_recurring ? "Yes" : "No",
      Notes: r.notes || ""
    }));
    return stringify(formattedRows, { header: true });
  }
};
var csvService = new CSVService();

// server/routes/transactions.ts
var router2 = Router2();
var upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router2.get("/", (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const categoryId = req.query.category_id ? parseInt(req.query.category_id) : void 0;
    const accountId = req.query.account_id ? parseInt(req.query.account_id) : void 0;
    const type = req.query.type;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const isRecurring = req.query.is_recurring !== void 0 ? parseInt(req.query.is_recurring) : void 0;
    const sortBy = req.query.sortBy || "date";
    const sortOrder = req.query.sortOrder?.toUpperCase() === "ASC" ? "ASC" : "DESC";
    const sortColumns = {
      date: "t.date",
      amount: "t.amount_cents",
      merchant: "t.merchant",
      category: "c.name"
    };
    const orderClause = sortColumns[sortBy] ? `${sortColumns[sortBy]} ${sortOrder}, t.id DESC` : `t.date DESC, t.id DESC`;
    let whereClause = " WHERE 1=1 ";
    const params = [];
    if (search) {
      whereClause += " AND (t.merchant LIKE ? OR t.notes LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    if (categoryId) {
      whereClause += " AND t.category_id = ?";
      params.push(categoryId);
    }
    if (accountId) {
      whereClause += " AND t.account_id = ?";
      params.push(accountId);
    }
    if (type && type !== "all") {
      whereClause += " AND t.type = ?";
      params.push(type);
    }
    if (startDate) {
      whereClause += " AND t.date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      whereClause += " AND t.date <= ?";
      params.push(endDate);
    }
    if (isRecurring !== void 0 && !isNaN(isRecurring)) {
      whereClause += " AND t.is_recurring = ?";
      params.push(isRecurring);
    }
    const countSql = `
      SELECT COUNT(*) as count 
      FROM transactions t 
      JOIN categories c ON t.category_id = c.id
      ${whereClause}
    `;
    const countRow = dbManager.get(countSql, params);
    const totalCount = countRow?.count || 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const querySql = `
      SELECT 
        t.id,
        t.account_id,
        t.category_id,
        t.amount_cents,
        t.type,
        t.date,
        t.merchant,
        t.notes,
        t.is_recurring,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color,
        a.name as account_name
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      JOIN accounts a ON t.account_id = a.id
      ${whereClause}
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `;
    const rows = dbManager.query(querySql, [...params, limit, offset]);
    res.json({
      page,
      limit,
      totalCount,
      totalPages,
      transactions: rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.get("/suggest-category", (req, res) => {
  const merchant = (req.query.merchant || "").trim();
  if (!merchant) {
    return res.json({ category_id: null });
  }
  const suggestedId = csvService.suggestCategory(merchant);
  const category = dbManager.get("SELECT * FROM categories WHERE id = ?", [suggestedId]);
  res.json({ category_id: suggestedId, category });
});
router2.post("/", (req, res) => {
  try {
    const { account_id, category_id, amount_cents, type, date, merchant, notes, is_recurring } = req.body;
    if (!account_id || !category_id || !amount_cents || !type || !date || !merchant) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (amount_cents <= 0) {
      return res.status(400).json({ error: "Amount must be greater than 0" });
    }
    const result = dbManager.transaction(() => {
      const res2 = dbManager.run(`
        INSERT INTO transactions (account_id, category_id, amount_cents, type, date, merchant, notes, is_recurring)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [account_id, category_id, amount_cents, type, date, merchant.trim(), notes || null, is_recurring ? 1 : 0]);
      const delta = type === "income" ? amount_cents : -amount_cents;
      dbManager.run("UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?", [delta, account_id]);
      try {
        const pattern = merchant.trim().toLowerCase();
        dbManager.run(`
          INSERT INTO merchant_category_rules (pattern, category_id)
          VALUES (?, ?)
          ON CONFLICT(pattern) DO UPDATE SET category_id = excluded.category_id
        `, [pattern, category_id]);
      } catch (e) {
      }
      return res2.lastInsertRowid;
    });
    const month = date.substring(0, 7);
    const budgets = analyticsService.getBudgetsWithActuals(month);
    const affectedBudget = budgets.find((b) => b.category_id === Number(category_id));
    res.status(201).json({
      id: result,
      message: "Transaction created successfully",
      budgetAlert: affectedBudget?.status !== "safe" ? affectedBudget : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.put("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { account_id, category_id, amount_cents, type, date, merchant, notes, is_recurring } = req.body;
    const existing = dbManager.get("SELECT * FROM transactions WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    dbManager.transaction(() => {
      const oldDelta = existing.type === "income" ? existing.amount_cents : -existing.amount_cents;
      dbManager.run("UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?", [oldDelta, existing.account_id]);
      const newDelta = type === "income" ? amount_cents : -amount_cents;
      dbManager.run("UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?", [newDelta, account_id]);
      dbManager.run(`
        UPDATE transactions 
        SET account_id = ?, category_id = ?, amount_cents = ?, type = ?, date = ?, merchant = ?, notes = ?, is_recurring = ?
        WHERE id = ?
      `, [account_id, category_id, amount_cents, type, date, merchant.trim(), notes || null, is_recurring ? 1 : 0, id]);
    });
    res.json({ message: "Transaction updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.delete("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = dbManager.get("SELECT * FROM transactions WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    dbManager.transaction(() => {
      const delta = existing.type === "income" ? existing.amount_cents : -existing.amount_cents;
      dbManager.run("UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?", [delta, existing.account_id]);
      dbManager.run("DELETE FROM transactions WHERE id = ?", [id]);
    });
    res.json({ message: "Transaction deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.post("/preview-csv", upload.single("file"), (req, res) => {
  try {
    let csvContent = "";
    if (req.file) {
      csvContent = req.file.buffer.toString("utf8");
    } else if (req.body.csv) {
      csvContent = req.body.csv;
    } else {
      return res.status(400).json({ error: "No CSV file or text content provided" });
    }
    const defaultAccountId = parseInt(req.body.account_id) || 1;
    const result = csvService.parseAndValidate(csvContent, defaultAccountId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: `CSV Parse Error: ${err.message}` });
  }
});
router2.post("/import-csv", (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No valid rows to import" });
    }
    const result = csvService.importTransactions(rows);
    res.json({
      message: `Successfully imported ${result.insertedCount} transactions`,
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.get("/export-csv", (req, res) => {
  try {
    const filters = {
      accountId: req.query.account_id ? parseInt(req.query.account_id) : void 0,
      categoryId: req.query.category_id ? parseInt(req.query.category_id) : void 0,
      type: req.query.type,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    const csvData = csvService.exportTransactionsToCsv(filters);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="transactions-export-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv"`);
    res.send(csvData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var transactions_default = router2;

// server/routes/budgets.ts
import { Router as Router3 } from "express";
var router3 = Router3();
router3.get("/", (req, res) => {
  try {
    const month = req.query.month || "2026-09";
    const budgets = analyticsService.getBudgetsWithActuals(month);
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.get("/latest-transactions", (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 3;
    const data = analyticsService.getLatestTransactionsPerBudgetCategory(limit);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.post("/", (req, res) => {
  try {
    const { category_id, limit_cents, alert_threshold_percent, period } = req.body;
    if (!category_id || !limit_cents || limit_cents <= 0) {
      return res.status(400).json({ error: "Valid category and spending limit are required" });
    }
    const existing = dbManager.get("SELECT id FROM budgets WHERE category_id = ?", [category_id]);
    if (existing) {
      return res.status(400).json({ error: "A budget for this category already exists" });
    }
    const result = dbManager.run(`
      INSERT INTO budgets (category_id, period, limit_cents, alert_threshold_percent)
      VALUES (?, ?, ?, ?)
    `, [category_id, period || "monthly", limit_cents, alert_threshold_percent || 80]);
    const created = dbManager.get("SELECT * FROM budgets WHERE id = ?", [result.lastInsertRowid]);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.put("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { limit_cents, alert_threshold_percent, period } = req.body;
    if (!limit_cents || limit_cents <= 0) {
      return res.status(400).json({ error: "Spending limit must be greater than 0" });
    }
    const result = dbManager.run(`
      UPDATE budgets 
      SET limit_cents = ?, alert_threshold_percent = ?, period = ?
      WHERE id = ?
    `, [limit_cents, alert_threshold_percent || 80, period || "monthly", id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Budget not found" });
    }
    const updated = dbManager.get("SELECT * FROM budgets WHERE id = ?", [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.delete("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = dbManager.run("DELETE FROM budgets WHERE id = ?", [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Budget not found" });
    }
    res.json({ message: "Budget deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var budgets_default = router3;

// server/routes/pots.ts
import { Router as Router4 } from "express";
var router4 = Router4();
router4.get("/", (req, res) => {
  try {
    const pots = dbManager.query(`
      SELECT 
        p.*,
        COUNT(pt.id) as transfer_count
      FROM pots p
      LEFT JOIN pot_transfers pt ON pt.pot_id = p.id
      GROUP BY p.id
      ORDER BY p.target_cents DESC
    `);
    const enriched = pots.map((p) => {
      const target = Number(p.target_cents);
      const current = Number(p.current_cents);
      const remaining = Math.max(0, target - current);
      const progress = target > 0 ? Math.min(100, Math.round(current / target * 100)) : 0;
      let monthsRemaining = null;
      let monthlyTargetCents = null;
      if (p.target_date) {
        const today = /* @__PURE__ */ new Date("2026-09-12");
        const targetDate = new Date(p.target_date);
        const diffMonths = (targetDate.getFullYear() - today.getFullYear()) * 12 + (targetDate.getMonth() - today.getMonth());
        if (diffMonths > 0) {
          monthsRemaining = diffMonths;
          monthlyTargetCents = Math.ceil(remaining / diffMonths);
        }
      }
      return {
        ...p,
        target_cents: target,
        current_cents: current,
        remaining_cents: remaining,
        progress_percent: progress,
        months_remaining: monthsRemaining,
        monthly_target_cents: monthlyTargetCents
      };
    });
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.get("/:id/transfers", (req, res) => {
  try {
    const potId = parseInt(req.params.id);
    const transfers = dbManager.query(`
      SELECT pt.*, a.name as account_name
      FROM pot_transfers pt
      JOIN accounts a ON pt.account_id = a.id
      WHERE pt.pot_id = ?
      ORDER BY pt.date DESC, pt.id DESC
    `, [potId]);
    res.json(transfers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.post("/", (req, res) => {
  try {
    const { name, target_cents, current_cents, color, target_date } = req.body;
    if (!name || !target_cents || target_cents <= 0) {
      return res.status(400).json({ error: "Name and a valid target amount are required" });
    }
    const result = dbManager.run(`
      INSERT INTO pots (name, target_cents, current_cents, color, target_date)
      VALUES (?, ?, ?, ?, ?)
    `, [name.trim(), target_cents, current_cents || 0, color || "#22c55e", target_date || null]);
    const created = dbManager.get("SELECT * FROM pots WHERE id = ?", [result.lastInsertRowid]);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.put("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, target_cents, color, target_date } = req.body;
    if (!name || !target_cents || target_cents <= 0) {
      return res.status(400).json({ error: "Name and a valid target amount are required" });
    }
    const result = dbManager.run(`
      UPDATE pots 
      SET name = ?, target_cents = ?, color = ?, target_date = ?
      WHERE id = ?
    `, [name.trim(), target_cents, color || "#22c55e", target_date || null, id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Pot not found" });
    }
    const updated = dbManager.get("SELECT * FROM pots WHERE id = ?", [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.delete("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pot = dbManager.get("SELECT current_cents FROM pots WHERE id = ?", [id]);
    if (!pot) {
      return res.status(404).json({ error: "Pot not found" });
    }
    if (pot.current_cents > 0) {
      return res.status(400).json({ error: "Cannot delete a pot with funds. Please withdraw the remaining funds first." });
    }
    dbManager.run("DELETE FROM pots WHERE id = ?", [id]);
    res.json({ message: "Pot deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.post("/:id/transfer", (req, res) => {
  try {
    const potId = parseInt(req.params.id);
    const { account_id, amount_cents, type, notes, date } = req.body;
    if (!account_id || !amount_cents || amount_cents <= 0 || !type) {
      return res.status(400).json({ error: "Missing required transfer fields" });
    }
    if (type !== "deposit" && type !== "withdraw") {
      return res.status(400).json({ error: "Type must be deposit or withdraw" });
    }
    const pot = dbManager.get("SELECT * FROM pots WHERE id = ?", [potId]);
    if (!pot) return res.status(404).json({ error: "Pot not found" });
    const account = dbManager.get("SELECT * FROM accounts WHERE id = ?", [account_id]);
    if (!account) return res.status(404).json({ error: "Account not found" });
    const transferDate = date || "2026-09-12";
    dbManager.transaction(() => {
      if (type === "deposit") {
        if (account.balance_cents < amount_cents) {
          throw new Error(`Insufficient account balance. Available: $${(account.balance_cents / 100).toFixed(2)}`);
        }
        dbManager.run("UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?", [amount_cents, account_id]);
        dbManager.run("UPDATE pots SET current_cents = current_cents + ? WHERE id = ?", [amount_cents, potId]);
      } else {
        if (pot.current_cents < amount_cents) {
          throw new Error(`Insufficient pot funds. Available: $${(pot.current_cents / 100).toFixed(2)}`);
        }
        dbManager.run("UPDATE pots SET current_cents = current_cents - ? WHERE id = ?", [amount_cents, potId]);
        dbManager.run("UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?", [amount_cents, account_id]);
      }
      dbManager.run(`
        INSERT INTO pot_transfers (pot_id, account_id, amount_cents, type, notes, date)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [potId, account_id, amount_cents, type, notes || `${type === "deposit" ? "Added to" : "Withdrawn from"} ${pot.name}`, transferDate]);
    });
    const updatedPot = dbManager.get("SELECT * FROM pots WHERE id = ?", [potId]);
    const updatedAccount = dbManager.get("SELECT * FROM accounts WHERE id = ?", [account_id]);
    res.json({
      message: `Successfully ${type === "deposit" ? "deposited" : "withdrawn"} $${(amount_cents / 100).toFixed(2)}`,
      pot: updatedPot,
      account: updatedAccount
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
var pots_default = router4;

// server/routes/recurring.ts
import { Router as Router5 } from "express";

// server/services/recurringDetectionService.ts
var RecurringDetectionService = class {
  /**
   * Identifies candidate recurring bills from transaction history
   * Looks for repeated charges with same merchant and amount at ~monthly intervals
   */
  detectPatterns() {
    const existingBills = dbManager.query("SELECT LOWER(name) as name, amount_cents FROM recurring_bills WHERE is_active = 1");
    const existingNames = new Set(existingBills.map((b) => b.name.toLowerCase()));
    const sql = `
      SELECT 
        t.id,
        t.merchant,
        t.amount_cents,
        t.date,
        t.category_id,
        c.name as category_name
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'expense'
      ORDER BY t.merchant COLLATE NOCASE ASC, t.date ASC
    `;
    const rows = dbManager.query(sql);
    const groups = {};
    for (const r of rows) {
      const key = `${r.merchant.toLowerCase().trim()}:::${r.amount_cents}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    const suggestions = [];
    for (const key of Object.keys(groups)) {
      const txs = groups[key];
      if (txs.length < 2) continue;
      const merchant = txs[0].merchant;
      const lowerMerchant = merchant.toLowerCase();
      let alreadyTracked = false;
      for (const existingName of existingNames) {
        if (lowerMerchant.includes(existingName) || existingName.includes(lowerMerchant)) {
          alreadyTracked = true;
          break;
        }
      }
      if (alreadyTracked) continue;
      const dates = txs.map((t) => new Date(t.date).getTime()).sort((a, b) => a - b);
      let monthlyIntervalCount = 0;
      for (let i = 1; i < dates.length; i++) {
        const diffDays = Math.round((dates[i] - dates[i - 1]) / (1e3 * 60 * 60 * 24));
        if (diffDays >= 25 && diffDays <= 35) {
          monthlyIntervalCount++;
        }
      }
      if (monthlyIntervalCount >= 1) {
        const latestTx = txs[txs.length - 1];
        const dueDay = parseInt(latestTx.date.split("-")[2], 10);
        const confidence = Math.min(100, 60 + monthlyIntervalCount * 20);
        suggestions.push({
          merchant: latestTx.merchant,
          amount_cents: Number(latestTx.amount_cents),
          category_id: Number(latestTx.category_id),
          category_name: latestTx.category_name,
          suggested_due_day: dueDay,
          frequency: "monthly",
          occurrence_count: txs.length,
          confidence,
          sample_dates: txs.map((t) => t.date)
        });
      }
    }
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }
};
var recurringDetectionService = new RecurringDetectionService();

// server/routes/recurring.ts
var router5 = Router5();
router5.get("/", (req, res) => {
  try {
    const search = (req.query.search || "").trim().toLowerCase();
    const sortBy = req.query.sortBy || "due_day";
    const sortOrder = req.query.sortOrder?.toUpperCase() === "DESC" ? "DESC" : "ASC";
    const currentDay = 12;
    const currentMonth = "2026-09";
    const sql = `
      SELECT 
        b.*,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color
      FROM recurring_bills b
      JOIN categories c ON b.category_id = c.id
      WHERE b.is_active = 1
    `;
    const bills = dbManager.query(sql);
    let processed = bills.map((bill) => {
      const amount = Number(bill.amount_cents);
      const isPaid = bill.last_paid_date && bill.last_paid_date.startsWith(currentMonth);
      let status = "upcoming";
      if (isPaid) {
        status = "paid";
      } else if (bill.due_day < currentDay) {
        status = "overdue";
      } else if (bill.due_day <= currentDay + 5) {
        status = "due_soon";
      } else {
        status = "upcoming";
      }
      return {
        ...bill,
        amount_cents: amount,
        status
      };
    });
    if (search) {
      processed = processed.filter(
        (b) => b.name.toLowerCase().includes(search) || b.category_name.toLowerCase().includes(search)
      );
    }
    processed.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      if (sortBy === "status") {
        const orderWeight = { overdue: 1, due_soon: 2, upcoming: 3, paid: 4 };
        valA = orderWeight[a.status] || 99;
        valB = orderWeight[b.status] || 99;
      }
      if (valA < valB) return sortOrder === "ASC" ? -1 : 1;
      if (valA > valB) return sortOrder === "ASC" ? 1 : -1;
      return 0;
    });
    const totalCents = processed.reduce((sum, b) => sum + b.amount_cents, 0);
    const paidCents = processed.filter((b) => b.status === "paid").reduce((sum, b) => sum + b.amount_cents, 0);
    const overdueCents = processed.filter((b) => b.status === "overdue").reduce((sum, b) => sum + b.amount_cents, 0);
    const upcomingCents = processed.filter((b) => b.status === "due_soon" || b.status === "upcoming").reduce((sum, b) => sum + b.amount_cents, 0);
    res.json({
      summary: {
        totalCents,
        paidCents,
        overdueCents,
        upcomingCents,
        count: processed.length
      },
      bills: processed
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.get("/detect-patterns", (req, res) => {
  try {
    const patterns = recurringDetectionService.detectPatterns();
    res.json(patterns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.post("/promote-detected", (req, res) => {
  try {
    const { name, category_id, amount_cents, due_day, reminder_email } = req.body;
    if (!name || !category_id || !amount_cents || !due_day) {
      return res.status(400).json({ error: "Missing required recurring bill parameters" });
    }
    const result = dbManager.run(`
      INSERT INTO recurring_bills (name, category_id, amount_cents, frequency, due_day, reminder_email, is_active)
      VALUES (?, ?, ?, 'monthly', ?, ?, 1)
    `, [name.trim(), category_id, amount_cents, due_day, reminder_email || "alex@example.com"]);
    const created = dbManager.get("SELECT * FROM recurring_bills WHERE id = ?", [result.lastInsertRowid]);
    res.status(201).json({
      message: "Detected pattern successfully promoted to active recurring bill",
      bill: created
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.post("/", (req, res) => {
  try {
    const { name, category_id, amount_cents, frequency, due_day, reminder_email } = req.body;
    if (!name || !category_id || !amount_cents || !due_day) {
      return res.status(400).json({ error: "Name, category, amount, and due day are required" });
    }
    const result = dbManager.run(`
      INSERT INTO recurring_bills (name, category_id, amount_cents, frequency, due_day, reminder_email, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [name.trim(), category_id, amount_cents, frequency || "monthly", due_day, reminder_email || null]);
    const created = dbManager.get("SELECT * FROM recurring_bills WHERE id = ?", [result.lastInsertRowid]);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.put("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, category_id, amount_cents, frequency, due_day, reminder_email, is_active } = req.body;
    const result = dbManager.run(`
      UPDATE recurring_bills
      SET name = ?, category_id = ?, amount_cents = ?, frequency = ?, due_day = ?, reminder_email = ?, is_active = ?
      WHERE id = ?
    `, [name.trim(), category_id, amount_cents, frequency || "monthly", due_day, reminder_email || null, is_active ?? 1, id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Bill not found" });
    }
    const updated = dbManager.get("SELECT * FROM recurring_bills WHERE id = ?", [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.delete("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = dbManager.run("DELETE FROM recurring_bills WHERE id = ?", [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Bill not found" });
    }
    res.json({ message: "Recurring bill removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.post("/:id/mark-paid", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const bill = dbManager.get("SELECT * FROM recurring_bills WHERE id = ?", [id]);
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    const payDate = req.body.date || "2026-09-12";
    const accountId = parseInt(req.body.account_id) || 1;
    dbManager.transaction(() => {
      dbManager.run("UPDATE recurring_bills SET last_paid_date = ? WHERE id = ?", [payDate, id]);
      dbManager.run(`
        INSERT INTO transactions (account_id, category_id, amount_cents, type, date, merchant, notes, is_recurring)
        VALUES (?, ?, ?, 'expense', ?, ?, ?, 1)
      `, [accountId, bill.category_id, bill.amount_cents, payDate, bill.name, "Recurring bill auto-logged payment"]);
      dbManager.run("UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?", [bill.amount_cents, accountId]);
    });
    res.json({ message: `Bill "${bill.name}" marked as paid for ${payDate.substring(0, 7)}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.post("/test-email-reminder", (req, res) => {
  try {
    const { bill_id, email } = req.body;
    const bill = dbManager.get(`
      SELECT b.*, c.name as category_name
      FROM recurring_bills b
      JOIN categories c ON b.category_id = c.id
      WHERE b.id = ?
    `, [bill_id]);
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    const targetEmail = email || bill.reminder_email || "alex@example.com";
    const amountFormatted = `$${(bill.amount_cents / 100).toFixed(2)}`;
    const simulatedEmail = {
      to: targetEmail,
      from: "reminders@vaultflow-finance.internal",
      subject: `\u23F0 Reminder: Upcoming Payment for ${bill.name} (${amountFormatted})`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      previewText: `Your payment of ${amountFormatted} for ${bill.name} is scheduled for day ${bill.due_day}.`,
      bodyHtml: `
        <div style="font-family: sans-serif; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-bottom: 8px;">VaultFlow Bill Reminder</h2>
          <p style="color: #64748b; font-size: 14px;">This is an automated notification from your personal finance manager.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
            <p style="margin: 4px 0; color: #475569;"><strong>Bill Name:</strong> ${bill.name}</p>
            <p style="margin: 4px 0; color: #475569;"><strong>Category:</strong> ${bill.category_name}</p>
            <p style="margin: 4px 0; color: #475569;"><strong>Due Day:</strong> ${bill.due_day}th of the month</p>
            <p style="margin: 4px 0; color: #0f172a; font-size: 18px;"><strong>Amount Due:</strong> <span style="color: #059669;">${amountFormatted}</span></p>
          </div>
          <p style="color: #64748b; font-size: 13px;">Ensure your primary account has sufficient funds to avoid missed payments or overdraft fees.</p>
        </div>
      `
    };
    res.json({
      success: true,
      message: `Simulated email notification triggered to ${targetEmail}`,
      email: simulatedEmail
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var recurring_default = router5;

// server/routes/categories.ts
import { Router as Router6 } from "express";
var router6 = Router6();
router6.get("/", (req, res) => {
  try {
    const categories = dbManager.query("SELECT * FROM categories ORDER BY name ASC");
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.post("/", (req, res) => {
  try {
    const { name, icon, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Category name is required" });
    }
    const trimmed = name.trim();
    const existing = dbManager.get("SELECT id FROM categories WHERE LOWER(name) = LOWER(?)", [trimmed]);
    if (existing) {
      return res.status(400).json({ error: "Category already exists" });
    }
    const result = dbManager.run(`
      INSERT INTO categories (name, icon, color, is_custom)
      VALUES (?, ?, ?, 1)
    `, [trimmed, icon || "Tag", color || "#64748b"]);
    const created = dbManager.get("SELECT * FROM categories WHERE id = ?", [result.lastInsertRowid]);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var categories_default = router6;

// server/routes/accounts.ts
import { Router as Router7 } from "express";
var router7 = Router7();
router7.get("/", (req, res) => {
  try {
    const accounts = dbManager.query("SELECT * FROM accounts ORDER BY id ASC");
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var accounts_default = router7;

// server/app.ts
var app = express();
function ensureDatabaseInitialized() {
  try {
    const countRow = dbManager.get("SELECT COUNT(*) as count FROM accounts");
    if (!countRow || countRow.count === 0) {
      console.log("Database empty, automatically seeding initial data...");
      seedDatabase();
    }
  } catch (e) {
    console.log("Error checking database status, running seed...", e);
    seedDatabase();
  }
}
ensureDatabaseInitialized();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(["/api/overview", "/overview"], overview_default);
app.use(["/api/transactions", "/transactions"], transactions_default);
app.use(["/api/budgets", "/budgets"], budgets_default);
app.use(["/api/pots", "/pots"], pots_default);
app.use(["/api/recurring", "/recurring"], recurring_default);
app.use(["/api/categories", "/categories"], categories_default);
app.use(["/api/accounts", "/accounts"], accounts_default);
app.get(["/api/health", "/health"], (req, res) => {
  res.json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    env: process.env.NODE_ENV || "development",
    serverless: !!process.env.VERCEL
  });
});
var distPath = path2.join(process.cwd(), "dist");
if (fs2.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path2.join(distPath, "index.html"));
  });
}
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});
var app_default = app;

// server/apiHandler.ts
ensureDatabaseInitialized();
function handler(req, res) {
  return app_default(req, res);
}
export {
  handler as default
};
