/**
 * 数据库对象 DDL 服务 — 视图/存储过程/函数/触发器 的 CRUD
 */

import { getConnectionManager } from './connectionService.js';
import { logger } from '../utils/logger.js';

/** 视图请求 */
export interface ViewRequest {
  connectionId: string;
  database: string;
  name: string;
  definition: string;   // SELECT 语句
  operation: 'create' | 'alter';
}

/** 存储过程/函数请求 */
export interface RoutineRequest {
  connectionId: string;
  database: string;
  name: string;
  type: 'PROCEDURE' | 'FUNCTION';
  params?: Array<{ name: string; dataType: string; direction?: 'IN' | 'OUT' | 'INOUT' }>;
  returns?: string;       // 仅 FUNCTION
  body: string;           // BEGIN ... END
  options?: {
    dataAccess?: 'CONTAINS SQL' | 'NO SQL' | 'READS SQL DATA' | 'MODIFIES SQL DATA';
    securityType?: 'DEFINER' | 'INVOKER';
    deterministic?: boolean;
    comment?: string;
  };
  operation: 'create' | 'alter';
}

/** 触发器请求 */
export interface TriggerRequest {
  connectionId: string;
  database: string;
  name: string;
  timing: 'BEFORE' | 'AFTER';
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  body: string;           // BEGIN ... END 或单条语句
  operation: 'create' | 'alter';
}

/** DDL 结果 */
export interface ObjectDDLResult {
  success: boolean;
  sql: string;
  error?: string;
}

export class ObjectDDLService {
  /**
   * 创建/修改视图
   */
  async manageView(req: ViewRequest): Promise<ObjectDDLResult> {
    const mgr = getConnectionManager();
    const pool = mgr.getMySQLPool(req.connectionId);
    const conn = await pool.getConnection();

    try {
      await conn.query(`USE \`${req.database}\``);

      const keyword = req.operation === 'alter' ? 'ALTER' : 'CREATE';
      const sql = `${keyword} VIEW \`${req.name}\` AS ${req.definition}`;

      logger.info(`${keyword} VIEW ${req.database}.${req.name}`);
      await conn.query(sql);
      conn.release();

      return { success: true, sql };
    } catch (err: any) {
      conn.release();
      logger.error(`View DDL failed: ${err.message}`);
      return { success: false, sql: '', error: err.message };
    }
  }

  /**
   * 创建/修改存储过程或函数
   */
  async manageRoutine(req: RoutineRequest): Promise<ObjectDDLResult> {
    const mgr = getConnectionManager();
    const pool = mgr.getMySQLPool(req.connectionId);
    const conn = await pool.getConnection();

    try {
      await conn.query(`USE \`${req.database}\``);

      // 构建参数列表
      const paramStr = (req.params || []).map(p => {
        const dir = p.direction && req.type === 'PROCEDURE' ? `${p.direction} ` : '';
        return `${dir}\`${p.name}\` ${p.dataType}`;
      }).join(', ');

      // 构建 RETURNS（仅 FUNCTION）
      const returnsStr = req.type === 'FUNCTION' && req.returns ? ` RETURNS ${req.returns}` : '';

      // 构建选项
      const options: string[] = [];
      if (req.options?.dataAccess) options.push(req.options.dataAccess);
      if (req.options?.securityType) options.push(`SQL SECURITY ${req.options.securityType}`);
      if (req.options?.deterministic) options.push('DETERMINISTIC');
      if (req.options?.comment) options.push(`COMMENT '${req.options.comment}'`);
      const optionsStr = options.length > 0 ? options.join(' ') + ' ' : '';

      const keyword = req.operation === 'alter' ? '' : 'CREATE';
      const dropFirst = req.operation === 'alter';

      let sql = '';

      if (dropFirst) {
        // ALTER = DROP + CREATE
        await conn.query(`DROP ${req.type} IF EXISTS \`${req.name}\``);
      }

      sql = `${keyword} ${req.type} \`${req.name}\`(${paramStr})${returnsStr} ${optionsStr}${req.body}`.trim();

      logger.info(`Creating ${req.type} ${req.database}.${req.name}`);
      await conn.query(sql);
      conn.release();

      return { success: true, sql };
    } catch (err: any) {
      conn.release();
      logger.error(`Routine DDL failed: ${err.message}`);
      return { success: false, sql: '', error: err.message };
    }
  }

