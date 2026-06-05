/**
 * Preferences 路由
 */

import { Router } from 'express';
import { getPreferencesService } from '../services/preferencesService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/preferences — 获取偏好设置
 */
router.get('/', (req, res) => {
  try {
    const service = getPreferencesService();
    const preferences = service.getPreferences();
    res.json({ success: true, data: preferences });
  } catch (err: any) {
    logger.error(`Preferences get error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/preferences — 更新偏好设置
 */
router.put('/', (req, res) => {
  try {
    const service = getPreferencesService();
    const preferences = service.updatePreferences(req.body);
    res.json({ success: true, data: preferences });
  } catch (err: any) {
    logger.error(`Preferences update error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
