/**
 * DDL 服务 - 表结构操作的 CREATE/ALTER TABLE SQL 生成与执行
 */

import { getConnectionManager } from './connectionService.js';
import { logger } from '../utils/logger.js';

/** 列定义 */
export interface ColumnDef {
  operation: 'add' | 'modify' | 'drop' | 'rename';
  name: string;
  newName?: string;
  dataType: string;
  nullable?: boolean;
  defaultValue?: string | null;
  hasDefault?: boolean;
  autoIncrement?: boolean;
  unsigned?: boolean;
  comment?: string;
  afterColumn?: string;
  position?: 'first' | 'after';
}

/** 索引定义 */
export interface IndexDef {
  operation: 'add' | 'drop';
  name: string;
  type?: 'PRIMARY' | 'UNIQUE' | 'INDEX' | 'FULLTEXT' | 'SPATIAL';
  columns?: Array<{ name: string; length?: number; order?: 'ASC' | 'DESC' }>;
  algorithm?: 'BTREE' | 'HASH';
}

/** 外键定义 */
export interface ForeignKeyDef {
  operation: 'add' | 'drop';
  name: string;
  columns?: string[];
  referencedTable?: string;
  referencedColumns?: string[];
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' | 'SET DEFAULT';
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' | 'SET DEFAULT';
}

/** 表选项 */
export interface TableOptionsDef {
  engine?: string;
  charset?: string;
  collation?: string;
  comment?: string;
  autoIncrement?: number;
  rowFormat?: string;
}

/** DDL 请求 */
export interface TableDDLRequest {
  connectionId: string;
  database: string;
  operation: 'create' | 'alter' | 'rename' | 'drop';
  tableName: string;
  newTableName?: string;
  columns?: ColumnDef[];
  indexes?: IndexDef[];
  foreignKeys?: ForeignKeyDef[];
  options?: TableOptionsDef;
}

/** DDL 结果 */
export interface DDLResult {
  success: boolean;
  sql: string;
  affectedRows?: number;
  error?: string;
}

export class DDLService {
  /**
   * 生成 CREATE TABLE SQL
   */
  generateCreateTable(
    tableName: string,
    columns: ColumnDef[],
    indexes?: IndexDef[],
    foreignKeys?: ForeignKeyDef[],
    options?: TableOptionsDef
  ): string {
    const lines: string[] = [];

    // 列定义
    for (const col of columns) {
      lines.push('  ' + this.columnDefinitionToSQL(col));
    }

    // 索引定义
    if (indexes) {
      for (const idx of indexes) {
        if (idx.operation === 'add' && idx.columns && idx.columns.length > 0) {
          lines.push('  ' + this.indexDefinitionToSQL(idx));
        }
      }
    }

    // 外键定义
    if (foreignKeys) {
      for (const fk of foreignKeys) {
        if (fk.operation === 'add' && fk.columns && fk.columns.length > 0) {
          lines.push('  ' + this.foreignKeyDefinitionToSQL(fk));
        }
      }
    }

    const sql = `CREATE TABLE \`${tableName}\` (\n${lines.join(',\n')}\n)`;
    const tableOpts = this.tableOptionsToSQL(options);
    return tableOpts ? `${sql} ${tableOpts}` : sql;
  }

  /**
   * 生成 ALTER TABLE SQL（多条语句用 ; 分隔）
   */
  generateAlterTable(
    tableName: string,
    columns?: ColumnDef[],
    indexes?: IndexDef[],
    foreignKeys?: ForeignKeyDef[],
    options?: TableOptionsDef
  ): string {
    const statements: string[] = [];

    // 列变更
    if (columns && columns.length > 0) {
      const colSQLs: string[] = [];
      for (const col of columns) {
        colSQLs.push(this.alterColumnToSQL(tableName, col));
      }
      statements.push(colSQLs.join(';\n'));
    }

    // 索引变更
    if (indexes && indexes.length > 0) {
      for (const idx of indexes) {
        statements.push(this.alterIndexToSQL(tableName, idx));
      }
    }

    // 外键变更
    if (foreignKeys && foreignKeys.length > 0) {
      for (const fk of foreignKeys) {
        statements.push(this.alterForeignKeyToSQL(tableName, fk));
      }
    }

    // 表选项
    if (options) {
      const optSQL = this.alterTableOptionsToSQL(tableName, options);
      if (optSQL) statements.push(optSQL);
    }

    return statements.filter(s => s.trim()).join(';\n');
  }

