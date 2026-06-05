/**
 * 表工具服务
 * 提供表维护（CHECK/OPTIMIZE/REPAIR/ANALYZE）和文本搜索
 */

import { getConnectionManager } from './connectionService.js';
import { logger } from '../utils/logger.js';

/** 维护操作类型 */
export type MaintenanceOperation = 'check' | 'analyze' | 'checksum' | 'optimize' | 'repair';

/** 维护请求 */
export interface MaintenanceRequest {
  connectionId: string;
  database: string;
  tables: string[];
  operation: MaintenanceOperation;
  options?: {
    quick?: boolean;
    fast?: boolean;
    medium?: boolean;
    extended?: boolean;
    changed?: boolean;
    forUpgrade?: boolean;
  };
}

/** 维护结果 */
export interface MaintenanceResult {
  database: string;
  table: string;
  operation: MaintenanceOperation;
  status: 'OK' | 'Error' | 'Warning' | 'Info';
  message: string;
}

/** 文本搜索请求 */
export interface FindTextRequest {
  connectionId: string;
  database: string;
  tables: string[];
  searchText: string;
  matchType?: 'exact' | 'contains' | 'starts_with' | 'ends_with' | 'regex';
  dataTypes?: string[]; // string, number, date, binary
}

/** 文本搜索结果 */
export interface FindTextResult {
  table: string;
  column: string;
  primaryKey: string;
  matchValue: string;
  rowCount: number;
}

/** 数据库同步分析请求 */
export interface SyncAnalyzeRequest {
  connectionId: string;
  sourceDb: string;
  targetDb: string;
}

/** 同步差异项 */
export interface SyncDiff {
  type: 'table' | 'column' | 'index' | 'fk';
  action: 'add' | 'drop' | 'modify';
  name: string;
  ddl: string;
}

/** 批量编辑请求 */
export interface BulkEditRequest {
  connectionId: string;
  database: string;
  tables: string[];
  operation: 'engine' | 'charset' | 'collation';
  value: string;
}

/** 数据生成请求 */
export interface GenerateDataRequest {
  connectionId: string;
  database: string;
  table: string;
  rowCount: number;
  columns?: string[];
}

export class ToolsService {
  /** 执行表维护操作 */
  async maintenance(req: MaintenanceRequest): Promise<MaintenanceResult[]> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(req.connectionId);
    const conn = await pool.getConnection();

