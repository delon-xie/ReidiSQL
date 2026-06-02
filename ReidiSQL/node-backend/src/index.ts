import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { connectionRoutes } from './routes/connections.js';
import { queryRoutes } from './routes/queries.js';
import { metadataRoutes } from './routes/metadata.js';
import { logger } from './utils/logger.js';
import { getConnectionManager } from './services/connectionService.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// 路由（注意：静态路由要在参数路由前面）
app.use('/api/connections', connectionRoutes);
app.use('/api/queries', queryRoutes);
app.use('/api/metadata', metadataRoutes);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '0.1.0-sprint1',
  });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 全局错误处理
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(500).json({ error: 'Internal Server Error' });
});

// 创建 HTTP 服务器
const server = createServer(app);

// WebSocket 服务器（用于日志推送）
const wss = new WebSocketServer({ server, path: '/ws' });
const wsClients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  logger.info(`WebSocket client connected (total: ${wsClients.size})`);

  ws.on('close', () => {
    wsClients.delete(ws);
    logger.info(`WebSocket client disconnected (total: ${wsClients.size})`);
  });

  ws.on('error', (err) => {
    logger.error(`WebSocket error: ${err.message}`);
    wsClients.delete(ws);
  });

  // 发送欢迎消息
  ws.send(JSON.stringify({
    type: 'connected',
    timestamp: new Date().toISOString(),
    message: 'Welcome to ReidiSQL WebSocket',
  }));
});

/** 广播消息给所有 WebSocket 客户端 */
export function broadcast(event: string, data: any): void {
  const message = JSON.stringify({ type: event, data, timestamp: new Date().toISOString() });
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// 启动服务器
server.listen(PORT, () => {
  logger.info(`ReidiSQL Backend v0.1.0-sprint1`);
  logger.info(`HTTP  : http://localhost:${PORT}/api`);
  logger.info(`WS    : ws://localhost:${PORT}/ws`);
  logger.info(`Health: http://localhost:${PORT}/api/health`);
});

// 优雅关闭
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  const connManager = getConnectionManager();
  await connManager.shutdown();

  for (const client of wsClients) {
    client.close();
  }

  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down...');
  const connManager = getConnectionManager();
  await connManager.shutdown();
  process.exit(0);
});
