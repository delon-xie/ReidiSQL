import { Router } from 'express';
import { MetadataService } from '../services/metadataService.js';
import { logger } from '../utils/logger.js';

const router = Router();
const metadataService = new MetadataService();

// 获取数据库列表
router.get('/:connectionId/databases', async (req, res) => {
  try {
    const data = await metadataService.getDatabases(req.params.connectionId);
    res.json({ data });
  } catch (error: any) {
    logger.error(`getDatabases error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 获取表列表
router.get('/:connectionId/databases/:database/tables', async (req, res) => {
  try {
    const data = await metadataService.getTables(req.params.connectionId, req.params.database);
    res.json({ data });
  } catch (error: any) {
    logger.error(`getTables error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 获取列信息
router.get('/:connectionId/databases/:database/tables/:table/columns', async (req, res) => {
  try {
    const data = await metadataService.getColumns(
      req.params.connectionId,
      req.params.database,
      req.params.table
    );
    res.json({ data });
  } catch (error: any) {
    logger.error(`getColumns error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 获取索引
router.get('/:connectionId/databases/:database/tables/:table/indexes', async (req, res) => {
  try {
    const data = await metadataService.getIndexes(
      req.params.connectionId,
      req.params.database,
      req.params.table
    );
    res.json({ data });
  } catch (error: any) {
    logger.error(`getIndexes error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 获取外键
router.get('/:connectionId/databases/:database/tables/:table/foreign-keys', async (req, res) => {
  try {
    const data = await metadataService.getForeignKeys(
      req.params.connectionId,
      req.params.database,
      req.params.table
    );
    res.json({ data });
  } catch (error: any) {
    logger.error(`getForeignKeys error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 获取建表语句
router.get('/:connectionId/databases/:database/tables/:table/create-sql', async (req, res) => {
  try {
    const sql = await metadataService.getCreateSQL(
      req.params.connectionId,
      req.params.database,
      req.params.table
    );
    res.json({ data: { createSQL: sql } });
  } catch (error: any) {
    logger.error(`getCreateSQL error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 获取视图
router.get('/:connectionId/databases/:database/views', async (req, res) => {
  try {
    const data = await metadataService.getViews(req.params.connectionId, req.params.database);
    res.json({ data });
  } catch (error: any) {
    logger.error(`getViews error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 获取存储过程
router.get('/:connectionId/databases/:database/procedures', async (req, res) => {
  try {
    const data = await metadataService.getRoutines(req.params.connectionId, req.params.database, 'PROCEDURE');
    res.json({ data });
  } catch (error: any) {
    logger.error(`getProcedures error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 获取函数
router.get('/:connectionId/databases/:database/functions', async (req, res) => {
  try {
    const data = await metadataService.getRoutines(req.params.connectionId, req.params.database, 'FUNCTION');
    res.json({ data });
  } catch (error: any) {
    logger.error(`getFunctions error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 获取触发器
router.get('/:connectionId/databases/:database/triggers', async (req, res) => {
  try {
    const data = await metadataService.getTriggers(req.params.connectionId, req.params.database);
    res.json({ data });
  } catch (error: any) {
    logger.error(`getTriggers error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 获取事件
router.get('/:connectionId/databases/:database/events', async (req, res) => {
  try {
    const data = await metadataService.getEvents(req.params.connectionId, req.params.database);
    res.json({ data });
  } catch (error: any) {
    logger.error(`getEvents error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 获取服务器信息
router.get('/:connectionId/server-info', async (req, res) => {
  try {
    const data = await metadataService.getServerInfo(req.params.connectionId);
    res.json({ data });
  } catch (error: any) {
    logger.error(`getServerInfo error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 获取服务器变量
router.get('/:connectionId/variables', async (req, res) => {
  try {
    const filter = req.query.filter as string | undefined;
    const data = await metadataService.getVariables(req.params.connectionId, filter);
    res.json({ data });
  } catch (error: any) {
    logger.error(`getVariables error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 获取服务器进程
router.get('/:connectionId/processes', async (req, res) => {
  try {
    const data = await metadataService.getProcesses(req.params.connectionId);
    res.json({ data });
  } catch (error: any) {
    logger.error(`getProcesses error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export { router as metadataRoutes };
