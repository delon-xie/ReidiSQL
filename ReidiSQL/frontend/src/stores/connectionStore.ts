/**
 * 连接状态管理 — Zustand Store
 */

import { create } from 'zustand';
import { connectionsApi, ConnectionConfig, ConnectionInfo } from '@/lib/api';

interface ConnectionStore {
  // 数据
  connections: ConnectionInfo[];
  activeConnectionId: string | null;
  activeDatabase: string | null;
  databases: Record<string, string[]>; // connectionId → databases[]
  loading: boolean;

  // 操作
  fetchConnections: () => Promise<void>;
  createConnection: (cfg: ConnectionConfig) => Promise<string>;
  updateConnection: (id: string, cfg: Partial<ConnectionConfig>) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  connect: (id: string) => Promise<{ serverVersion: string; databases: string[] }>;
  disconnect: (id: string) => Promise<void>;
  setActiveDatabase: (db: string | null) => void;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  connections: [],
  activeConnectionId: null,
  activeDatabase: null,
  databases: {},
  loading: false,

  fetchConnections: async () => {
    set({ loading: true });
    try {
      const connections = await connectionsApi.list();
      set({ connections, loading: false });
    } catch (err) {
      console.error('fetchConnections failed:', err);
      set({ loading: false });
    }
  },

  createConnection: async (cfg) => {
    const created = await connectionsApi.create(cfg);
    await get().fetchConnections();
    return created.id;
  },

  updateConnection: async (id, cfg) => {
    await connectionsApi.update(id, cfg);
    await get().fetchConnections();
  },

  deleteConnection: async (id) => {
    await connectionsApi.delete(id);
    const { activeConnectionId } = get();
    if (activeConnectionId === id) {
      set({ activeConnectionId: null, activeDatabase: null });
    }
    await get().fetchConnections();
  },

  connect: async (id) => {
    const result = await connectionsApi.connect(id);
    // 刷新连接列表以更新 status
    await get().fetchConnections();
    // 存储数据库列表
    set((s) => ({
      activeConnectionId: id,
      databases: { ...s.databases, [id]: result.databases },
    }));
    return result;
  },

  disconnect: async (id) => {
    await connectionsApi.disconnect(id);
    await get().fetchConnections();
    if (get().activeConnectionId === id) {
      set({ activeConnectionId: null, activeDatabase: null });
    }
  },

  setActiveDatabase: (db) => set({ activeDatabase: db }),
}));
