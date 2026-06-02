/**
 * 连接管理模态框 — 创建/编辑数据库连接
 */

import React from 'react';
import { Modal, Form, Input, InputNumber, Select, Button, Space, message, Descriptions } from 'antd';
import { ApiOutlined, CheckCircleOutlined, DisconnectOutlined } from '@ant-design/icons';
import { connectionsApi, ConnectionConfig, ConnectionInfo } from '@/lib/api';
import { useConnectionStore } from '@/stores/connectionStore';

interface Props {
  open: boolean;
  editingConnection?: ConnectionInfo | null;
  onClose: () => void;
  onSaved?: (connectionId: string) => void;
}

const DB_TYPES = [
  { label: 'MySQL', value: 'mysql' },
  { label: 'MariaDB', value: 'mariadb' },
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'SQLite', value: 'sqlite' },
];

const DEFAULT_PORTS: Record<string, number> = { mysql: 3306, mariadb: 3306, postgresql: 5432, sqlite: 0 };

const ConnectionModal: React.FC<Props> = ({ open, editingConnection, onClose, onSaved }) => {
  const [form] = Form.useForm();
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<any>(null);
  const { createConnection, updateConnection } = useConnectionStore();

  React.useEffect(() => {
    if (open && editingConnection) {
      form.setFieldsValue({
        name: editingConnection.name,
        type: editingConnection.type,
        host: editingConnection.host,
        port: editingConnection.port,
        username: editingConnection.username,
        password: '',
        database: editingConnection.database,
      });
    } else if (open) {
      form.resetFields();
      form.setFieldsValue({ type: 'mysql', host: 'localhost', port: 3306, username: 'root' });
    }
    setTestResult(null);
  }, [open, editingConnection, form]);

  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      setTesting(true);
      setTestResult(null);
      const result = await connectionsApi.test(values as ConnectionConfig);
      setTestResult(result);
      if (result.connected) {
        message.success(`连接成功 (${result.responseTime}ms)`);
      } else {
        message.error(result.error || '连接失败');
      }
    } catch (err: any) {
      setTestResult({ connected: false, error: err.message });
      message.error(err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      let connId: string;
      if (editingConnection?.id) {
        await updateConnection(editingConnection.id, values);
        connId = editingConnection.id;
        message.success('连接已更新');
      } else {
        connId = await createConnection(values);
        message.success('连接已创建');
      }
      onClose();
      onSaved?.(connId);
    } catch (err: any) {
      if (err.message) message.error(err.message);
    }
  };

  return (
    <Modal
      title={editingConnection ? '编辑连接' : '新建连接'}
      open={open}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button key="test" icon={<ApiOutlined />} loading={testing} onClick={handleTest}>测试连接</Button>,
        <Button key="save" type="primary" onClick={handleSave}>保存</Button>,
      ]}
    >
      <Form form={form} layout="vertical" size="middle">
        <Form.Item name="name" label="连接名称" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="My Database" />
        </Form.Item>

        <Form.Item name="type" label="数据库类型" rules={[{ required: true }]}>
          <Select options={DB_TYPES} onChange={(v) => form.setFieldValue('port', DEFAULT_PORTS[v])} />
        </Form.Item>

        <Space.Compact style={{ display: 'flex', gap: 12 }}>
          <Form.Item name="host" label="主机" rules={[{ required: true }]} style={{ flex: 2 }}>
            <Input placeholder="localhost" />
          </Form.Item>
          <Form.Item name="port" label="端口" style={{ flex: 1 }}>
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
        </Space.Compact>

        <Space.Compact style={{ display: 'flex', gap: 12 }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input placeholder="root" />
          </Form.Item>
          <Form.Item name="password" label="密码" style={{ flex: 1 }}>
            <Input.Password placeholder="密码" />
          </Form.Item>
        </Space.Compact>

        <Form.Item name="database" label="默认数据库">
          <Input placeholder="(可选)" />
        </Form.Item>
      </Form>

      {testResult && (
        <Descriptions bordered size="small" column={1} style={{ marginTop: 12 }}>
          <Descriptions.Item label="状态">
            {testResult.connected ? (
              <span style={{ color: '#52c41a' }}><CheckCircleOutlined /> 已连接</span>
            ) : (
              <span style={{ color: '#ff4d4f' }}><DisconnectOutlined /> 失败</span>
            )}
          </Descriptions.Item>
          {testResult.serverVersion && (
            <Descriptions.Item label="版本">{testResult.serverVersion}</Descriptions.Item>
          )}
          {testResult.responseTime !== undefined && (
            <Descriptions.Item label="响应时间">{testResult.responseTime}ms</Descriptions.Item>
          )}
          {testResult.error && (
            <Descriptions.Item label="错误">{testResult.error}</Descriptions.Item>
          )}
        </Descriptions>
      )}
    </Modal>
  );
};

export default ConnectionModal;
