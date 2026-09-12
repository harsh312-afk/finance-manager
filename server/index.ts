import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { dbManager } from './db/database.ts';
import { seedDatabase } from './db/seed.ts';

import overviewRouter from './routes/overview.ts';
import transactionsRouter from './routes/transactions.ts';
import budgetsRouter from './routes/budgets.ts';
import potsRouter from './routes/pots.ts';
import recurringRouter from './routes/recurring.ts';
import categoriesRouter from './routes/categories.ts';
import accountsRouter from './routes/accounts.ts';

const app = express();
const PORT = process.env.PORT || 3001;

// Auto-seed if database has no accounts
try {
  const countRow = dbManager.get<{ count: number }>('SELECT COUNT(*) as count FROM accounts');
  if (!countRow || countRow.count === 0) {
    console.log('Database empty, automatically seeding initial data...');
    seedDatabase();
  }
} catch (e) {
  console.log('Error checking database status, running seed...', e);
  seedDatabase();
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/overview', overviewRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/budgets', budgetsRouter);
app.use('/api/pots', potsRouter);
app.use('/api/recurring', recurringRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/accounts', accountsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Production static file serving
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`🚀 VaultFlow Finance API server listening on http://localhost:${PORT}`);
});
