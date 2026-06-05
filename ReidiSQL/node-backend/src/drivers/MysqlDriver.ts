/**
 * MySQL / MariaDB 驱动实现
 */

import mysql from 'mysql2/promise';
import { DatabaseDriver, ConnectResult, TestResult } from './DatabaseDriver.js';
import { StoredConnection } from '../services/configStore.js';

export class MysqlDriver implements DatabaseDriver {
  readonly name = 'MySQL';

  async connect(config: StoredConnection): Promise<ConnectResult> {
    const pool = mysql.createPool({
      host: config.host,
      port: config.port || 3306,
      user: config.username,
      password: config.password,
      database: config.database,
      charset: config.options?.charset || 'utf8mb4',
      connectTimeout: config.options?.connectTimeout || 10000,
      waitForConnections: true,
      connectionLimit: 5,
      multipleStatements: true,
      ssl: config.ssl?.enabled ? {
        ca: config.ssl.ca,
        cert: config.ssl.cert,
        key: config.ssl.key,
      } : undefined,
    });

    // 验证连接
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query('SELECT VERSION() as version');
      const serverVersion = (rows as any)[0].version;
      return { pool, serverVersion };
    } finally {
      conn.release();
    }
  }

  async disconnect(pool: any): Promise<void> {
    await (pool as mysql.Pool).end();
  }

  async testConnection(config: StoredConnection): Promise<TestResult> {
    const startTime = Date.now();
    try {
      const conn = await mysql.createConnection({
        host: config.host,
        port: config.port || 3306,
        user: config.username,
        password: config.password,
        database: config.database,
        connectTimeout: config.options?.connectTimeout || 10000,
        charset: config.options?.charset || 'utf8mb4',
        ssl: config.ssl?.enabled ? {
          ca: config.ssl.ca,
          cert: config.ssl.cert,
          key: config.ssl.key,
        } : undefined,
      });
      const [rows] = await conn.query('SELECT VERSION() as version');
      const version = (rows as any)[0].version;
      await conn.end();
      return {
        connected: true,
        serverVersion: version,
        serverType: version.includes('MariaDB') ? 'MariaDB' : 'MySQL',
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
    const [rows] = await (pool as mysql.Pool).query('SHOW DATABASES');
    return (rows as any[]).map(r => Object.values(r)[0] as string);
  }

  getPool(pool: any): any {
    return pool as mysql.Pool;
  }
}
