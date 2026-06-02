/**
 * 查询执行服务
 * 通过 ConnectionManager 获取真实连接执行 SQL
 */

import mysql from 'mysql2/promise';
import { getConnectionManager } from './connectionService.js';
import { logger } from '../utils/logger.js';

/** 查询结果 */
export interface QueryResult {
  queryId: string;
  sql: string;
  columns: Array<{ name: string; type: string; category: string; nullable: boolean }>;
  rows: Record<string, unknown>[];
  rowCount: number;
  affectedRows?: number;
  insertId?: number;
  duration: number;
  hasMore: boolean;
  warnings: Array<{ level: string; code: number; message: string }>;
}

/** MySQL 类型分类 */
function categorizeType(type: string): string {
  const t = type.toUpperCase();
  if (/INT/.test(t)) return 'integer';
  if (/FLOAT|DOUBLE|DECIMAL|NUMERIC|REAL/.test(t)) return 'real';
  if (/CHAR|TEXT|ENUM|SET|JSON/.test(t)) return 'text';
  if (/BLOB|BINARY/.test(t)) return 'binary';
  if (/DATE|TIME|TIMESTAMP|YEAR/.test(t)) return 'temporal';
  if (/GEOMETRY|POINT|LINE|POLYGON|SPATIAL/.test(t)) return 'spatial';
  return 'other';
}

export class QueryService {
  private history: Array<{
    id: string;
    connectionId: string;
    sql: string;
    duration: number;
    rowCount: number;
    status: 'success' | 'error';
    errorMessage?: string;
    executedAt: string;
  }> = [];

  async executeQuery(
    connectionId: string,
    sql: string,
    _params?: unknown[],
    options?: { limit?: number; timeout?: number }
  ): Promise<QueryResult> {
    const connManager = getConnectionManager();
    const connType = connManager.getConnectionType(connectionId);
    const queryId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const startTime = Date.now();

    logger.info(`[${queryId}] Executing: ${sql.slice(0, 100)}...`);

    try {
      if (connType === 'mysql') {
        const result = await this.executeMySQL(connectionId, sql, options);
        const duration = Date.now() - startTime;
        this.addHistory(connectionId, sql, duration, result.rowCount, 'success');
        return { ...result, queryId, sql, duration };
      } else {
        throw new Error(`Query execution for ${connType} not yet implemented in Sprint 1`);
      }
    } catch (err: any) {
      const duration = Date.now() - startTime;
      this.addHistory(connectionId, sql, duration, 0, 'error', err.message);
      throw err;
    }
  }

  private async executeMySQL(
    connectionId: string,
    sql: string,
    options?: { limit?: number }
  ): Promise<Omit<QueryResult, 'queryId' | 'sql' | 'duration'>> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);

    const limit = options?.limit || 1000;

    const [rows, fieldPacket] = await pool.query({
      sql,
      rowsAsArray: false,
    });

    // 处理 DDL/DML 无结果集的情况
    if (!Array.isArray(rows)) {
      const result = rows as mysql.ResultSetHeader;
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        affectedRows: result.affectedRows,
        insertId: result.insertId,
        hasMore: false,
        warnings: [],
      };
    }

    // 构建列描述
    const columns = (fieldPacket as mysql.FieldPacket[]).map(f => {
      const fieldNum = typeof f.type === 'number' ? f.type : 0;
      const flagsNum = typeof f.flags === 'number' ? f.flags : 0;
      return {
        name: f.name,
        type: mysqlTypeToString(fieldNum),
        category: categorizeType(mysqlTypeToString(fieldNum)),
        nullable: (flagsNum & 1) === 0,
      };
    });

    // 应用行数限制
    const rowArray = rows as Record<string, unknown>[];
    const hasMore = rowArray.length > limit;
    const limitedRows = hasMore ? rowArray.slice(0, limit) : rowArray;

    return {
      columns,
      rows: limitedRows,
      rowCount: rowArray.length,
      hasMore,
      warnings: [],
    };
  }

  /** 查询历史 */
  getHistory(connectionId?: string, limit = 50): typeof this.history {
    let items = this.history;
    if (connectionId) {
      items = items.filter(h => h.connectionId === connectionId);
    }
    return items.slice(-limit).reverse();
  }

  private addHistory(
    connectionId: string,
    sql: string,
    duration: number,
    rowCount: number,
    status: 'success' | 'error',
    errorMessage?: string
  ): void {
    this.history.push({
      id: `h_${Date.now()}`,
      connectionId,
      sql,
      duration,
      rowCount,
      status,
      errorMessage,
      executedAt: new Date().toISOString(),
    });
    // 保留最近 1000 条
    if (this.history.length > 1000) {
      this.history = this.history.slice(-1000);
    }
  }
}

/** MySQL field type 编号 → 字符串 */
function mysqlTypeToString(type: number): string {
  const map: Record<number, string> = {
    0: 'DECIMAL', 1: 'TINYINT', 2: 'SMALLINT', 3: 'INT', 4: 'FLOAT',
    5: 'DOUBLE', 6: 'NULL', 7: 'TIMESTAMP', 8: 'BIGINT', 9: 'MEDIUMINT',
    10: 'DATE', 11: 'TIME', 12: 'DATETIME', 13: 'YEAR', 14: 'NEWDATE',
    15: 'VARCHAR', 16: 'BIT', 17: 'JSON',
    245: 'JSON', 246: 'DECIMAL',
    247: 'ENUM', 248: 'SET', 249: 'TINYBLOB', 250: 'MEDIUMBLOB',
    251: 'LONGBLOB', 252: 'BLOB', 253: 'VARCHAR', 254: 'CHAR',
    255: 'GEOMETRY',
  };
  return map[type] || `TYPE_${type}`;
}
