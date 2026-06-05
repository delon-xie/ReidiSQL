/**
 * MainLayout — 三栏布局：对象树 / SQL编辑器+结果 / 日志
 */

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { ConfigProvider, Layout, Button, Space, Tag, Select, message, theme as antdTheme } from 'antd';
import {
  PlusOutlined, SettingOutlined, ApiOutlined,
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import { useConnectionStore } from './stores/connectionStore';
import { useObjectTreeStore } from './stores/objectTreeStore';
import { useLogStore } from './stores/logStore';
import { useTableEditorStore } from './stores/tableEditorStore';
import { useQueryStore } from './stores/queryStore';
import { preferencesApi, queriesApi, connectionsApi } from './lib/api';
import ConnectionModal from './components/ConnectionModal';
import DatabaseTree from './components/DatabaseTree';
import SQLEditor from './components/SQLEditor';
import DataGrid from './components/DataGrid';
import LogPanel from './components/LogPanel';
import TableEditor from './components/TableEditor';
import ExportDialog from './components/ExportDialog';
import ImportWizard from './components/ImportWizard';
import ViewEditor from './components/ViewEditor';
import RoutineEditor from './components/RoutineEditor';
import TriggerEditor from './components/TriggerEditor';
import UserManager from './components/UserManager';
import Preferences from './components/Preferences';
import TableTools from './components/TableTools';
import SQLHelp from './components/SQLHelp';
import UpdateCheck from './components/UpdateCheck';
import ServerManager from './components/ServerManager';
import StatusBar from './components/StatusBar';
import AboutDialog from './components/AboutDialog';
import SyncDB from './components/SyncDB';
import BulkEdit from './components/BulkEdit';
import GenerateData from './components/GenerateData';
import MenuBar from './components/MenuBar';
import ConnectionManager from './components/ConnectionManager';

const { Header, Sider } = Layout;

function App() {
  const { connections, fetchConnections, activeConnectionId, connect, disconnect } = useConnectionStore();
  const { loadDatabases } = useObjectTreeStore();
  const { connect: connectWS } = useLogStore();
  const { init: initTableEditor } = useTableEditorStore();

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingConn, setEditingConn] = React.useState<any>(null);
  const [tableEditorOpen, setTableEditorOpen] = React.useState(false);
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [exportTableName, setExportTableName] = React.useState('');

  // Sprint 3: 导入/视图/存储过程/触发器编辑器
  const [importOpen, setImportOpen] = React.useState(false);
  const [importDatabase, setImportDatabase] = React.useState('');
  const [viewEditorOpen, setViewEditorOpen] = React.useState(false);
  const [viewEditorName, setViewEditorName] = React.useState<string | undefined>(undefined);
  const [viewEditorDb, setViewEditorDb] = React.useState('');
  const [routineEditorOpen, setRoutineEditorOpen] = React.useState(false);
  const [routineEditorName, setRoutineEditorName] = React.useState<string | undefined>(undefined);
  const [routineEditorType, setRoutineEditorType] = React.useState<'PROCEDURE' | 'FUNCTION'>('PROCEDURE');
  const [routineEditorDb, setRoutineEditorDb] = React.useState('');
  const [triggerEditorOpen, setTriggerEditorOpen] = React.useState(false);
  const [triggerEditorName, setTriggerEditorName] = React.useState<string | undefined>(undefined);
  const [triggerEditorDb, setTriggerEditorDb] = React.useState('');

  // Sprint 4: 管理/工具/偏好/帮助/更新
  const [userManagerOpen, setUserManagerOpen] = React.useState(false);
  const [preferencesOpen, setPreferencesOpen] = React.useState(false);
  const [tableToolsOpen, setTableToolsOpen] = React.useState(false);
  const [tableToolsDatabase, setTableToolsDatabase] = React.useState('');
  const [sqlHelpOpen, setSqlHelpOpen] = React.useState(false);
  const [updateCheckOpen, setUpdateCheckOpen] = React.useState(false);

  // Sprint 5: 服务器管理/关于/主题
  const [serverManagerOpen, setServerManagerOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [isDark, setIsDark] = useState(false);

  // Sprint 6: 可拖拽分割条
  const [splitRatio, setSplitRatio] = useState(() => {
    const saved = localStorage.getItem('reidisql_splitter_ratio');
    return saved ? parseFloat(saved) : 0.5;
  });
  const splitterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // Sprint 6: 新组件状态
  const [connectionManagerOpen, setConnectionManagerOpen] = React.useState(false);
  const [syncDbOpen, setSyncDbOpen] = React.useState(false);
  const [bulkEditOpen, setBulkEditOpen] = React.useState(false);
  const [bulkEditDatabase, setBulkEditDatabase] = React.useState('');
  const [generateDataOpen, setGenerateDataOpen] = React.useState(false);
  const [generateDataDatabase, setGenerateDataDatabase] = React.useState('');

  const handleSplitterMouseDown = useCallback(() => {
    draggingRef.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = (e.clientY - rect.top) / rect.height;
      const clamped = Math.max(0.15, Math.min(0.85, ratio));
      setSplitRatio(clamped);
    };
    const handleMouseUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // 保存到 localStorage
        localStorage.setItem('reidisql_splitter_ratio', String(splitRatio));
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [splitRatio]);

  const handleSplitterDoubleClick = useCallback(() => {
    setSplitRatio(0.5);
    localStorage.setItem('reidisql_splitter_ratio', '0.5');
  }, []);

  // 加载偏好设置中的主题
  useEffect(() => {
    preferencesApi.get().then(prefs => {
      const themePref = prefs.general?.theme;
      if (themePref === 'dark') {
        setIsDark(true);
      } else if (themePref === 'system') {
        setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    }).catch(() => {});
  }, []);

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

  void handleDisconnect;

  // 表设计器回调
  const handleDesignTable = useCallback((database: string, tableName: string) => {
    if (!activeConnectionId) return;
    initTableEditor(tableName ? 'alter' : 'create', activeConnectionId, database, tableName || undefined);
    setTableEditorOpen(true);
  }, [activeConnectionId, initTableEditor]);

  // 导出回调
  const handleExportTable = useCallback((_database: string, tableName: string) => {
    setExportTableName(tableName);
    setExportDialogOpen(true);
  }, []);

  // 表设计器成功回调 - 刷新对象树
  const handleTableEditorSuccess = useCallback((_tableName: string) => {
    // 刷新对象树（重新加载数据库列表）
    if (activeConnectionId) {
      const { loadDatabases } = useObjectTreeStore.getState();
      const { connect } = useConnectionStore.getState();
      connect(activeConnectionId).then(result => {
        loadDatabases(activeConnectionId, result.databases);
      }).catch(() => {});
    }
  }, [activeConnectionId]);

  // DataGrid 导出按钮
  const handleGridExport = useCallback(() => {
    setExportDialogOpen(true);
  }, []);

  // Sprint 3: 回调处理
  const handleImportCSV = useCallback((database: string) => {
    setImportDatabase(database);
    setImportOpen(true);
  }, []);

  const handleEditView = useCallback((database: string, viewName: string) => {
    setViewEditorDb(database);
    setViewEditorName(viewName);
    setViewEditorOpen(true);
  }, []);

  const handleNewView = useCallback((database: string) => {
    setViewEditorDb(database);
    setViewEditorName(undefined);
    setViewEditorOpen(true);
  }, []);

  const handleEditRoutine = useCallback((database: string, routineName: string, type: 'PROCEDURE' | 'FUNCTION') => {
    setRoutineEditorDb(database);
    setRoutineEditorName(routineName);
    setRoutineEditorType(type);
    setRoutineEditorOpen(true);
  }, []);

  const handleNewRoutine = useCallback((database: string, type: 'PROCEDURE' | 'FUNCTION') => {
    setRoutineEditorDb(database);
    setRoutineEditorName(undefined);
    setRoutineEditorType(type);
    setRoutineEditorOpen(true);
  }, []);

  const handleEditTrigger = useCallback((database: string, triggerName: string) => {
    setTriggerEditorDb(database);
    setTriggerEditorName(triggerName);
    setTriggerEditorOpen(true);
  }, []);

  const handleNewTrigger = useCallback((database: string) => {
    setTriggerEditorDb(database);
    setTriggerEditorName(undefined);
    setTriggerEditorOpen(true);
  }, []);

  // 通用刷新回调
  const handleRefreshTree = useCallback(() => {
    if (activeConnectionId) {
      const { loadDatabases } = useObjectTreeStore.getState();
      const { connect } = useConnectionStore.getState();
      connect(activeConnectionId).then(result => {
        loadDatabases(activeConnectionId, result.databases);
      }).catch(() => {});
    }
  }, [activeConnectionId]);

  // Sprint 4: 表工具回调
  const handleTableTools = useCallback((database: string) => {
    setTableToolsDatabase(database);
    setTableToolsOpen(true);
  }, []);

  // Sprint 6: 新增回调
  const handleNewQuery = useCallback((_database?: string) => {
    useQueryStore.getState().addTab(_database ? `Query - ${_database}` : 'New Query');
  }, []);

  const handleOpenData = useCallback((_database: string, tableName: string) => {
    const store = useQueryStore.getState();
    store.addTab(`Data - ${tableName}`);
    const sql = `SELECT * FROM \`${tableName}\` LIMIT 1000;`;
    const { tabs } = useQueryStore.getState();
    const newTab = tabs[tabs.length - 1];
    store.updateTabSQL(newTab.id, sql);
    if (activeConnectionId) {
      store.executeQuery(activeConnectionId, newTab.id);
    }
  }, [activeConnectionId]);

  const handleCopyName = useCallback((name: string) => {
    navigator.clipboard.writeText(name).then(() => message.success(`已复制: ${name}`));
  }, []);

  const handleGenerateSelect = useCallback((_database: string, tableName: string) => {
    const sql = `SELECT * FROM \`${tableName}\` LIMIT 100;`;
    navigator.clipboard.writeText(sql).then(() => message.success('已生成 SELECT 语句'));
  }, []);

  const handleTruncateTable = useCallback(async (database: string, tableName: string) => {
    if (!activeConnectionId) return;
    try {
      await queriesApi.execute(activeConnectionId, `TRUNCATE TABLE \`${database}\`.\`${tableName}\``);
      message.success(`已清空表 ${tableName}`);
    } catch (err: any) {
      message.error(`清空表失败: ${err.message}`);
    }
  }, [activeConnectionId]);

  const handleDropTable = useCallback(async (database: string, tableName: string) => {
    if (!activeConnectionId) return;
    try {
      await queriesApi.execute(activeConnectionId, `DROP TABLE \`${database}\`.\`${tableName}\``);
      message.success(`已删除表 ${tableName}`);
      handleRefreshTree();
    } catch (err: any) {
      message.error(`删除表失败: ${err.message}`);
    }
  }, [activeConnectionId, handleRefreshTree]);

  const handleBulkEdit = useCallback((database?: string) => {
    setBulkEditDatabase(database || '');
    setBulkEditOpen(true);
  }, []);

  const handleGenerateData = useCallback((database?: string) => {
    setGenerateDataDatabase(database || '');
    setGenerateDataOpen(true);
  }, []);

  const handleToggleTheme = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { borderRadius: 6 },
      }}
    >
      <Layout style={{ height: '100vh' }}>
        {/* Sprint 6: 菜单栏 */}
        <MenuBar
          isConnected={!!activeConnectionId}
          isDark={isDark}
          onNewConnection={() => setModalOpen(true)}
          onConnectionManager={() => setConnectionManagerOpen(true)}
          onImportCSV={() => { setImportDatabase(''); setImportOpen(true); }}
          onExport={() => setExportDialogOpen(true)}
          onRefreshTree={handleRefreshTree}
          onToggleTheme={handleToggleTheme}
          onTableTools={() => { setTableToolsDatabase(''); setTableToolsOpen(true); }}
          onUserManager={() => setUserManagerOpen(true)}
          onServerManager={() => setServerManagerOpen(true)}
          onSyncDB={() => setSyncDbOpen(true)}
          onBulkEdit={() => handleBulkEdit()}
          onGenerateData={() => handleGenerateData()}
          onSQLHelp={() => setSqlHelpOpen(true)}
          onUpdateCheck={() => setUpdateCheckOpen(true)}
          onAbout={() => setAboutOpen(true)}
          onPreferences={() => setPreferencesOpen(true)}
        />

        {/* 顶部导航栏（简化工具条） */}
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#001529', padding: '0 16px', zIndex: 10, height: 48, lineHeight: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ color: 'white', margin: 0, fontSize: 18, fontWeight: 600 }}>ReidiSQL</h1>
            <Tag color="blue" style={{ fontSize: 11 }}>Sprint 6</Tag>
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
            <Button icon={<ApiOutlined />} onClick={() => setConnectionManagerOpen(true)}>
              连接管理
            </Button>
            <Button icon={<SettingOutlined />} onClick={() => setPreferencesOpen(true)} />
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
            <DatabaseTree
              onDesignTable={handleDesignTable}
              onExportTable={handleExportTable}
              onImportCSV={handleImportCSV}
              onEditView={handleEditView}
              onNewView={handleNewView}
              onEditRoutine={handleEditRoutine}
              onNewRoutine={handleNewRoutine}
              onEditTrigger={handleEditTrigger}
              onNewTrigger={handleNewTrigger}
              onTableTools={handleTableTools}
              onNewQuery={handleNewQuery}
              onOpenData={handleOpenData}
              onTruncateTable={handleTruncateTable}
              onDropTable={handleDropTable}
              onCopyName={handleCopyName}
              onGenerateSelect={handleGenerateSelect}
              onEditConnection={(connId) => { setEditingConn(connections.find(c => c.id === connId) || null); setModalOpen(true); }}
              onDeleteConnection={async (connId) => {
                try {
                  await connectionsApi.delete(connId);
                  message.success('连接已删除');
                  fetchConnections();
                } catch (err: any) {
                  message.error(`删除失败: ${err.message}`);
                }
              }}
              onDisconnectConnection={async (connId) => {
                await disconnect(connId);
                message.success('已断开连接');
              }}
            />
          </Sider>

          {/* 中间内容区 */}
          <Layout ref={containerRef} style={{ display: 'flex', flexDirection: 'column' }}>
            {/* SQL 编辑器 */}
            <div style={{ flex: `0 0 ${splitRatio * 100}%`, minHeight: 200, overflow: 'hidden' }}>
              <SQLEditor isDark={isDark} />
            </div>

            {/* 可拖拽分割条 */}
            <div
              ref={splitterRef}
              onMouseDown={handleSplitterMouseDown}
              onDoubleClick={handleSplitterDoubleClick}
              style={{
                height: 6,
                cursor: 'row-resize',
                background: isDark ? '#1f1f1f' : '#f0f0f0',
                borderBottom: `1px solid ${isDark ? '#303030' : '#e0e0e0'}`,
                flexShrink: 0,
                position: 'relative',
                zIndex: 5,
              }}
            >
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 40,
                height: 2,
                background: isDark ? '#555' : '#ccc',
                borderRadius: 1,
              }} />
            </div>

            {/* 结果网格 */}
            <div style={{ flex: 1, minHeight: 150, overflow: 'hidden' }}>
              <DataGrid onExport={handleGridExport} isDark={isDark} />
            </div>
          </Layout>
        </Layout>

        {/* 底部日志 */}
        <div style={{ height: 152, borderTop: '2px solid #f0f0f0' }}>
          <LogPanel />
        </div>

        {/* Sprint 5: 状态栏 */}
        <StatusBar />
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

      {/* 表设计器 */}
      <TableEditor
        open={tableEditorOpen}
        onClose={() => setTableEditorOpen(false)}
        onSuccess={handleTableEditorSuccess}
      />

      {/* 导出对话框 */}
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        tableName={exportTableName}
      />

      {/* CSV 导入向导 */}
      <ImportWizard
        open={importOpen}
        connectionId={activeConnectionId || ''}
        database={importDatabase}
        onClose={() => setImportOpen(false)}
        onSuccess={handleRefreshTree}
      />

      {/* 视图编辑器 */}
      <ViewEditor
        open={viewEditorOpen}
        connectionId={activeConnectionId || ''}
        database={viewEditorDb}
        viewName={viewEditorName}
        onClose={() => setViewEditorOpen(false)}
        onSuccess={handleRefreshTree}
      />

      {/* 存储过程/函数编辑器 */}
      <RoutineEditor
        open={routineEditorOpen}
        connectionId={activeConnectionId || ''}
        database={routineEditorDb}
        routineName={routineEditorName}
        routineType={routineEditorType}
        onClose={() => setRoutineEditorOpen(false)}
        onSuccess={handleRefreshTree}
      />

      {/* 触发器编辑器 */}
      <TriggerEditor
        open={triggerEditorOpen}
        connectionId={activeConnectionId || ''}
        database={triggerEditorDb}
        triggerName={triggerEditorName}
        onClose={() => setTriggerEditorOpen(false)}
        onSuccess={handleRefreshTree}
      />

      {/* Sprint 4: 用户管理 */}
      <UserManager
        open={userManagerOpen}
        connectionId={activeConnectionId || ''}
        onClose={() => setUserManagerOpen(false)}
      />

      {/* Sprint 4: 偏好设置 */}
      <Preferences
        open={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
      />

      {/* Sprint 4: 表工具 */}
      <TableTools
        open={tableToolsOpen}
        connectionId={activeConnectionId || ''}
        database={tableToolsDatabase}
        onClose={() => setTableToolsOpen(false)}
      />

      {/* Sprint 4: SQL 帮助 */}
      <SQLHelp
        open={sqlHelpOpen}
        onClose={() => setSqlHelpOpen(false)}
      />

      {/* Sprint 4: 检查更新 */}
      <UpdateCheck
        open={updateCheckOpen}
        onClose={() => setUpdateCheckOpen(false)}
      />

      {/* Sprint 5: 服务器管理 */}
      <ServerManager
        open={serverManagerOpen}
        connectionId={activeConnectionId || ''}
        onClose={() => setServerManagerOpen(false)}
      />

      {/* Sprint 5: 关于对话框 */}
      <AboutDialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />

      {/* Sprint 6: 连接管理 */}
      <ConnectionManager
        open={connectionManagerOpen}
        onClose={() => setConnectionManagerOpen(false)}
        onNewConnection={() => { setConnectionManagerOpen(false); setEditingConn(null); setModalOpen(true); }}
        onEditConnection={(conn) => { setConnectionManagerOpen(false); setEditingConn(conn); setModalOpen(true); }}
      />

      {/* Sprint 6: 数据库同步 */}
      <SyncDB
        open={syncDbOpen}
        connectionId={activeConnectionId || ''}
        onClose={() => setSyncDbOpen(false)}
      />

      {/* Sprint 6: 批量编辑 */}
      <BulkEdit
        open={bulkEditOpen}
        connectionId={activeConnectionId || ''}
        database={bulkEditDatabase}
        onClose={() => setBulkEditOpen(false)}
      />

      {/* Sprint 6: 数据生成 */}
      <GenerateData
        open={generateDataOpen}
        connectionId={activeConnectionId || ''}
        database={generateDataDatabase}
        onClose={() => setGenerateDataOpen(false)}
      />
    </ConfigProvider>
  );
}

export default App;
