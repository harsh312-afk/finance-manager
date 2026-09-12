import { Router } from 'express';
import { dbManager } from '../db/database.ts';

const router = Router();

// GET /api/pots
router.get('/', (req, res) => {
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

    const enriched = pots.map(p => {
      const target = Number(p.target_cents);
      const current = Number(p.current_cents);
      const remaining = Math.max(0, target - current);
      const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

      // Estimated months left if target_date exists
      let monthsRemaining: number | null = null;
      let monthlyTargetCents: number | null = null;
      if (p.target_date) {
        const today = new Date('2026-09-12');
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pots/:id/transfers
router.get('/:id/transfers', (req, res) => {
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pots
router.post('/', (req, res) => {
  try {
    const { name, target_cents, current_cents, color, target_date } = req.body;

    if (!name || !target_cents || target_cents <= 0) {
      return res.status(400).json({ error: 'Name and a valid target amount are required' });
    }

    const result = dbManager.run(`
      INSERT INTO pots (name, target_cents, current_cents, color, target_date)
      VALUES (?, ?, ?, ?, ?)
    `, [name.trim(), target_cents, current_cents || 0, color || '#22c55e', target_date || null]);

    const created = dbManager.get('SELECT * FROM pots WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/pots/:id
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, target_cents, color, target_date } = req.body;

    if (!name || !target_cents || target_cents <= 0) {
      return res.status(400).json({ error: 'Name and a valid target amount are required' });
    }

    const result = dbManager.run(`
      UPDATE pots 
      SET name = ?, target_cents = ?, color = ?, target_date = ?
      WHERE id = ?
    `, [name.trim(), target_cents, color || '#22c55e', target_date || null, id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Pot not found' });
    }

    const updated = dbManager.get('SELECT * FROM pots WHERE id = ?', [id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pots/:id
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pot = dbManager.get('SELECT current_cents FROM pots WHERE id = ?', [id]);
    if (!pot) {
      return res.status(404).json({ error: 'Pot not found' });
    }

    if (pot.current_cents > 0) {
      return res.status(400).json({ error: 'Cannot delete a pot with funds. Please withdraw the remaining funds first.' });
    }

    dbManager.run('DELETE FROM pots WHERE id = ?', [id]);
    res.json({ message: 'Pot deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pots/:id/transfer (Deposit or Withdraw)
router.post('/:id/transfer', (req, res) => {
  try {
    const potId = parseInt(req.params.id);
    const { account_id, amount_cents, type, notes, date } = req.body;

    if (!account_id || !amount_cents || amount_cents <= 0 || !type) {
      return res.status(400).json({ error: 'Missing required transfer fields' });
    }

    if (type !== 'deposit' && type !== 'withdraw') {
      return res.status(400).json({ error: 'Type must be deposit or withdraw' });
    }

    const pot = dbManager.get('SELECT * FROM pots WHERE id = ?', [potId]);
    if (!pot) return res.status(404).json({ error: 'Pot not found' });

    const account = dbManager.get('SELECT * FROM accounts WHERE id = ?', [account_id]);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const transferDate = date || '2026-09-12';

    dbManager.transaction(() => {
      if (type === 'deposit') {
        // Check account has enough funds
        if (account.balance_cents < amount_cents) {
          throw new Error(`Insufficient account balance. Available: $${(account.balance_cents / 100).toFixed(2)}`);
        }
        // Deduct from account, add to pot
        dbManager.run('UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?', [amount_cents, account_id]);
        dbManager.run('UPDATE pots SET current_cents = current_cents + ? WHERE id = ?', [amount_cents, potId]);
      } else {
        // Withdraw: check pot has enough funds
        if (pot.current_cents < amount_cents) {
          throw new Error(`Insufficient pot funds. Available: $${(pot.current_cents / 100).toFixed(2)}`);
        }
        // Deduct from pot, add to account
        dbManager.run('UPDATE pots SET current_cents = current_cents - ? WHERE id = ?', [amount_cents, potId]);
        dbManager.run('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?', [amount_cents, account_id]);
      }

      // Record transfer ledger
      dbManager.run(`
        INSERT INTO pot_transfers (pot_id, account_id, amount_cents, type, notes, date)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [potId, account_id, amount_cents, type, notes || `${type === 'deposit' ? 'Added to' : 'Withdrawn from'} ${pot.name}`, transferDate]);
    });

    const updatedPot = dbManager.get('SELECT * FROM pots WHERE id = ?', [potId]);
    const updatedAccount = dbManager.get('SELECT * FROM accounts WHERE id = ?', [account_id]);

    res.json({
      message: `Successfully ${type === 'deposit' ? 'deposited' : 'withdrawn'} $${(amount_cents / 100).toFixed(2)}`,
      pot: updatedPot,
      account: updatedAccount
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
