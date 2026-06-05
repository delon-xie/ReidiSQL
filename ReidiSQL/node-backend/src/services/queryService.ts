/**
 * 查询执行服务
 * 通过 ConnectionManager 获取真实连接执行 SQL
 */

import mysql from 'mysql2/promise';
import mysqlCb from 'mysql2';
import { getConnectionManager } from './connectionService.js';
import { logger } from '../utils/logger.js';

/** 流式查询事件类型 */
export type StreamEvent =
  | { type: 'start'; sql: string; timestamp: number }
  | { type: 'columns'; columns: Array<{ name: string; type: string; category: string }> }
  | { type: 'rows'; rows: Record<string, unknown>[]; rowCount: number }
  | { type: 'end'; rowCount: number; duration: number }
  | { type: 'error'; error: string };

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

  // ==================== 流式查询 ====================

  /**
   * 流式执行查询（NDJSON 格式）
   * 适用于大结果集场景，避免一次性返回所有行导致内存溢出
   * 
   * @param connectionId 连接 ID
   * @param sql SQL 语句
   * @param batchSize 每批发送的行数
   * @param onRow 行回调（返回 false 则取消）
   */
  async executeQueryStream(
    connectionId: string,
    sql: string,
    batchSize: number = 100,
    onRow: (event: StreamEvent) => boolean | void,
  ): Promise<{ rowCount: number; duration: number }> {
    const connManager = getConnectionManager();
    const connType = connManager.getConnectionType(connectionId);
    const startTime = Date.now();

    if (connType !== 'mysql') {
      throw new Error(`Stream query only supports MySQL, got: ${connType}`);
    }

    const pool = connManager.getMySQLPool(connectionId);
    // 使用 mysql2 callback API 获取流式支持
    const poolCb = (pool as any).pool as mysqlCb.Pool;
    const connCb = await new Promise<mysqlCb.PoolConnection>((resolve, reject) => {
      poolCb.getConnection((err: Error | null, conn: mysqlCb.PoolConnection) => {
        if (err) reject(err);
        else resolve(conn);
      });
    });

    try {
      // 发送 start 事件
      const metaSent = onRow({ type: 'start', sql, timestamp: Date.now() });
      if (metaSent === false) {
        connCb.release();
        return { rowCount: 0, duration: 0 };
      }

      let rowCount = 0;
      let batch: Record<string, unknown>[] = [];

      // mysql2 callback API 的 query 方法返回 Query 对象（可读流）
      return new Promise((resolve, reject) => {
        const query = connCb.query({ sql });

        query.on('fields', (fields: any[]) => {
          const columns = fields.map((f: any) => ({
            name: f.name,
            type: mysqlTypeToString(typeof f.type === 'number' ? f.type : 0),
            category: categorizeType(mysqlTypeToString(typeof f.type === 'number' ? f.type : 0)),
          }));
          onRow({ type: 'columns', columns });
        });

        query.on('result', (row: Record<string, unknown>) => {
          batch.push(row);
          rowCount++;
          if (batch.length >= batchSize) {
            const cont = onRow({ type: 'rows', rows: batch, rowCount });
            batch = [];
            if (cont === false) {
              connCb.release();
              resolve({ rowCount, duration: Date.now() - startTime });
            }
          }
        });

        query.on('end', () => {
          if (batch.length > 0) {
            onRow({ type: 'rows', rows: batch, rowCount });
          }
          connCb.release();
          const duration = Date.now() - startTime;
          onRow({ type: 'end', rowCount, duration });
          this.addHistory(connectionId, sql, duration, rowCount, 'success');
          resolve({ rowCount, duration });
        });

        query.on('error', (err: Error) => {
          connCb.release();
          const duration = Date.now() - startTime;
          this.addHistory(connectionId, sql, duration, 0, 'error', err.message);
          onRow({ type: 'error', error: err.message });
          reject(err);
        });
      });
    } catch (err: any) {
      connCb.release();
      throw err;
    }
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
