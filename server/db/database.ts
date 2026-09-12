import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'finance.db');

class DatabaseManager {
  private db: DatabaseSync;

  constructor(filePath: string = DB_PATH) {
    this.db = new DatabaseSync(filePath);
    this.init();
  }

  private init() {
    this.db.exec('PRAGMA foreign_keys = ON;');
    const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      this.db.exec(schemaSql);
    }
  }

  public getDb(): DatabaseSync {
    return this.db;
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  public get<T = any>(sql: string, params: any[] = []): T | undefined {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params) as T | undefined;
  }

  public run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number | bigint } {
    const stmt = this.db.prepare(sql);
    const info = stmt.run(...params);
    return {
      changes: Number(info.changes),
      lastInsertRowid: Number(info.lastInsertRowid)
    };
  }

  public transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      const result = fn();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  public close() {
    this.db.close();
  }
}

export const dbManager = new DatabaseManager();
export const db = dbManager.getDb();
