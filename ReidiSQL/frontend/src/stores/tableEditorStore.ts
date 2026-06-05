/**
 * 表编辑器状态管理
 */

import { create } from 'zustand';
import type { ColumnDDL, IndexDDL, ForeignKeyDDL, TableOptions } from '../lib/api';

/** 列编辑状态 */
export interface ColumnEditState extends ColumnDDL {
  key: string; // 唯一标识
}

/** 索引编辑状态 */
export interface IndexEditState extends IndexDDL {
  key: string;
}

/** 外键编辑状态 */
export interface ForeignKeyEditState extends ForeignKeyDDL {
  key: string;
}

export type EditorMode = 'create' | 'alter';

interface TableEditorState {
  // 模式
  mode: EditorMode;
  connectionId: string;
  database: string;
  tableName: string;
  newTableName: string; // 编辑模式下的新表名（rename）

  // 表结构
  columns: ColumnEditState[];
  indexes: IndexEditState[];
  foreignKeys: ForeignKeyEditState[];
  options: TableOptions;

  // UI 状态
  activeTab: 'columns' | 'indexes' | 'foreignKeys' | 'options';
  previewSQL: string;
  showPreview: boolean;
  loading: boolean;
  error: string | null;

  // 操作
  init: (mode: EditorMode, connectionId: string, database: string, tableName?: string) => void;
  setTableName: (name: string) => void;
  setNewTableName: (name: string) => void;
  setActiveTab: (tab: 'columns' | 'indexes' | 'foreignKeys' | 'options') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // 列操作
  addColumn: () => void;
  updateColumn: (key: string, updates: Partial<ColumnEditState>) => void;
  removeColumn: (key: string) => void;
  moveColumn: (fromIndex: number, toIndex: number) => void;

  // 索引操作
  addIndex: () => void;
  updateIndex: (key: string, updates: Partial<IndexEditState>) => void;
  removeIndex: (key: string) => void;

  // 外键操作
  addForeignKey: () => void;
  updateForeignKey: (key: string, updates: Partial<ForeignKeyEditState>) => void;
  removeForeignKey: (key: string) => void;

  // 表选项
  updateOptions: (updates: Partial<TableOptions>) => void;

  // SQL 预览
  setPreviewSQL: (sql: string) => void;
  setShowPreview: (show: boolean) => void;

  // 转换为 DDL 请求格式
  toColumnDDLs: () => ColumnDDL[];
  toIndexDDLs: () => IndexDDL[];
  toForeignKeyDDLs: () => ForeignKeyDDL[];

  // 加载现有表结构（编辑模式）
  loadExistingTable: (columns: any[], indexes: any[], foreignKeys: any[], createSQL: string) => void;
}

let keyCounter = 0;
const genKey = () => `col_${++keyCounter}`;