    try {
      await conn.query(`USE \`${req.database}\``);

      const results: MaintenanceResult[] = [];
      const op = req.operation.toUpperCase();

      for (const table of req.tables) {
        try {
          // 构建 SQL
          let sql = `${op} TABLE \`${table}\``;

          // 添加选项
          const opts: string[] = [];
          if (req.options?.quick) opts.push('QUICK');
          if (req.options?.fast) opts.push('FAST');
          if (req.options?.medium) opts.push('MEDIUM');
          if (req.options?.extended) opts.push('EXTENDED');
          if (req.options?.changed) opts.push('CHANGED');
          if (req.options?.forUpgrade) opts.push('FOR UPGRADE');
          if (opts.length > 0) sql += ' ' + opts.join(' ');

          const [rows] = await conn.query(sql);

          // 解析 MySQL 返回的状态行
          const rowArray = rows as any[];
          if (rowArray && rowArray.length > 0) {
            const lastRow = rowArray[rowArray.length - 1];
            const msgText = lastRow.Msg_text || lastRow.Message || '';
            const msgType = lastRow.Msg_type || lastRow.Type || 'status';

            let status: MaintenanceResult['status'] = 'OK';
            if (msgType === 'error') status = 'Error';
            else if (msgType === 'warning') status = 'Warning';
            else if (msgType === 'info') status = 'Info';

            results.push({
              database: req.database,
              table,
              operation: req.operation,
              status,
              message: msgText,
            });
          } else {
            results.push({
              database: req.database,
              table,
              operation: req.operation,
              status: 'OK',
              message: 'Operation completed',
            });
          }

          logger.info(`Maintenance ${op} on ${req.database}.${table}: OK`);
        } catch (err: any) {
          results.push({
            database: req.database,
            table,
            operation: req.operation,
            status: 'Error',
            message: err.message,
          });
          logger.error(`Maintenance ${op} on ${req.database}.${table} failed: ${err.message}`);
        }
      }

      return results;
    } finally {
      conn.release();
    }
  }

  /** 在表中搜索文本 */
  async findText(req: FindTextRequest): Promise<FindTextResult[]> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(req.connectionId);
    const conn = await pool.getConnection();

    try {
      await conn.query(`USE \`${req.database}\``);

      const results: FindTextResult[] = [];

      for (const table of req.tables) {
        try {
          // 获取表列信息
          const [cols] = await conn.query(`SHOW COLUMNS FROM \`${table}\``);
          const columns = cols as any[];

          // 过滤文本列
          const textColumns = columns.filter(col => {
            const type = (col.Type || '').toUpperCase();
            if (req.dataTypes && req.dataTypes.length > 0) {
              if (req.dataTypes.includes('string') && /CHAR|TEXT|ENUM|SET|JSON/.test(type)) return true;
              if (req.dataTypes.includes('number') && /INT|FLOAT|DOUBLE|DECIMAL/.test(type)) return true;
              if (req.dataTypes.includes('date') && /DATE|TIME|TIMESTAMP/.test(type)) return true;
              return false;
            }
            // 默认搜索文本列
            return /CHAR|TEXT|ENUM|SET|JSON/.test(type);
          });

          if (textColumns.length === 0) continue;

          // 获取主键
          const pkCol = columns.find(c => c.Key === 'PRI');
          const pkName = pkCol ? pkCol.Field : columns[0].Field;

          // 构建搜索条件
          const conditions = textColumns.map(col => {
            const colName = col.Field;
            switch (req.matchType) {
              case 'exact':
                return `\`${colName}\` = '${this.escape(req.searchText)}'`;
              case 'starts_with':
                return `\`${colName}\` LIKE '${this.escape(req.searchText)}%'`;
              case 'ends_with':
                return `\`${colName}\` LIKE '%${this.escape(req.searchText)}'`;
              case 'regex':
                return `\`${colName}\` REGEXP '${this.escape(req.searchText)}'`;
              case 'contains':
              default:
                return `\`${colName}\` LIKE '%${this.escape(req.searchText)}%'`;
            }
          });

          const sql = `SELECT \`${pkName}\`, ${textColumns.map(c => `\`${c.Field}\``).join(', ')}
            FROM \`${table}\`
            WHERE ${conditions.join(' OR ')}
            LIMIT 100`;

          const [rows] = await conn.query(sql);
          const rowArray = rows as any[];

          for (const row of rowArray) {
            // 找到匹配的列
            for (const col of textColumns) {
              const val = row[col.Field];
              if (val !== null && String(val).includes(req.searchText)) {
                results.push({
                  table,
                  column: col.Field,
                  primaryKey: String(row[pkName] ?? ''),
                  matchValue: String(val).slice(0, 200),
                  rowCount: 1,
                });
                break; // 每行只报一个匹配列
              }
            }
          }

          logger.info(`Find text in ${req.database}.${table}: ${rowArray.length} rows`);
        } catch (err: any) {
          logger.warn(`Find text in ${req.database}.${table} failed: ${err.message}`);
        }
      }

      return results;
    } finally {
      conn.release();
    }
  }

  private escape(str: string): string {
    return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
  }

  /** 数据库同步分析 — 比较两个数据库的 schema 差异 */
  async syncAnalyze(req: SyncAnalyzeRequest): Promise<SyncDiff[]> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(req.connectionId);
    const conn = await pool.getConnection();

    try {
      // 获取源库和目标库的表列表
      const [srcTables] = await conn.query(`SHOW TABLES FROM \`${req.sourceDb}\``);
      const [tgtTables] = await conn.query(`SHOW TABLES FROM \`${req.targetDb}\``);

      const srcTableNames = (srcTables as any[]).map(r => Object.values(r)[0] as string);
      const tgtTableNames = (tgtTables as any[]).map(r => Object.values(r)[0] as string);

      const diffs: SyncDiff[] = [];

      // 源库有但目标库没有的表 → 需要创建
      for (const table of srcTableNames) {
        if (!tgtTableNames.includes(table)) {
          // 获取 CREATE TABLE 语句
          const [rows] = await conn.query(`SHOW CREATE TABLE \`${req.sourceDb}\`.\`${table}\``);
          const createSql = (rows as any[])[0]?.['Create Table'] || '';
          // 替换数据库名
          const ddl = createSql.replace(new RegExp(`\`${req.sourceDb}\``, 'g'), `\`${req.targetDb}\``);
          diffs.push({
            type: 'table',
            action: 'add',
            name: table,
            ddl: ddl + ';',
          });
        }
      }

      // 目标库有但源库没有的表 → 需要删除
      for (const table of tgtTableNames) {
        if (!srcTableNames.includes(table)) {
          diffs.push({
            type: 'table',
            action: 'drop',
            name: table,
            ddl: `DROP TABLE \`${req.targetDb}\`.\`${table}\`;`,
          });
        }
      }

      // 两个库都有的表 → 比较列差异
      for (const table of srcTableNames) {
        if (!tgtTableNames.includes(table)) continue;

        const [srcCols] = await conn.query(`SHOW COLUMNS FROM \`${req.sourceDb}\`.\`${table}\``);
        const [tgtCols] = await conn.query(`SHOW COLUMNS FROM \`${req.targetDb}\`.\`${table}\``);

        const srcColMap = new Map((srcCols as any[]).map(c => [c.Field, c]));
        const tgtColMap = new Map((tgtCols as any[]).map(c => [c.Field, c]));

        // 源有目标没有的列
        for (const [colName, col] of srcColMap) {
          if (!tgtColMap.has(colName)) {
            const colDef = this.buildColumnDef(col);
            diffs.push({
              type: 'column',
              action: 'add',
              name: `${table}.${colName}`,
              ddl: `ALTER TABLE \`${req.targetDb}\`.\`${table}\` ADD COLUMN \`${colName}\` ${colDef};`,
            });
          }
        }

        // 目标有源没有的列
        for (const [colName] of tgtColMap) {
          if (!srcColMap.has(colName)) {
            diffs.push({
              type: 'column',
              action: 'drop',
              name: `${table}.${colName}`,
              ddl: `ALTER TABLE \`${req.targetDb}\`.\`${table}\` DROP COLUMN \`${colName}\`;`,
            });
          }
        }

        // 两个都有的列 → 比较类型差异
        for (const [colName, srcCol] of srcColMap) {
          const tgtCol = tgtColMap.get(colName);
          if (!tgtCol) continue;
          if (srcCol.Type !== tgtCol.Type || srcCol.Null !== tgtCol.Null) {
            const colDef = this.buildColumnDef(srcCol);
            diffs.push({
              type: 'column',
              action: 'modify',
              name: `${table}.${colName}`,
              ddl: `ALTER TABLE \`${req.targetDb}\`.\`${table}\` MODIFY COLUMN \`${colName}\` ${colDef};`,
            });
          }
        }
      }

      logger.info(`Sync analyze ${req.sourceDb} → ${req.targetDb}: ${diffs.length} diffs`);
      return diffs;
    } finally {
      conn.release();
    }
  }

  /** 构建列定义字符串 */
  private buildColumnDef(col: any): string {
    let def = col.Type;
    if (col.Null === 'NO') def += ' NOT NULL';
    if (col.Default !== null) {
      def += ` DEFAULT '${col.Default}'`;
    } else if (col.Null === 'YES') {
      def += ' DEFAULT NULL';
    }
    if (col.Extra) def += ` ${col.Extra}`;
    return def;
  }

  /** 批量编辑多个表的属性 */
  async bulkEdit(req: BulkEditRequest): Promise<MaintenanceResult[]> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(req.connectionId);
    const conn = await pool.getConnection();

    try {
      await conn.query(`USE \`${req.database}\``);
      const results: MaintenanceResult[] = [];

      for (const table of req.tables) {
        try {
          let sql: string;
          switch (req.operation) {
            case 'engine':
              sql = `ALTER TABLE \`${table}\` ENGINE = ${req.value}`;
              break;
            case 'charset':
              sql = `ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET ${req.value}`;
              break;
            case 'collation':
              sql = `ALTER TABLE \`${table}\` COLLATE ${req.value}`;
              break;
            default:
              throw new Error(`Unknown operation: ${req.operation}`);
          }

          await conn.query(sql);
          results.push({
            database: req.database,
            table,
            operation: req.operation as any,
            status: 'OK',
            message: `${req.operation} set to ${req.value}`,
          });
          logger.info(`Bulk edit ${req.database}.${table}: ${req.operation} = ${req.value}`);
        } catch (err: any) {
          results.push({
            database: req.database,
            table,
            operation: req.operation as any,
            status: 'Error',
            message: err.message,
          });
          logger.error(`Bulk edit ${req.database}.${table} failed: ${err.message}`);
        }
      }

      return results;
    } finally {
      conn.release();
    }
  }

  /** 为指定表生成测试数据 */
  async generateData(req: GenerateDataRequest): Promise<{ insertedRows: number }> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(req.connectionId);
    const conn = await pool.getConnection();

    try {
      await conn.query(`USE \`${req.database}\``);

      // 获取表列信息
      const [cols] = await conn.query(`SHOW COLUMNS FROM \`${req.table}\``);
      const columns = (cols as any[]).filter(col => {
        // 排除自增列
        if (col.Extra?.includes('auto_increment')) return false;
        // 如果指定了列，只处理指定的列
        if (req.columns && req.columns.length > 0) {
          return req.columns.includes(col.Field);
        }
        return true;
      });

      if (columns.length === 0) {
        return { insertedRows: 0 };
      }

      // 批量生成和插入数据
      const batchSize = 100;
      let totalInserted = 0;

      for (let i = 0; i < req.rowCount; i += batchSize) {
        const batch = Math.min(batchSize, req.rowCount - i);
        const values: string[][] = [];

        for (let j = 0; j < batch; j++) {
          const row = columns.map(col => this.generateValue(col));
          values.push(row);
        }

        const colNames = columns.map(c => `\`${c.Field}\``).join(', ');
        const placeholders = values.map(row => `(${row.join(', ')})`).join(', ');
        const sql = `INSERT INTO \`${req.table}\` (${colNames}) VALUES ${placeholders}`;

        await conn.query(sql);
        totalInserted += batch;
      }

      logger.info(`Generated ${totalInserted} rows for ${req.database}.${req.table}`);
      return { insertedRows: totalInserted };
    } finally {
      conn.release();
    }
  }

  /** 根据列类型生成随机值 */
  private generateValue(col: any): string {
    const type = (col.Type || '').toUpperCase();
    const isNullable = col.Null === 'YES';

    // 5% 概率生成 NULL（如果允许）
    if (isNullable && Math.random() < 0.05) return 'NULL';

    // 整数类型
    if (/INT|SERIAL/.test(type)) {
      const max = /BIGINT/.test(type) ? 999999 : /SMALLINT/.test(type) ? 32767 : /TINYINT/.test(type) ? 127 : 99999;
      return String(Math.floor(Math.random() * max));
    }

    // 浮点类型
    if (/FLOAT|DOUBLE|DECIMAL|NUMERIC|REAL/.test(type)) {
      return (Math.random() * 10000).toFixed(2);
    }

    // 日期时间类型
    if (/DATETIME|TIMESTAMP/.test(type)) {
      const d = new Date(Date.now() - Math.random() * 365 * 24 * 3600 * 1000);
      return `'${d.toISOString().slice(0, 19).replace('T', ' ')}'`;
    }
    if (/DATE/.test(type)) {
      const d = new Date(Date.now() - Math.random() * 365 * 24 * 3600 * 1000);
      return `'${d.toISOString().slice(0, 10)}'`;
    }
    if (/TIME/.test(type)) {
      const h = Math.floor(Math.random() * 24);
      const m = Math.floor(Math.random() * 60);
      const s = Math.floor(Math.random() * 60);
      return `'${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}'`;
    }
    if (/YEAR/.test(type)) {
      return String(2000 + Math.floor(Math.random() * 25));
    }

    // ENUM/SET 类型
    if (/ENUM\(/.test(type)) {
      const match = type.match(/ENUM\((.+)\)/);
      if (match) {
        const options = match[1].split(',').map((o: string) => o.trim());
        return options[Math.floor(Math.random() * options.length)];
      }
    }
    if (/SET\(/.test(type)) {
      const match = type.match(/SET\((.+)\)/);
      if (match) {
        const options = match[1].split(',').map((o: string) => o.trim());
        const selected = options.filter(() => Math.random() > 0.5);
        return selected.length > 0 ? selected.join(',') : options[0];
      }
    }

    // 字符串类型
    if (/CHAR|TEXT|BLOB|BINARY/.test(type)) {
      const lenMatch = type.match(/\((\d+)\)/);
      const maxLen = lenMatch ? Math.min(parseInt(lenMatch[1]), 50) : 50;
      const len = Math.max(1, Math.floor(Math.random() * maxLen));
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ';
      let str = '';
      for (let i = 0; i < len; i++) {
        str += chars[Math.floor(Math.random() * chars.length)];
      }
      return `'${str.replace(/'/g, "''")}'`;
    }

    // JSON 类型
    if (/JSON/.test(type)) {
      return `'{"key":"value_${Math.floor(Math.random() * 1000)}"}'`;
    }

    // 布尔类型
    if (/BOOL/.test(type)) {
      return Math.random() > 0.5 ? '1' : '0';
    }

    // 默认字符串
    return `'data_${Math.floor(Math.random() * 10000)}'`;
  }
}

// 全局单例
let instance: ToolsService | null = null;

export function getToolsService(): ToolsService {
  if (!instance) {
    instance = new ToolsService();
  }
  return instance;
}
