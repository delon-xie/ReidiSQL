/**
 * 元数据服务
 * 从真实数据库连接获取 schema 元数据
 */

import { getConnectionManager } from './connectionService.js';
import { logger } from '../utils/logger.js';

export class MetadataService {
  /** 获取数据库列表（带大小） */
  async getDatabases(connectionId: string): Promise<any[]> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);
    const [rows] = await pool.query(
      `SELECT
        s.schema_name AS name,
        s.default_character_set_name AS charset,
        s.default_collation_name AS collation,
        COALESCE(SUM(t.data_length + t.index_length), 0) AS size
      FROM information_schema.schemata s
      LEFT JOIN information_schema.tables t ON t.table_schema = s.schema_name
      GROUP BY s.schema_name, s.default_character_set_name, s.default_collation_name
      ORDER BY s.schema_name`
    );
    return rows as any[];
  }

  /** 获取表列表 */
  async getTables(connectionId: string, database: string): Promise<any[]> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);
    const [rows] = await pool.query(
      `SELECT
        table_name AS name,
        engine,
        table_rows AS rowCount,
        data_length + index_length AS size,
        auto_increment,
        table_collation AS collation,
        create_time,
        update_time,
        table_comment AS comment
      FROM information_schema.tables
      WHERE table_schema = ? AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
      [database]
    );
    return rows as any[];
  }

  /** 获取列信息 */
  async getColumns(connectionId: string, database: string, table: string): Promise<any[]> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);
    const [rows] = await pool.query(
      `SELECT
        ordinal_position AS position,
        column_name AS name,
        column_type AS fullType,
        data_type AS type,
        character_maximum_length AS length,
        numeric_precision AS precision,
        numeric_scale AS scale,
        is_nullable = 'YES' AS nullable,
        column_default AS default_value,
        extra LIKE '%auto_increment%' AS autoIncrement,
        column_key AS keyType,
        extra,
        column_comment AS comment,
        collation_name AS collation
      FROM information_schema.columns
      WHERE table_schema = ? AND table_name = ?
      ORDER BY ordinal_position`,
      [database, table]
    );
    return rows as any[];
  }

  /** 获取索引 */
  async getIndexes(connectionId: string, database: string, table: string): Promise<any[]> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);
    const [rows] = await pool.query(
      `SELECT
        index_name AS name,
        non_unique = 0 AS unique,
        index_type AS type,
        GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns,
        GROUP_CONCAT(CASE collation WHEN 'A' THEN 'ASC' WHEN 'D' THEN 'DESC' END ORDER BY seq_in_index) AS directions,
        nullable,
        comment
      FROM information_schema.statistics
      WHERE table_schema = ? AND table_name = ?
      GROUP BY index_name, non_unique, index_type, nullable, comment
      ORDER BY index_name`,
      [database, table]
    );
    return rows as any[];
  }

  /** 获取外键 */
  async getForeignKeys(connectionId: string, database: string, table: string): Promise<any[]> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);
    const [rows] = await pool.query(
      `SELECT
        kcu.constraint_name AS name,
        GROUP_CONCAT(kcu.column_name ORDER BY kcu.ordinal_position) AS columns,
        kcu.referenced_table_schema AS refDatabase,
        kcu.referenced_table_name AS refTable,
        GROUP_CONCAT(kcu.referenced_column_name ORDER BY kcu.ordinal_position) AS refColumns,
        rc.update_rule AS onUpdate,
        rc.delete_rule AS onDelete
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = kcu.constraint_name
        AND rc.constraint_schema = kcu.table_schema
      WHERE kcu.table_schema = ? AND kcu.table_name = ?
        AND kcu.referenced_table_name IS NOT NULL
      GROUP BY kcu.constraint_name, kcu.referenced_table_schema,
        kcu.referenced_table_name, rc.update_rule, rc.delete_rule`,
      [database, table]
    );
    return rows as any[];
  }

  /** 获取建表语句 */
  async getCreateSQL(connectionId: string, database: string, table: string): Promise<string> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);
    const [rows] = await pool.query(`SHOW CREATE TABLE \`${database}\`.\`${table}\``);
    const row = (rows as any)[0];
    return row['Create Table'] || row['Create View'] || '';
  }

  /** 获取视图 */
  async getViews(connectionId: string, database: string): Promise<any[]> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);
    const [rows] = await pool.query(
      `SELECT
        table_name AS name,
        view_definition AS definition,
        check_option AS checkOption,
        is_updatable AS isUpdatable
      FROM information_schema.views
      WHERE table_schema = ?
      ORDER BY table_name`,
      [database]
    );
    return rows as any[];
  }

  /** 获取存储过程和函数 */
  async getRoutines(connectionId: string, database: string, type: 'PROCEDURE' | 'FUNCTION'): Promise<any[]> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);
    const [rows] = await pool.query(
      `SELECT
        routine_name AS name,
        routine_type AS type,
        dtd_reference AS returns,
        data_access AS dataAccess,
        is_deterministic = 'YES' AS deterministic,
        security_type AS security,
        routine_comment AS comment,
        routine_definition AS definition,
        character_set_client,
        collation_connection
      FROM information_schema.routines
      WHERE routine_schema = ? AND routine_type = ?
      ORDER BY routine_name`,
      [database, type]
    );

    // 获取参数
    for (const routine of (rows as any[])) {
      const [params] = await pool.query(
        `SELECT
          ordinal_position AS position,
          parameter_name AS name,
          parameter_mode AS mode,
          data_type AS type
        FROM information_schema.parameters
        WHERE specific_schema = ? AND specific_name = ?
        ORDER BY ordinal_position`,
        [database, routine.name]
      );
      routine.params = params;
    }

    return rows as any[];
  }

  /** 获取触发器 */
  async getTriggers(connectionId: string, database: string): Promise<any[]> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);
    const [rows] = await pool.query(
      `SELECT
        trigger_name AS name,
        event_manipulation AS event,
        event_object_table AS table,
        action_timing AS timing,
        action_statement AS statement,
        action_orientation AS orientation,
        definer,
        created
      FROM information_schema.triggers
      WHERE trigger_schema = ?
      ORDER BY trigger_name`,
      [database]
    );
    return rows as any[];
  }

  /** 获取事件 */
  async getEvents(connectionId: string, database: string): Promise<any[]> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);
    const [rows] = await pool.query(
      `SELECT
        event_name AS name,
        event_type AS type,
        execute_at,
        interval_value,
        interval_field,
        status,
        event_definition AS definition,
        definer,
        created,
        last_altered
      FROM information_schema.events
      WHERE event_schema = ?
      ORDER BY event_name`,
      [database]
    );
    return rows as any[];
  }

  /** 获取服务器信息 */
  async getServerInfo(connectionId: string): Promise<any> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);

    const [versionRows] = await pool.query('SELECT VERSION() as version');
    const [charsetRows] = await pool.query("SHOW VARIABLES LIKE 'character_set_server'");
    const [collationRows] = await pool.query("SHOW VARIABLES LIKE 'collation_server'");
    const [uptimeRows] = await pool.query("SHOW GLOBAL STATUS LIKE 'Uptime'");

    return {
      version: (versionRows as any)[0]?.version,
      charset: (charsetRows as any)[0]?.Value,
      collation: (collationRows as any)[0]?.Value,
      uptime: parseInt((uptimeRows as any)[0]?.Value || '0'),
    };
  }

  /** 获取服务器变量 */
  async getVariables(connectionId: string, filter?: string): Promise<any[]> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);
    let sql = 'SHOW GLOBAL VARIABLES';
    const params: string[] = [];
    if (filter) {
      sql += ' WHERE variable_name LIKE ?';
      params.push(`%${filter}%`);
    }
    const [rows] = await pool.query(sql, params);
    return (rows as any[]).map(r => ({ name: r.Variable_name, value: r.Value }));
  }

  /** 获取服务器进程 */
  async getProcesses(connectionId: string): Promise<any[]> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);
    const [rows] = await pool.query('SHOW FULL PROCESSLIST');
    return rows as any[];
  }
}
