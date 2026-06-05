/**
 * TableTools — 表工具集组件 (Sprint 4)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal, Tabs, Form, Select, Button, Input, Table, Space,
  Radio, message, Tag, Spin,
} from 'antd';
import {
  ToolOutlined, SearchOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { toolsApi, MaintenanceResult, FindTextResult } from '@/lib/api';
import { metadataApi } from '@/lib/api';

interface TableToolsProps {
  open: boolean;
  connectionId: string;
  database: string;
  onClose: () => void;
}

const MAINTENANCE_OPS = [
  { label: 'CHECK TABLE', value: 'CHECK' },
  { label: 'ANALYZE TABLE', value: 'ANALYZE' },
  { label: 'CHECKSUM TABLE', value: 'CHECKSUM' },
  { label: 'OPTIMIZE TABLE', value: 'OPTIMIZE' },
  { label: 'REPAIR TABLE', value: 'REPAIR' },
];

const TableTools: React.FC<TableToolsProps> = ({ open, connectionId, database, onClose }) => {
  // Tables list
  const [tables, setTables] = useState<string[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);

  // Maintenance state
  const [maintenanceOp, setMaintenanceOp] = useState<string>('CHECK');
  const [maintenanceTables, setMaintenanceTables] = useState<string[]>([]);
  const [maintenanceResults, setMaintenanceResults] = useState<MaintenanceResult[]>([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  // Find text state
  const [searchText, setSearchText] = useState('');
  const [findTables, setFindTables] = useState<string[]>([]);
  const [matchType, setMatchType] = useState<'LIKE' | 'REGEXP'>('LIKE');
  const [findResults, setFindResults] = useState<FindTextResult[]>([]);
  const [findLoading, setFindLoading] = useState(false);

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
    if (open) loadTables();
  }, [open, loadTables]);

  const handleMaintenance = async () => {
    if (maintenanceTables.length === 0) {
      message.warning('请选择至少一个表');
      return;
    }
    setMaintenanceLoading(true);
    try {
      const results = await toolsApi.maintenance({
        connectionId,
        database,
        tables: maintenanceTables,
        operation: maintenanceOp as any,
      });
      setMaintenanceResults(Array.isArray(results) ? results : []);
      message.success(`${maintenanceOp} 完成`);
    } catch (err: any) {
      message.error(`执行失败: ${err.message}`);
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleFindText = async () => {
    if (!searchText.trim()) {
      message.warning('请输入搜索文本');
      return;
    }
    if (findTables.length === 0) {
      message.warning('请选择至少一个表');
      return;
    }
    setFindLoading(true);
    try {
      const results = await toolsApi.findText({
        connectionId,
        database,
        tables: findTables,
        searchText,
        matchType,
      });
      setFindResults(Array.isArray(results) ? results : []);
      message.success(`找到 ${(results as any[])?.length || 0} 条匹配`);
    } catch (err: any) {
      message.error(`搜索失败: ${err.message}`);
    } finally {
      setFindLoading(false);
    }
  };

  const maintenanceColumns = [
    { title: '表', dataIndex: 'table', key: 'table' },
    { title: '操作', dataIndex: 'op', key: 'op' },
    {
      title: '类型', dataIndex: 'msg_type', key: 'msg_type',
      render: (v: string) => <Tag color={v === 'status' ? 'green' : v === 'error' ? 'red' : 'default'}>{v}</Tag>,
    },
    { title: '信息', dataIndex: 'msg_text', key: 'msg_text' },
  ];

  const findColumns = [
    { title: '表', dataIndex: 'table', key: 'table' },
    { title: '列', dataIndex: 'column', key: 'column' },
    { title: '主键', dataIndex: 'primaryKey', key: 'pk' },
    { title: '主键值', dataIndex: 'primaryKeyValue', key: 'pkv' },
    { title: '匹配值', dataIndex: 'matchedValue', key: 'matched', ellipsis: true },
  ];

  return (
    <Modal
      title={<><ToolOutlined /> 表工具 — {database}</>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      destroyOnClose
    >
      <Tabs items={[
        {
          key: 'maintenance',
          label: '表维护',
          children: (
            <div>
              <Form layout="vertical" size="small">
                <Form.Item label="操作">
                  <Radio.Group
                    value={maintenanceOp}
                    onChange={e => setMaintenanceOp(e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                    options={MAINTENANCE_OPS}
                  />
                </Form.Item>
                <Form.Item label="选择表">
                  <Select
                    mode="multiple"
                    value={maintenanceTables}
                    onChange={setMaintenanceTables}
                    loading={loadingTables}
                    placeholder="选择要操作的表..."
                    options={tables.map(t => ({ label: t, value: t }))}
                    maxTagCount={5}
                  />
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={handleMaintenance}
                      loading={maintenanceLoading}
                    >
                      执行
                    </Button>
                    <Button onClick={() => { setMaintenanceTables(tables); }}>全选</Button>
                    <Button onClick={() => { setMaintenanceTables([]); }}>清空</Button>
                  </Space>
                </Form.Item>
              </Form>
              {maintenanceResults.length > 0 && (
                <Table
                  dataSource={maintenanceResults}
                  columns={maintenanceColumns}
                  rowKey={(r, i) => `${r.table}-${r.op}-${i}`}
                  size="small"
                  pagination={{ pageSize: 20 }}
                  scroll={{ y: 250 }}
                />
              )}
            </div>
          ),
        },
        {
          key: 'findtext',
          label: '文本搜索',
          children: (
            <div>
              <Form layout="vertical" size="small">
                <Form.Item label="搜索文本">
                  <Input.Search
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    placeholder="输入要搜索的文本..."
                    enterButton={<><SearchOutlined /> 搜索</>}
                    onSearch={handleFindText}
                    loading={findLoading}
                  />
                </Form.Item>
                <Form.Item label="匹配类型">
                  <Radio.Group value={matchType} onChange={e => setMatchType(e.target.value)}>
                    <Radio value="LIKE">LIKE (模糊)</Radio>
                    <Radio value="REGEXP">REGEXP (正则)</Radio>
                  </Radio.Group>
                </Form.Item>
                <Form.Item label="选择表">
                  <Select
                    mode="multiple"
                    value={findTables}
                    onChange={setFindTables}
                    loading={loadingTables}
                    placeholder="选择要搜索的表..."
                    options={tables.map(t => ({ label: t, value: t }))}
                    maxTagCount={5}
                  />
                </Form.Item>
              </Form>
              {findLoading && <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>}
              {!findLoading && findResults.length > 0 && (
                <Table
                  dataSource={findResults}
                  columns={findColumns}
                  rowKey={(r, i) => `${r.table}-${r.column}-${i}`}
                  size="small"
                  pagination={{ pageSize: 20 }}
                  scroll={{ y: 250 }}
                />
              )}
            </div>
          ),
        },
      ]} />
    </Modal>
  );
};

export default TableTools;
