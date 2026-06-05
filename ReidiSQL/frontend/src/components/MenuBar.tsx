/**
 * MenuBar — 菜单栏组件 (Sprint 6)
 * 使用 Ant Design Menu 实现结构化菜单栏
 */

import React from 'react';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined, DownloadOutlined, UploadOutlined, ApiOutlined,
  UndoOutlined, RedoOutlined, SearchOutlined,
  ReloadOutlined, BgColorsOutlined,
  ToolOutlined, TeamOutlined, DashboardOutlined,
  SwapOutlined, EditOutlined, ExperimentOutlined,
  BookOutlined, CloudDownloadOutlined, InfoCircleOutlined,
} from '@ant-design/icons';

interface MenuBarProps {
  isConnected: boolean;
  isDark: boolean;
  onNewConnection: () => void;
  onConnectionManager: () => void;
  onImportCSV: () => void;
  onExport: () => void;
  onRefreshTree: () => void;
  onToggleTheme: () => void;
  onTableTools: () => void;
  onUserManager: () => void;
  onServerManager: () => void;
  onSyncDB: () => void;
  onBulkEdit: () => void;
  onGenerateData: () => void;
  onSQLHelp: () => void;
  onUpdateCheck: () => void;
  onAbout: () => void;
  onPreferences: () => void;
}

const MenuBar: React.FC<MenuBarProps> = ({
  isConnected,
  onNewConnection, onConnectionManager, onImportCSV, onExport,
  onRefreshTree, onToggleTheme,
  onTableTools, onUserManager, onServerManager,
  onSyncDB, onBulkEdit, onGenerateData,
  onSQLHelp, onUpdateCheck, onAbout, onPreferences,
}) => {
  const items: MenuProps['items'] = [
    {
      key: 'file',
      label: '文件',
      children: [
        { key: 'new-conn', icon: <PlusOutlined />, label: '新建连接...', onClick: onNewConnection },
        { key: 'conn-manager', icon: <ApiOutlined />, label: '连接管理...', onClick: onConnectionManager },
        { type: 'divider' },
        { key: 'import', icon: <DownloadOutlined />, label: '导入 CSV...', disabled: !isConnected, onClick: onImportCSV },
        { key: 'export', icon: <UploadOutlined />, label: '导出数据...', disabled: !isConnected, onClick: onExport },
        { type: 'divider' },
        { key: 'preferences', icon: <ToolOutlined />, label: '偏好设置...', onClick: onPreferences },
      ],
    },
    {
      key: 'edit',
      label: '编辑',
      children: [
        { key: 'undo', icon: <UndoOutlined />, label: '撤销', disabled: true },
        { key: 'redo', icon: <RedoOutlined />, label: '重做', disabled: true },
        { type: 'divider' },
        { key: 'find', icon: <SearchOutlined />, label: '查找 (Ctrl+F)', disabled: true },
        { key: 'replace', label: '替换 (Ctrl+H)', disabled: true },
      ],
    },
    {
      key: 'view',
      label: '视图',
      children: [
        { key: 'refresh', icon: <ReloadOutlined />, label: '刷新对象树', disabled: !isConnected, onClick: onRefreshTree },
        { type: 'divider' },
        { key: 'theme', icon: <BgColorsOutlined />, label: '切换主题', onClick: onToggleTheme },
      ],
    },
    {
      key: 'tools',
      label: '工具',
      children: [
        { key: 'table-tools', icon: <ToolOutlined />, label: '表工具...', disabled: !isConnected, onClick: onTableTools },
        { key: 'user-mgr', icon: <TeamOutlined />, label: '用户管理...', disabled: !isConnected, onClick: onUserManager },
        { key: 'server-mgr', icon: <DashboardOutlined />, label: '服务器管理...', disabled: !isConnected, onClick: onServerManager },
        { type: 'divider' },
        { key: 'sync-db', icon: <SwapOutlined />, label: '数据库同步...', disabled: !isConnected, onClick: onSyncDB },
        { key: 'bulk-edit', icon: <EditOutlined />, label: '批量编辑...', disabled: !isConnected, onClick: onBulkEdit },
        { key: 'gen-data', icon: <ExperimentOutlined />, label: '数据生成...', disabled: !isConnected, onClick: onGenerateData },
      ],
    },
    {
      key: 'help',
      label: '帮助',
      children: [
        { key: 'sql-help', icon: <BookOutlined />, label: 'SQL 帮助...', onClick: onSQLHelp },
        { key: 'update', icon: <CloudDownloadOutlined />, label: '检查更新...', onClick: onUpdateCheck },
        { type: 'divider' },
        { key: 'about', icon: <InfoCircleOutlined />, label: '关于 ReidiSQL...', onClick: onAbout },
      ],
    },
  ];

  return (
    <div style={{ lineHeight: '32px', borderBottom: '1px solid #f0f0f0' }}>
      <Menu
        mode="horizontal"
        selectable={false}
        items={items}
        style={{ border: 'none', lineHeight: '32px' }}
      />
    </div>
  );
};

export default MenuBar;
