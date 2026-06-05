/**
 * 服务器管理路由 (Sprint 5)
 */

import { Router } from 'express';
import { MetadataService } from '../services/metadataService.js';
import { logger } from '../utils/logger.js';

const router = Router();
const metadataService = new MetadataService();

// GET /api/server/:connectionId/info — 服务器信息 + 统计
router.get('/:connectionId/info', async (req, res) => {
  try {
    const data = await metadataService.getServerInfo(req.params.connectionId);
    res.json({ data });
  } catch (error: any) {
    logger.error(`getServerInfo error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/server/:connectionId/variables — 变量列表
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

// PUT /api/server/:connectionId/variables/:name — SET 变量
router.put('/:connectionId/variables/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { value } = req.body;
    if (value === undefined) {
      res.status(400).json({ error: 'value is required' });
      return;
    }
    await metadataService.setVariable(req.params.connectionId, name, String(value));
    res.json({ success: true });
  } catch (error: any) {
    logger.error(`setVariable error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/server/:connectionId/processes — 进程列表
router.get('/:connectionId/processes', async (req, res) => {
  try {
    const data = await metadataService.getProcesses(req.params.connectionId);
    res.json({ data });
  } catch (error: any) {
    logger.error(`getProcesses error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/server/:connectionId/processes/:pid/kill — KILL 进程
router.post('/:connectionId/processes/:pid/kill', async (req, res) => {
  try {
    const pid = parseInt(req.params.pid, 10);
    if (isNaN(pid)) {
      res.status(400).json({ error: 'Invalid pid' });
      return;
    }
    await metadataService.killProcess(req.params.connectionId, pid);
    res.json({ success: true });
  } catch (error: any) {
    logger.error(`killProcess error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;
