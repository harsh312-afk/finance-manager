-- Enable foreign keys
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
    date TEXT NOT NULL, -- YYYY-MM-DD
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
    target_date TEXT, -- YYYY-MM-DD
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pot_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pot_id INTEGER NOT NULL REFERENCES pots(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('deposit', 'withdraw')),
    notes TEXT,
    date TEXT NOT NULL, -- YYYY-MM-DD
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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_recurring_due_day ON recurring_bills(due_day);
