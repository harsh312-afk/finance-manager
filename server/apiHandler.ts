import type { IncomingMessage, ServerResponse } from 'node:http';
import app, { ensureDatabaseInitialized } from '../server/app.ts';

// Ensure database tables and initial dataset exist
ensureDatabaseInitialized();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req as any, res as any);
}