export const useTableEditorStore = create<TableEditorState>((set, get) => ({
  mode: 'create',
  connectionId: '',
  database: '',
  tableName: '',
  newTableName: '',

  columns: [],
  indexes: [],
  foreignKeys: [],
  options: { engine: 'InnoDB', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' },

  activeTab: 'columns',
  previewSQL: '',
  showPreview: false,
  loading: false,
  error: null,

  init: (mode, connectionId, database, tableName) => {
    set({
      mode,
      connectionId,
      database,
      tableName: tableName || '',
      newTableName: '',
      columns: mode === 'create' ? [
        { key: genKey(), operation: 'add', name: 'id', dataType: 'INT', nullable: false, autoIncrement: true, unsigned: true },
        { key: genKey(), operation: 'add', name: 'created_at', dataType: 'TIMESTAMP', nullable: true, hasDefault: true, defaultValue: 'CURRENT_TIMESTAMP' },
      ] : [],
      indexes: mode === 'create' ? [
        { key: genKey(), operation: 'add', name: 'PRIMARY', type: 'PRIMARY', columns: [{ name: 'id' }] },
      ] : [],
      foreignKeys: [],
      options: { engine: 'InnoDB', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' },
      activeTab: 'columns',
      previewSQL: '',
      showPreview: false,
      loading: false,
      error: null,
    });
  },

  setTableName: (name) => set({ tableName: name }),
  setNewTableName: (name) => set({ newTableName: name }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // 列操作
  addColumn: () => {
    const newCol: ColumnEditState = {
      key: genKey(),
      operation: get().mode === 'create' ? 'add' : 'add',
      name: '',
      dataType: 'VARCHAR',
      nullable: true,
    };
    set((s) => ({ columns: [...s.columns, newCol] }));
  },

  updateColumn: (key, updates) => {
    set((s) => ({
      columns: s.columns.map(c => c.key === key ? { ...c, ...updates } : c),
    }));
  },

  removeColumn: (key) => {
    set((s) => ({ columns: s.columns.filter(c => c.key !== key) }));
  },

  moveColumn: (fromIndex, toIndex) => {
    set((s) => {
      const cols = [...s.columns];
      const [moved] = cols.splice(fromIndex, 1);
      cols.splice(toIndex, 0, moved);
      return { columns: cols };
    });
  },

  // 索引操作
  addIndex: () => {
    const newIdx: IndexEditState = {
      key: genKey(),
      operation: 'add',
      name: '',
      type: 'INDEX',
      columns: [],
    };
    set((s) => ({ indexes: [...s.indexes, newIdx] }));
  },

  updateIndex: (key, updates) => {
    set((s) => ({
      indexes: s.indexes.map(i => i.key === key ? { ...i, ...updates } : i),
    }));
  },

  removeIndex: (key) => {
    set((s) => ({ indexes: s.indexes.filter(i => i.key !== key) }));
  },

  // 外键操作
  addForeignKey: () => {
    const newFk: ForeignKeyEditState = {
      key: genKey(),
      operation: 'add',
      name: '',
      columns: [],
      referencedTable: '',
      referencedColumns: [],
      onDelete: 'RESTRICT',
      onUpdate: 'RESTRICT',
    };
    set((s) => ({ foreignKeys: [...s.foreignKeys, newFk] }));
  },

  updateForeignKey: (key, updates) => {
    set((s) => ({
      foreignKeys: s.foreignKeys.map(f => f.key === key ? { ...f, ...updates } : f),
    }));
  },

  removeForeignKey: (key) => {
    set((s) => ({ foreignKeys: s.foreignKeys.filter(f => f.key !== key) }));
  },

  // 表选项
  updateOptions: (updates) => {
    set((s) => ({ options: { ...s.options, ...updates } }));
  },

  // SQL 预览
  setPreviewSQL: (sql) => set({ previewSQL: sql }),
  setShowPreview: (show) => set({ showPreview: show }),

  // 转换
  toColumnDDLs: () => get().columns.map(({ key, ...rest }) => rest),
  toIndexDDLs: () => get().indexes.map(({ key, ...rest }) => rest),
  toForeignKeyDDLs: () => get().foreignKeys.map(({ key, ...rest }) => rest),

  // 加载现有表结构
  loadExistingTable: (cols, idxs, fks, _createSQL) => {
    set({
      columns: cols.map((c: any) => ({
        key: genKey(),
        operation: 'modify' as const,
        name: c.name,
        dataType: c.dataType || c.type,
        nullable: c.nullable !== false,
        hasDefault: c.defaultValue !== undefined && c.defaultValue !== null,
        defaultValue: c.defaultValue,
        autoIncrement: c.autoIncrement || false,
        unsigned: c.unsigned || false,
        comment: c.comment || '',
      })),
      indexes: idxs.map((i: any) => ({
        key: genKey(),
        operation: 'add' as const,
        name: i.name,
        type: i.type || 'INDEX',
        columns: i.columns || [],
      })),
      foreignKeys: fks.map((f: any) => ({
        key: genKey(),
        operation: 'add' as const,
        name: f.name,
        columns: f.columns || [],
        referencedTable: f.referencedTable || '',
        referencedColumns: f.referencedColumns || [],
        onDelete: f.onDelete || 'RESTRICT',
        onUpdate: f.onUpdate || 'RESTRICT',
      })),
    });
  },
}));
