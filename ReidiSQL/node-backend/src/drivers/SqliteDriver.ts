/**
 * SQLite 驱动实现
 */

import Database from 'better-sqlite3';
import { DatabaseDriver, ConnectResult, TestResult } from './DatabaseDriver.js';
import { StoredConnection } from '../services/configStore.js';

export class SqliteDriver implements DatabaseDriver {
  readonly name = 'SQLite';

  async connect(config: StoredConnection): Promise<ConnectResult> {
    const dbPath = config.host || ':memory:';
    const db = new Database(dbPath, { readonly: false });
    const serverVersion = String(db.pragma('compile_options', { simple: true }) || 'unknown');
    return { pool: db, serverVersion };
  }

  async disconnect(pool: any): Promise<void> {
    (pool as Database.Database).close();
  }

  async testConnection(config: StoredConnection): Promise<TestResult> {
    const startTime = Date.now();
    try {
      const dbPath = config.host || ':memory:';
      const db = new Database(dbPath, { readonly: true });
      const version = String(db.pragma('compile_options', { simple: true }) || 'unknown');
      db.close();
      return {
        connected: true,
        serverVersion: version,
        serverType: 'SQLite',
        responseTime: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        connected: false,
        error: err.message,
        responseTime: Date.now() - startTime,
      };
    }
  }

  async getDatabases(_pool: any): Promise<string[]> {
    return ['main'];
  }

  getPool(pool: any): any {
    return pool as Database.Database;
  }
}
