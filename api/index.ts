import app, { ensureDatabaseInitialized } from '../server/app.ts';

// Ensure DB is initialized on cold starts
ensureDatabaseInitialized();

export default app;
