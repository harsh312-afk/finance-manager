import { dbManager } from '../db/database.ts';

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

export class RecurringDetectionService {
  /**
   * Identifies candidate recurring bills from transaction history
   * Looks for repeated charges with same merchant and amount at ~monthly intervals
   */
  public detectPatterns(): RecurringPatternSuggestion[] {
    // 1. Fetch all existing active recurring bill names (lowercased)
    const existingBills = dbManager.query('SELECT LOWER(name) as name, amount_cents FROM recurring_bills WHERE is_active = 1');
    const existingNames = new Set(existingBills.map(b => b.name.toLowerCase()));

    // 2. Fetch all expense transactions ordered by merchant and date
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

    // 3. Group by merchant and amount
    const groups: Record<string, any[]> = {};
    for (const r of rows) {
      const key = `${r.merchant.toLowerCase().trim()}:::${r.amount_cents}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }

    const suggestions: RecurringPatternSuggestion[] = [];

    for (const key of Object.keys(groups)) {
      const txs = groups[key];
      if (txs.length < 2) continue;

      const merchant = txs[0].merchant;
      const lowerMerchant = merchant.toLowerCase();

      // Skip if already tracked
      let alreadyTracked = false;
      for (const existingName of existingNames) {
        if (lowerMerchant.includes(existingName) || existingName.includes(lowerMerchant)) {
          alreadyTracked = true;
          break;
        }
      }
      if (alreadyTracked) continue;

      // Check date gaps
      const dates = txs.map(t => new Date(t.date).getTime()).sort((a, b) => a - b);
      let monthlyIntervalCount = 0;

      for (let i = 1; i < dates.length; i++) {
        const diffDays = Math.round((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
        // typical monthly interval is between 25 and 35 days
        if (diffDays >= 25 && diffDays <= 35) {
          monthlyIntervalCount++;
        }
      }

      if (monthlyIntervalCount >= 1) {
        // Compute suggested due day from latest transaction
        const latestTx = txs[txs.length - 1];
        const dueDay = parseInt(latestTx.date.split('-')[2], 10);
        const confidence = Math.min(100, 60 + monthlyIntervalCount * 20);

        suggestions.push({
          merchant: latestTx.merchant,
          amount_cents: Number(latestTx.amount_cents),
          category_id: Number(latestTx.category_id),
          category_name: latestTx.category_name,
          suggested_due_day: dueDay,
          frequency: 'monthly',
          occurrence_count: txs.length,
          confidence,
          sample_dates: txs.map(t => t.date)
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }
}

export const recurringDetectionService = new RecurringDetectionService();
