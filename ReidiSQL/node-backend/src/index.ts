import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { connectionRoutes } from './routes/connections.js';
import { queryRoutes } from './routes/queries.js';
import { metadataRoutes } from './routes/metadata.js';
import ddlRoutes from './routes/ddl.js';
import dataRoutes from './routes/data.js';
import exportRoutes from './routes/export.js';
import importRoutes from './routes/import.js';
import objectsRoutes from './routes/objects.js';
import adminRoutes from './routes/admin.js';
import preferencesRoutes from './routes/preferences.js';
import toolsRoutes from './routes/tools.js';
import updateRoutes from './routes/update.js';
import serverRoutes from './routes/server.js';
import { logger } from './utils/logger.js';
import { getConnectionManager } from './services/connectionService.js';

dotenv.config();

const app = express();
// 端口：优先读取 Tauri 传入的 REIDISQL_PORT，否则使用 PORT 或默认 3001
const PORT = parseInt(process.env.REIDISQL_PORT || process.env.PORT || '3001', 10);
// Token：Tauri 启动时生成并传入；开发模式下可不设置（跳过认证）
const AUTH_TOKEN = process.env.REIDISQL_TOKEN || process.env.AUTH_TOKEN || '';

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Token 认证中间件（仅当 AUTH_TOKEN 存在时启用）
if (AUTH_TOKEN) {
  app.use((req, res, next) => {
    // 健康检查豁免
    if (req.path === '/api/health') return next();
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${AUTH_TOKEN}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });
  logger.info('Token authentication enabled');
} else {
  logger.warn('No AUTH_TOKEN set — running without authentication (dev mode)');
}

// 请求日志
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// 路由（注意：静态路由要在参数路由前面）
app.use('/api/connections', connectionRoutes);
app.use('/api/queries', queryRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/ddl', ddlRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/objects', objectsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/update', updateRoutes);
app.use('/api/server', serverRoutes);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '0.6.0-sprint6',
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
  logger.info(`ReidiSQL Backend v0.6.0-sprint6`);
  logger.info(`HTTP  : http://localhost:${PORT}/api`);
  logger.info(`WS    : ws://localhost:${PORT}/ws`);
  logger.info(`Health: http://localhost:${PORT}/api/health`);
  if (AUTH_TOKEN) logger.info(`Auth  : Bearer Token required`);
  
  // 输出 READY 信号供 Tauri 主进程解析（格式：READY:{"port":N,"token":"xxx"}）
  // 使用 process.stdout.write 避免 winston 格式干扰
  process.stdout.write(`READY:${JSON.stringify({ port: PORT, token: AUTH_TOKEN || null })}\n`);
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
