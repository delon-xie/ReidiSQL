/**
 * 数据库对象树 — 左侧面板（增强版右键菜单）
 */

import React, { useCallback, useState } from 'react';
import { Tree, Spin, Empty, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import {
  DatabaseOutlined, TableOutlined, EyeOutlined, CodeOutlined,
  FunctionOutlined, ThunderboltOutlined, ScheduleOutlined,
  FolderOutlined, ColumnHeightOutlined, KeyOutlined,
  EditOutlined, DownloadOutlined, ReloadOutlined, PlusOutlined,
  ToolOutlined, CopyOutlined, DeleteOutlined, ScissorOutlined,
  PlayCircleOutlined, DisconnectOutlined, FileTextOutlined,
} from '@ant-design/icons';
import type { TreeDataNode } from 'antd';
import { useObjectTreeStore, TreeNode } from '@/stores/objectTreeStore';
import { useConnectionStore } from '@/stores/connectionStore';

const ICON_MAP: Record<string, React.ReactNode> = {
  database: <DatabaseOutlined />,
  table: <TableOutlined />,
  view: <EyeOutlined />,
  code: <CodeOutlined />,
  function: <FunctionOutlined />,
  thunderbolt: <ThunderboltOutlined />,
  schedule: <ScheduleOutlined />,
  table_group: <FolderOutlined />,
  view_group: <FolderOutlined />,
  procedure_group: <FolderOutlined />,
  function_group: <FolderOutlined />,
  trigger_group: <FolderOutlined />,
  event_group: <FolderOutlined />,
  column: <ColumnHeightOutlined />,
  index: <KeyOutlined />,
};

interface DatabaseTreeProps {
  onDesignTable?: (database: string, tableName: string) => void;
  onExportTable?: (database: string, tableName: string) => void;
  onRefreshTree?: () => void;
  onImportCSV?: (database: string) => void;
  onEditView?: (database: string, viewName: string) => void;
  onNewView?: (database: string) => void;
  onEditRoutine?: (database: string, routineName: string, type: 'PROCEDURE' | 'FUNCTION') => void;
  onNewRoutine?: (database: string, type: 'PROCEDURE' | 'FUNCTION') => void;
  onEditTrigger?: (database: string, triggerName: string) => void;
  onNewTrigger?: (database: string) => void;
  onTableTools?: (database: string) => void;
  // Sprint 6: 增强回调
  onNewQuery?: (database?: string) => void;
  onOpenData?: (database: string, tableName: string) => void;
  onTruncateTable?: (database: string, tableName: string) => void;
  onDropTable?: (database: string, tableName: string) => void;
  onCopyName?: (name: string) => void;
  onGenerateSelect?: (database: string, tableName: string) => void;
  onEditConnection?: (connectionId: string) => void;
  onDeleteConnection?: (connectionId: string) => void;
  onDisconnectConnection?: (connectionId: string) => void;
}

function toAntdTreeData(nodes: TreeNode[]): TreeDataNode[] {
  return nodes.map(n => ({
    key: n.key,
    title: n.title,
    icon: ICON_MAP[n.icon || ''] || ICON_MAP[n.type] || null,
    isLeaf: n.isLeaf ?? (!n.children || n.children.length === 0),
    children: n.children ? toAntdTreeData(n.children) : undefined,
  }));
}

const DatabaseTree: React.FC<DatabaseTreeProps> = ({
  onDesignTable, onExportTable, onRefreshTree: _onRefreshTree,
  onImportCSV, onEditView, onNewView, onEditRoutine, onNewRoutine,
  onEditTrigger, onNewTrigger, onTableTools,
  onNewQuery, onOpenData, onTruncateTable, onDropTable, onCopyName,
  onGenerateSelect, onEditConnection, onDeleteConnection, onDisconnectConnection,
}) => {
  const { treeData, expandedKeys, setExpandedKeys, setSelectedKey } = useObjectTreeStore();
  const { activeConnectionId } = useConnectionStore();
  const [loadingKey, setLoadingKey] = React.useState<string | null>(null);
  const { loadTables, loadTableDetails, loadViews, loadRoutines } = useObjectTreeStore();

  // 右键菜单
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeKey: string; nodeType: string; database: string; tableName: string; nodeTitle: string } | null>(null);

  const handleExpand = useCallback(async (keys: React.Key[], info: any) => {
    setExpandedKeys(keys as string[]);
    const node = info.node;
    const key = node.key as string;

    if (!info.expanded) return;

    setLoadingKey(key);
    try {
      const parts = key.split('/');
      const connId = parts[0];
      const db = parts[2];

      if (node.type === 'database' || key.endsWith('/tables') && !node.children?.length) {
        if (key.includes('/tables')) {
          await loadTables(connId, db);
        }
      } else if (key.endsWith('/tables')) {
        await loadTables(connId, db);
      } else if (key.endsWith('/views')) {
        await loadViews(connId, db);
      } else if (key.endsWith('/procedures') || key.endsWith('/functions')) {
        await loadRoutines(connId, db);
      } else if (node.type === 'table') {
        await loadTableDetails(connId, db, node.tableName);
      }
    } catch (err) {
      console.error('Failed to load tree node:', err);
    } finally {
      setLoadingKey(null);
    }
  }, [setExpandedKeys, loadTables, loadTableDetails, loadViews, loadRoutines]);

  const handleSelect = useCallback((keys: React.Key[]) => {
    setSelectedKey((keys[0] as string) || null);
  }, [setSelectedKey]);

  // 双击打开编辑器
  const handleDoubleClick = useCallback((_event: React.MouseEvent, node: any) => {
    const parts = (node.key as string).split('/');
    const db = parts[2];

    if (node.type === 'table') {
      onDesignTable?.(db, node.tableName);
    } else if (node.type === 'view') {
      onEditView?.(db, node.title);
    } else if (node.type === 'code') {
      onEditRoutine?.(db, node.title, 'PROCEDURE');
    } else if (node.type === 'function') {
      onEditRoutine?.(db, node.title, 'FUNCTION');
    } else if (node.type === 'thunderbolt') {
      onEditTrigger?.(db, node.title);
    }
  }, [onDesignTable, onEditView, onEditRoutine, onEditTrigger]);

  // 右键菜单
  const handleRightClick = useCallback(({ event, node }: any) => {
    event.preventDefault();
    const key = node.key as string;
    const parts = key.split('/');
    const db = parts[2] || '';
    const tableName = node.type === 'table' ? node.tableName : '';

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      nodeKey: key,
      nodeType: node.type || '',
      database: db,
      tableName: tableName || '',
      nodeTitle: String(node.title) || '',
    });
  }, []);

  // 关闭右键菜单
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // 右键菜单项
  const contextMenuItems: MenuProps['items'] = (() => {
    const type = contextMenu?.nodeType;
    const db = contextMenu?.database || '';
    const name = contextMenu?.tableName || '';
    const nodeTitle = contextMenu?.nodeTitle || '';

    switch (type) {
      case 'table':
        return [
          { key: 'open', icon: <PlayCircleOutlined />, label: '打开数据 (SELECT *)', onClick: () => { onOpenData?.(db, name); closeContextMenu(); } },
          { key: 'design', icon: <EditOutlined />, label: '设计表', onClick: () => { onDesignTable?.(db, name); closeContextMenu(); } },
          { key: 'export', icon: <DownloadOutlined />, label: '导出数据', onClick: () => { onExportTable?.(db, name); closeContextMenu(); } },
          { type: 'divider' as const },
          { key: 'copy-name', icon: <CopyOutlined />, label: '复制表名', onClick: () => { onCopyName?.(name); closeContextMenu(); } },
          { key: 'gen-select', icon: <FileTextOutlined />, label: '生成 SELECT', onClick: () => { onGenerateSelect?.(db, name); closeContextMenu(); } },
          { type: 'divider' as const },
          { key: 'truncate', icon: <ScissorOutlined />, label: '清空表 (TRUNCATE)', danger: true, onClick: () => { onTruncateTable?.(db, name); closeContextMenu(); } },
          { key: 'drop', icon: <DeleteOutlined />, label: '删除表 (DROP)', danger: true, onClick: () => { onDropTable?.(db, name); closeContextMenu(); } },
          { type: 'divider' as const },
          { key: 'refresh', icon: <ReloadOutlined />, label: '刷新', onClick: () => { closeContextMenu(); } },
        ];
      case 'table_group':
        return [
          { key: 'newtable', icon: <PlusOutlined />, label: '新建表...', onClick: () => { onDesignTable?.(db, ''); closeContextMenu(); } },
          { key: 'import', icon: <DownloadOutlined />, label: '导入 CSV...', onClick: () => { onImportCSV?.(db); closeContextMenu(); } },
          { key: 'tools', icon: <ToolOutlined />, label: '表工具...', onClick: () => { onTableTools?.(db); closeContextMenu(); } },
        ];
      case 'view':
        return [
          { key: 'edit', icon: <EditOutlined />, label: '编辑视图', onClick: () => { onEditView?.(db, nodeTitle || name); closeContextMenu(); } },
          { key: 'copy-name', icon: <CopyOutlined />, label: '复制名称', onClick: () => { onCopyName?.(nodeTitle || name); closeContextMenu(); } },
        ];
      case 'view_group':
        return [
          { key: 'newview', icon: <PlusOutlined />, label: '新建视图...', onClick: () => { onNewView?.(db); closeContextMenu(); } },
        ];
      case 'code':
      case 'function':
        return [
          { key: 'edit', icon: <EditOutlined />, label: '编辑', onClick: () => { onEditRoutine?.(db, nodeTitle || name, type === 'function' ? 'FUNCTION' : 'PROCEDURE'); closeContextMenu(); } },
          { key: 'copy-name', icon: <CopyOutlined />, label: '复制名称', onClick: () => { onCopyName?.(nodeTitle || name); closeContextMenu(); } },
        ];
      case 'procedure_group':
        return [
          { key: 'newproc', icon: <PlusOutlined />, label: '新建存储过程...', onClick: () => { onNewRoutine?.(db, 'PROCEDURE'); closeContextMenu(); } },
        ];
      case 'function_group':
        return [
          { key: 'newfunc', icon: <PlusOutlined />, label: '新建函数...', onClick: () => { onNewRoutine?.(db, 'FUNCTION'); closeContextMenu(); } },
        ];
      case 'thunderbolt':
        return [
          { key: 'edit', icon: <EditOutlined />, label: '编辑触发器', onClick: () => { onEditTrigger?.(db, nodeTitle || name); closeContextMenu(); } },
          { key: 'copy-name', icon: <CopyOutlined />, label: '复制名称', onClick: () => { onCopyName?.(nodeTitle || name); closeContextMenu(); } },
        ];
      case 'trigger_group':
        return [
          { key: 'newtrigger', icon: <PlusOutlined />, label: '新建触发器...', onClick: () => { onNewTrigger?.(db); closeContextMenu(); } },
        ];
      case 'database':
        return [
          { key: 'new-query', icon: <FileTextOutlined />, label: '新建查询', onClick: () => { onNewQuery?.(db); closeContextMenu(); } },
          { type: 'divider' as const },
          { key: 'newtable', icon: <PlusOutlined />, label: '新建表...', onClick: () => { onDesignTable?.(db, ''); closeContextMenu(); } },
          { key: 'newview', icon: <PlusOutlined />, label: '新建视图...', onClick: () => { onNewView?.(db); closeContextMenu(); } },
          { type: 'divider' as const },
          { key: 'import', icon: <DownloadOutlined />, label: '导入 CSV...', onClick: () => { onImportCSV?.(db); closeContextMenu(); } },
          { key: 'tools', icon: <ToolOutlined />, label: '表工具...', onClick: () => { onTableTools?.(db); closeContextMenu(); } },
          { type: 'divider' as const },
          { key: 'copy-name', icon: <CopyOutlined />, label: '复制数据库名', onClick: () => { onCopyName?.(db); closeContextMenu(); } },
          { key: 'refresh', icon: <ReloadOutlined />, label: '刷新', onClick: () => { closeContextMenu(); } },
        ];
      case 'column':
        return [
          { key: 'copy-name', icon: <CopyOutlined />, label: '复制列名', onClick: () => { onCopyName?.(nodeTitle); closeContextMenu(); } },
        ];
      default:
        // 连接节点（没有匹配的 type）
        if (contextMenu?.nodeKey && !contextMenu.nodeKey.includes('/')) {
          return [
            { key: 'new-query', icon: <FileTextOutlined />, label: '新建查询', onClick: () => { onNewQuery?.(); closeContextMenu(); } },
            { key: 'edit', icon: <EditOutlined />, label: '编辑连接', onClick: () => { onEditConnection?.(contextMenu.nodeKey); closeContextMenu(); } },
            { key: 'disconnect', icon: <DisconnectOutlined />, label: '断开连接', onClick: () => { onDisconnectConnection?.(contextMenu.nodeKey); closeContextMenu(); } },
            { type: 'divider' as const },
            { key: 'delete', icon: <DeleteOutlined />, label: '删除连接', danger: true, onClick: () => { onDeleteConnection?.(contextMenu.nodeKey); closeContextMenu(); } },
          ];
        }
        return [];
    }
  })();

  if (!activeConnectionId) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Empty description="请先连接数据库" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  const antdData = toAntdTreeData(treeData);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '8px 0' }} onClick={closeContextMenu}>
      {antdData.length > 0 ? (
        <Tree
          showIcon
          treeData={antdData}
          expandedKeys={expandedKeys}
          onExpand={handleExpand}
          onSelect={handleSelect}
          onRightClick={handleRightClick}
          onDoubleClick={handleDoubleClick as any}
          blockNode
          virtual
          height={600}
        />
      ) : (
        <Empty description="无数据库" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 40 }} />
      )}
      {loadingKey && (
        <div style={{ textAlign: 'center', padding: 8 }}>
          <Spin size="small" />
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && contextMenuItems && contextMenuItems.length > 0 && (
        <Dropdown
          menu={{ items: contextMenuItems }}
          open
          onOpenChange={(open) => { if (!open) closeContextMenu(); }}
          trigger={['click']}
        >
          <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, width: 1, height: 1 }} />
        </Dropdown>
      )}
    </div>
  );
};

export default DatabaseTree;
