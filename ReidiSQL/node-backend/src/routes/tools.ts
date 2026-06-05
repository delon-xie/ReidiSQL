/**
 * Tools 路由 — 表维护、文本搜索、数据库同步、批量编辑、数据生成
 */

import { Router } from 'express';
import {
  getToolsService, MaintenanceRequest, FindTextRequest,
  SyncAnalyzeRequest, BulkEditRequest, GenerateDataRequest,
} from '../services/toolsService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/tools/maintenance — 表维护
 */
router.post('/maintenance', async (req, res) => {
  try {
    const request: MaintenanceRequest = req.body;
    if (!request.connectionId || !request.database || !request.tables || !request.operation) {
      return res.status(400).json({ success: false, error: 'connectionId, database, tables, operation are required' });
    }

    const service = getToolsService();
    const results = await service.maintenance(request);
    res.json({ success: true, data: results });
  } catch (err: any) {
    logger.error(`Tools maintenance error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/tools/find — 文本搜索
 */
router.post('/find', async (req, res) => {
  try {
    const request: FindTextRequest = req.body;
    if (!request.connectionId || !request.database || !request.tables || !request.searchText) {
      return res.status(400).json({ success: false, error: 'connectionId, database, tables, searchText are required' });
    }

    const service = getToolsService();
    const results = await service.findText(request);
    res.json({ success: true, data: results });
  } catch (err: any) {
    logger.error(`Tools find error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/tools/sync/analyze — 数据库同步分析
 */
router.post('/sync/analyze', async (req, res) => {
  try {
    const request: SyncAnalyzeRequest = req.body;
    if (!request.connectionId || !request.sourceDb || !request.targetDb) {
      return res.status(400).json({ success: false, error: 'connectionId, sourceDb, targetDb are required' });
    }

    const service = getToolsService();
    const diffs = await service.syncAnalyze(request);
    res.json({ success: true, data: diffs });
  } catch (err: any) {
    logger.error(`Tools sync/analyze error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/tools/bulk-edit — 批量编辑表属性
 */
router.post('/bulk-edit', async (req, res) => {
  try {
    const request: BulkEditRequest = req.body;
    if (!request.connectionId || !request.database || !request.tables || !request.operation || !request.value) {
      return res.status(400).json({ success: false, error: 'connectionId, database, tables, operation, value are required' });
    }

    const service = getToolsService();
    const results = await service.bulkEdit(request);
    res.json({ success: true, data: results });
  } catch (err: any) {
    logger.error(`Tools bulk-edit error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/tools/generate-data — 生成测试数据
 */
router.post('/generate-data', async (req, res) => {
  try {
    const request: GenerateDataRequest = req.body;
    if (!request.connectionId || !request.database || !request.table || !request.rowCount) {
      return res.status(400).json({ success: false, error: 'connectionId, database, table, rowCount are required' });
    }

    const service = getToolsService();
    const result = await service.generateData(request);
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error(`Tools generate-data error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
