import { Router } from 'express';
import { getConnectionManager, ConnectionInfo } from '../services/connectionService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// 测试连接（不保存配置，仅测试）— 必须在 /:id 路由前面
router.post('/test', async (req, res) => {
  try {
    const connManager = getConnectionManager();
    const result = await connManager.testConnection(req.body);
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 获取所有连接（含状态）
router.get('/', (req, res) => {
  const connManager = getConnectionManager();
  const connections = connManager.getAllConnections();
  res.json({ data: connections });
});

// 获取单个连接
router.get('/:id', (req, res) => {
  const connManager = getConnectionManager();
  const connections = connManager.getAllConnections();
  const conn = connections.find(c => c.id === req.params.id);
  if (!conn) return res.status(404).json({ error: 'Connection not found' });
  res.json({ data: conn });
});

// 创建连接
router.post('/', (req, res) => {
  try {
    const connManager = getConnectionManager();
    const created = connManager.createConnection(req.body);
    logger.info(`Created connection: ${created.name}`);
    res.json({ data: created });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 更新连接
router.put('/:id', (req, res) => {
  try {
    const connManager = getConnectionManager();
    const updated = connManager.updateConnection(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Connection not found' });
    res.json({ data: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 删除连接
router.delete('/:id', (req, res) => {
  try {
    const connManager = getConnectionManager();
    const deleted = connManager.deleteConnection(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Connection not found' });
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 连接（建立数据库连接）
router.post('/:id/connect', async (req, res) => {
  try {
    const connManager = getConnectionManager();
    const result = await connManager.connect(req.params.id);
    logger.info(`Connected: ${req.params.id}, version=${result.serverVersion}`);
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 断开连接
router.post('/:id/disconnect', async (req, res) => {
  try {
    const connManager = getConnectionManager();
    await connManager.disconnect(req.params.id);
    res.json({ message: 'Disconnected' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 获取连接状态
router.get('/:id/status', (req, res) => {
  const connManager = getConnectionManager();
  const status = connManager.getStatus(req.params.id);
  res.json({ data: status });
});

export { router as connectionRoutes };
