/**
 * 数据库连接管理服务
 * 管理真实的数据库连接池，支持 MySQL/MariaDB、PostgreSQL、SQLite
 */

import mysql from 'mysql2/promise';
import pg from 'pg';
import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import { ConfigStore, StoredConnection } from './configStore.js';

/** 活跃连接包装器 */
interface ActiveConnection {
  id: string;
  config: StoredConnection;
  type: 'mysql' | 'postgresql' | 'sqlite';
  pool: mysql.Pool | pg.Pool | Database.Database;
  serverVersion: string;
  connectedAt: string;
}

/** 连接测试结果 */
interface TestResult {
  connected: boolean;
  serverVersion?: string;
  serverType?: string;
  responseTime?: number;
  error?: string;
}

/** 连接信息（不含密码） */
export interface ConnectionInfo {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  username: string;
  database?: string;
  status: 'connected' | 'disconnected';
  serverVersion?: string;
  lastConnectedAt?: string;
  color?: string;
}

/** 数据类型分类 */
function categorizeMySQLType(type: string): string {
  const t = type.toUpperCase();
  if (/INT/.test(t)) return 'integer';
  if (/FLOAT|DOUBLE|DECIMAL|NUMERIC|REAL/.test(t)) return 'real';
  if (/CHAR|TEXT|ENUM|SET|JSON/.test(t)) return 'text';
  if (/BLOB|BINARY/.test(t)) return 'binary';
  if (/DATE|TIME|TIMESTAMP|YEAR/.test(t)) return 'temporal';
  if (/GEOMETRY|POINT|LINE|POLYGON|SPATIAL/.test(t)) return 'spatial';
  return 'other';
}

export class ConnectionManager {
  private configStore: ConfigStore;
  private activeConnections: Map<string, ActiveConnection> = new Map();

  constructor() {
    this.configStore = new ConfigStore();
  }

  // ==================== 连接配置 CRUD ====================

  getAllConnections(): ConnectionInfo[] {
    return this.configStore.getAll().map(c => this.toConnectionInfo(c));
  }

  createConnection(input: any): StoredConnection {
    return this.configStore.create(input);
  }

  updateConnection(id: string, updates: any): StoredConnection | null {
    return this.configStore.update(id, updates);
  }

  deleteConnection(id: string): boolean {
    // 如果连接活跃，先断开
    if (this.activeConnections.has(id)) {
      this.disconnect(id);
    }
    return this.configStore.delete(id);
  }

  // ==================== 连接/断开 ====================

  async connect(id: string): Promise<{ serverVersion: string; databases: string[] }> {
    if (this.activeConnections.has(id)) {
      const active = this.activeConnections.get(id)!;
      return { serverVersion: active.serverVersion, databases: [] };
    }

    const config = this.configStore.getById(id);
    if (!config) throw new Error(`Connection not found: ${id}`);

    const startTime = Date.now();
    logger.info(`Connecting to ${config.name} (${config.type})...`);

    try {
      let active: ActiveConnection;

      if (config.type === 'mysql' || config.type === 'mariadb') {
        active = await this.connectMySQL(config);
      } else if (config.type === 'postgresql') {
        active = await this.connectPostgreSQL(config);
      } else if (config.type === 'sqlite') {
        active = await this.connectSQLite(config);
      } else {
        throw new Error(`Unsupported database type: ${config.type}`);
      }

      this.activeConnections.set(id, active);
      this.configStore.touchConnected(id);

      const elapsed = Date.now() - startTime;
      logger.info(`Connected to ${config.name} in ${elapsed}ms (v${active.serverVersion})`);

      // 获取数据库列表
      const databases = await this.getDatabases(id);
      return { serverVersion: active.serverVersion, databases };
    } catch (err: any) {
      logger.error(`Failed to connect to ${config.name}: ${err.message}`);
      throw new Error(`连接失败: ${err.message}`);
    }
  }

  async disconnect(id: string): Promise<void> {
    const active = this.activeConnections.get(id);
    if (!active) return;

    try {
      if (active.type === 'mysql') {
        await (active.pool as mysql.Pool).end();
      } else if (active.type === 'postgresql') {
        await (active.pool as pg.Pool).end();
      } else if (active.type === 'sqlite') {
        (active.pool as Database.Database).close();
      }
      logger.info(`Disconnected: ${active.config.name}`);
    } catch (err: any) {
      logger.warn(`Error disconnecting ${active.config.name}: ${err.message}`);
    } finally {
      this.activeConnections.delete(id);
    }
  }

  isConnected(id: string): boolean {
    return this.activeConnections.has(id);
  }

  getStatus(id: string): { status: string; serverVersion?: string } {
    const active = this.activeConnections.get(id);
    if (active) {
      return { status: 'connected', serverVersion: active.serverVersion };
    }
    return { status: 'disconnected' };
  }

  // ==================== 测试连接 ====================

