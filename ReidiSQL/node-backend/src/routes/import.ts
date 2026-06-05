/**
 * CSV 导入路由
 */

import { Router } from 'express';
import { getImportService } from '../services/importService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/import/detect — 格式检测
 * Body: { content, options? }
 */
router.post('/detect', (req, res) => {
  try {
    const { content, options } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Missing required field: content' });
    }

    const service = getImportService();
    const result = service.detectFormat(content, options);
    res.json(result);
  } catch (err: any) {
    logger.error('Import detect error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/import/execute — 执行导入
 * Body: { connectionId, database, table, content, options }
 */
router.post('/execute', async (req, res) => {
  try {
    const { connectionId, database, table, content, options } = req.body;
    if (!connectionId || !database || !table || !content) {
      return res.status(400).json({ error: 'Missing required fields: connectionId, database, table, content' });
    }

    const service = getImportService();
    const result = await service.importCSV(connectionId, database, table, content, options || {});

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    logger.error('Import execute error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/import/copy — 表复制
 * Body: { connectionId, srcDb, srcTable, dstDb, dstTable, options }
 */
router.post('/copy', async (req, res) => {
  try {
    const { connectionId, srcDb, srcTable, dstDb, dstTable, options } = req.body;
    if (!connectionId || !srcDb || !srcTable || !dstDb || !dstTable) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const service = getImportService();
    const result = await service.copyTable(connectionId, srcDb, srcTable, dstDb, dstTable, options || {});

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    logger.error('Import copy error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
