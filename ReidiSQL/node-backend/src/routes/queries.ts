import { Router } from 'express';
import { QueryService } from '../services/queryService.js';
import { logger } from '../utils/logger.js';

const router = Router();
const queryService = new QueryService();

// 执行查询
router.post('/execute', async (req, res) => {
  try {
    const { connectionId, query, params, options } = req.body;
    if (!connectionId || !query) {
      return res.status(400).json({ error: 'connectionId and query are required' });
    }
    const result = await queryService.executeQuery(connectionId, query, params, options);
    logger.info(`Query executed: ${result.rowCount} rows in ${result.duration}ms`);
    res.json({ data: result });
  } catch (error: any) {
    logger.error(`Query error: ${error.message}`);
    res.status(400).json({ error: error.message });
  }
});

// 获取查询历史
router.get('/history', (req, res) => {
  const { connectionId, limit } = req.query;
  const history = queryService.getHistory(
    connectionId as string | undefined,
    parseInt(limit as string) || 50
  );
  res.json({ data: history });
});

export { router as queryRoutes };
