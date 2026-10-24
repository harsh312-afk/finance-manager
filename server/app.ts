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

// Auto-seed if database has no accounts (handles cold starts and fresh environments)
export function ensureDatabaseInitialized() {
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
}

ensureDatabaseInitialized();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Support both /api/... and root-level routes for flexible serverless rewrites
app.use(['/api/overview', '/overview'], overviewRouter);
app.use(['/api/transactions', '/transactions'], transactionsRouter);
app.use(['/api/budgets', '/budgets'], budgetsRouter);
app.use(['/api/pots', '/pots'], potsRouter);
app.use(['/api/recurring', '/recurring'], recurringRouter);
app.use(['/api/categories', '/categories'], categoriesRouter);
app.use(['/api/accounts', '/accounts'], accountsRouter);

// Health check endpoint
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    serverless: !!process.env.VERCEL
  });
});

// Production static file serving for local standalone runs
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

export default app;
