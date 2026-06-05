/**
 * ServerManager — 服务器管理组件 (Sprint 5)
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Modal, Tabs, Table, Input, Button, Space, Descriptions, Card, Row, Col,
  Statistic, Tag, Popconfirm, message, Tooltip, Badge,
} from 'antd';
import {
  ReloadOutlined, StopOutlined, EditOutlined, SearchOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { serverApi, ServerInfo, ServerVariable, ServerProcess } from '@/lib/api';

interface ServerManagerProps {
  open: boolean;
  connectionId: string;
  onClose: () => void;
}

/** 格式化运行时间 */
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}天 ${h}时 ${m}分`;
  if (h > 0) return `${h}时 ${m}分 ${s}秒`;
  return `${m}分 ${s}秒`;
}

/** 格式化字节数 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const ServerManager: React.FC<ServerManagerProps> = ({ open, connectionId, onClose }) => {
  // Server Info
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);

  // Variables
  const [variables, setVariables] = useState<ServerVariable[]>([]);
  const [varFilter, setVarFilter] = useState('');
  const [varLoading, setVarLoading] = useState(false);
  const [editingVar, setEditingVar] = useState<{ name: string; value: string } | null>(null);
  const [varSaving, setVarSaving] = useState(false);

  // Processes
  const [processes, setProcesses] = useState<ServerProcess[]>([]);
  const [procLoading, setProcLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInfo = useCallback(async () => {
    if (!connectionId) return;
    setInfoLoading(true);
    try {
      const data = await serverApi.getInfo(connectionId);
      setServerInfo(data);
    } catch (err: any) {
      message.error(`获取服务器信息失败: ${err.message}`);
    } finally {
      setInfoLoading(false);
    }
  }, [connectionId]);

  const fetchVariables = useCallback(async () => {
    if (!connectionId) return;
    setVarLoading(true);
    try {
      const data = await serverApi.getVariables(connectionId, varFilter || undefined);
      setVariables(Array.isArray(data) ? data : []);
    } catch (err: any) {
      message.error(`获取变量失败: ${err.message}`);
    } finally {
      setVarLoading(false);
    }
  }, [connectionId, varFilter]);

  const fetchProcesses = useCallback(async () => {
    if (!connectionId) return;
    setProcLoading(true);
    try {
      const data = await serverApi.getProcesses(connectionId);
      setProcesses(Array.isArray(data) ? data : []);
    } catch (err: any) {
      message.error(`获取进程失败: ${err.message}`);
    } finally {
      setProcLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    if (open) {
      fetchInfo();
      fetchVariables();
      fetchProcesses();
    }
  }, [open, fetchInfo, fetchVariables, fetchProcesses]);

  // 自动刷新进程
  useEffect(() => {
    if (open && autoRefresh) {
      intervalRef.current = setInterval(fetchProcesses, 5000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [open, autoRefresh, fetchProcesses]);

  const handleSetVariable = async () => {
    if (!editingVar) return;
    setVarSaving(true);
    try {
      await serverApi.setVariable(connectionId, editingVar.name, editingVar.value);
      message.success(`变量 ${editingVar.name} 已更新`);
      setEditingVar(null);
      fetchVariables();
    } catch (err: any) {
      message.error(`设置变量失败: ${err.message}`);
    } finally {
      setVarSaving(false);
    }
  };

  const handleKillProcess = async (pid: number) => {
    try {
      await serverApi.killProcess(connectionId, pid);
      message.success(`进程 ${pid} 已终止`);
      fetchProcesses();
    } catch (err: any) {
      message.error(`终止进程失败: ${err.message}`);
    }
  };

  const varColumns = [
    { title: '变量名', dataIndex: 'name', key: 'name', sorter: (a: ServerVariable, b: ServerVariable) => a.name.localeCompare(b.name), width: 280 },
    {
      title: '值', dataIndex: 'value', key: 'value', ellipsis: true,
      render: (v: string, record: ServerVariable) =>
        editingVar?.name === record.name
          ? <Input size="small" value={editingVar.value} onChange={e => setEditingVar({ ...editingVar, value: e.target.value })} onPressEnter={handleSetVariable} style={{ width: '100%' }} />
          : <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    {
      title: '', key: 'actions', width: 60,
      render: (_: unknown, record: ServerVariable) =>
        editingVar?.name === record.name
          ? <Space size="small"><Button size="small" type="primary" loading={varSaving} onClick={handleSetVariable}>OK</Button><Button size="small" onClick={() => setEditingVar(null)}>取消</Button></Space>
          : <Tooltip title="编辑"><Button type="link" size="small" icon={<EditOutlined />} onClick={() => setEditingVar({ name: record.name, value: record.value })} /></Tooltip>,
    },
  ];

  const procColumns = [
    { title: 'ID', dataIndex: 'Id', key: 'Id', width: 60, sorter: (a: ServerProcess, b: ServerProcess) => a.Id - b.Id },
    { title: '用户', dataIndex: 'User', key: 'User', width: 100 },
    { title: '主机', dataIndex: 'Host', key: 'Host', width: 140 },
    { title: '数据库', dataIndex: 'db', key: 'db', width: 100, render: (v: string | null) => v || <Tag>NULL</Tag> },
    { title: '命令', dataIndex: 'Command', key: 'Command', width: 80 },
    { title: '时间(s)', dataIndex: 'Time', key: 'Time', width: 70, sorter: (a: ServerProcess, b: ServerProcess) => a.Time - b.Time },
    { title: '状态', dataIndex: 'State', key: 'State', width: 100 },
    { title: 'SQL', dataIndex: 'Info', key: 'Info', ellipsis: true, render: (v: string | null) => v ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> : '-' },
    {
      title: '操作', key: 'actions', width: 70,
      render: (_: unknown, record: ServerProcess) => (
        record.Command !== 'Daemon' ? (
          <Popconfirm title={`确定终止进程 ${record.Id}？`} onConfirm={() => handleKillProcess(record.Id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<StopOutlined />} />
          </Popconfirm>
        ) : null
      ),
    },
  ];

  return (
    <Modal
      title={<><DashboardOutlined /> 服务器管理</>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={950}
      destroyOnClose
    >
      <Tabs items={[
        {
          key: 'info',
          label: '服务器信息',
          children: (
            <div>
              <Button icon={<ReloadOutlined />} onClick={fetchInfo} loading={infoLoading} style={{ marginBottom: 16 }}>刷新</Button>
              {serverInfo && (
                <>
                  <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="版本">{serverInfo.version}</Descriptions.Item>
                    <Descriptions.Item label="运行时间">{formatUptime(serverInfo.uptime)}</Descriptions.Item>
                    <Descriptions.Item label="字符集">{serverInfo.charset}</Descriptions.Item>
                    <Descriptions.Item label="排序规则">{serverInfo.collation}</Descriptions.Item>
                  </Descriptions>
                  <Row gutter={[12, 12]}>
                    <Col span={6}><Card size="small"><Statistic title="活跃连接" value={serverInfo.stats.threadsConnected} suffix={<Badge status={serverInfo.stats.threadsConnected > 50 ? 'warning' : 'success'} />} /></Card></Col>
                    <Col span={6}><Card size="small"><Statistic title="运行线程" value={serverInfo.stats.threadsRunning} /></Card></Col>
                    <Col span={6}><Card size="small"><Statistic title="总查询数" value={serverInfo.stats.queries} /></Card></Col>
                    <Col span={6}><Card size="small"><Statistic title="慢查询" value={serverInfo.stats.slowQueries} valueStyle={serverInfo.stats.slowQueries > 0 ? { color: '#cf1322' } : undefined} /></Card></Col>
                    <Col span={6}><Card size="small"><Statistic title="接收流量" value={formatBytes(serverInfo.stats.bytesReceived)} /></Card></Col>
                    <Col span={6}><Card size="small"><Statistic title="发送流量" value={formatBytes(serverInfo.stats.bytesSent)} /></Card></Col>
                    <Col span={6}><Card size="small"><Statistic title="总连接次数" value={serverInfo.stats.totalConnections} /></Card></Col>
                    <Col span={6}><Card size="small"><Statistic title="异常断开" value={serverInfo.stats.abortedClients + serverInfo.stats.abortedConnects} valueStyle={(serverInfo.stats.abortedClients + serverInfo.stats.abortedConnects) > 0 ? { color: '#faad14' } : undefined} /></Card></Col>
                  </Row>
                </>
              )}
            </div>
          ),
        },
        {
          key: 'variables',
          label: '服务器变量',
          children: (
            <div>
              <Space style={{ marginBottom: 12 }}>
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="搜索变量名..."
                  value={varFilter}
                  onChange={e => setVarFilter(e.target.value)}
                  onPressEnter={fetchVariables}
                  allowClear
                  style={{ width: 250 }}
                />
                <Button type="primary" onClick={fetchVariables} loading={varLoading}>搜索</Button>
                <Button icon={<ReloadOutlined />} onClick={fetchVariables} loading={varLoading}>刷新</Button>
              </Space>
              <Table
                dataSource={variables}
                columns={varColumns}
                rowKey="name"
                loading={varLoading}
                size="small"
                pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'] }}
                scroll={{ y: 380 }}
              />
            </div>
          ),
        },
        {
          key: 'processes',
          label: '进程管理',
          children: (
            <div>
              <Space style={{ marginBottom: 12 }}>
                <Button icon={<ReloadOutlined />} onClick={fetchProcesses} loading={procLoading}>刷新</Button>
                <span>
                  自动刷新:
                  <Button
                    type={autoRefresh ? 'primary' : 'default'}
                    size="small"
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    style={{ marginLeft: 4 }}
                  >
                    {autoRefresh ? '开 (5s)' : '关'}
                  </Button>
                </span>
                <Tag>共 {processes.length} 个进程</Tag>
              </Space>
              <Table
                dataSource={processes}
                columns={procColumns}
                rowKey="Id"
                loading={procLoading}
                size="small"
                pagination={{ pageSize: 15 }}
                scroll={{ y: 380 }}
              />
            </div>
          ),
        },
      ]} />
    </Modal>
  );
};

export default ServerManager;
