/**
 * BulkEdit — 批量表编辑组件 (Sprint 6)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal, Form, Select, Input, Button, Table, Space, Radio, message, Tag,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { metadataApi, toolsApi, MaintenanceResult } from '@/lib/api';

interface BulkEditProps {
  open: boolean;
  connectionId: string;
  database: string;
  onClose: () => void;
}

const OPERATIONS = [
  { label: '存储引擎', value: 'engine' },
  { label: '字符集', value: 'charset' },
  { label: '排序规则', value: 'collation' },
];

const ENGINE_OPTIONS = ['InnoDB', 'MyISAM', 'MEMORY', 'CSV', 'ARCHIVE'];
const CHARSET_OPTIONS = ['utf8mb4', 'utf8', 'latin1', 'ascii', 'binary'];

const BulkEdit: React.FC<BulkEditProps> = ({ open, connectionId, database, onClose }) => {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [operation, setOperation] = useState<'engine' | 'charset' | 'collation'>('engine');
  const [value, setValue] = useState('InnoDB');
  const [results, setResults] = useState<MaintenanceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);

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

  useEffect(() => {
    if (open) {
      loadTables();
      setResults([]);
      setSelectedTables([]);
    }
  }, [open, loadTables]);

  const handleOperationChange = (op: 'engine' | 'charset' | 'collation') => {
    setOperation(op);
    if (op === 'engine') setValue('InnoDB');
    else if (op === 'charset') setValue('utf8mb4');
    else setValue('utf8mb4_general_ci');
  };

  const handleExecute = async () => {
    if (selectedTables.length === 0) {
      message.warning('请选择至少一个表');
      return;
    }
    if (!value.trim()) {
      message.warning('请输入目标值');
      return;
    }

    setLoading(true);
    try {
      const res = await toolsApi.bulkEdit({
        connectionId,
        database,
        tables: selectedTables,
        operation,
        value: value.trim(),
      });
      setResults(Array.isArray(res) ? res : []);
      const successCount = (res as MaintenanceResult[]).filter(r => r.msg_type === 'status' || r.msg_type === 'OK').length;
      message.success(`完成：${successCount}/${selectedTables.length} 成功`);
    } catch (err: any) {
      message.error(`执行失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: '表', dataIndex: 'table', key: 'table' },
    {
      title: '状态',
      dataIndex: 'msg_type',
      key: 'msg_type',
      render: (v: string) => <Tag color={v === 'status' || v === 'OK' ? 'success' : 'error'}>{v}</Tag>,
    },
    { title: '信息', dataIndex: 'msg_text', key: 'msg_text', ellipsis: true },
  ];

  return (
    <Modal
      title={<><EditOutlined /> 批量表编辑 — {database}</>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      <Form layout="vertical" size="small">
        <Form.Item label="操作类型">
          <Radio.Group
            value={operation}
            onChange={e => handleOperationChange(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            options={OPERATIONS}
          />
        </Form.Item>

        <Form.Item label="目标值">
          {operation === 'engine' ? (
            <Select value={value} onChange={setValue} options={ENGINE_OPTIONS.map(e => ({ label: e, value: e }))} />
          ) : operation === 'charset' ? (
            <Select value={value} onChange={setValue} options={CHARSET_OPTIONS.map(e => ({ label: e, value: e }))} />
          ) : (
            <Input value={value} onChange={e => setValue(e.target.value)} placeholder="输入排序规则..." />
          )}
        </Form.Item>

        <Form.Item label="选择表">
          <Select
            mode="multiple"
            value={selectedTables}
            onChange={setSelectedTables}
            loading={loadingTables}
            placeholder="选择要修改的表..."
            options={tables.map(t => ({ label: t, value: t }))}
            maxTagCount={5}
          />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" onClick={handleExecute} loading={loading}>
              执行
            </Button>
            <Button onClick={() => setSelectedTables(tables)}>全选</Button>
            <Button onClick={() => setSelectedTables([])}>清空</Button>
          </Space>
        </Form.Item>
      </Form>

      {results.length > 0 && (
        <Table
          dataSource={results}
          columns={columns}
          rowKey={(r, i) => `${r.table}-${i}`}
          size="small"
          pagination={{ pageSize: 10 }}
          scroll={{ y: 250 }}
        />
      )}
    </Modal>
  );
};

export default BulkEdit;
