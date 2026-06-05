/**
 * 数据导出路由
 */

import { Router } from 'express';
import { getExportService } from '../services/exportService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/export - 导出表数据
 * Body: { connectionId, database, format, tables, options? }
 */
router.post('/', async (req, res) => {
  try {
    const { connectionId, database, format, tables, options } = req.body;

    if (!connectionId || !database || !format || !tables || !Array.isArray(tables)) {
      return res.status(400).json({ error: 'Missing required fields: connectionId, database, format, tables' });
    }

    if (!['csv', 'json', 'sql'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Supported: csv, json, sql' });
    }

    const service = getExportService();
    const results = await service.exportTable(connectionId, database, {
      format,
      tables,
      includeStructure: options?.includeStructure ?? true,
      includeData: options?.includeData ?? true,
      includeHeaders: options?.includeHeaders ?? true,
      delimiter: options?.delimiter || ',',
      enclosure: options?.enclosure || '"',
      encoding: options?.encoding || 'utf-8',
      lineEnding: options?.lineEnding || '\n',
      insertMode: options?.insertMode || 'INSERT',
      batchSize: options?.batchSize || 100,
      maxRows: options?.maxRows,
      whereClause: options?.whereClause,
    });

    // 单表导出时直接返回数据
    if (results.length === 1) {
      const result = results[0];
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // 设置下载头
      if (req.query.download === '1') {
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        return res.send(result.data);
      }

      return res.json({
        success: true,
        format: result.format,
        table: result.table,
        rowCount: result.rowCount,
        data: result.data,
        filename: result.filename,
        contentType: result.contentType,
      });
    }

    // 多表导出返回数组
    const allSuccess = results.every(r => r.success);
    res.json({
      success: allSuccess,
      results: results.map(r => ({
        success: r.success,
        format: r.format,
        table: r.table,
        rowCount: r.rowCount,
        data: r.data,
        filename: r.filename,
        error: r.error,
      })),
    });
  } catch (err: any) {
    logger.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
