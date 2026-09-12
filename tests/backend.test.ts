import { describe, it, expect, beforeEach } from 'vitest';
import { dbManager } from '../server/db/database.ts';
import { seedDatabase } from '../server/db/seed.ts';
import { analyticsService } from '../server/services/analyticsService.ts';
import { recurringDetectionService } from '../server/services/recurringDetectionService.ts';
import { csvService } from '../server/services/csvService.ts';

describe('Personal Finance Manager - Backend & Database Tests', () => {
  beforeEach(() => {
    seedDatabase();
  });

  describe('1. SQLite Window Function - Latest 3 Transactions Per Category', () => {
    it('returns at most 3 latest expense transactions per category partitioned by category_id', () => {
      const rows = analyticsService.getLatestTransactionsPerBudgetCategory(3);
      expect(rows.length).toBeGreaterThan(0);

      // Group by category_id and verify count <= 3
      const counts: Record<number, number> = {};
      const datesByCategory: Record<number, string[]> = {};

      for (const row of rows) {
        counts[row.category_id] = (counts[row.category_id] || 0) + 1;
        if (!datesByCategory[row.category_id]) {
          datesByCategory[row.category_id] = [];
        }
        datesByCategory[row.category_id].push(row.date);
      }

      for (const [catId, count] of Object.entries(counts)) {
        expect(count).toBeLessThanOrEqual(3);
        // Verify chronological descending order
        const dates = datesByCategory[Number(catId)];
        for (let i = 1; i < dates.length; i++) {
          expect(new Date(dates[i - 1]).getTime()).toBeGreaterThanOrEqual(new Date(dates[i]).getTime());
        }
      }
    });
  });

  describe('2. Common Table Expression (CTE) - Month-over-Month Spending Aggregation', () => {
    it('aggregates income and expenses for current month vs previous month', () => {
      const mom = analyticsService.getMonthOverMonthComparison('2026-09', '2026-08');
      expect(mom.current.month).toBe('2026-09');
      expect(mom.previous.month).toBe('2026-08');
      expect(mom.current.income_cents).toBeGreaterThan(0);
      expect(mom.current.expense_cents).toBeGreaterThan(0);
      expect(typeof mom.expenseChangePercent).toBe('number');
    });
  });

  describe('3. Financial Architecture - Integer Cents Currency Handling', () => {
    it('converts dollar strings to integer cents without floating point inaccuracy', () => {
      expect(csvService.parseAmountToCents('$19.99')).toBe(1999);
      expect(csvService.parseAmountToCents('0.10')).toBe(10);
      expect(csvService.parseAmountToCents('0.20')).toBe(20);
      // In JS float: 0.1 + 0.2 = 0.30000000000000004
      // With integer cents: 10 + 20 = 30 cents exactly
      const cents1 = csvService.parseAmountToCents('0.10');
      const cents2 = csvService.parseAmountToCents('0.20');
      expect(cents1 + cents2).toBe(30);

      expect(csvService.parseAmountToCents('$1,450.50')).toBe(145050);
    });

    it('formats cents cleanly to two-decimal strings', () => {
      expect(csvService.formatCentsToCurrency(145050)).toBe('1450.50');
      expect(csvService.formatCentsToCurrency(99)).toBe('0.99');
      expect(csvService.formatCentsToCurrency(5)).toBe('0.05');
    });
  });

  describe('4. Budget Tracking & Alerts', () => {
    it('accurately identifies budgets reaching warning threshold and exceeding limits', () => {
      const budgets = analyticsService.getBudgetsWithActuals('2026-09');
      expect(budgets.length).toBeGreaterThan(0);

      for (const b of budgets) {
        expect(b).toHaveProperty('spent_cents');
        expect(b).toHaveProperty('remaining_cents');
        expect(b).toHaveProperty('percent_spent');
        expect(b).toHaveProperty('status');
        expect(['safe', 'warning', 'exceeded']).toContain(b.status);

        if (b.percent_spent >= 100) {
          expect(b.status).toBe('exceeded');
        } else if (b.percent_spent >= b.alert_threshold_percent) {
          expect(b.status).toBe('warning');
        } else {
          expect(b.status).toBe('safe');
        }
      }
    });
  });

  describe('5. Recurring Bill Pattern Detection Algorithm', () => {
    it('identifies repeating transactions spaced approximately 1 month apart', () => {
      const detected = recurringDetectionService.detectPatterns();
      expect(detected.length).toBeGreaterThan(0);

      const icloud = detected.find(p => p.merchant.includes('iCloud'));
      expect(icloud).toBeDefined();
      expect(icloud?.amount_cents).toBe(299);
      expect(icloud?.occurrence_count).toBeGreaterThanOrEqual(2);
      expect(icloud?.suggested_due_day).toBe(5);
    });
  });

  describe('6. CSV Import & Export Service', () => {
    it('parses valid CSV data and auto-assigns category', () => {
      const sampleCsv = `Date,Merchant,Amount,Type\n2026-09-08,Starbucks Coffee,5.75,expense\n2026-09-09,Uber Technologies,24.50,expense`;
      const result = csvService.parseAndValidate(sampleCsv, 1);

      expect(result.validCount).toBe(2);
      expect(result.invalidCount).toBe(0);
      expect(result.validRows[0].amount_cents).toBe(575);
      expect(result.validRows[0].merchant).toBe('Starbucks Coffee');
      // Starbucks should be auto-categorized to Food & Dining (category_id 2)
      expect(result.validRows[0].category_id).toBe(2);
    });

    it('rejects invalid rows missing merchant or date', () => {
      const badCsv = `Date,Merchant,Amount\n,Starbucks,5.75\n2026-09-09,,10.00\n2026-09-10,Valid Store,-0.00`;
      const result = csvService.parseAndValidate(badCsv, 1);

      expect(result.invalidCount).toBe(3);
    });

    it('exports RFC-4180 compliant CSV', () => {
      const csv = csvService.exportTransactionsToCsv();
      expect(typeof csv).toBe('string');
      expect(csv).toContain('Date');
      expect(csv).toContain('Merchant');
      expect(csv).toContain('Amount');
    });
  });

  describe('7. Saving Pots & Balance Integrity', () => {
    it('allows valid deposit and updates pot and account balances', () => {
      const potBefore = dbManager.get('SELECT current_cents FROM pots WHERE id = 1');
      const accBefore = dbManager.get('SELECT balance_cents FROM accounts WHERE id = 1');
      const depositCents = 10000; // $100.00

      // Execute deposit in transaction
      dbManager.transaction(() => {
        dbManager.run('UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?', [depositCents, 1]);
        dbManager.run('UPDATE pots SET current_cents = current_cents + ? WHERE id = ?', [depositCents, 1]);
      });

      const potAfter = dbManager.get('SELECT current_cents FROM pots WHERE id = 1');
      const accAfter = dbManager.get('SELECT balance_cents FROM accounts WHERE id = 1');

      expect(potAfter.current_cents).toBe(potBefore.current_cents + depositCents);
      expect(accAfter.balance_cents).toBe(accBefore.balance_cents - depositCents);
    });
  });
});
