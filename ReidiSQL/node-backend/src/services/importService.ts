/**
 * CSV 导入服务 — 格式检测 + 数据导入 + 表复制
 */

import mysql from 'mysql2/promise';
import { getConnectionManager } from './connectionService.js';
import { logger } from '../utils/logger.js';

/** 格式检测结果 */
export interface DetectResult {
  delimiter: string;
  enclosure: string;
  lineEnding: string;
  hasHeader: boolean;
  columns: Array<{ name: string; type: string; sample: string }>;
  preview: string[][];
  rowCount: number;
}

/** 导入选项 */
export interface ImportOptions {
  delimiter?: string;
  enclosure?: string;
  lineEnding?: string;
  encoding?: string;
  hasHeader?: boolean;
  skipRows?: number;
  insertMode?: 'INSERT' | 'INSERT IGNORE' | 'REPLACE';
  truncateFirst?: boolean;
  batchSize?: number;
  columnMapping?: string[]; // 文件列 → 表列映射
}

/** 导入结果 */
export interface ImportResult {
  success: boolean;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errors: Array<{ row: number; error: string }>;
  duration: number;
}

/** 表复制选项 */
export interface CopyTableOptions {
  copyColumns?: string[];
  copyIndexes?: boolean;
  copyForeignKeys?: boolean;
  copyData?: boolean;
  whereClause?: string;
  dropIfExists?: boolean;
}

export class ImportService {
  /**
   * 检测 CSV 格式
   */
  detectFormat(content: string, options?: { delimiter?: string; enclosure?: string }): DetectResult {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) {
      return { delimiter: ',', enclosure: '"', lineEnding: '\n', hasHeader: false, columns: [], preview: [], rowCount: 0 };
    }

    // 检测分隔符
    const candidates = [',', '\t', ';', '|'];
    const delimiter = options?.delimiter || this.detectDelimiter(lines[0], candidates);
    const enclosure = options?.enclosure || '"';

    // 解析所有行
    const parsed = lines.map(line => this.parseCSVLine(line, delimiter, enclosure));

    // 检测是否有表头
    const hasHeader = this.detectHeader(parsed);

    // 数据行（跳过表头）
    const dataRows = hasHeader ? parsed.slice(1) : parsed;
    const colCount = parsed[0]?.length || 0;

    // 类型检测
    const columns: Array<{ name: string; type: string; sample: string }> = [];
    for (let i = 0; i < colCount; i++) {
      const name = hasHeader ? parsed[0][i] : `col_${i}`;
      const values = dataRows.map(r => r[i] || '').filter(v => v.length > 0);
      const type = this.detectColumnType(values);
      const sample = values[0] || '';
      columns.push({ name, type, sample });
    }

    // 预览（前 5 行）
    const preview = parsed.slice(0, 6);

