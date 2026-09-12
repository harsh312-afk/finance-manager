import { Router } from 'express';
import { dbManager } from '../db/database.ts';
import { recurringDetectionService } from '../services/recurringDetectionService.ts';

const router = Router();

// GET /api/recurring
router.get('/', (req, res) => {
  try {
    const search = (req.query.search as string || '').trim().toLowerCase();
    const sortBy = (req.query.sortBy as string) || 'due_day';
    const sortOrder = (req.query.sortOrder as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const currentDay = 12; // Sept 12, 2026
    const currentMonth = '2026-09';

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

    // Calculate status for each bill
    let processed = bills.map(bill => {
      const amount = Number(bill.amount_cents);
      const isPaid = bill.last_paid_date && bill.last_paid_date.startsWith(currentMonth);
      let status: 'paid' | 'due_soon' | 'overdue' | 'upcoming' = 'upcoming';

      if (isPaid) {
        status = 'paid';
      } else if (bill.due_day < currentDay) {
        status = 'overdue';
      } else if (bill.due_day <= currentDay + 5) {
        status = 'due_soon';
      } else {
        status = 'upcoming';
      }

      return {
        ...bill,
        amount_cents: amount,
        status
      };
    });

    // Search filter
    if (search) {
      processed = processed.filter(b => 
        b.name.toLowerCase().includes(search) || 
        b.category_name.toLowerCase().includes(search)
      );
    }

    // Sort
    processed.sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      if (sortBy === 'status') {
        const orderWeight = { overdue: 1, due_soon: 2, upcoming: 3, paid: 4 };
        valA = orderWeight[a.status as keyof typeof orderWeight] || 99;
        valB = orderWeight[b.status as keyof typeof orderWeight] || 99;
      }

      if (valA < valB) return sortOrder === 'ASC' ? -1 : 1;
      if (valA > valB) return sortOrder === 'ASC' ? 1 : -1;
      return 0;
    });

    // Aggregated statistics
    const totalCents = processed.reduce((sum, b) => sum + b.amount_cents, 0);
    const paidCents = processed.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.amount_cents, 0);
    const overdueCents = processed.filter(b => b.status === 'overdue').reduce((sum, b) => sum + b.amount_cents, 0);
    const upcomingCents = processed.filter(b => b.status === 'due_soon' || b.status === 'upcoming').reduce((sum, b) => sum + b.amount_cents, 0);

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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/recurring/detect-patterns
router.get('/detect-patterns', (req, res) => {
  try {
    const patterns = recurringDetectionService.detectPatterns();
    res.json(patterns);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recurring/promote-detected
router.post('/promote-detected', (req, res) => {
  try {
    const { name, category_id, amount_cents, due_day, reminder_email } = req.body;

    if (!name || !category_id || !amount_cents || !due_day) {
      return res.status(400).json({ error: 'Missing required recurring bill parameters' });
    }

    const result = dbManager.run(`
      INSERT INTO recurring_bills (name, category_id, amount_cents, frequency, due_day, reminder_email, is_active)
      VALUES (?, ?, ?, 'monthly', ?, ?, 1)
    `, [name.trim(), category_id, amount_cents, due_day, reminder_email || 'alex@example.com']);

    const created = dbManager.get('SELECT * FROM recurring_bills WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({
      message: 'Detected pattern successfully promoted to active recurring bill',
      bill: created
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recurring
router.post('/', (req, res) => {
  try {
    const { name, category_id, amount_cents, frequency, due_day, reminder_email } = req.body;

    if (!name || !category_id || !amount_cents || !due_day) {
      return res.status(400).json({ error: 'Name, category, amount, and due day are required' });
    }

    const result = dbManager.run(`
      INSERT INTO recurring_bills (name, category_id, amount_cents, frequency, due_day, reminder_email, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [name.trim(), category_id, amount_cents, frequency || 'monthly', due_day, reminder_email || null]);

    const created = dbManager.get('SELECT * FROM recurring_bills WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/recurring/:id
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, category_id, amount_cents, frequency, due_day, reminder_email, is_active } = req.body;

    const result = dbManager.run(`
      UPDATE recurring_bills
      SET name = ?, category_id = ?, amount_cents = ?, frequency = ?, due_day = ?, reminder_email = ?, is_active = ?
      WHERE id = ?
    `, [name.trim(), category_id, amount_cents, frequency || 'monthly', due_day, reminder_email || null, is_active ?? 1, id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const updated = dbManager.get('SELECT * FROM recurring_bills WHERE id = ?', [id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/recurring/:id
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = dbManager.run('DELETE FROM recurring_bills WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    res.json({ message: 'Recurring bill removed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recurring/:id/mark-paid
router.post('/:id/mark-paid', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const bill = dbManager.get('SELECT * FROM recurring_bills WHERE id = ?', [id]);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const payDate = req.body.date || '2026-09-12';
    const accountId = parseInt(req.body.account_id) || 1;

    dbManager.transaction(() => {
      // 1. Update bill last_paid_date
      dbManager.run('UPDATE recurring_bills SET last_paid_date = ? WHERE id = ?', [payDate, id]);

      // 2. Automatically create matching transaction
      dbManager.run(`
        INSERT INTO transactions (account_id, category_id, amount_cents, type, date, merchant, notes, is_recurring)
        VALUES (?, ?, ?, 'expense', ?, ?, ?, 1)
      `, [accountId, bill.category_id, bill.amount_cents, payDate, bill.name, 'Recurring bill auto-logged payment']);

      // 3. Deduct from account balance
      dbManager.run('UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?', [bill.amount_cents, accountId]);
    });

    res.json({ message: `Bill "${bill.name}" marked as paid for ${payDate.substring(0, 7)}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recurring/test-email-reminder
router.post('/test-email-reminder', (req, res) => {
  try {
    const { bill_id, email } = req.body;
    const bill = dbManager.get(`
      SELECT b.*, c.name as category_name
      FROM recurring_bills b
      JOIN categories c ON b.category_id = c.id
      WHERE b.id = ?
    `, [bill_id]);

    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const targetEmail = email || bill.reminder_email || 'alex@example.com';
    const amountFormatted = `$${(bill.amount_cents / 100).toFixed(2)}`;

    // Build simulated email notification payload
    const simulatedEmail = {
      to: targetEmail,
      from: 'reminders@vaultflow-finance.internal',
      subject: `⏰ Reminder: Upcoming Payment for ${bill.name} (${amountFormatted})`,
      timestamp: new Date().toISOString(),
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
