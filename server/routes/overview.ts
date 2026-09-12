import { Router } from 'express';
import { analyticsService } from '../services/analyticsService.ts';

const router = Router();

router.get('/', (req, res) => {
  try {
    const month = (req.query.month as string) || '2026-09';
    const data = analyticsService.getOverview(month);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
