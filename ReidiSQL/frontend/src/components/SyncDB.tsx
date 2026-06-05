/**
 * SyncDB — 数据库同步分析组件 (Sprint 6)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal, Select, Button, Table, Space, Tag, message, Spin, Typography,
} from 'antd';
import { SwapOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { metadataApi, ddlApi, toolsApi, SyncDiff } from '@/lib/api';

const { Text } = Typography;

interface SyncDBProps {
  open: boolean;
  connectionId: string;
  onClose: () => void;
}

const SyncDB: React.FC<SyncDBProps> = ({ open, connectionId, onClose }) => {
  const [databases, setDatabases] = useState<string[]>([]);
  const [sourceDb, setSourceDb] = useState<string>('');
  const [targetDb, setTargetDb] = useState<string>('');
  const [diffs, setDiffs] = useState<SyncDiff[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [execResults, setExecResults] = useState<{ success: number; failed: number } | null>(null);

  const loadDatabases = useCallback(async () => {
    if (!connectionId) return;
    try {
      const data = await metadataApi.databases(connectionId);
      const names = data.map((d: any) => d.name || d.Database || d.SCHEMA_NAME);
      setDatabases(names);
    } catch (err: any) {
      message.error(`获取数据库列表失败: ${err.message}`);
    }
  }, [connectionId]);

  useEffect(() => {
    if (open) {
      loadDatabases();
      setDiffs([]);
      setSelectedKeys([]);
      setExecResults(null);
    }
  }, [open, loadDatabases]);

  const handleAnalyze = async () => {
    if (!sourceDb || !targetDb) {
      message.warning('请选择源数据库和目标数据库');
      return;
    }
    if (sourceDb === targetDb) {
      message.warning('源数据库和目标数据库不能相同');
      return;
    }

    setAnalyzing(true);
    try {
      const result = await toolsApi.syncAnalyze({ connectionId, sourceDb, targetDb });
      const diffsList = Array.isArray(result) ? result : [];
      setDiffs(diffsList);
      setSelectedKeys(diffsList.map((_, i) => i));
      if (diffsList.length === 0) {
        message.success('两个数据库结构完全一致，无需同步');
      } else {
        message.info(`发现 ${diffsList.length} 处差异`);
      }
    } catch (err: any) {
      message.error(`分析失败: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExecute = async () => {
    if (selectedKeys.length === 0) {
      message.warning('请选择要执行的差异项');
      return;
    }

    setExecuting(true);
    let success = 0;
    let failed = 0;

    try {
      for (const key of selectedKeys) {
        const diff = diffs[key as number];
        if (!diff) continue;

        try {
          await ddlApi.execute(connectionId, targetDb, diff.ddl);
          success++;
        } catch {
          failed++;
        }
      }

      setExecResults({ success, failed });
      if (failed === 0) {
        message.success(`同步完成：${success} 项成功`);
      } else {
        message.warning(`同步部分完成：${success} 成功，${failed} 失败`);
      }
    } finally {
      setExecuting(false);
    }
  };

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (v: string) => {
        const colors: Record<string, string> = { table: 'blue', column: 'green', index: 'orange', fk: 'purple' };
        return <Tag color={colors[v] || 'default'}>{v}</Tag>;
      },
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 80,
      render: (v: string) => {
        const colors: Record<string, string> = { add: 'success', drop: 'error', modify: 'warning' };
        const labels: Record<string, string> = { add: '新增', drop: '删除', modify: '修改' };
        return <Tag color={colors[v]}>{labels[v] || v}</Tag>;
      },
    },
    {
      title: '对象',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      ellipsis: true,
    },
    {
      title: 'DDL',
      dataIndex: 'ddl',
      key: 'ddl',
      ellipsis: true,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v?.slice(0, 100)}...</Text>,
    },
  ];

  return (
    <Modal
      title={<><SwapOutlined /> 数据库同步</>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 数据库选择 */}
        <Space wrap>
          <Select
            style={{ width: 200 }}
            placeholder="源数据库"
            value={sourceDb}
            onChange={setSourceDb}
            options={databases.map(d => ({ label: d, value: d }))}
          />
          <SwapOutlined />
          <Select
            style={{ width: 200 }}
            placeholder="目标数据库"
            value={targetDb}
            onChange={setTargetDb}
            options={databases.filter(d => d !== sourceDb).map(d => ({ label: d, value: d }))}
          />
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleAnalyze}
            loading={analyzing}
          >
            分析差异
          </Button>
        </Space>

        {/* 差异列表 */}
        {analyzing && <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>}
        {!analyzing && diffs.length > 0 && (
          <>
            <Table
              rowSelection={{
                selectedRowKeys: selectedKeys,
                onChange: (keys) => setSelectedKeys(keys),
              }}
              dataSource={diffs.map((d, i) => ({ ...d, _key: i }))}
              columns={columns}
              rowKey={(_, i) => String(i)}
              size="small"
              pagination={{ pageSize: 10 }}
              scroll={{ y: 300 }}
            />

            {/* 执行按钮 */}
            <Space>
              <Button
                type="primary"
                danger
                onClick={handleExecute}
                loading={executing}
                disabled={selectedKeys.length === 0}
              >
                执行选中项 ({selectedKeys.length})
              </Button>
              <Button onClick={() => setSelectedKeys(diffs.map((_, i) => i))}>全选</Button>
              <Button onClick={() => setSelectedKeys([])}>清空</Button>
            </Space>
          </>
        )}

        {/* 执行结果 */}
        {execResults && (
          <Space>
            <Tag color="success">成功: {execResults.success}</Tag>
            {execResults.failed > 0 && <Tag color="error">失败: {execResults.failed}</Tag>}
          </Space>
        )}
      </Space>
    </Modal>
  );
};

export default SyncDB;
