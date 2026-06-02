/**
 * MainLayout — 三栏布局：对象树 / SQL编辑器+结果 / 日志

 */

import React, { useEffect } from 'react';
import { ConfigProvider, Layout, Button, Space, Tag, Select, message } from 'antd';
import {
  PlusOutlined, SettingOutlined,
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import { useConnectionStore } from './stores/connectionStore';
import { useObjectTreeStore } from './stores/objectTreeStore';
import { useLogStore } from './stores/logStore';
import ConnectionModal from './components/ConnectionModal';
import DatabaseTree from './components/DatabaseTree';
import SQLEditor from './components/SQLEditor';
import DataGrid from './components/DataGrid';
import LogPanel from './components/LogPanel';

const { Header, Sider } = Layout;

function App() {
  const { connections, fetchConnections, activeConnectionId, connect, disconnect } = useConnectionStore();
  const { loadDatabases } = useObjectTreeStore();
  const { connect: connectWS } = useLogStore();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingConn, setEditingConn] = React.useState<any>(null);

  useEffect(() => {
    fetchConnections();
    connectWS();
  }, []);

  const handleConnect = async (id: string) => {
    try {
      const result = await connect(id);
      message.success(`Connected to ${result.serverVersion}`);
      loadDatabases(id, result.databases);
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleDisconnect = async (id: string) => {
    await disconnect(id);
    message.success('已断开连接');
  };

  // 保留 handleDisconnect 给将来的断开按钮使用
  void handleDisconnect;

  return (
    <ConfigProvider locale={zhCN}>
      <Layout style={{ height: '100vh' }}>
        {/* 顶部导航栏 */}
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#001529', padding: '0 16px', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ color: 'white', margin: 0, fontSize: 18, fontWeight: 600 }}>ReidiSQL</h1>
            <Tag color="blue" style={{ fontSize: 11 }}>Sprint 1</Tag>
          </div>

          <Space>
            <Select
              style={{ width: 200 }}
              placeholder="选择连接..."
              value={activeConnectionId}
              onChange={(val) => {
                if (val) handleConnect(val);
              }}
              options={connections.map(c => ({ label: c.name, value: c.id }))}
            />
            <Button icon={<PlusOutlined />} type="primary" onClick={() => setModalOpen(true)}>
              新建
            </Button>
            <Button icon={<SettingOutlined />} />
          </Space>
        </Header>

        <Layout>
          {/* 左侧面板 */}
          <Sider
            width={280}
            theme="light"
            style={{ borderRight: '1px solid #f0f0f0', overflow: 'auto' }}
          >
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>数据库对象</span>
              <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => setModalOpen(true)} />
            </div>
            <DatabaseTree />
          </Sider>

          {/* 中间内容区 */}
          <Layout style={{ display: 'flex', flexDirection: 'column' }}>
            {/* SQL 编辑器 */}
            <div style={{ flex: '0 0 45%', borderBottom: '3px solid #f0f0f0', minHeight: 300 }}>
              <SQLEditor />
            </div>

            {/* 结果网格 */}
            <div style={{ flex: 1, minHeight: 250 }}>
              <DataGrid />
            </div>
          </Layout>
        </Layout>

        {/* 底部日志 */}
        <div style={{ height: 180, borderTop: '2px solid #f0f0f0' }}>
          <LogPanel />
        </div>
      </Layout>

      {/* 连接模态框 */}
      <ConnectionModal
        open={modalOpen}
        editingConnection={editingConn}
        onClose={() => {
          setModalOpen(false);
          setEditingConn(null);
        }}
        onSaved={async (connId) => {
          try {
            const result = await connect(connId);
            message.success(`已连接 ${result.serverVersion}`);
            loadDatabases(connId, result.databases);
          } catch (err: any) {
            message.error(`连接失败: ${err.message}`);
          }
        }}
      />
    </ConfigProvider>
  );
}

export default App;
