import { Router, Request, Response } from 'express';
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

// 流式查询（NDJSON 格式）
router.post('/stream', async (req: Request, res: Response) => {
  const { connectionId, query, batchSize } = req.body;
  if (!connectionId || !query) {
    return res.status(400).json({ error: 'connectionId and query are required' });
  }

  // 设置 NDJSON 响应头
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.flushHeaders();

  let aborted = false;
  req.on('close', () => { aborted = true; });

  try {
    await queryService.executeQueryStream(
      connectionId,
      query,
      batchSize || 100,
      (event) => {
        if (aborted) return false;
        res.write(JSON.stringify(event) + '\n');
        return true;
      },
    );
    res.end();
  } catch (error: any) {
    logger.error(`Stream query error: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(JSON.stringify({ type: 'error', error: error.message }) + '\n');
      res.end();
    }
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
