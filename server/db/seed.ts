import { dbManager } from './database.ts';

export function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  dbManager.transaction(() => {
    // Clear existing data cleanly
    dbManager.run('DELETE FROM pot_transfers');
    dbManager.run('DELETE FROM recurring_bills');
    dbManager.run('DELETE FROM budgets');
    dbManager.run('DELETE FROM transactions');
    dbManager.run('DELETE FROM pots');
    dbManager.run('DELETE FROM merchant_category_rules');
    dbManager.run('DELETE FROM categories');
    dbManager.run('DELETE FROM accounts');

    // 1. Insert Accounts
    dbManager.run(`
      INSERT INTO accounts (id, name, type, balance_cents, currency) VALUES
      (1, 'Primary Checking', 'checking', 485050, 'USD'),
      (2, 'High-Yield Savings', 'savings', 1840000, 'USD'),
      (3, 'Apex Rewards Card', 'credit', -62040, 'USD')
    `);

    // 2. Insert Categories
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

    // 3. Insert Merchant Rules for Auto-categorization
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

    // 4. Insert Budgets (Monthly limits with alert thresholds)
    dbManager.run(`
      INSERT INTO budgets (id, category_id, period, limit_cents, alert_threshold_percent) VALUES
      (1, 2, 'monthly', 65000, 80),  -- Food & Dining: $650 limit
      (2, 3, 'monthly', 28000, 80),  -- Transportation: $280 limit
      (3, 4, 'monthly', 16000, 80),  -- Entertainment: $160 limit (near threshold)
      (4, 5, 'monthly', 22000, 80),  -- Utilities: $220 limit
      (5, 7, 'monthly', 30000, 80)   -- Shopping: $300 limit
    `);

    // 5. Insert Saving Pots
    dbManager.run(`
      INSERT INTO pots (id, name, target_cents, current_cents, color, target_date) VALUES
      (1, 'Emergency Safety Net', 1000000, 825000, '#22c55e', '2026-12-31'),
      (2, 'Japan Cherry Blossom Trip', 450000, 295000, '#ec4899', '2027-04-01'),
      (3, 'MacBook Pro M-Series', 220000, 185000, '#3b82f6', '2026-11-15'),
      (4, 'Home Renovation Fund', 2500000, 1240000, '#f59e0b', '2027-08-30')
    `);

    // 6. Insert Pot Transfers (History)
    dbManager.run(`
      INSERT INTO pot_transfers (pot_id, account_id, amount_cents, type, notes, date) VALUES
      (1, 1, 50000, 'deposit', 'Monthly emergency allocation', '2026-09-02'),
      (2, 1, 25000, 'deposit', 'Saved flight deal savings', '2026-09-05'),
      (3, 1, 15000, 'deposit', 'Freelance milestone bonus', '2026-09-08'),
      (1, 1, 10000, 'withdraw', 'Urgent car brake repair', '2026-08-15'),
      (2, 1, 30000, 'deposit', 'August trip fund transfer', '2026-08-05')
    `);

    // 7. Insert Recurring Bills
    dbManager.run(`
      INSERT INTO recurring_bills (id, category_id, name, amount_cents, frequency, due_day, is_active, last_paid_date, reminder_email) VALUES
      (1, 5, 'Fiber Gigabit Internet', 7500, 'monthly', 4, 1, '2026-09-04', 'alex@example.com'),
      (2, 8, 'Equinox Health & Fitness', 5500, 'monthly', 8, 1, '2026-09-08', 'alex@example.com'),
      (3, 4, 'Netflix Premium 4K', 2299, 'monthly', 14, 1, '2026-08-14', 'alex@example.com'),
      (4, 5, 'City Clean Power & Light', 9540, 'monthly', 16, 1, '2026-08-16', 'alex@example.com'),
      (5, 1, 'Apartment Lease Rent', 165000, 'monthly', 1, 1, '2026-08-01', 'alex@example.com'),
      (6, 4, 'Spotify Family Tier', 1699, 'monthly', 28, 1, '2026-08-28', 'alex@example.com')
    `);

    // 8. Insert Multi-Month Transactions (July, August, September 2026)
    // Cents are used for amounts.
    const transactions = [
      // September 2026 (Current Month)
      { acc: 1, cat: 9, amount: 325000, type: 'income', date: '2026-09-01', merchant: 'Employer Payroll', notes: 'Bi-weekly salary deposit', rec: 0 },
      { acc: 1, cat: 5, amount: 7500, type: 'expense', date: '2026-09-04', merchant: 'Fiber Gigabit Internet', notes: 'Monthly recurring bill', rec: 1 },
      { acc: 1, cat: 8, amount: 5500, type: 'expense', date: '2026-09-08', merchant: 'Equinox Health & Fitness', notes: 'Gym membership', rec: 1 },
      { acc: 1, cat: 2, amount: 8450, type: 'expense', date: '2026-09-02', merchant: 'Whole Foods Market', notes: 'Weekly grocery run', rec: 0 },
      { acc: 1, cat: 2, amount: 1420, type: 'expense', date: '2026-09-03', merchant: 'Chipotle Mexican Grill', notes: 'Burrito bowl lunch', rec: 0 },
      { acc: 1, cat: 3, amount: 3450, type: 'expense', date: '2026-09-04', merchant: 'Uber Technologies', notes: 'Ride to airport', rec: 0 },
      { acc: 1, cat: 2, amount: 4680, type: 'expense', date: '2026-09-05', merchant: 'Trader Joe\'s', notes: 'Pantry restocking', rec: 0 },
      { acc: 1, cat: 7, amount: 12900, type: 'expense', date: '2026-09-06', merchant: 'Amazon Marketplace', notes: 'Desk ergonomic chair cushion & lamp', rec: 0 },
      { acc: 1, cat: 2, amount: 650, type: 'expense', date: '2026-09-07', merchant: 'Starbucks Coffee', notes: 'Iced caramel macchiato', rec: 0 },
      { acc: 1, cat: 4, amount: 6500, type: 'expense', date: '2026-09-08', merchant: 'AMC Theaters', notes: 'IMAX movie tickets and snacks', rec: 0 },
      { acc: 1, cat: 2, amount: 3820, type: 'expense', date: '2026-09-09', merchant: 'Sweetgreen Salad', notes: 'Harvest bowl dinner', rec: 0 },
      { acc: 1, cat: 3, amount: 4800, type: 'expense', date: '2026-09-10', merchant: 'Shell Oil Station', notes: 'Full tank unleaded fuel', rec: 0 },
      { acc: 1, cat: 4, amount: 5999, type: 'expense', date: '2026-09-11', merchant: 'Steam Video Games', notes: 'New RPG release', rec: 0 },
      { acc: 1, cat: 6, amount: 3500, type: 'expense', date: '2026-09-11', merchant: 'CVS Pharmacy', notes: 'Prescription refill & vitamins', rec: 0 },
      { acc: 1, cat: 2, amount: 7200, type: 'expense', date: '2026-09-12', merchant: 'Trader Joe\'s', notes: 'Weekend groceries and produce', rec: 0 },
      { acc: 1, cat: 7, amount: 8500, type: 'expense', date: '2026-09-12', merchant: 'Nike Direct', notes: 'Running shoes on sale', rec: 0 },
      // Subscriptions that repeat every ~30 days (will trigger Recurring Bill Pattern Detection!)
      { acc: 1, cat: 4, amount: 299, type: 'expense', date: '2026-09-05', merchant: 'Apple iCloud Storage', notes: 'Cloud 200GB tier', rec: 0 },
      { acc: 1, cat: 8, amount: 4500, type: 'expense', date: '2026-09-09', merchant: 'Downtown Barber Shop', notes: 'Monthly haircut & trim', rec: 0 },

      // August 2026
      { acc: 1, cat: 9, amount: 325000, type: 'income', date: '2026-08-01', merchant: 'Employer Payroll', notes: 'Bi-weekly salary deposit', rec: 0 },
      { acc: 1, cat: 9, amount: 325000, type: 'income', date: '2026-08-15', merchant: 'Employer Payroll', notes: 'Bi-weekly salary deposit', rec: 0 },
      { acc: 1, cat: 9, amount: 95000, type: 'income', date: '2026-08-20', merchant: 'Freelance Client UX', notes: 'Design consulting invoice', rec: 0 },
      { acc: 1, cat: 1, amount: 165000, type: 'expense', date: '2026-08-01', merchant: 'Apartment Lease Rent', notes: 'August rent payment', rec: 1 },
      { acc: 1, cat: 5, amount: 7500, type: 'expense', date: '2026-08-04', merchant: 'Fiber Gigabit Internet', notes: 'Monthly internet', rec: 1 },
      { acc: 1, cat: 8, amount: 5500, type: 'expense', date: '2026-08-08', merchant: 'Equinox Health & Fitness', notes: 'Gym fee', rec: 1 },
      { acc: 1, cat: 4, amount: 2299, type: 'expense', date: '2026-08-14', merchant: 'Netflix Premium 4K', notes: 'Streaming subscription', rec: 1 },
      { acc: 1, cat: 5, amount: 9240, type: 'expense', date: '2026-08-16', merchant: 'City Clean Power & Light', notes: 'Electric utility bill', rec: 1 },
      { acc: 1, cat: 4, amount: 1699, type: 'expense', date: '2026-08-28', merchant: 'Spotify Family Tier', notes: 'Music streaming', rec: 1 },
      // Cadence detection pairs in August:
      { acc: 1, cat: 4, amount: 299, type: 'expense', date: '2026-08-05', merchant: 'Apple iCloud Storage', notes: 'Cloud 200GB tier', rec: 0 },
      { acc: 1, cat: 8, amount: 4500, type: 'expense', date: '2026-08-09', merchant: 'Downtown Barber Shop', notes: 'Monthly haircut & trim', rec: 0 },
      // August standard expenses
      { acc: 1, cat: 2, amount: 14500, type: 'expense', date: '2026-08-03', merchant: 'Whole Foods Market', notes: 'Large family grocery shop', rec: 0 },
      { acc: 1, cat: 2, amount: 6230, type: 'expense', date: '2026-08-10', merchant: 'Trader Joe\'s', notes: 'Weekly groceries', rec: 0 },
      { acc: 1, cat: 2, amount: 8900, type: 'expense', date: '2026-08-17', merchant: 'Whole Foods Market', notes: 'Organic groceries', rec: 0 },
      { acc: 1, cat: 2, amount: 5410, type: 'expense', date: '2026-08-24', merchant: 'Trader Joe\'s', notes: 'Produce and frozen meals', rec: 0 },
      { acc: 1, cat: 2, amount: 4200, type: 'expense', date: '2026-08-12', merchant: 'Sweetgreen Salad', notes: 'Team lunch', rec: 0 },
      { acc: 1, cat: 2, amount: 3100, type: 'expense', date: '2026-08-19', merchant: 'Chipotle Mexican Grill', notes: 'Dinner with friends', rec: 0 },
      { acc: 1, cat: 3, amount: 5200, type: 'expense', date: '2026-08-07', merchant: 'Shell Oil Station', notes: 'Full tank gas', rec: 0 },
      { acc: 1, cat: 3, amount: 2850, type: 'expense', date: '2026-08-15', merchant: 'Uber Technologies', notes: 'Late ride home', rec: 0 },
      { acc: 1, cat: 3, amount: 3300, type: 'expense', date: '2026-08-22', merchant: 'MTA Subway Pass', notes: 'Monthly transit reload', rec: 0 },
      { acc: 1, cat: 7, amount: 16500, type: 'expense', date: '2026-08-11', merchant: 'Amazon Marketplace', notes: 'Kitchen blender & filters', rec: 0 },
      { acc: 1, cat: 7, amount: 7800, type: 'expense', date: '2026-08-25', merchant: 'Target Department Store', notes: 'Household essentials & detergents', rec: 0 },
      { acc: 1, cat: 6, amount: 4200, type: 'expense', date: '2026-08-18', merchant: 'Walgreens Pharmacy', notes: 'First aid and skincare', rec: 0 },

      // July 2026
      { acc: 1, cat: 9, amount: 325000, type: 'income', date: '2026-07-01', merchant: 'Employer Payroll', notes: 'Bi-weekly salary deposit', rec: 0 },
      { acc: 1, cat: 9, amount: 325000, type: 'income', date: '2026-07-15', merchant: 'Employer Payroll', notes: 'Bi-weekly salary deposit', rec: 0 },
      { acc: 1, cat: 1, amount: 165000, type: 'expense', date: '2026-07-01', merchant: 'Apartment Lease Rent', notes: 'July rent payment', rec: 1 },
      { acc: 1, cat: 5, amount: 7500, type: 'expense', date: '2026-07-04', merchant: 'Fiber Gigabit Internet', notes: 'Monthly internet', rec: 1 },
      { acc: 1, cat: 8, amount: 5500, type: 'expense', date: '2026-07-08', merchant: 'Equinox Health & Fitness', notes: 'Gym fee', rec: 1 },
      { acc: 1, cat: 4, amount: 2299, type: 'expense', date: '2026-07-14', merchant: 'Netflix Premium 4K', notes: 'Streaming subscription', rec: 1 },
      { acc: 1, cat: 5, amount: 8950, type: 'expense', date: '2026-07-16', merchant: 'City Clean Power & Light', notes: 'Electric utility bill', rec: 1 },
      { acc: 1, cat: 4, amount: 1699, type: 'expense', date: '2026-07-28', merchant: 'Spotify Family Tier', notes: 'Music streaming', rec: 1 },
      // Cadence detection pairs in July:
      { acc: 1, cat: 4, amount: 299, type: 'expense', date: '2026-07-05', merchant: 'Apple iCloud Storage', notes: 'Cloud 200GB tier', rec: 0 },
      { acc: 1, cat: 8, amount: 4500, type: 'expense', date: '2026-07-09', merchant: 'Downtown Barber Shop', notes: 'Monthly haircut & trim', rec: 0 },
      { acc: 1, cat: 2, amount: 11200, type: 'expense', date: '2026-07-08', merchant: 'Whole Foods Market', notes: 'July groceries', rec: 0 },
      { acc: 1, cat: 2, amount: 5900, type: 'expense', date: '2026-07-20', merchant: 'Trader Joe\'s', notes: 'Snacks & groceries', rec: 0 },
      { acc: 1, cat: 3, amount: 4900, type: 'expense', date: '2026-07-12', merchant: 'Shell Oil Station', notes: 'Gas refill', rec: 0 }
    ];

    const insertTx = dbManager.getDb().prepare(`
      INSERT INTO transactions (account_id, category_id, amount_cents, type, date, merchant, notes, is_recurring)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const t of transactions) {
      insertTx.run(t.acc, t.cat, t.amount, t.type, t.date, t.merchant, t.notes, t.rec);
    }
  });

  console.log('✅ Database seeded successfully with multi-month accounts, transactions, budgets, pots, and bills.');
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}
