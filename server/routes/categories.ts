import { Router } from 'express';
import { dbManager } from '../db/database.ts';

const router = Router();

router.get('/', (req, res) => {
  try {
    const categories = dbManager.query('SELECT * FROM categories ORDER BY name ASC');
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, icon, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const trimmed = name.trim();
    const existing = dbManager.get('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)', [trimmed]);
    if (existing) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    const result = dbManager.run(`
      INSERT INTO categories (name, icon, color, is_custom)
      VALUES (?, ?, ?, 1)
    `, [trimmed, icon || 'Tag', color || '#64748b']);

    const created = dbManager.get('SELECT * FROM categories WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
