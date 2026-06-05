/**
 * ConnectionManager — 连接管理面板 (Sprint 6)
 * 提供：连接列表、编辑、测试有效性、删除、连接/断开
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal, Table, Button, Space, Tag, Popconfirm, message, Badge, Tooltip, Typography,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined,
  LinkOutlined, DisconnectOutlined, CheckCircleOutlined,
  CloseCircleOutlined, QuestionCircleOutlined,
} from '@ant-design/icons';
import { connectionsApi, ConnectionConfig, ConnectionInfo } from '@/lib/api';
import { useConnectionStore } from '@/stores/connectionStore';

const { Text } = Typography;

interface ConnectionManagerProps {
  open: boolean;
  onClose: () => void;
  onNewConnection: () => void;
  onEditConnection: (conn: ConnectionInfo) => void;
}

interface TestResult {
  connected: boolean;
  serverVersion?: string;
  error?: string;
  responseTime?: number;
}

const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  open, onClose, onNewConnection, onEditConnection,
}) => {
  const { connections, activeConnectionId, fetchConnections, connect, disconnect, deleteConnection } = useConnectionStore();
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [connectingIds, setConnectingIds] = useState<Set<string>>(new Set());

  // 打开时刷新列表
  useEffect(() => {
    if (open) {
      fetchConnections();
      setTestResults({});
    }
  }, [open, fetchConnections]);

  // 测试单个连接
  const handleTest = useCallback(async (conn: ConnectionInfo) => {
    setTestingIds(prev => new Set(prev).add(conn.id));
    try {
      const result = await connectionsApi.test({
        name: conn.name,
        type: conn.type as any,
        host: conn.host,
        port: conn.port,
        username: conn.username,
        database: conn.database,
      } as ConnectionConfig);
      setTestResults(prev => ({ ...prev, [conn.id]: result }));
      if (result.connected) {
        message.success(`${conn.name}: 连接成功 (${result.responseTime}ms)`);
      } else {
        message.error(`${conn.name}: ${result.error || '连接失败'}`);
      }
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [conn.id]: { connected: false, error: err.message } }));
      message.error(`${conn.name}: 测试失败 - ${err.message}`);
    } finally {
      setTestingIds(prev => {
        const next = new Set(prev);
        next.delete(conn.id);
        return next;
      });
    }
  }, []);

  // 测试所有连接
  const handleTestAll = useCallback(async () => {
    message.info(`正在测试 ${connections.length} 个连接...`);
    for (const conn of connections) {
      await handleTest(conn);
    }
  }, [connections, handleTest]);

  // 连接
  const handleConnect = useCallback(async (conn: ConnectionInfo) => {
    setConnectingIds(prev => new Set(prev).add(conn.id));
    try {
      const result = await connect(conn.id);
      message.success(`已连接 ${conn.name} (${result.serverVersion})`);
    } catch (err: any) {
      message.error(`连接失败: ${err.message}`);
    } finally {
      setConnectingIds(prev => {
        const next = new Set(prev);
        next.delete(conn.id);
        return next;
      });
    }
  }, [connect]);

  // 断开
  const handleDisconnect = useCallback(async (conn: ConnectionInfo) => {
    try {
      await disconnect(conn.id);
      message.success(`已断开 ${conn.name}`);
    } catch (err: any) {
      message.error(`断开失败: ${err.message}`);
    }
  }, [disconnect]);

  // 删除
  const handleDelete = useCallback(async (conn: ConnectionInfo) => {
    try {
      await deleteConnection(conn.id);
      message.success(`已删除 ${conn.name}`);
      setTestResults(prev => {
        const next = { ...prev };
        delete next[conn.id];
        return next;
      });
    } catch (err: any) {
      message.error(`删除失败: ${err.message}`);
    }
  }, [deleteConnection]);

  // 获取测试状态图标
  const getTestBadge = (connId: string) => {
    if (testingIds.has(connId)) {
      return <Badge status="processing" text="测试中" />;
    }
    const result = testResults[connId];
    if (!result) {
      return <Text type="secondary"><QuestionCircleOutlined /> 未测试</Text>;
    }
    if (result.connected) {
      return (
        <Space size={4}>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          <Text type="success">{result.serverVersion || '已连接'}</Text>
          <Text type="secondary">({result.responseTime}ms)</Text>
        </Space>
      );
    }
    return (
      <Tooltip title={result.error}>
        <Space size={4}>
          <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
          <Text type="danger">失败</Text>
        </Space>
      </Tooltip>
    );
  };

  const columns = [
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: (_: unknown, record: ConnectionInfo) => {
        if (record.id === activeConnectionId) {
          return <Tag color="success" icon={<LinkOutlined />}>已连接</Tag>;
        }
        if (record.status === 'connected') {
          return <Tag color="blue">在线</Tag>;
        }
        return <Tag>未连接</Tag>;
      },
    },
    {
      title: '名称',
      key: 'name',
      dataIndex: 'name',
      ellipsis: true,
      render: (name: string, record: ConnectionInfo) => (
        <Space>
          <Text strong>{name}</Text>
          {record.color && <div style={{ width: 8, height: 8, borderRadius: '50%', background: record.color }} />}
        </Space>
      ),
    },
    {
      title: '类型',
      key: 'type',
      dataIndex: 'type',
      width: 90,
      render: (type: string) => {
        const colors: Record<string, string> = { mysql: 'blue', mariadb: 'cyan', postgresql: 'purple', sqlite: 'orange' };
        return <Tag color={colors[type] || 'default'}>{type}</Tag>;
      },
    },
    {
      title: '地址',
      key: 'address',
      width: 180,
      render: (_: unknown, record: ConnectionInfo) => (
        <Text type="secondary">{record.host}:{record.port}</Text>
      ),
    },
    {
      title: '用户',
      key: 'username',
      dataIndex: 'username',
      width: 100,
      ellipsis: true,
    },
    {
      title: '测试结果',
      key: 'test',
      width: 180,
      render: (_: unknown, record: ConnectionInfo) => getTestBadge(record.id),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: ConnectionInfo) => {
        const isActive = record.id === activeConnectionId;
        const isTesting = testingIds.has(record.id);
        const isConnecting = connectingIds.has(record.id);

        return (
          <Space size="small" wrap>
            {isActive ? (
              <Tooltip title="断开连接">
                <Button size="small" icon={<DisconnectOutlined />} onClick={() => handleDisconnect(record)}>
                  断开
                </Button>
              </Tooltip>
            ) : (
              <Tooltip title="连接到此数据库">
                <Button size="small" type="primary" icon={<LinkOutlined />} loading={isConnecting} onClick={() => handleConnect(record)}>
                  连接
                </Button>
              </Tooltip>
            )}
            <Tooltip title="测试连接有效性">
              <Button size="small" icon={<ApiOutlined />} loading={isTesting} onClick={() => handleTest(record)} />
            </Tooltip>
            <Tooltip title="编辑">
              <Button size="small" icon={<EditOutlined />} onClick={() => onEditConnection(record)} />
            </Tooltip>
            <Popconfirm
              title={`确认删除连接 "${record.name}"？`}
              description="删除后无法恢复"
              onConfirm={() => handleDelete(record)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="删除">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const connectedCount = connections.filter(c => c.id === activeConnectionId || c.status === 'connected').length;

  return (
    <Modal
      title={
        <Space>
          <ApiOutlined />
          <span>连接管理</span>
          <Tag>{connections.length} 个连接</Tag>
          {connectedCount > 0 && <Tag color="success">{connectedCount} 个已连接</Tag>}
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={1000}
      footer={[
        <Button key="test-all" icon={<ApiOutlined />} onClick={handleTestAll} disabled={connections.length === 0}>
          测试全部
        </Button>,
        <Button key="new" type="primary" icon={<PlusOutlined />} onClick={onNewConnection}>
          新建连接
        </Button>,
        <Button key="close" onClick={onClose}>关闭</Button>,
      ]}
      destroyOnClose
    >
      <Table
        dataSource={connections}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={connections.length > 10 ? { pageSize: 10 } : false}
        scroll={{ y: 400 }}
        locale={{ emptyText: '暂无连接，点击"新建连接"添加' }}
      />
    </Modal>
  );
};

export default ConnectionManager;
