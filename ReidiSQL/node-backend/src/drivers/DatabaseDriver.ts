/**
 * 统一数据库驱动接口
 * 消除 connectionService.ts 中的 if-else 分支，遵循开闭原则
 */

import { StoredConnection } from '../services/configStore.js';

/** 连接测试结果 */
export interface TestResult {
  connected: boolean;
  serverVersion?: string;
  serverType?: string;
  responseTime?: number;
  error?: string;
}

/** 连接成功结果 */
export interface ConnectResult {
  pool: any;           // 驱动特定的连接池对象
  serverVersion: string;
}

/** 数据库驱动接口 */
export interface DatabaseDriver {
  /** 驱动标识（用于日志和错误信息） */
  readonly name: string;

  /** 创建连接池并验证连接 */
  connect(config: StoredConnection): Promise<ConnectResult>;

  /** 关闭连接池 */
  disconnect(pool: any): Promise<void>;

  /** 测试连接（不创建连接池，仅验证可达性） */
  testConnection(config: StoredConnection): Promise<TestResult>;

  /** 获取数据库列表 */
  getDatabases(pool: any): Promise<string[]>;

  /** 获取底层连接池（供 queryService 等直接使用） */
  getPool(pool: any): any;
}
