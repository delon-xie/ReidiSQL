/**
 * 查询状态管理 — Zustand Store
 */

import { create } from 'zustand';
import { queriesApi, QueryResult, QueryHistoryItem } from '@/lib/api';

interface QueryTab {
  id: string;
  title: string;
  sql: string;
  result: QueryResult | null;
  executing: boolean;
  error: string | null;
}

interface QueryStore {
  // 数据
  tabs: QueryTab[];
  activeTabId: string;
  history: QueryHistoryItem[];

  // 操作
  addTab: (title?: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabSQL: (tabId: string, sql: string) => void;
  executeQuery: (connectionId: string, tabId?: string) => Promise<void>;
  fetchHistory: (connectionId?: string) => Promise<void>;
}

let tabCounter = 1;

export const useQueryStore = create<QueryStore>((set, get) => ({
  tabs: [
    { id: 'tab_1', title: 'Query 1', sql: '', result: null, executing: false, error: null },
  ],
  activeTabId: 'tab_1',
  history: [],

  addTab: (title) => {
    const id = `tab_${++tabCounter}`;
    set((s) => ({
      tabs: [...s.tabs, { id, title: title || `Query ${tabCounter}`, sql: '', result: null, executing: false, error: null }],
      activeTabId: id,
    }));
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return; // 至少保留一个标签
    const newTabs = tabs.filter(t => t.id !== tabId);
    const newActiveId = activeTabId === tabId ? newTabs[newTabs.length - 1].id : activeTabId;
    set({ tabs: newTabs, activeTabId: newActiveId });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateTabSQL: (tabId, sql) => {
    set((s) => ({
      tabs: s.tabs.map(t => t.id === tabId ? { ...t, sql } : t),
    }));
  },

  executeQuery: async (connectionId, tabId) => {
    const { tabs, activeTabId } = get();
    const id = tabId || activeTabId;
    const tab = tabs.find(t => t.id === id);
    if (!tab || !tab.sql.trim()) return;

    set((s) => ({
      tabs: s.tabs.map(t => t.id === id ? { ...t, executing: true, error: null, result: null } : t),
    }));

    try {
      const result = await queriesApi.execute(connectionId, tab.sql);
      set((s) => ({
        tabs: s.tabs.map(t => t.id === id ? { ...t, executing: false, result, error: null } : t),
      }));
    } catch (err: any) {
      set((s) => ({
        tabs: s.tabs.map(t => t.id === id ? { ...t, executing: false, error: err.message } : t),
      }));
    }
  },

  fetchHistory: async (connectionId) => {
    const history = await queriesApi.history(connectionId);
    set({ history });
  },
}));
