/**
 * 数据库对象树 — 左侧面板
 */

import React, { useCallback } from 'react';
import { Tree, Spin, Empty } from 'antd';
import {
  DatabaseOutlined, TableOutlined, EyeOutlined, CodeOutlined,
  FunctionOutlined, ThunderboltOutlined, ScheduleOutlined,
  FolderOutlined, ColumnHeightOutlined, KeyOutlined,
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

function toAntdTreeData(nodes: TreeNode[]): TreeDataNode[] {
  return nodes.map(n => ({
    key: n.key,
    title: n.title,
    icon: ICON_MAP[n.icon || ''] || ICON_MAP[n.type] || null,
    isLeaf: n.isLeaf ?? (!n.children || n.children.length === 0),
    children: n.children ? toAntdTreeData(n.children) : undefined,
  }));
}

const DatabaseTree: React.FC = () => {
  const { treeData, expandedKeys, setExpandedKeys, setSelectedKey } = useObjectTreeStore();
  const { activeConnectionId } = useConnectionStore();
  const [loadingKey, setLoadingKey] = React.useState<string | null>(null);
  const { loadTables, loadTableDetails, loadViews, loadRoutines } = useObjectTreeStore();

  const handleExpand = useCallback(async (keys: React.Key[], info: any) => {
    setExpandedKeys(keys as string[]);
    const node = info.node;
    const key = node.key as string;

    if (!info.expanded) return; // 只在展开时加载

    setLoadingKey(key);
    try {
      // 解析路径：connectionId/db/database/...
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

  if (!activeConnectionId) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Empty description="请先连接数据库" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  const antdData = toAntdTreeData(treeData);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '8px 0' }}>
      {antdData.length > 0 ? (
        <Tree
          showIcon
          treeData={antdData}
          expandedKeys={expandedKeys}
          onExpand={handleExpand}
          onSelect={handleSelect}
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
    </div>
  );
};

export default DatabaseTree;
