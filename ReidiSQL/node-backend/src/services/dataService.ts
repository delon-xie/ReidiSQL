/**
 * 数据修改服务 - INSERT/UPDATE/DELETE 操作
 */

import mysql from 'mysql2/promise';
import { getConnectionManager } from './connectionService.js';
import { logger } from '../utils/logger.js';

/** 数据操作 */
export type DataOperation =
  | { type: 'insert'; data: Record<string, unknown> }
  | { type: 'update'; data: Record<string, unknown>; where: Record<string, unknown> }
  | { type: 'delete'; where: Record<string, unknown> };

/** 操作结果 */
export interface DataModificationResult {
  success: boolean;
  affectedRows: number;
  insertId?: number;
  errors?: Array<{ index: number; error: string; code?: number }>;
}

export class DataService {
  /**
   * 插入一行
   */
  async insertRow(
    connectionId: string,
    database: string,
    table: string,
    data: Record<string, unknown>
  ): Promise<DataModificationResult> {
    const mgr = getConnectionManager();
    const pool = mgr.getMySQLPool(connectionId);
    const conn = await pool.getConnection();

    try {
      await conn.query(`USE \`${database}\``);

      const columns = Object.keys(data).map(k => `\`${k}\``).join(', ');
      const values = Object.values(data);
      const placeholders = values.map(() => '?').join(', ');

      const sql = `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`;
      const [result] = await conn.query(sql, values);

      conn.release();
      const insertResult = result as mysql.ResultSetHeader;
      logger.info(`Inserted row into ${database}.${table}, id=${insertResult.insertId}`);

      return {
        success: true,
        affectedRows: insertResult.affectedRows,
        insertId: insertResult.insertId,
      };
    } catch (err: any) {
      conn.release();
      logger.error(`Insert failed: ${err.message}`);
      return { success: false, affectedRows: 0, errors: [{ index: 0, error: err.message, code: err.errno }] };
    }
  }

  /**
   * 更新行
   */
  async updateRow(
    connectionId: string,
    database: string,
    table: string,
    data: Record<string, unknown>,
    where: Record<string, unknown>
  ): Promise<DataModificationResult> {
    const mgr = getConnectionManager();
    const pool = mgr.getMySQLPool(connectionId);
    const conn = await pool.getConnection();

    try {
      await conn.query(`USE \`${database}\``);

      const setClauses = Object.keys(data).map(k => `\`${k}\` = ?`).join(', ');
      const setValues = Object.values(data);

      const whereClauses = Object.keys(where).map(k => `\`${k}\` = ?`).join(' AND ');
      const whereValues = Object.values(where);

      const sql = `UPDATE \`${table}\` SET ${setClauses} WHERE ${whereClauses}`;
      const [result] = await conn.query(sql, [...setValues, ...whereValues]);

      conn.release();
      const updateResult = result as mysql.ResultSetHeader;
      logger.info(`Updated rows in ${database}.${table}, affected=${updateResult.affectedRows}`);

      return { success: true, affectedRows: updateResult.affectedRows };
    } catch (err: any) {
      conn.release();
      logger.error(`Update failed: ${err.message}`);
      return { success: false, affectedRows: 0, errors: [{ index: 0, error: err.message, code: err.errno }] };
    }
  }

  /**
   * 删除行
   */
  async deleteRow(
    connectionId: string,
    database: string,
    table: string,
    where: Record<string, unknown>
  ): Promise<DataModificationResult> {
    const mgr = getConnectionManager();
    const pool = mgr.getMySQLPool(connectionId);
    const conn = await pool.getConnection();

    try {
      await conn.query(`USE \`${database}\``);

      const whereClauses = Object.keys(where).map(k => `\`${k}\` = ?`).join(' AND ');
      const whereValues = Object.values(where);

      const sql = `DELETE FROM \`${table}\` WHERE ${whereClauses}`;
      const [result] = await conn.query(sql, whereValues);

      conn.release();
      const deleteResult = result as mysql.ResultSetHeader;
      logger.info(`Deleted rows from ${database}.${table}, affected=${deleteResult.affectedRows}`);

      return { success: true, affectedRows: deleteResult.affectedRows };
    } catch (err: any) {
      conn.release();
      logger.error(`Delete failed: ${err.message}`);
      return { success: false, affectedRows: 0, errors: [{ index: 0, error: err.message, code: err.errno }] };
    }
  }

  /**
   * 批量操作（事务）
   */
  async batchModify(
    connectionId: string,
    database: string,
    table: string,
    operations: DataOperation[]
  ): Promise<DataModificationResult> {
    const mgr = getConnectionManager();
    const pool = mgr.getMySQLPool(connectionId);
    const conn = await pool.getConnection();

    try {
      await conn.query(`USE \`${database}\``);
      await conn.beginTransaction();

      let totalAffected = 0;
      let lastInsertId: number | undefined;
      const errors: Array<{ index: number; error: string; code?: number }> = [];

      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        try {
          let result: mysql.ResultSetHeader;

          if (op.type === 'insert') {
            const columns = Object.keys(op.data).map(k => `\`${k}\``).join(', ');
            const values = Object.values(op.data);
            const placeholders = values.map(() => '?').join(', ');
            const [r] = await conn.query(
              `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`,
              values
            );
            result = r as mysql.ResultSetHeader;
            if (result.insertId) lastInsertId = result.insertId;
          } else if (op.type === 'update') {
            const setClauses = Object.keys(op.data).map(k => `\`${k}\` = ?`).join(', ');
            const setValues = Object.values(op.data);
            const whereClauses = Object.keys(op.where).map(k => `\`${k}\` = ?`).join(' AND ');
            const whereValues = Object.values(op.where);
            const [r] = await conn.query(
              `UPDATE \`${table}\` SET ${setClauses} WHERE ${whereClauses}`,
              [...setValues, ...whereValues]
            );
            result = r as mysql.ResultSetHeader;
          } else {
            // delete
            const whereClauses = Object.keys(op.where).map(k => `\`${k}\` = ?`).join(' AND ');
            const whereValues = Object.values(op.where);
            const [r] = await conn.query(
              `DELETE FROM \`${table}\` WHERE ${whereClauses}`,
              whereValues
            );
            result = r as mysql.ResultSetHeader;
          }

          totalAffected += result.affectedRows;
        } catch (err: any) {
          errors.push({ index: i, error: err.message, code: err.errno });
        }
      }

      if (errors.length > 0 && errors.length === operations.length) {
        // 全部失败，回滚
        await conn.rollback();
        conn.release();
        return { success: false, affectedRows: 0, errors };
      }

      await conn.commit();
      conn.release();
      logger.info(`Batch modify ${database}.${table}: ${operations.length} ops, ${totalAffected} affected`);

      return {
        success: errors.length === 0,
        affectedRows: totalAffected,
        insertId: lastInsertId,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (err: any) {
      await conn.rollback().catch(() => {});
      conn.release();
      logger.error(`Batch modify failed: ${err.message}`);
      return { success: false, affectedRows: 0, errors: [{ index: -1, error: err.message }] };
    }
  }
}

// 单例
let dataInstance: DataService | null = null;
export function getDataService(): DataService {
  if (!dataInstance) {
    dataInstance = new DataService();
  }
  return dataInstance;
}
