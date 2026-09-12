import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { dbManager } from '../db/database.ts';
import { analyticsService } from './analyticsService.ts';

export interface CSVImportRow {
  date: string;
  merchant: string;
  amount_cents: number;
  type: 'expense' | 'income' | 'transfer';
  category_id: number;
  account_id: number;
  notes?: string;
  raw_line?: number;
  errors?: string[];
}

export class CSVService {
  /**
   * Parses string amount into exact integer cents to avoid floating point inaccuracies
   * e.g. "$1,234.56" -> 123456
   */
  public parseAmountToCents(amountStr: string | number): number {
    if (typeof amountStr === 'number') {
      return Math.round(amountStr * 100);
    }
    if (!amountStr || typeof amountStr !== 'string') return 0;
    
    // Clean currency symbols, spaces, commas
    const cleanStr = amountStr.replace(/[$,\s]/g, '').trim();
    if (!cleanStr) return 0;

    const parsedFloat = parseFloat(cleanStr);
    if (isNaN(parsedFloat)) return 0;

    return Math.round(parsedFloat * 100);
  }

  /**
   * Formats integer cents into currency string
   * e.g. 123456 -> "$1,234.56"
   */
  public formatCentsToCurrency(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  /**
   * Suggests category ID based on merchant name using merchant_category_rules
   */
  public suggestCategory(merchant: string): number {
    const lower = merchant.toLowerCase();
    const rules = dbManager.query('SELECT pattern, category_id FROM merchant_category_rules');
    
    for (const rule of rules) {
      if (lower.includes(rule.pattern.toLowerCase())) {
        return Number(rule.category_id);
      }
    }
    // Default fallback category: 2 (Food & Dining) or 7 (Shopping)
    return 7; // Shopping
  }

  /**
   * Parses and validates raw CSV content
   */
  public parseAndValidate(csvContent: string, defaultAccountId: number = 1) {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const categories = dbManager.query('SELECT id, LOWER(name) as name FROM categories');
    const categoryMap = new Map<string, number>();
    categories.forEach(c => categoryMap.set(c.name, Number(c.id)));

    const validRows: CSVImportRow[] = [];
    const invalidRows: { line: number; row: any; errors: string[] }[] = [];

    records.forEach((record: any, index: number) => {
      const lineNum = index + 2; // +1 for header, +1 1-based
      const errors: string[] = [];

      // Extract keys flexibly (case-insensitive keys)
      const keys = Object.keys(record);
      const findKey = (candidates: string[]) => {
        const found = keys.find(k => candidates.includes(k.toLowerCase().trim()));
        return found ? record[found] : '';
      };

      const dateStr = findKey(['date', 'transaction_date', 'posted_date', 'timestamp']);
      const merchantStr = findKey(['merchant', 'description', 'payee', 'name', 'title']);
      const amountRaw = findKey(['amount', 'price', 'total', 'amount_cents']);
      const typeStr = findKey(['type', 'transaction_type', 'direction'])?.toLowerCase();
      const categoryStr = findKey(['category', 'category_name'])?.toLowerCase();
      const notesStr = findKey(['notes', 'memo', 'comment']);

      // 1. Validate Date
      let normalizedDate = '';
      if (!dateStr) {
        errors.push('Date is missing');
      } else {
        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          errors.push(`Invalid date format: "${dateStr}". Expected YYYY-MM-DD or MM/DD/YYYY`);
        } else {
          normalizedDate = parsedDate.toISOString().split('T')[0];
        }
      }

      // 2. Validate Merchant
      if (!merchantStr || !merchantStr.trim()) {
        errors.push('Merchant/Description is missing');
      }

      // 3. Validate Amount
      const amountCents = Math.abs(this.parseAmountToCents(amountRaw));
      if (amountCents <= 0) {
        errors.push(`Amount must be greater than $0.00 (received "${amountRaw}")`);
      }

      // 4. Validate Type
      let txType: 'expense' | 'income' | 'transfer' = 'expense';
      if (typeStr) {
        if (['income', 'deposit', 'credit'].includes(typeStr)) {
          txType = 'income';
        } else if (['transfer'].includes(typeStr)) {
          txType = 'transfer';
        }
      } else {
        // If raw amount is positive vs negative, infer type
        const rawNum = parseFloat(String(amountRaw).replace(/[$,\s]/g, ''));
        if (!isNaN(rawNum) && rawNum > 0 && String(amountRaw).includes('+')) {
          txType = 'income';
        }
      }

      // 5. Category Resolution
      let categoryId = 7; // fallback Shopping
      if (categoryStr && categoryMap.has(categoryStr)) {
        categoryId = categoryMap.get(categoryStr)!;
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
          notes: notesStr ? notesStr.trim() : 'Imported via CSV',
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
  public importTransactions(rows: CSVImportRow[]) {
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

        // Update account balance
        const multiplier = row.type === 'income' ? 1 : -1;
        dbManager.run(
          'UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?',
          [row.amount_cents * multiplier, row.account_id]
        );
      }
    });

    // Check budget alerts for current month after import
    const budgets = analyticsService.getBudgetsWithActuals('2026-09');
    const newAlerts = budgets.filter(b => b.status === 'warning' || b.status === 'exceeded');

    return {
      insertedCount: rows.length,
      budgetAlerts: newAlerts
    };
  }

  /**
   * Generates formatted CSV string for backup export
   */
  public exportTransactionsToCsv(filters: { accountId?: number; categoryId?: number; type?: string; startDate?: string; endDate?: string } = {}) {
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
    const params: any[] = [];

    if (filters.accountId) {
      sql += ' AND t.account_id = ?';
      params.push(filters.accountId);
    }
    if (filters.categoryId) {
      sql += ' AND t.category_id = ?';
      params.push(filters.categoryId);
    }
    if (filters.type && filters.type !== 'all') {
      sql += ' AND t.type = ?';
      params.push(filters.type);
    }
    if (filters.startDate) {
      sql += ' AND t.date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND t.date <= ?';
      params.push(filters.endDate);
    }

    sql += ' ORDER BY t.date DESC, t.id DESC';
    const rows = dbManager.query(sql, params);

    const formattedRows = rows.map(r => ({
      ID: r.id,
      Date: r.date,
      Merchant: r.merchant,
      Category: r.category,
      Account: r.account,
      Type: r.type,
      Amount: (Number(r.amount_cents) / 100).toFixed(2),
      Recurring: r.is_recurring ? 'Yes' : 'No',
      Notes: r.notes || ''
    }));

    return stringify(formattedRows, { header: true });
  }
}

export const csvService = new CSVService();
