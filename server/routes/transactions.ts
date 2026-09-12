import { Router } from 'express';
import multer from 'multer';
import { dbManager } from '../db/database.ts';
import { csvService } from '../services/csvService.ts';
import { analyticsService } from '../services/analyticsService.ts';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/transactions
// Pagination: strictly 10 per page by default
router.get('/', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const offset = (page - 1) * limit;

    const search = (req.query.search as string || '').trim();
    const categoryId = req.query.category_id ? parseInt(req.query.category_id as string) : undefined;
    const accountId = req.query.account_id ? parseInt(req.query.account_id as string) : undefined;
    const type = req.query.type as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const isRecurring = req.query.is_recurring !== undefined ? parseInt(req.query.is_recurring as string) : undefined;

    const sortBy = (req.query.sortBy as string) || 'date';
    const sortOrder = (req.query.sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Allowed sort columns
    const sortColumns: Record<string, string> = {
      date: 't.date',
      amount: 't.amount_cents',
      merchant: 't.merchant',
      category: 'c.name'
    };
    const orderClause = sortColumns[sortBy] ? `${sortColumns[sortBy]} ${sortOrder}, t.id DESC` : `t.date DESC, t.id DESC`;

    let whereClause = ' WHERE 1=1 ';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (t.merchant LIKE ? OR t.notes LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (categoryId) {
      whereClause += ' AND t.category_id = ?';
      params.push(categoryId);
    }
    if (accountId) {
      whereClause += ' AND t.account_id = ?';
      params.push(accountId);
    }
    if (type && type !== 'all') {
      whereClause += ' AND t.type = ?';
      params.push(type);
    }
    if (startDate) {
      whereClause += ' AND t.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND t.date <= ?';
      params.push(endDate);
    }
    if (isRecurring !== undefined && !isNaN(isRecurring)) {
      whereClause += ' AND t.is_recurring = ?';
      params.push(isRecurring);
    }

    // Count total matches
    const countSql = `
      SELECT COUNT(*) as count 
      FROM transactions t 
      JOIN categories c ON t.category_id = c.id
      ${whereClause}
    `;
    const countRow = dbManager.get<{ count: number }>(countSql, params);
    const totalCount = countRow?.count || 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    // Fetch paginated data
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions/suggest-category?merchant=...
router.get('/suggest-category', (req, res) => {
  const merchant = (req.query.merchant as string || '').trim();
  if (!merchant) {
    return res.json({ category_id: null });
  }
  const suggestedId = csvService.suggestCategory(merchant);
  const category = dbManager.get('SELECT * FROM categories WHERE id = ?', [suggestedId]);
  res.json({ category_id: suggestedId, category });
});

// POST /api/transactions
router.post('/', (req, res) => {
  try {
    const { account_id, category_id, amount_cents, type, date, merchant, notes, is_recurring } = req.body;

    if (!account_id || !category_id || !amount_cents || !type || !date || !merchant) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (amount_cents <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const result = dbManager.transaction(() => {
      const res = dbManager.run(`
        INSERT INTO transactions (account_id, category_id, amount_cents, type, date, merchant, notes, is_recurring)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [account_id, category_id, amount_cents, type, date, merchant.trim(), notes || null, is_recurring ? 1 : 0]);

      // Update account balance
      const delta = type === 'income' ? amount_cents : -amount_cents;
      dbManager.run('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?', [delta, account_id]);

      // Save merchant category rule for future suggestions
      try {
        const pattern = merchant.trim().toLowerCase();
        dbManager.run(`
          INSERT INTO merchant_category_rules (pattern, category_id)
          VALUES (?, ?)
          ON CONFLICT(pattern) DO UPDATE SET category_id = excluded.category_id
        `, [pattern, category_id]);
      } catch (e) {
        // Ignore rule conflict
      }

      return res.lastInsertRowid;
    });

    // Check budget alert for this category
    const month = date.substring(0, 7);
    const budgets = analyticsService.getBudgetsWithActuals(month);
    const affectedBudget = budgets.find(b => b.category_id === Number(category_id));

    res.status(201).json({
      id: result,
      message: 'Transaction created successfully',
      budgetAlert: affectedBudget?.status !== 'safe' ? affectedBudget : null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/transactions/:id
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { account_id, category_id, amount_cents, type, date, merchant, notes, is_recurring } = req.body;

    const existing = dbManager.get('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    dbManager.transaction(() => {
      // Revert old account balance
      const oldDelta = existing.type === 'income' ? existing.amount_cents : -existing.amount_cents;
      dbManager.run('UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?', [oldDelta, existing.account_id]);

      // Apply new account balance
      const newDelta = type === 'income' ? amount_cents : -amount_cents;
      dbManager.run('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?', [newDelta, account_id]);

      // Update transaction
      dbManager.run(`
        UPDATE transactions 
        SET account_id = ?, category_id = ?, amount_cents = ?, type = ?, date = ?, merchant = ?, notes = ?, is_recurring = ?
        WHERE id = ?
      `, [account_id, category_id, amount_cents, type, date, merchant.trim(), notes || null, is_recurring ? 1 : 0, id]);
    });

    res.json({ message: 'Transaction updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = dbManager.get('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    dbManager.transaction(() => {
      // Revert balance
      const delta = existing.type === 'income' ? existing.amount_cents : -existing.amount_cents;
      dbManager.run('UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?', [delta, existing.account_id]);

      dbManager.run('DELETE FROM transactions WHERE id = ?', [id]);
    });

    res.json({ message: 'Transaction deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions/preview-csv
router.post('/preview-csv', upload.single('file'), (req, res) => {
  try {
    let csvContent = '';
    if (req.file) {
      csvContent = req.file.buffer.toString('utf8');
    } else if (req.body.csv) {
      csvContent = req.body.csv;
    } else {
      return res.status(400).json({ error: 'No CSV file or text content provided' });
    }

    const defaultAccountId = parseInt(req.body.account_id) || 1;
    const result = csvService.parseAndValidate(csvContent, defaultAccountId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: `CSV Parse Error: ${err.message}` });
  }
});

// POST /api/transactions/import-csv
router.post('/import-csv', (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No valid rows to import' });
    }

    const result = csvService.importTransactions(rows);
    res.json({
      message: `Successfully imported ${result.insertedCount} transactions`,
      ...result
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions/export-csv
router.get('/export-csv', (req, res) => {
  try {
    const filters = {
      accountId: req.query.account_id ? parseInt(req.query.account_id as string) : undefined,
      categoryId: req.query.category_id ? parseInt(req.query.category_id as string) : undefined,
      type: req.query.type as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    };

    const csvData = csvService.exportTransactionsToCsv(filters);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="transactions-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
