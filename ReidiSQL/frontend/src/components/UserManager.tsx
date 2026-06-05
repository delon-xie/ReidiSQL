/**
 * UserManager — MySQL 用户管理组件 (Sprint 4)
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal, Table, Button, Space, Tag, Popconfirm, Drawer, Form,
  Input, Select, Tabs, Checkbox, InputNumber, message, Tooltip,
} from 'antd';
import {
  UserAddOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  LockOutlined, UnlockOutlined,
} from '@ant-design/icons';
import { adminApi, MySQLUser } from '@/lib/api';

interface UserManagerProps {
  open: boolean;
  connectionId: string;
  onClose: () => void;
}

const PRIVILEGE_GROUPS = [
  { label: '数据', options: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { label: 'DDL', options: ['CREATE', 'ALTER', 'DROP', 'INDEX', 'CREATE VIEW', 'SHOW VIEW'] },
  { label: '管理', options: ['GRANT OPTION', 'SUPER', 'PROCESS', 'RELOAD', 'SHUTDOWN', 'SHOW DATABASES'] },
  { label: '其他', options: ['FILE', 'REFERENCES', 'CREATE TEMPORARY TABLES', 'LOCK TABLES', 'EXECUTE', 'CREATE ROUTINE', 'ALTER ROUTINE', 'EVENT', 'TRIGGER'] },
];

const UserManager: React.FC<UserManagerProps> = ({ open, connectionId, onClose }) => {
  const [users, setUsers] = useState<MySQLUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<MySQLUser | null>(null);
  const [form] = Form.useForm();
  const [privForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('basic');
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!connectionId) return;
    setLoading(true);
    try {
      const data = await adminApi.listUsers(connectionId);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      message.error(`获取用户列表失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    if (open) fetchUsers();
  }, [open, fetchUsers]);

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    privForm.resetFields();
    setActiveTab('basic');
    setDrawerOpen(true);
  };

  const handleEdit = async (record: MySQLUser) => {
    setEditingUser(record);
    setActiveTab('basic');
    form.setFieldsValue({
      username: record.User,
      host: record.Host,
      authPlugin: record.plugin,
    });
    // Load privileges
    try {
      const userKey = `${record.User}@${record.Host}`;
      const privs = await adminApi.getPrivileges(connectionId, userKey);
      const grantList: string[] = privs.grants || [];
      // Parse granted privileges
      const allPrivs: string[] = [];
      for (const g of grantList) {
        const match = g.match(/GRANT (.+?) ON/);
        if (match) {
          match[1].split(',').map(s => s.trim()).forEach(p => allPrivs.push(p));
        }
      }
      privForm.setFieldsValue({ privileges: allPrivs });
    } catch {
      privForm.setFieldsValue({ privileges: [] });
    }
    setDrawerOpen(true);
  };

  const handleDelete = async (record: MySQLUser) => {
    try {
      const userKey = `${record.User}@${record.Host}`;
      await adminApi.dropUser(connectionId, userKey);
      message.success(`用户 ${userKey} 已删除`);
      fetchUsers();
    } catch (err: any) {
      message.error(`删除失败: ${err.message}`);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const basicValues = form.getFieldsValue();
      const privValues = privForm.getFieldsValue();

      if (editingUser) {
        // Modify user
        const userKey = `${editingUser.User}@${editingUser.Host}`;
        await adminApi.modifyUser(connectionId, userKey, {
          password: basicValues.password || undefined,
          authPlugin: basicValues.authPlugin,
        });
        // Update privileges
        const currentPrivs: string[] = privValues.privileges || [];
        // Simple approach: revoke all then grant selected
        const allOptions = PRIVILEGE_GROUPS.flatMap(g => g.options);
        const toRevoke = allOptions.filter(p => !currentPrivs.includes(p));
        await adminApi.modifyPrivileges(connectionId, userKey, {
          grant: currentPrivs,
          revoke: toRevoke,
        });
        message.success('用户已更新');
      } else {
        // Create user
        await adminApi.createUser(connectionId, {
          username: basicValues.username,
          host: basicValues.host || '%',
          password: basicValues.password,
          authPlugin: basicValues.authPlugin,
        });
        const userKey = `${basicValues.username}@${basicValues.host || '%'}`;
        const privs: string[] = privValues.privileges || [];
        if (privs.length > 0) {
          await adminApi.modifyPrivileges(connectionId, userKey, { grant: privs, revoke: [] });
        }
        message.success('用户已创建');
      }
      setDrawerOpen(false);
      fetchUsers();
    } catch (err: any) {
      message.error(`保存失败: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: '用户名', dataIndex: 'User', key: 'User', sorter: (a: MySQLUser, b: MySQLUser) => a.User.localeCompare(b.User) },
    { title: '主机', dataIndex: 'Host', key: 'Host' },
    { title: '认证插件', dataIndex: 'plugin', key: 'plugin', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '状态', dataIndex: 'account_locked', key: 'locked',
      render: (v: string) => v === 'Y'
        ? <Tag color="red" icon={<LockOutlined />}>锁定</Tag>
        : <Tag color="green" icon={<UnlockOutlined />}>正常</Tag>,
    },
    {
      title: '密码过期', dataIndex: 'password_expired', key: 'expired',
      render: (v: string) => v === 'Y' ? <Tag color="orange">已过期</Tag> : <Tag>否</Tag>,
    },
    { title: '最大连接数', dataIndex: 'max_connections', key: 'max_conn', render: (v: number) => v || '无限制' },
    {
      title: '操作', key: 'actions', width: 120,
      render: (_: unknown, record: MySQLUser) => (
        <Space>
          <Tooltip title="编辑"><Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip>
          <Popconfirm title={`确定删除用户 ${record.User}@${record.Host}？`} onConfirm={() => handleDelete(record)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Modal
        title="用户管理"
        open={open}
        onCancel={onClose}
        footer={null}
        width={900}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Button type="primary" icon={<UserAddOutlined />} onClick={handleCreate}>创建用户</Button>
            <Button icon={<ReloadOutlined />} onClick={fetchUsers} loading={loading}>刷新</Button>
          </Space>
        </div>
        <Table
          dataSource={users}
          columns={columns}
          rowKey={(r) => `${r.User}@${r.Host}`}
          loading={loading}
          size="small"
          pagination={{ pageSize: 15 }}
          scroll={{ y: 400 }}
        />
      </Modal>

      <Drawer
        title={editingUser ? `编辑用户: ${editingUser.User}@${editingUser.Host}` : '创建用户'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={500}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>保存</Button>
          </Space>
        }
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          {
            key: 'basic',
            label: '基本信息',
            children: (
              <Form form={form} layout="vertical">
                <Form.Item name="username" label="用户名" rules={[{ required: !editingUser, message: '请输入用户名' }]}>
                  <Input disabled={!!editingUser} placeholder="username" />
                </Form.Item>
                <Form.Item name="host" label="主机" initialValue="%">
                  <Input disabled={!!editingUser} placeholder="%" />
                </Form.Item>
                <Form.Item name="password" label="密码">
                  <Input.Password placeholder={editingUser ? '留空则不修改' : '密码'} />
                </Form.Item>
                <Form.Item name="authPlugin" label="认证插件" initialValue="caching_sha2_password">
                  <Select options={[
                    { label: 'caching_sha2_password', value: 'caching_sha2_password' },
                    { label: 'mysql_native_password', value: 'mysql_native_password' },
                    { label: 'sha256_password', value: 'sha256_password' },
                  ]} />
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'privileges',
            label: '权限',
            children: (
              <Form form={privForm} layout="vertical">
                <Form.Item name="privileges" label="全局权限">
                  <Checkbox.Group style={{ width: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {PRIVILEGE_GROUPS.map(group => (
                        <div key={group.label}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{group.label}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {group.options.map(opt => (
                              <Checkbox key={opt} value={opt} style={{ width: 180 }}>{opt}</Checkbox>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Checkbox.Group>
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'resource',
            label: '资源限制',
            children: (
              <Form layout="vertical">
                <Form.Item label="最大连接数 (MAX_CONNECTIONS_PER_HOUR)">
                  <InputNumber min={0} placeholder="0 = 无限制" style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="最大用户连接 (MAX_USER_CONNECTIONS)">
                  <InputNumber min={0} placeholder="0 = 无限制" style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="最大查询数/小时 (MAX_QUERIES_PER_HOUR)">
                  <InputNumber min={0} placeholder="0 = 无限制" style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="最大更新数/小时 (MAX_UPDATES_PER_HOUR)">
                  <InputNumber min={0} placeholder="0 = 无限制" style={{ width: '100%' }} />
                </Form.Item>
              </Form>
            ),
          },
        ]} />
      </Drawer>
    </>
  );
};

export default UserManager;