  /**
   * 执行 DDL
   */
  async executeDDL(connectionId: string, database: string, sql: string): Promise<DDLResult> {
    const mgr = getConnectionManager();
    const pool = mgr.getMySQLPool(connectionId);
    const conn = await pool.getConnection();

    try {
      logger.info(`Executing DDL on ${database}: ${sql.substring(0, 200)}...`);
      
      // 切换数据库（使用同一个连接），空数据库名或使用 mysql/information_schema 时跳过
      if (database && database !== 'mysql' && database !== 'information_schema') {
        try {
          await conn.query(`USE \`${database}\``);
        } catch {
          // 如果数据库不存在（如 CREATE DATABASE），忽略 USE 失败
        }
      }
      
      // 执行 DDL（支持多条语句）
      const statements = sql.split(';').filter(s => s.trim());
      let totalAffected = 0;

      for (const stmt of statements) {
        const [result] = await conn.query(stmt.trim());
        const affected = (result as any)?.affectedRows ?? 0;
        totalAffected += affected;
      }

      conn.release();
      return { success: true, sql, affectedRows: totalAffected };
    } catch (err: any) {
      conn.release();
      logger.error(`DDL execution failed: ${err.message}`);
      return { success: false, sql, error: err.message };
    }
  }

  /**
   * 从完整请求生成 SQL
   */
  generateSQL(request: TableDDLRequest): string {
    switch (request.operation) {
      case 'create':
        return this.generateCreateTable(
          request.tableName,
          request.columns || [],
          request.indexes,
          request.foreignKeys,
          request.options
        );
      case 'alter':
        return this.generateAlterTable(
          request.tableName,
          request.columns,
          request.indexes,
          request.foreignKeys,
          request.options
        );
      case 'rename':
        if (!request.newTableName) throw new Error('newTableName is required for rename');
        return `ALTER TABLE \`${request.tableName}\` RENAME TO \`${request.newTableName}\``;
      case 'drop':
        return `DROP TABLE IF EXISTS \`${request.tableName}\``;
      default:
        throw new Error(`Unknown operation: ${request.operation}`);
    }
  }

  // ========== 私有方法 ==========

  private columnDefinitionToSQL(col: ColumnDef): string {
    const parts: string[] = [`\`${col.name}\``];
    parts.push(col.unsigned ? `${col.dataType} UNSIGNED` : col.dataType);
    if (col.nullable === false) parts.push('NOT NULL');
    if (col.hasDefault && col.defaultValue !== undefined) {
      if (col.defaultValue === null) {
        parts.push('DEFAULT NULL');
      } else {
        // 特殊值不加引号
        const specialValues = ['CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP()', 'NOW()', 'UUID()', 'TRUE', 'FALSE'];
        if (specialValues.includes(String(col.defaultValue).toUpperCase())) {
          parts.push(`DEFAULT ${col.defaultValue}`);
        } else {
          parts.push(`DEFAULT '${col.defaultValue}'`);
        }
      }
    }
    if (col.autoIncrement) parts.push('AUTO_INCREMENT');
    if (col.comment) parts.push(`COMMENT '${col.comment}'`);
    return parts.join(' ');
  }

  private indexDefinitionToSQL(idx: IndexDef): string {
    const colList = idx.columns!.map(c => {
      let s = `\`${c.name}\``;
      if (c.length) s += `(${c.length})`;
      if (c.order === 'DESC') s += ' DESC';
      return s;
    }).join(', ');

    if (idx.type === 'PRIMARY') return `PRIMARY KEY (${colList})`;
    if (idx.type === 'UNIQUE') return `UNIQUE KEY \`${idx.name}\` (${colList})`;
    if (idx.type === 'FULLTEXT') return `FULLTEXT KEY \`${idx.name}\` (${colList})`;
    if (idx.type === 'SPATIAL') return `SPATIAL KEY \`${idx.name}\` (${colList})`;
    return `KEY \`${idx.name}\` (${colList})`;
  }

  private foreignKeyDefinitionToSQL(fk: ForeignKeyDef): string {
    const cols = fk.columns!.map(c => `\`${c}\``).join(', ');
    const refCols = fk.referencedColumns!.map(c => `\`${c}\``).join(', ');
    let sql = `CONSTRAINT \`${fk.name}\` FOREIGN KEY (${cols}) REFERENCES \`${fk.referencedTable}\` (${refCols})`;
    if (fk.onDelete) sql += ` ON DELETE ${fk.onDelete}`;
    if (fk.onUpdate) sql += ` ON UPDATE ${fk.onUpdate}`;
    return sql;
  }