    return {
      delimiter,
      enclosure,
      lineEnding: content.includes('\r\n') ? '\r\n' : '\n',
      hasHeader,
      columns,
      preview,
      rowCount: dataRows.length,
    };
  }

  /**
   * 导入 CSV 到表
   */
  async importCSV(
    connectionId: string,
    database: string,
    table: string,
    content: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const mgr = getConnectionManager();
    const pool = mgr.getMySQLPool(connectionId);
    const conn = await pool.getConnection();

    const delimiter = options.delimiter || ',';
    const enclosure = options.enclosure || '"';
    const hasHeader = options.hasHeader ?? true;
    const skipRows = options.skipRows || 0;
    const insertMode = options.insertMode || 'INSERT';
    const batchSize = options.batchSize || 500;

    try {
      await conn.query(`USE \`${database}\``);

      // 清空表
      if (options.truncateFirst) {
        try {
          await conn.query(`TRUNCATE TABLE \`${table}\``);
        } catch {
          await conn.query(`DELETE FROM \`${table}\``);
        }
      }

      // 解析 CSV
      const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
      const startIdx = (hasHeader ? 1 : 0) + skipRows;
      const dataLines = lines.slice(startIdx);

      // 获取列名
      let targetColumns: string[];
      if (options.columnMapping && options.columnMapping.length > 0) {
        targetColumns = options.columnMapping.filter(c => c.length > 0);
      } else if (hasHeader && lines.length > 0) {
        // 从 CSV 表头匹配表列
        const headerLine = this.parseCSVLine(lines[0], delimiter, enclosure);
        const [cols] = await conn.query(`SHOW COLUMNS FROM \`${table}\``);
        const tableCols = (cols as any[]).map((c: any) => c.Field as string);
        // 只保留 CSV 表头中存在且表中也有的列
        targetColumns = headerLine.filter(h => tableCols.includes(h.trim()));
        if (targetColumns.length === 0) {
          // 回退到全部表列
          targetColumns = tableCols;
        }
      } else {
        // 从表结构获取列名
        const [cols] = await conn.query(`SHOW COLUMNS FROM \`${table}\``);
        targetColumns = (cols as any[]).map((c: any) => c.Field);
      }

      const colList = targetColumns.map(c => `\`${c}\``).join(', ');

      let totalRows = 0;
      let importedRows = 0;
      let skippedRows = 0;
      const errors: Array<{ row: number; error: string }> = [];

      // 分批处理
      for (let i = 0; i < dataLines.length; i += batchSize) {
        const batch = dataLines.slice(i, i + batchSize);
        const valueSets: string[] = [];
        const params: any[] = [];

        for (const line of batch) {
          totalRows++;
          try {
            const values = this.parseCSVLine(line, delimiter, enclosure);
            const mappedValues = values.slice(0, targetColumns.length);
            const placeholders = mappedValues.map(() => '?').join(', ');
            valueSets.push(`(${placeholders})`);
            params.push(...mappedValues.map(v => v === '' ? null : v));
          } catch (err: any) {
            errors.push({ row: i + startIdx + totalRows, error: err.message });
            skippedRows++;
          }
        }

        if (valueSets.length > 0) {
          try {
            const sql = `${insertMode} INTO \`${table}\` (${colList}) VALUES ${valueSets.join(', ')}`;
            const [result] = await conn.query(sql, params);
            importedRows += (result as mysql.ResultSetHeader).affectedRows;
          } catch (err: any) {
            errors.push({ row: i + startIdx + 1, error: err.message });
            skippedRows += batch.length;
          }
        }
      }

      conn.release();
      const duration = Date.now() - startTime;
      logger.info(`CSV import: ${totalRows} rows, ${importedRows} imported, ${skippedRows} skipped, ${duration}ms`);

      return { success: errors.length === 0, totalRows, importedRows, skippedRows, errors, duration };
    } catch (err: any) {
      conn.release();
      logger.error(`CSV import failed: ${err.message}`);
      return { success: false, totalRows: 0, importedRows: 0, skippedRows: 0, errors: [{ row: 0, error: err.message }], duration: Date.now() - startTime };
    }
  }

  /**
   * 表复制
   */
  async copyTable(
    connectionId: string,
    srcDb: string,
    srcTable: string,
    dstDb: string,
    dstTable: string,
    options: CopyTableOptions
  ): Promise<{ success: boolean; message: string }> {
    const mgr = getConnectionManager();
    const pool = mgr.getMySQLPool(connectionId);
    const conn = await pool.getConnection();

    try {
      // 复制结构
      let createSQL: string;
      if (options.copyColumns && options.copyColumns.length > 0) {
        const colList = options.copyColumns.map(c => `\`${c}\``).join(', ');
        createSQL = `CREATE TABLE \`${dstDb}\`.\`${dstTable}\` AS SELECT ${colList} FROM \`${srcDb}\`.\`${srcTable}\` WHERE 1=0`;
      } else {
        // 获取原始 CREATE TABLE
        await conn.query(`USE \`${srcDb}\``);
        const [result] = await conn.query(`SHOW CREATE TABLE \`${srcTable}\``);
        const originalSQL = (result as any[])[0]['Create Table'];
        // 替换表名
        createSQL = originalSQL.replace(
          new RegExp(`CREATE TABLE \`${srcTable}\``),
          `CREATE TABLE \`${dstDb}\`.\`${dstTable}\``
        );
      }

      // 删除已存在的表
      if (options.dropIfExists) {
        await conn.query(`DROP TABLE IF EXISTS \`${dstDb}\`.\`${dstTable}\``);
      }

      await conn.query(createSQL);

      // 复制索引（如果选中且整表复制）
      if (options.copyIndexes && (!options.copyColumns || options.copyColumns.length === 0)) {
        // 索引已在 CREATE TABLE 中包含
      }

      // 复制数据
      if (options.copyData) {
        let colList = '*';
        if (options.copyColumns && options.copyColumns.length > 0) {
          colList = options.copyColumns.map(c => `\`${c}\``).join(', ');
        }

        let sql = `INSERT INTO \`${dstDb}\`.\`${dstTable}\` SELECT ${colList} FROM \`${srcDb}\`.\`${srcTable}\``;
        if (options.whereClause) {
          sql += ` WHERE ${options.whereClause}`;
        }
        await conn.query(sql);
      }

      conn.release();
      logger.info(`Table copied: ${srcDb}.${srcTable} -> ${dstDb}.${dstTable}`);
      return { success: true, message: `Table copied successfully` };
    } catch (err: any) {
      conn.release();
      logger.error(`Table copy failed: ${err.message}`);
      return { success: false, message: err.message };
    }
  }

  // ========== 私有方法 ==========

  private detectDelimiter(line: string, candidates: string[]): string {
    let best = candidates[0];
    let bestCount = 0;

    for (const d of candidates) {
      const count = (line.match(new RegExp(d === '|' ? '\\|' : d, 'g')) || []).length;
      if (count > bestCount) {
        best = d;
        bestCount = count;
      }
    }
    return best;
  }

  private parseCSVLine(line: string, delimiter: string, enclosure: string): string[] {
    const result: string[] = [];
    let current = '';
    let inEnclosure = false;
    let i = 0;

    while (i < line.length) {
      const ch = line[i];

      if (inEnclosure) {
        if (ch === enclosure) {
          if (i + 1 < line.length && line[i + 1] === enclosure) {
            current += enclosure;
            i += 2;
            continue;
          }
          inEnclosure = false;
          i++;
          continue;
        }
        current += ch;
        i++;
      } else {
        if (ch === enclosure) {
          inEnclosure = true;
          i++;
        } else if (ch === delimiter) {
          result.push(current);
          current = '';
          i++;
        } else {
          current += ch;
          i++;
        }
      }
    }
    result.push(current);
    return result;
  }

  private detectHeader(parsed: string[][]): boolean {
    if (parsed.length < 2) return false;
    const first = parsed[0];
    const second = parsed[1];

    // 如果第一行全是非数字文本，且第二行有数字，可能是表头
    const firstAllText = first.every(v => isNaN(Number(v)) && v.length > 0);
    const secondHasNumbers = second.some(v => !isNaN(Number(v)) && v.length > 0);
    return firstAllText && secondHasNumbers;
  }

  private detectColumnType(values: string[]): string {
    if (values.length === 0) return 'TEXT';

    // 检查是否全是整数
    const allInt = values.every(v => /^-?\d+$/.test(v));
    if (allInt) return 'INT';

    // 检查是否全是浮点
    const allFloat = values.every(v => /^-?\d+\.?\d*$/.test(v));
    if (allFloat) return 'DOUBLE';

    // 检查日期
    const allDate = values.every(v => /^\d{4}-\d{2}-\d{2}$/.test(v));
    if (allDate) return 'DATE';

    // 检查日期时间
    const allDateTime = values.every(v => /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(v));
    if (allDateTime) return 'DATETIME';

    // 默认 TEXT
    const maxLen = Math.max(...values.map(v => v.length));
    if (maxLen <= 255) return 'VARCHAR(255)';
    return 'TEXT';
  }
}

let importInstance: ImportService | null = null;
export function getImportService(): ImportService {
  if (!importInstance) {
    importInstance = new ImportService();
  }
  return importInstance;
}