  async testConnection(input: any): Promise<TestResult> {
    const startTime = Date.now();

    try {
      if (input.type === 'mysql' || input.type === 'mariadb') {
        const conn = await mysql.createConnection({
          host: input.host,
          port: input.port || 3306,
          user: input.username,
          password: input.password,
          database: input.database,
          connectTimeout: input.options?.connectTimeout || 10000,
          charset: input.options?.charset || 'utf8mb4',
          ssl: input.ssl?.enabled ? {
            ca: input.ssl.ca,
            cert: input.ssl.cert,
            key: input.ssl.key,
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
      } else if (input.type === 'postgresql') {
        const client = new pg.Client({
          host: input.host,
          port: input.port || 5432,
          user: input.username,
          password: input.password,
          database: input.database || 'postgres',
          connectionTimeoutMillis: input.options?.connectTimeout || 10000,
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
      } else if (input.type === 'sqlite') {
        const db = new Database(input.host || ':memory:', { readonly: true });
        const version = db.pragma('compile_options', { simple: true }) as string;
        db.close();
        return {
          connected: true,
          serverVersion: String(version),
          serverType: 'SQLite',
          responseTime: Date.now() - startTime,
        };
      }
      return { connected: false, error: `Unsupported type: ${input.type}` };
    } catch (err: any) {
      return {
        connected: false,
        error: err.message,
        responseTime: Date.now() - startTime,
      };
    }
  }

  // ==================== 内部连接方法 ====================

  private async connectMySQL(config: StoredConnection): Promise<ActiveConnection> {
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
    const [rows] = await conn.query('SELECT VERSION() as version');
    const version = (rows as any)[0].version;
    conn.release();

    return {
      id: config.id,
      config,
      type: 'mysql',
      pool,
      serverVersion: version,
      connectedAt: new Date().toISOString(),
    };
  }

  private async connectPostgreSQL(config: StoredConnection): Promise<ActiveConnection> {
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
    const res = await client.query('SELECT version()');
    const version = res.rows[0].version;
    client.release();

    return {
      id: config.id,
      config,
      type: 'postgresql',
      pool,
      serverVersion: version,
      connectedAt: new Date().toISOString(),
    };
  }

  private async connectSQLite(config: StoredConnection): Promise<ActiveConnection> {
    const dbPath = config.host || ':memory:';
    const db = new Database(dbPath, { readonly: false });
    const version = String(db.pragma('compile_options', { simple: true }) || 'unknown');

    return {
      id: config.id,
      config,
      type: 'sqlite',
      pool: db,
      serverVersion: version,
      connectedAt: new Date().toISOString(),
    };
  }

  // ==================== 查询辅助 ====================

  getActiveConnection(id: string): ActiveConnection {
    const active = this.activeConnections.get(id);
    if (!active) throw new Error(`No active connection: ${id}`);
    return active;
  }

  getMySQLPool(id: string): mysql.Pool {
    const active = this.getActiveConnection(id);
    if (active.type !== 'mysql') throw new Error('Connection is not MySQL');
    return active.pool as mysql.Pool;
  }

  getPGPool(id: string): pg.Pool {
    const active = this.getActiveConnection(id);
    if (active.type !== 'postgresql') throw new Error('Connection is not PostgreSQL');
    return active.pool as pg.Pool;
  }

  getSQLiteDB(id: string): Database.Database {
    const active = this.getActiveConnection(id);
    if (active.type !== 'sqlite') throw new Error('Connection is not SQLite');
    return active.pool as Database.Database;
  }

  getConnectionType(id: string): string {
    return this.getActiveConnection(id).type;
  }

  // ==================== 数据库列表 ====================

  async getDatabases(connectionId: string): Promise<string[]> {
    const active = this.getActiveConnection(connectionId);

    if (active.type === 'mysql') {
      const pool = active.pool as mysql.Pool;
      const [rows] = await pool.query('SHOW DATABASES');
      return (rows as any[]).map(r => Object.values(r)[0] as string);
    } else if (active.type === 'postgresql') {
      const pool = active.pool as pg.Pool;
      const res = await pool.query("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname");
      return res.rows.map((r: any) => r.datname);
    } else if (active.type === 'sqlite') {
      return ['main'];
    }
    return [];
  }

  // ==================== 辅助方法 ====================

  private toConnectionInfo(config: StoredConnection): ConnectionInfo {
    const active = this.activeConnections.get(config.id);
    return {
      id: config.id,
      name: config.name,
      type: config.type,
      host: config.host,
      port: config.port,
      username: config.username,
      database: config.database,
      status: active ? 'connected' : 'disconnected',
      serverVersion: active?.serverVersion,
      lastConnectedAt: config.lastConnectedAt,
      color: config.color,
    };
  }

  /** 优雅关闭：断开所有活跃连接 */
  async shutdown(): Promise<void> {
    const ids = Array.from(this.activeConnections.keys());
    logger.info(`Shutting down ${ids.length} active connections...`);
    for (const id of ids) {
      await this.disconnect(id);
    }
  }
}

// 全局单例
let instance: ConnectionManager | null = null;

export function getConnectionManager(): ConnectionManager {
  if (!instance) {
    instance = new ConnectionManager();
  }
  return instance;
}