  private alterColumnToSQL(tableName: string, col: ColumnDef): string {
    switch (col.operation) {
      case 'add': {
        const def = this.columnDefinitionToSQL(col);
        let sql = `ALTER TABLE \`${tableName}\` ADD COLUMN ${def}`;
        if (col.position === 'first') sql += ' FIRST';
        else if (col.afterColumn) sql += ` AFTER \`${col.afterColumn}\``;
        return sql;
      }
      case 'modify': {
        const def = this.columnDefinitionToSQL(col);
        return `ALTER TABLE \`${tableName}\` MODIFY COLUMN ${def}`;
      }
      case 'drop':
        return `ALTER TABLE \`${tableName}\` DROP COLUMN \`${col.name}\``;
      case 'rename':
        return `ALTER TABLE \`${tableName}\` RENAME COLUMN \`${col.name}\` TO \`${col.newName}\``;
      default:
        throw new Error(`Unknown column operation: ${col.operation}`);
    }
  }

  private alterIndexToSQL(tableName: string, idx: IndexDef): string {
    if (idx.operation === 'drop') {
      if (idx.type === 'PRIMARY') return `ALTER TABLE \`${tableName}\` DROP PRIMARY KEY`;
      return `ALTER TABLE \`${tableName}\` DROP INDEX \`${idx.name}\``;
    }
    // add
    const colList = idx.columns!.map(c => {
      let s = `\`${c.name}\``;
      if (c.length) s += `(${c.length})`;
      return s;
    }).join(', ');

    if (idx.type === 'PRIMARY') return `ALTER TABLE \`${tableName}\` ADD PRIMARY KEY (${colList})`;
    if (idx.type === 'UNIQUE') return `ALTER TABLE \`${tableName}\` ADD UNIQUE INDEX \`${idx.name}\` (${colList})`;
    return `ALTER TABLE \`${tableName}\` ADD INDEX \`${idx.name}\` (${colList})`;
  }

  private alterForeignKeyToSQL(tableName: string, fk: ForeignKeyDef): string {
    if (fk.operation === 'drop') {
      return `ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${fk.name}\``;
    }
    const cols = fk.columns!.map(c => `\`${c}\``).join(', ');
    const refCols = fk.referencedColumns!.map(c => `\`${c}\``).join(', ');
    let sql = `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (${cols}) REFERENCES \`${fk.referencedTable}\` (${refCols})`;
    if (fk.onDelete) sql += ` ON DELETE ${fk.onDelete}`;
    if (fk.onUpdate) sql += ` ON UPDATE ${fk.onUpdate}`;
    return sql;
  }

  private tableOptionsToSQL(options?: TableOptionsDef): string {
    if (!options) return '';
    const parts: string[] = [];
    if (options.engine) parts.push(`ENGINE=${options.engine}`);
    if (options.charset) parts.push(`DEFAULT CHARSET=${options.charset}`);
    if (options.collation) parts.push(`COLLATE=${options.collation}`);
    if (options.comment) parts.push(`COMMENT='${options.comment}'`);
    if (options.autoIncrement !== undefined) parts.push(`AUTO_INCREMENT=${options.autoIncrement}`);
    return parts.join(' ');
  }

  private alterTableOptionsToSQL(tableName: string, options: TableOptionsDef): string {
    const parts: string[] = [];
    if (options.engine) parts.push(`ENGINE=${options.engine}`);
    if (options.charset) parts.push(`DEFAULT CHARSET=${options.charset}`);
    if (options.collation) parts.push(`COLLATE=${options.collation}`);
    if (options.comment !== undefined) parts.push(`COMMENT='${options.comment}'`);
    if (options.autoIncrement !== undefined) parts.push(`AUTO_INCREMENT=${options.autoIncrement}`);
    if (parts.length === 0) return '';
    return `ALTER TABLE \`${tableName}\` ${parts.join(' ')}`;
  }
}

// 单例
let ddlInstance: DDLService | null = null;
export function getDDLService(): DDLService {
  if (!ddlInstance) {
    ddlInstance = new DDLService();
  }
  return ddlInstance;
}
