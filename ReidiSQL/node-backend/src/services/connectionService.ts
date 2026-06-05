/**
 * 数据库连接管理服务
 * 管理真实的数据库连接池，通过 DriverFactory 委托给具体驱动实现
 */

import mysql from 'mysql2/promise';
import pg from 'pg';
import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import { ConfigStore, StoredConnection } from './configStore.js';
import { getDriver } from '../drivers/DriverFactory.js';
import type { TestResult } from '../drivers/DatabaseDriver.js';

/** 活跃连接包装器 */
interface ActiveConnection {
  id: string;
  config: StoredConnection;
  type: 'mysql' | 'postgresql' | 'sqlite';
  pool: any; // 驱动特定的连接池对象
  serverVersion: string;
  connectedAt: string;
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

/** 规范化连接类型为 ActiveConnection type */
function normalizeActiveType(type: string): 'mysql' | 'postgresql' | 'sqlite' {
  if (type === 'mariadb') return 'mysql';
  return type as 'mysql' | 'postgresql' | 'sqlite';
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
    const driver = getDriver(config.type);
    logger.info(`Connecting to ${config.name} (${config.type}) via ${driver.name}...`);

    try {
      const result = await driver.connect(config);

      const active: ActiveConnection = {
        id: config.id,
        config,
        type: normalizeActiveType(config.type),
        pool: result.pool,
        serverVersion: result.serverVersion,
        connectedAt: new Date().toISOString(),
      };

      this.activeConnections.set(id, active);
      this.configStore.touchConnected(id);

      const elapsed = Date.now() - startTime;
      logger.info(`Connected to ${config.name} in ${elapsed}ms (v${active.serverVersion})`);

      // 获取数据库列表
      const databases = await driver.getDatabases(result.pool);
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
      const driver = getDriver(active.config.type);
      await driver.disconnect(active.pool);
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
    const driver = getDriver(input.type);
    // 将 input 转换为 StoredConnection 格式（testConnection 只需要连接信息字段）
    const config = input as StoredConnection;
    return driver.testConnection(config);
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
    const driver = getDriver(active.config.type);
    return driver.getDatabases(active.pool);
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