  /**
   * 创建/修改触发器
   */
  async manageTrigger(req: TriggerRequest): Promise<ObjectDDLResult> {
    const mgr = getConnectionManager();
    const pool = mgr.getMySQLPool(req.connectionId);
    const conn = await pool.getConnection();

    try {
      await conn.query(`USE \`${req.database}\``);

      let sql = '';

      if (req.operation === 'alter') {
        await conn.query(`DROP TRIGGER IF EXISTS \`${req.name}\``);
      }

      sql = `CREATE TRIGGER \`${req.name}\` ${req.timing} ${req.event} ON \`${req.table}\` FOR EACH ROW ${req.body}`;

      logger.info(`Creating trigger ${req.database}.${req.name}`);
      await conn.query(sql);
      conn.release();

      return { success: true, sql };
    } catch (err: any) {
      conn.release();
      logger.error(`Trigger DDL failed: ${err.message}`);
      return { success: false, sql: '', error: err.message };
    }
  }

  /**
   * 删除对象
   */
  async dropObject(
    connectionId: string,
    database: string,
    type: 'VIEW' | 'PROCEDURE' | 'FUNCTION' | 'TRIGGER',
    name: string
  ): Promise<ObjectDDLResult> {
    const mgr = getConnectionManager();
    const pool = mgr.getMySQLPool(connectionId);
    const conn = await pool.getConnection();

    try {
      await conn.query(`USE \`${database}\``);
      const sql = `DROP ${type} IF EXISTS \`${name}\``;
      await conn.query(sql);
      conn.release();

      logger.info(`Dropped ${type} ${database}.${name}`);
      return { success: true, sql };
    } catch (err: any) {
      conn.release();
      logger.error(`Drop ${type} failed: ${err.message}`);
      return { success: false, sql: '', error: err.message };
    }
  }

  /**
   * 获取对象定义代码
   */
  async getObjectCode(
    connectionId: string,
    database: string,
    type: 'VIEW' | 'PROCEDURE' | 'FUNCTION' | 'TRIGGER',
    name: string
  ): Promise<{ success: boolean; code: string; error?: string }> {
    const mgr = getConnectionManager();
    const pool = mgr.getMySQLPool(connectionId);
    const conn = await pool.getConnection();

    try {
      await conn.query(`USE \`${database}\``);

      let sql: string;
      let codeKey: string;

      switch (type) {
        case 'VIEW':
          sql = `SHOW CREATE VIEW \`${name}\``;
          codeKey = 'Create View';
          break;
        case 'PROCEDURE':
          sql = `SHOW CREATE PROCEDURE \`${name}\``;
          codeKey = 'Create Procedure';
          break;
        case 'FUNCTION':
          sql = `SHOW CREATE FUNCTION \`${name}\``;
          codeKey = 'Create Function';
          break;
        case 'TRIGGER':
          sql = `SHOW CREATE TRIGGER \`${name}\``;
          codeKey = 'SQL Original Statement';
          break;
        default:
          throw new Error(`Unknown type: ${type}`);
      }

      const [result] = await conn.query(sql);
      const row = (result as any[])[0];
      conn.release();

      return { success: true, code: row?.[codeKey] || '' };
    } catch (err: any) {
      conn.release();
      logger.error(`Get ${type} code failed: ${err.message}`);
      return { success: false, code: '', error: err.message };
    }
  }
}

let objectDDLInstance: ObjectDDLService | null = null;
export function getObjectDDLService(): ObjectDDLService {
  if (!objectDDLInstance) {
    objectDDLInstance = new ObjectDDLService();
  }
  return objectDDLInstance;
}
