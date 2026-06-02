/**
 * API 客户端 — 封装 axios 与后端通信
 */

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// 响应拦截：统一解包 { data } 和错误处理
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.error || err.message || '网络错误';
    return Promise.reject(new Error(msg));
  },
);

// ==================== Connections ====================

export interface ConnectionConfig {
  id?: string;
  name: string;
  type: 'mysql' | 'mariadb' | 'postgresql' | 'sqlite';
  host: string;
  port: number;
  username: string;
  password?: string;
  database?: string;
  ssh?: { enabled: boolean; host: string; port: number; username: string; authType: 'password' | 'key'; password?: string; privateKey?: string };
  ssl?: { enabled: boolean; ca?: string; cert?: string; key?: string };
  options?: { charset?: string; connectTimeout?: number; queryTimeout?: number };
  color?: string;
}

export interface ConnectionInfo {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  username: string;
  database?: string;
  status: 'connected' | 'disconnected';
  serverVersion?: string;
  lastConnectedAt?: string;
  color?: string;
}

export const connectionsApi = {
  list: () => api.get<{ data: ConnectionInfo[] }>('/connections').then(r => r.data.data),
  get: (id: string) => api.get<{ data: ConnectionInfo }>(`/connections/${id}`).then(r => r.data.data),
  create: (cfg: ConnectionConfig) => api.post('/connections', cfg).then(r => r.data.data),
  update: (id: string, cfg: Partial<ConnectionConfig>) => api.put(`/connections/${id}`, cfg).then(r => r.data.data),
  delete: (id: string) => api.delete(`/connections/${id}`).then(r => r.data),
  connect: (id: string) => api.post<{ data: { serverVersion: string; databases: string[] } }>(`/connections/${id}/connect`).then(r => r.data.data),
  disconnect: (id: string) => api.post(`/connections/${id}/disconnect`).then(r => r.data),
  status: (id: string) => api.get<{ data: { status: string; serverVersion?: string } }>(`/connections/${id}/status`).then(r => r.data.data),
  test: (cfg: ConnectionConfig) => api.post<{ data: { connected: boolean; serverVersion?: string; error?: string; responseTime?: number } }>('/connections/test', cfg).then(r => r.data.data),
};

// ==================== Queries ====================

export interface QueryResult {
  queryId: string;
  sql: string;
  columns: Array<{ name: string; type: string; category: string; nullable: boolean }>;
  rows: Record<string, unknown>[];
  rowCount: number;
  affectedRows?: number;
  insertId?: number;
  duration: number;
  hasMore: boolean;
  warnings: Array<{ level: string; code: number; message: string }>;
}

export interface QueryHistoryItem {
  id: string;
  connectionId: string;
  sql: string;
  duration: number;
  rowCount: number;
  status: 'success' | 'error';
  errorMessage?: string;
  executedAt: string;
}

export const queriesApi = {
  execute: (connectionId: string, query: string, options?: { limit?: number }) =>
    api.post<{ data: QueryResult }>('/queries/execute', { connectionId, query, options }).then(r => r.data.data),
  history: (connectionId?: string, limit = 50) =>
    api.get<{ data: QueryHistoryItem[] }>('/queries/history', { params: { connectionId, limit } }).then(r => r.data.data),
};

// ==================== Metadata ====================

export const metadataApi = {
  databases: (connId: string) =>
    api.get<{ data: any[] }>(`/metadata/${connId}/databases`).then(r => r.data.data),
  tables: (connId: string, db: string) =>
    api.get<{ data: any[] }>(`/metadata/${connId}/databases/${db}/tables`).then(r => r.data.data),
  columns: (connId: string, db: string, table: string) =>
    api.get<{ data: any[] }>(`/metadata/${connId}/databases/${db}/tables/${table}/columns`).then(r => r.data.data),
  indexes: (connId: string, db: string, table: string) =>
    api.get<{ data: any[] }>(`/metadata/${connId}/databases/${db}/tables/${table}/indexes`).then(r => r.data.data),
  foreignKeys: (connId: string, db: string, table: string) =>
    api.get<{ data: any[] }>(`/metadata/${connId}/databases/${db}/tables/${table}/foreign-keys`).then(r => r.data.data),
  createSQL: (connId: string, db: string, table: string) =>
    api.get<{ data: { createSQL: string } }>(`/metadata/${connId}/databases/${db}/tables/${table}/create-sql`).then(r => r.data.data),
  views: (connId: string, db: string) =>
    api.get<{ data: any[] }>(`/metadata/${connId}/databases/${db}/views`).then(r => r.data.data),
  procedures: (connId: string, db: string) =>
    api.get<{ data: any[] }>(`/metadata/${connId}/databases/${db}/procedures`).then(r => r.data.data),
  functions: (connId: string, db: string) =>
    api.get<{ data: any[] }>(`/metadata/${connId}/databases/${db}/functions`).then(r => r.data.data),
  triggers: (connId: string, db: string) =>
    api.get<{ data: any[] }>(`/metadata/${connId}/databases/${db}/triggers`).then(r => r.data.data),
  events: (connId: string, db: string) =>
    api.get<{ data: any[] }>(`/metadata/${connId}/databases/${db}/events`).then(r => r.data.data),
  serverInfo: (connId: string) =>
    api.get<{ data: any }>(`/metadata/${connId}/server-info`).then(r => r.data.data),
  variables: (connId: string, filter?: string) =>
    api.get<{ data: any[] }>(`/metadata/${connId}/variables`, { params: { filter } }).then(r => r.data.data),
  processes: (connId: string) =>
    api.get<{ data: any[] }>(`/metadata/${connId}/processes`).then(r => r.data.data),
};

export default api;
