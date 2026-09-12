import { Router } from 'express';
import { dbManager } from '../db/database.ts';

const router = Router();

router.get('/', (req, res) => {
  try {
    const accounts = dbManager.query('SELECT * FROM accounts ORDER BY id ASC');
    res.json(accounts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
