/**
 * 数据库对象树状态管理 — Zustand Store
 */

import { create } from 'zustand';
import { metadataApi } from '@/lib/api';

export interface TreeNode {
  key: string;
  title: string;
  type: 'server' | 'database' | 'table_group' | 'view_group' | 'procedure_group' | 'function_group' | 'trigger_group' | 'event_group' | 'table' | 'view' | 'procedure' | 'function' | 'trigger' | 'event' | 'column' | 'index' | 'foreign_key';
  icon?: string;
  children?: TreeNode[];
  isLeaf?: boolean;
  database?: string;
  tableName?: string;
  extra?: Record<string, any>;
}

interface ObjectTreeStore {
  // 数据
  treeData: TreeNode[];
  expandedKeys: string[];
  selectedKey: string | null;
  loading: boolean;

  // 操作
  loadDatabases: (connectionId: string, databases: string[]) => void;
  loadTables: (connectionId: string, database: string) => Promise<void>;
  loadTableDetails: (connectionId: string, database: string, table: string) => Promise<void>;
  loadViews: (connectionId: string, database: string) => Promise<void>;
  loadRoutines: (connectionId: string, database: string) => Promise<void>;
  setExpandedKeys: (keys: string[]) => void;
  setSelectedKey: (key: string | null) => void;
  updateNodeChildren: (parentKey: string, children: TreeNode[]) => void;
  clearTree: () => void;
}

export const useObjectTreeStore = create<ObjectTreeStore>((set, get) => ({
  treeData: [],
  expandedKeys: [],
  selectedKey: null,
  loading: false,

  loadDatabases: (connectionId, databases) => {
    const treeData = databases.map(db => ({
      key: `${connectionId}/db/${db}`,
      title: db,
      type: 'database' as const,
      icon: 'database',
      database: db,
      isLeaf: false,
      children: [
        { key: `${connectionId}/db/${db}/tables`, title: 'Tables', type: 'table_group' as const, icon: 'table', database: db, isLeaf: false, children: [] },
        { key: `${connectionId}/db/${db}/views`, title: 'Views', type: 'view_group' as const, icon: 'eye', database: db, isLeaf: false, children: [] },
        { key: `${connectionId}/db/${db}/procedures`, title: 'Procedures', type: 'procedure_group' as const, icon: 'code', database: db, isLeaf: false, children: [] },
        { key: `${connectionId}/db/${db}/functions`, title: 'Functions', type: 'function_group' as const, icon: 'function', database: db, isLeaf: false, children: [] },
        { key: `${connectionId}/db/${db}/triggers`, title: 'Triggers', type: 'trigger_group' as const, icon: 'thunderbolt', database: db, isLeaf: false, children: [] },
        { key: `${connectionId}/db/${db}/events`, title: 'Events', type: 'event_group' as const, icon: 'schedule', database: db, isLeaf: false, children: [] },
      ],
    }));
    set({ treeData });
  },

  loadTables: async (connectionId, database) => {
    const tables = await metadataApi.tables(connectionId, database);
    const children: TreeNode[] = tables.map((t: any) => ({
      key: `${connectionId}/db/${database}/tables/${t.name}`,
      title: t.name,
      type: 'table' as const,
      icon: 'table',
      database,
      tableName: t.name,
      isLeaf: false,
      extra: { rowCount: t.rowCount, engine: t.engine, size: t.size },
    }));
    get().updateNodeChildren(`${connectionId}/db/${database}/tables`, children);
  },

  loadTableDetails: async (connectionId, database, table) => {
    const columns = await metadataApi.columns(connectionId, database, table);
    const indexes = await metadataApi.indexes(connectionId, database, table);

    const columnNodes: TreeNode[] = columns.map((c: any) => ({
      key: `${connectionId}/db/${database}/tables/${table}/col/${c.name}`,
      title: `${c.name} (${c.fullType || c.type})`,
      type: 'column' as const,
      isLeaf: true,
      database,
      tableName: table,
      extra: c,
    }));

    const indexNodes: TreeNode[] = indexes.map((i: any) => ({
      key: `${connectionId}/db/${database}/tables/${table}/idx/${i.name}`,
      title: `${i.name} (${i.columns})`,
      type: 'index' as const,
      isLeaf: true,
      database,
      tableName: table,
      extra: i,
    }));

    const children = [...columnNodes, ...indexNodes];
    get().updateNodeChildren(`${connectionId}/db/${database}/tables/${table}`, children);
  },

  loadViews: async (connectionId, database) => {
    const views = await metadataApi.views(connectionId, database);
    const children: TreeNode[] = views.map((v: any) => ({
      key: `${connectionId}/db/${database}/views/${v.name}`,
      title: v.name,
      type: 'view' as const,
      isLeaf: true,
      database,
      extra: v,
    }));
    get().updateNodeChildren(`${connectionId}/db/${database}/views`, children);
  },

  loadRoutines: async (connectionId, database) => {
    const [procedures, functions] = await Promise.all([
      metadataApi.procedures(connectionId, database),
      metadataApi.functions(connectionId, database),
    ]);

    const procNodes: TreeNode[] = procedures.map((p: any) => ({
      key: `${connectionId}/db/${database}/procedures/${p.name}`,
      title: p.name,
      type: 'procedure' as const,
      isLeaf: true,
      database,
      extra: p,
    }));
    const funcNodes: TreeNode[] = functions.map((f: any) => ({
      key: `${connectionId}/db/${database}/functions/${f.name}`,
      title: f.name,
      type: 'function' as const,
      isLeaf: true,
      database,
      extra: f,
    }));

    get().updateNodeChildren(`${connectionId}/db/${database}/procedures`, procNodes);
    get().updateNodeChildren(`${connectionId}/db/${database}/functions`, funcNodes);
  },

  setExpandedKeys: (keys) => set({ expandedKeys: keys }),
  setSelectedKey: (key) => set({ selectedKey: key }),

  updateNodeChildren: (parentKey, children) => {
    const updateTree = (nodes: TreeNode[]): TreeNode[] =>
      nodes.map(node => {
        if (node.key === parentKey) {
          return { ...node, children };
        }
        if (node.children) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    set((s) => ({ treeData: updateTree(s.treeData) }));
  },

  clearTree: () => set({ treeData: [], expandedKeys: [], selectedKey: null }),
}));
