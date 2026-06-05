/**
 * 数据导出服务 - CSV/JSON/SQL 格式导出
 */

import { getConnectionManager } from './connectionService.js';
import { logger } from '../utils/logger.js';

/** 导出格式 */
export type ExportFormat = 'csv' | 'json' | 'sql';

/** 导出选项 */
export interface ExportOptions {
  format: ExportFormat;
  tables: string[];
  includeStructure?: boolean;
  includeData?: boolean;
  includeHeaders?: boolean;
  delimiter?: string;
  enclosure?: string;
  encoding?: string;
  lineEnding?: string;
  insertMode?: 'INSERT' | 'REPLACE' | 'INSERT IGNORE';
  batchSize?: number;
  maxRows?: number;
  whereClause?: string;
}

/** 导出结果 */
export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  table: string;
  rowCount: number;
  data: string;
  filename: string;
  contentType: string;
  error?: string;
}

export class ExportService {
  /**
   * 导出表数据
   */
  async exportTable(
    connectionId: string,
    database: string,
    options: ExportOptions
  ): Promise<ExportResult[]> {
    const results: ExportResult[] = [];

    for (const table of options.tables) {
      try {
        const data = await this.fetchTableData(connectionId, database, table, options.maxRows, options.whereClause);

        let exported: ExportResult;
        switch (options.format) {
          case 'csv':
            exported = this.toCSV(table, data.columns, data.rows, options);
            break;
          case 'json':
            exported = this.toJSON(table, data.rows);
            break;
          case 'sql':
            exported = await this.toSQL(connectionId, database, table, data.columns, data.rows, options);
            break;
          default:
            throw new Error(`Unsupported format: ${options.format}`);
        }

        results.push(exported);
      } catch (err: any) {
        logger.error(`Export ${table} failed: ${err.message}`);
        results.push({
          success: false,
          format: options.format,
          table,
          rowCount: 0,
          data: '',
          filename: '',
          contentType: '',
          error: err.message,
        });
      }
    }

    return results;
  }

  /**
   * 获取表数据
   */
  private async fetchTableData(
    connectionId: string,
    database: string,
    table: string,
    maxRows?: number,
    whereClause?: string
  ): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
    const mgr = getConnectionManager();
    const pool = mgr.getMySQLPool(connectionId);
    const conn = await pool.getConnection();

    try {
      await conn.query(`USE \`${database}\``);

      let sql = `SELECT * FROM \`${table}\``;
      if (whereClause) sql += ` WHERE ${whereClause}`;
      if (maxRows && maxRows > 0) sql += ` LIMIT ${maxRows}`;

      const [rows, fields] = await conn.query(sql);
      conn.release();

      const columns = (fields as any[]).map(f => f.name);
      return { columns, rows: rows as Record<string, unknown>[] };
    } catch (err) {
      conn.release();
      throw err;
    }
  }

  /**
   * 导出为 CSV
   */
  private toCSV(
    table: string,
    columns: string[],
    rows: Record<string, unknown>[],
    options: ExportOptions
  ): ExportResult {
    const delimiter = options.delimiter || ',';
    const enclosure = options.enclosure || '"';
    const lineEnding = options.lineEnding || '\n';
    const lines: string[] = [];

    // 表头
    if (options.includeHeaders !== false) {
      lines.push(columns.map(c => `${enclosure}${c}${enclosure}`).join(delimiter));
    }

    // 数据行
    for (const row of rows) {
      const values = columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const str = String(val);
        // 转义引号
        const escaped = str.replace(new RegExp(enclosure, 'g'), `${enclosure}${enclosure}`);
        return `${enclosure}${escaped}${enclosure}`;
      });
      lines.push(values.join(delimiter));
    }

    const data = lines.join(lineEnding);

    return {
      success: true,
      format: 'csv',
      table,
      rowCount: rows.length,
      data,
      filename: `${table}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  /**
   * 导出为 JSON
   */
  private toJSON(table: string, rows: Record<string, unknown>[]): ExportResult {
    const data = JSON.stringify(rows, null, 2);

    return {
      success: true,
      format: 'json',
      table,
      rowCount: rows.length,
      data,
      filename: `${table}.json`,
      contentType: 'application/json; charset=utf-8',
    };
  }

  /**
   * 导出为 SQL INSERT 语句
   */
  private async toSQL(
    connectionId: string,
    database: string,
    table: string,
    columns: string[],
    rows: Record<string, unknown>[],
    options: ExportOptions
  ): Promise<ExportResult> {
    const insertMode = options.insertMode || 'INSERT';
    const batchSize = options.batchSize || 100;
    const lines: string[] = [];

    // 获取 CREATE TABLE（如果包含结构）
    if (options.includeStructure !== false) {
      const mgr = getConnectionManager();
      const pool = mgr.getMySQLPool(connectionId);
      const conn = await pool.getConnection();
      try {
        await conn.query(`USE \`${database}\``);
        const [createResult] = await conn.query(`SHOW CREATE TABLE \`${table}\``);
        conn.release();
        const createSQL = (createResult as any[])[0]?.['Create Table'];
        if (createSQL) {
          lines.push(`-- Table structure for \`${table}\`\n`);
          lines.push(`DROP TABLE IF EXISTS \`${table}\`;`);
          lines.push(`${createSQL};\n`);
        }
      } catch (err) {
        conn.release();
        throw err;
      }
    }

    // 生成 INSERT 语句
    if (options.includeData !== false && rows.length > 0) {
      lines.push(`-- Data for table \`${table}\`\n`);

      const colList = columns.map(c => `\`${c}\``).join(', ');

      // 按批次分组
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const valueSets = batch.map(row => {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return String(val);
            if (typeof val === 'boolean') return val ? '1' : '0';
            // 转义字符串
            const escaped = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
            return `'${escaped}'`;
          });
          return `(${values.join(', ')})`;
        });

        lines.push(`${insertMode} INTO \`${table}\` (${colList}) VALUES\n${valueSets.join(',\n')};`);
      }
    }

    const data = lines.join('\n');

    return {
      success: true,
      format: 'sql',
      table,
      rowCount: rows.length,
      data,
      filename: `${table}.sql`,
      contentType: 'application/sql; charset=utf-8',
    };
  }
}

// 单例
let exportInstance: ExportService | null = null;
export function getExportService(): ExportService {
  if (!exportInstance) {
    exportInstance = new ExportService();
  }
  return exportInstance;
}
