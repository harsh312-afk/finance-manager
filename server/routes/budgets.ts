import { Router } from 'express';
import { dbManager } from '../db/database.ts';
import { analyticsService } from '../services/analyticsService.ts';

const router = Router();

// GET /api/budgets
router.get('/', (req, res) => {
  try {
    const month = (req.query.month as string) || '2026-09';
    const budgets = analyticsService.getBudgetsWithActuals(month);
    res.json(budgets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/budgets/latest-transactions?limit=3
router.get('/latest-transactions', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 3;
    const data = analyticsService.getLatestTransactionsPerBudgetCategory(limit);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/budgets
router.post('/', (req, res) => {
  try {
    const { category_id, limit_cents, alert_threshold_percent, period } = req.body;

    if (!category_id || !limit_cents || limit_cents <= 0) {
      return res.status(400).json({ error: 'Valid category and spending limit are required' });
    }

    const existing = dbManager.get('SELECT id FROM budgets WHERE category_id = ?', [category_id]);
    if (existing) {
      return res.status(400).json({ error: 'A budget for this category already exists' });
    }

    const result = dbManager.run(`
      INSERT INTO budgets (category_id, period, limit_cents, alert_threshold_percent)
      VALUES (?, ?, ?, ?)
    `, [category_id, period || 'monthly', limit_cents, alert_threshold_percent || 80]);

    const created = dbManager.get('SELECT * FROM budgets WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/budgets/:id
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { limit_cents, alert_threshold_percent, period } = req.body;

    if (!limit_cents || limit_cents <= 0) {
      return res.status(400).json({ error: 'Spending limit must be greater than 0' });
    }

    const result = dbManager.run(`
      UPDATE budgets 
      SET limit_cents = ?, alert_threshold_percent = ?, period = ?
      WHERE id = ?
    `, [limit_cents, alert_threshold_percent || 80, period || 'monthly', id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    const updated = dbManager.get('SELECT * FROM budgets WHERE id = ?', [id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/budgets/:id
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = dbManager.run('DELETE FROM budgets WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    res.json({ message: 'Budget deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
