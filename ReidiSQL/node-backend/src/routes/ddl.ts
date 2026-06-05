/**
 * DDL 路由
 */

import { Router } from 'express';
import { getDDLService } from '../services/ddlService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/ddl/execute - 执行任意 DDL
 */
router.post('/execute', async (req, res) => {
  try {
    const { connectionId, database, sql } = req.body;
    if (!connectionId || !database || !sql) {
      return res.status(400).json({ error: 'Missing required fields: connectionId, database, sql' });
    }

    const service = getDDLService();
    const result = await service.executeDDL(connectionId, database, sql);

    if (result.success) {
      res.json({ success: true, affectedRows: result.affectedRows, sql: result.sql });
    } else {
      res.status(400).json({ success: false, error: result.error, sql: result.sql });
    }
  } catch (err: any) {
    logger.error('DDL execute error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ddl/table - 从 TableDDLRequest 生成并执行
 */
router.post('/table', async (req, res) => {
  try {
    const { connectionId, database, operation, tableName, newTableName, columns, indexes, foreignKeys, options } = req.body;
    if (!connectionId || !database || !operation || !tableName) {
      return res.status(400).json({ error: 'Missing required fields: connectionId, database, operation, tableName' });
    }

    const service = getDDLService();
    const sql = service.generateSQL({
      connectionId,
      database,
      operation,
      tableName,
      newTableName,
      columns,
      indexes,
      foreignKeys,
      options,
    });

    logger.info(`Generated DDL for ${operation} ${tableName}: ${sql.substring(0, 200)}...`);

    const result = await service.executeDDL(connectionId, database, sql);

    if (result.success) {
      res.json({ success: true, sql, affectedRows: result.affectedRows });
    } else {
      res.status(400).json({ success: false, error: result.error, sql });
    }
  } catch (err: any) {
    logger.error('DDL table error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ddl/generate - 仅生成 SQL 不执行（预览）
 */
router.post('/generate', (req, res) => {
  try {
    const { operation, tableName, newTableName, columns, indexes, foreignKeys, options } = req.body;
    if (!operation || !tableName) {
      return res.status(400).json({ error: 'Missing required fields: operation, tableName' });
    }

    const service = getDDLService();
    const sql = service.generateSQL({
      connectionId: '',
      database: '',
      operation,
      tableName,
      newTableName,
      columns,
      indexes,
      foreignKeys,
      options,
    });

    res.json({ sql });
  } catch (err: any) {
    logger.error('DDL generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
