/**
 * GenerateData — 测试数据生成器组件 (Sprint 6)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal, Form, Select, InputNumber, Button, message, Statistic, Row, Col, Card,
} from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import { metadataApi, toolsApi } from '@/lib/api';

interface GenerateDataProps {
  open: boolean;
  connectionId: string;
  database: string;
  onClose: () => void;
}

const GenerateData: React.FC<GenerateDataProps> = ({ open, connectionId, database, onClose }) => {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [result, setResult] = useState<{ insertedRows: number } | null>(null);

  const loadTables = useCallback(async () => {
    if (!connectionId || !database) return;
    setLoadingTables(true);
    try {
      const data = await metadataApi.tables(connectionId, database);
      const names = data.map((t: any) => t.name || t.TABLE_NAME || t.table_name);
      setTables(names);
    } catch (err: any) {
      message.error(`获取表列表失败: ${err.message}`);
    } finally {
      setLoadingTables(false);
    }
  }, [connectionId, database]);

  const loadColumns = useCallback(async (table: string) => {
    if (!connectionId || !database || !table) return;
    try {
      const data = await metadataApi.columns(connectionId, database, table);
      const names = data.map((c: any) => c.name || c.COLUMN_NAME || c.Field);
      setColumns(names);
      setSelectedColumns([]);
    } catch (err: any) {
      message.error(`获取列信息失败: ${err.message}`);
    }
  }, [connectionId, database]);

  useEffect(() => {
    if (open) {
      loadTables();
      setResult(null);
      setSelectedTable('');
      setColumns([]);
    }
  }, [open, loadTables]);

  useEffect(() => {
    if (selectedTable) {
      loadColumns(selectedTable);
    }
  }, [selectedTable, loadColumns]);

  const handleGenerate = async () => {
    if (!selectedTable) {
      message.warning('请选择表');
      return;
    }
    if (rowCount < 1 || rowCount > 100000) {
      message.warning('行数必须在 1-100000 之间');
      return;
    }

    setLoading(true);
    try {
      const res = await toolsApi.generateData({
        connectionId,
        database,
        table: selectedTable,
        rowCount,
        columns: selectedColumns.length > 0 ? selectedColumns : undefined,
      });
      setResult(res as any);
      message.success(`成功生成 ${(res as any)?.insertedRows || 0} 行数据`);
    } catch (err: any) {
      message.error(`生成失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={<><ExperimentOutlined /> 数据生成器 — {database}</>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      <Form layout="vertical" size="small">
        <Form.Item label="选择表">
          <Select
            value={selectedTable || undefined}
            onChange={setSelectedTable}
            loading={loadingTables}
            placeholder="选择要生成数据的表..."
            options={tables.map(t => ({ label: t, value: t }))}
            showSearch
          />
        </Form.Item>

        <Form.Item label="行数">
          <InputNumber
            value={rowCount}
            onChange={(v) => setRowCount(v || 100)}
            min={1}
            max={100000}
            step={100}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item label="选择列（留空则自动填充所有非自增列）">
          <Select
            mode="multiple"
            value={selectedColumns}
            onChange={setSelectedColumns}
            placeholder="选择要填充的列..."
            options={columns.map(c => ({ label: c, value: c }))}
            maxTagCount={5}
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            icon={<ExperimentOutlined />}
            onClick={handleGenerate}
            loading={loading}
          >
            生成数据
          </Button>
        </Form.Item>
      </Form>

      {result && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Statistic title="插入行数" value={result.insertedRows} />
            </Col>
            <Col span={12}>
              <Statistic title="目标表" value={selectedTable} />
            </Col>
          </Row>
        </Card>
      )}
    </Modal>
  );
};

export default GenerateData;
