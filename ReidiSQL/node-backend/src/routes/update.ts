/**
 * Update 路由 — 检查更新
 */

import { Router } from 'express';
import { logger } from '../utils/logger.js';

const router = Router();

/** 当前版本 */
const CURRENT_VERSION = '0.4.0-sprint4';

/** GitHub Releases API */
const GITHUB_API = 'https://api.github.com/repos/your-org/reidisql/releases/latest';

/**
 * GET /api/update/check — 检查更新
 */
router.get('/check', async (req, res) => {
  try {
    // 开发模式直接返回无更新
    if (process.env.NODE_ENV !== 'production') {
      return res.json({
        success: true,
        data: {
          currentVersion: CURRENT_VERSION,
          latestVersion: CURRENT_VERSION,
          hasUpdate: false,
          releaseUrl: null,
          releaseNotes: null,
        },
      });
    }

    // 生产模式：请求 GitHub API
    const response = await fetch(GITHUB_API, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ReidiSQL-UpdateChecker',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const release = await response.json() as { tag_name?: string; html_url?: string; body?: string };
    const latestVersion = release.tag_name?.replace(/^v/, '') || CURRENT_VERSION;

    // 简单版本比较
    const hasUpdate = compareVersions(latestVersion, CURRENT_VERSION) > 0;

    res.json({
      success: true,
      data: {
        currentVersion: CURRENT_VERSION,
        latestVersion,
        hasUpdate,
        releaseUrl: release.html_url || null,
        releaseNotes: release.body || null,
      },
    });
  } catch (err: any) {
    logger.warn(`Update check failed: ${err.message}`);
    // 即使检查失败也返回成功（不阻断应用）
    res.json({
      success: true,
      data: {
        currentVersion: CURRENT_VERSION,
        latestVersion: CURRENT_VERSION,
        hasUpdate: false,
        releaseUrl: null,
        releaseNotes: null,
        error: err.message,
      },
    });
  }
});

/**
 * 比较版本号（语义化版本）
 * 返回: 正数表示 a > b，负数表示 a < b，0 表示相等
 */
function compareVersions(a: string, b: string): number {
  const pa = a.replace(/-.*$/, '').split('.').map(Number);
  const pb = b.replace(/-.*$/, '').split('.').map(Number);

  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va !== vb) return va - vb;
  }

  // 如果主版本相同，检查 pre-release 标签
  const preA = a.includes('-') ? a.split('-')[1] : '';
  const preB = b.includes('-') ? b.split('-')[1] : '';
  if (!preA && preB) return 1;   // a 是正式版，b 是预发布版
  if (preA && !preB) return -1;  // a 是预发布版，b 是正式版
  return preA.localeCompare(preB);
}

export default router;
