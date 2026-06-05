/**
 * PostgreSQL 驱动实现
 */

import pg from 'pg';
import { DatabaseDriver, ConnectResult, TestResult } from './DatabaseDriver.js';
import { StoredConnection } from '../services/configStore.js';

export class PgDriver implements DatabaseDriver {
  readonly name = 'PostgreSQL';

  async connect(config: StoredConnection): Promise<ConnectResult> {
    const pool = new pg.Pool({
      host: config.host,
      port: config.port || 5432,
      user: config.username,
      password: config.password,
      database: config.database || 'postgres',
      connectionTimeoutMillis: config.options?.connectTimeout || 10000,
      max: 5,
    });

    // 验证连接
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT version()');
      const serverVersion = res.rows[0].version;
      return { pool, serverVersion };
    } finally {
      client.release();
    }
  }

  async disconnect(pool: any): Promise<void> {
    await (pool as pg.Pool).end();
  }

  async testConnection(config: StoredConnection): Promise<TestResult> {
    const startTime = Date.now();
    try {
      const client = new pg.Client({
        host: config.host,
        port: config.port || 5432,
        user: config.username,
        password: config.password,
        database: config.database || 'postgres',
        connectionTimeoutMillis: config.options?.connectTimeout || 10000,
      });
      await client.connect();
      const res = await client.query('SELECT version()');
      const version = res.rows[0].version;
      await client.end();
      return {
        connected: true,
        serverVersion: version,
        serverType: 'PostgreSQL',
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

  async getDatabases(pool: any): Promise<string[]> {
    const res = await (pool as pg.Pool).query(
      "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname"
    );
    return res.rows.map((r: any) => r.datname);
  }

  getPool(pool: any): any {
    return pool as pg.Pool;
  }
}
