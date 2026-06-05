/**
 * 数据库对象路由 — 视图/存储过程/函数/触发器
 */

import { Router } from 'express';
import { getObjectDDLService, ViewRequest, RoutineRequest, TriggerRequest } from '../services/objectDDLService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/objects/view — 创建/修改视图
 */
router.post('/view', async (req, res) => {
  try {
    const request: ViewRequest = req.body;
    if (!request.connectionId || !request.database || !request.name || !request.definition) {
      return res.status(400).json({ error: 'Missing required fields: connectionId, database, name, definition' });
    }

    const service = getObjectDDLService();
    const result = await service.manageView(request);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    logger.error('View route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/objects/routine — 创建/修改存储过程或函数
 */
router.post('/routine', async (req, res) => {
  try {
    const request: RoutineRequest = req.body;
    if (!request.connectionId || !request.database || !request.name || !request.body) {
      return res.status(400).json({ error: 'Missing required fields: connectionId, database, name, body' });
    }

    const service = getObjectDDLService();
    const result = await service.manageRoutine(request);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    logger.error('Routine route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/objects/trigger — 创建/修改触发器
 */
router.post('/trigger', async (req, res) => {
  try {
    const request: TriggerRequest = req.body;
    if (!request.connectionId || !request.database || !request.name || !request.body || !request.table) {
      return res.status(400).json({ error: 'Missing required fields: connectionId, database, name, table, body' });
    }

    const service = getObjectDDLService();
    const result = await service.manageTrigger(request);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    logger.error('Trigger route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/objects/:type/:name — 删除对象
 */
router.delete('/:type/:name', async (req, res) => {
  try {
    const { type, name } = req.params;
    const { connectionId, database } = req.body;

    if (!connectionId || !database) {
      return res.status(400).json({ error: 'Missing required fields: connectionId, database' });
    }

    const validTypes = ['VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER'];
    const upperType = type.toUpperCase();
    if (!validTypes.includes(upperType)) {
      return res.status(400).json({ error: `Invalid type: ${type}` });
    }

    const service = getObjectDDLService();
    const result = await service.dropObject(connectionId, database, upperType as any, name);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    logger.error('Delete object error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/objects/:type/:name/code — 获取对象定义
 */
router.get('/:type/:name/code', async (req, res) => {
  try {
    const { type, name } = req.params;
    const { connectionId, database } = req.query;

    if (!connectionId || !database) {
      return res.status(400).json({ error: 'Missing required query params: connectionId, database' });
    }

    const validTypes = ['VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER'];
    const upperType = type.toUpperCase();
    if (!validTypes.includes(upperType)) {
      return res.status(400).json({ error: `Invalid type: ${type}` });
    }

    const service = getObjectDDLService();
    const result = await service.getObjectCode(connectionId as string, database as string, upperType as any, name);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    logger.error('Get object code error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
