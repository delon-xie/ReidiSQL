/**
 * 数据修改路由
 */

import { Router } from 'express';
import { getDataService } from '../services/dataService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/data/insert - 插入行
 */
router.post('/insert', async (req, res) => {
  try {
    const { connectionId, database, table, data } = req.body;
    if (!connectionId || !database || !table || !data) {
      return res.status(400).json({ error: 'Missing required fields: connectionId, database, table, data' });
    }

    const service = getDataService();
    const result = await service.insertRow(connectionId, database, table, data);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    logger.error('Data insert error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/data/update - 更新行
 */
router.put('/update', async (req, res) => {
  try {
    const { connectionId, database, table, data, where } = req.body;
    if (!connectionId || !database || !table || !data || !where) {
      return res.status(400).json({ error: 'Missing required fields: connectionId, database, table, data, where' });
    }

    const service = getDataService();
    const result = await service.updateRow(connectionId, database, table, data, where);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    logger.error('Data update error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/data/delete - 删除行
 */
router.delete('/delete', async (req, res) => {
  try {
    const { connectionId, database, table, where } = req.body;
    if (!connectionId || !database || !table || !where) {
      return res.status(400).json({ error: 'Missing required fields: connectionId, database, table, where' });
    }

    const service = getDataService();
    const result = await service.deleteRow(connectionId, database, table, where);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    logger.error('Data delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/data/batch - 批量操作（事务）
 */
router.post('/batch', async (req, res) => {
  try {
    const { connectionId, database, table, operations } = req.body;
    if (!connectionId || !database || !table || !operations || !Array.isArray(operations)) {
      return res.status(400).json({ error: 'Missing required fields: connectionId, database, table, operations' });
    }

    const service = getDataService();
    const result = await service.batchModify(connectionId, database, table, operations);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    logger.error('Data batch error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
