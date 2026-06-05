/**
 * 数据导出对话框
 */

import React, { useState, useCallback } from 'react';
import {
  Modal, Form, Select, Input, InputNumber, Switch, Space, Typography,
  message, Alert,
} from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { exportApi, type ExportFormat, type ExportOptions, type ExportResult } from '../lib/api';
import { useConnectionStore } from '../stores/connectionStore';

const { Text } = Typography;
const { TextArea } = Input;

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  tableName?: string;
}

const FORMAT_OPTIONS = [
  { label: 'CSV (逗号分隔)', value: 'csv' },
  { label: 'JSON', value: 'json' },
  { label: 'SQL (INSERT 语句)', value: 'sql' },
];

const INSERT_MODES = [
  { label: 'INSERT INTO', value: 'INSERT' },
  { label: 'REPLACE INTO', value: 'REPLACE' },
  { label: 'INSERT IGNORE', value: 'INSERT IGNORE' },
];

const ExportDialog: React.FC<ExportDialogProps> = ({ open, onClose, tableName }) => {
  const { activeConnectionId, activeDatabase } = useConnectionStore();

  const [format, setFormat] = useState<ExportFormat>('csv');
  const [tables, setTables] = useState<string[]>(tableName ? [tableName] : []);
  const [maxRows, setMaxRows] = useState<number | undefined>(undefined);
  const [whereClause, setWhereClause] = useState('');

  // CSV 选项
  const [delimiter, setDelimiter] = useState(',');
  const [includeHeaders, setIncludeHeaders] = useState(true);

  // SQL 选项
  const [includeStructure, setIncludeStructure] = useState(true);
  const [includeData, setIncludeData] = useState(true);
  const [insertMode, setInsertMode] = useState<'INSERT' | 'REPLACE' | 'INSERT IGNORE'>('INSERT');
  const [batchSize, setBatchSize] = useState(100);

  // 结果
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!activeConnectionId || !activeDatabase) {
      message.warning('请先连接数据库');
      return;
    }
    if (tables.length === 0) {
      message.warning('请指定表名');
      return;
    }

    setExporting(true);
    setExportResult(null);

    try {
      const options: ExportOptions = {
        includeStructure,
        includeData,
        includeHeaders,
        delimiter,
        insertMode,
        batchSize,
        maxRows,
        whereClause: whereClause || undefined,
      };

      const res = await exportApi.export(activeConnectionId, activeDatabase, format, tables, options);

      // 单表结果
      if ('format' in res) {
        setExportResult(res as ExportResult);
        message.success(`导出成功: ${res.rowCount} 行`);
      } else {
        // 多表
        const first = (res as any).results?.[0];
        setExportResult(first);
        message.success(`导出成功`);
      }
    } catch (err: any) {
      message.error(`导出失败: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }, [activeConnectionId, activeDatabase, format, tables, maxRows, whereClause, delimiter, includeHeaders, includeStructure, includeData, insertMode, batchSize]);

  // 下载
  const handleDownload = useCallback(() => {
    if (!exportResult?.data) return;

    const blob = new Blob([exportResult.data], { type: exportResult.contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportResult.filename;
    a.click();
    URL.revokeObjectURL(url);
    message.success('下载已开始');
  }, [exportResult]);

  // 关闭时重置
  const handleClose = useCallback(() => {
    setExportResult(null);
    onClose();
  }, [onClose]);

  return (
    <Modal
      title="导出数据"
      open={open}
      onCancel={handleClose}
      width={600}
      footer={
        exportResult ? (
          <Space>
            <span style={{ fontSize: 12, color: '#666' }}>
              {exportResult.rowCount} 行, {exportResult.data.length} 字符
            </span>
            <div style={{ flex: 1 }} />
            <button className="ant-btn" onClick={handleClose}>关闭</button>
            <button className="ant-btn ant-btn-primary" onClick={handleDownload}>
              <DownloadOutlined /> 下载文件
            </button>
          </Space>
        ) : (
          <Space>
            <button className="ant-btn" onClick={handleClose}>取消</button>
            <button
              className="ant-btn ant-btn-primary"
              onClick={handleExport}
              disabled={!activeConnectionId || tables.length === 0}
              style={{ opacity: exporting ? 0.6 : 1 }}
            >
              {exporting ? '导出中...' : '导出'}
            </button>
          </Space>
        )
      }
    >
      {!exportResult ? (
        <Form layout="vertical" size="small">
          <Form.Item label="导出格式">
            <Select
              value={format}
              onChange={(v) => setFormat(v)}
              options={FORMAT_OPTIONS}
            />
          </Form.Item>

          <Form.Item label="表名">
            <Input
              value={tables.join(', ')}
              onChange={(e) => setTables(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="表名（多个用逗号分隔）"
            />
          </Form.Item>

          <Form.Item label="行数限制（可选）">
            <InputNumber
              value={maxRows}
              onChange={(v) => setMaxRows(v ?? undefined)}
              min={1}
              style={{ width: '100%' }}
              placeholder="不限制"
            />
          </Form.Item>

          <Form.Item label="WHERE 条件（可选）">
            <Input
              value={whereClause}
              onChange={(e) => setWhereClause(e.target.value)}
              placeholder="例: status = 'active'"
            />
          </Form.Item>

          {format === 'csv' && (
            <>
              <Form.Item label="分隔符">
                <Select
                  value={delimiter}
                  onChange={(v) => setDelimiter(v)}
                  options={[
                    { label: '逗号 (,)', value: ',' },
                    { label: '制表符 (Tab)', value: '\t' },
                    { label: '分号 (;)', value: ';' },
                    { label: '竖线 (|)', value: '|' },
                  ]}
                />
              </Form.Item>
              <Form.Item label="包含表头">
                <Switch checked={includeHeaders} onChange={setIncludeHeaders} />
              </Form.Item>
            </>
          )}

          {format === 'sql' && (
            <>
              <Form.Item label="包含表结构 (CREATE TABLE)">
                <Switch checked={includeStructure} onChange={setIncludeStructure} />
              </Form.Item>
              <Form.Item label="包含数据 (INSERT)">
                <Switch checked={includeData} onChange={setIncludeData} />
              </Form.Item>
              <Form.Item label="INSERT 模式">
                <Select
                  value={insertMode}
                  onChange={(v) => setInsertMode(v)}
                  options={INSERT_MODES}
                />
              </Form.Item>
              <Form.Item label="批量大小">
                <InputNumber
                  value={batchSize}
                  onChange={(v) => setBatchSize(v || 100)}
                  min={1}
                  max={10000}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </>
          )}
        </Form>
      ) : (
        <div>
          <Alert
            message="导出成功"
            description={`${exportResult.table}: ${exportResult.rowCount} 行`}
            type="success"
            showIcon
            style={{ marginBottom: 12 }}
          />
          <Text strong>预览：</Text>
          <TextArea
            value={exportResult.data.substring(0, 5000)}
            readOnly
            autoSize={{ minRows: 6, maxRows: 15 }}
            style={{ fontFamily: 'monospace', fontSize: 12, marginTop: 8 }}
          />
          {exportResult.data.length > 5000 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              ... 已截断，完整内容请下载查看
            </Text>
          )}
        </div>
      )}
    </Modal>
  );
};

export default ExportDialog;
