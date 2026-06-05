/**
 * Admin 路由 — MySQL 用户管理
 */

import { Router } from 'express';
import { getAdminService, CreateUserRequest, ModifyPrivilegesRequest } from '../services/adminService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/admin/:connectionId/users — 用户列表
 */
router.get('/:connectionId/users', async (req, res) => {
  try {
    const service = getAdminService();
    const users = await service.getUsers(req.params.connectionId);
    res.json({ success: true, data: users });
  } catch (err: any) {
    logger.error(`Admin getUsers error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/admin/:connectionId/users — 创建用户
 */
router.post('/:connectionId/users', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const request: CreateUserRequest = req.body;

    if (!request.username || !request.host) {
      return res.status(400).json({ success: false, error: 'username and host are required' });
    }

    const service = getAdminService();
    const result = await service.createUser(connectionId, request);
    res.json(result);
  } catch (err: any) {
    logger.error(`Admin createUser error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/admin/:connectionId/users/:user — 修改用户
 * user 格式: username@host 或 username (默认 host=%)
 */
router.put('/:connectionId/users/:user', async (req, res) => {
  try {
    const { connectionId, user } = req.params;
    const [username, host] = user.includes('@') ? user.split('@') : [user, '%'];

    const service = getAdminService();
    const result = await service.modifyUser(connectionId, username, host, req.body);
    res.json(result);
  } catch (err: any) {
    logger.error(`Admin modifyUser error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/admin/:connectionId/users/:user — 删除用户
 */
router.delete('/:connectionId/users/:user', async (req, res) => {
  try {
    const { connectionId, user } = req.params;
    const [username, host] = user.includes('@') ? user.split('@') : [user, '%'];

    const service = getAdminService();
    const result = await service.dropUser(connectionId, username, host);
    res.json(result);
  } catch (err: any) {
    logger.error(`Admin dropUser error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/:connectionId/users/:user/privileges — 获取权限
 */
router.get('/:connectionId/users/:user/privileges', async (req, res) => {
  try {
    const { connectionId, user } = req.params;
    const [username, host] = user.includes('@') ? user.split('@') : [user, '%'];

    const service = getAdminService();
    const privileges = await service.getUserPrivileges(connectionId, username, host);
    res.json({ success: true, data: privileges });
  } catch (err: any) {
    logger.error(`Admin getPrivileges error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/admin/:connectionId/users/:user/privileges — 修改权限
 */
router.put('/:connectionId/users/:user/privileges', async (req, res) => {
  try {
    const { connectionId, user } = req.params;
    const [username, host] = user.includes('@') ? user.split('@') : [user, '%'];

    const request: ModifyPrivilegesRequest = req.body;
    const service = getAdminService();
    const result = await service.modifyPrivileges(connectionId, username, host, request);
    res.json(result);
  } catch (err: any) {
    logger.error(`Admin modifyPrivileges error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
