/**
 * API 客户端 — 封装 axios 与后端通信
 */

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ==================== Token 认证 ====================

/** 模块级 Token 存储（Tauri 生产模式下由 invoke 注入） */
let authToken: string = '';

/** 设置认证 Token（Tauri 启动后调用） */
export function setAuthToken(token: string): void {
  authToken = token;
}

/** 获取当前 Token */
export function getAuthToken(): string {
  // 优先级：模块变量 > localStorage > Vite 环境变量
  return authToken
    || localStorage.getItem('reidisql_token')
    || (import.meta.env.VITE_AUTH_TOKEN as string)
    || '';
}

// 请求拦截：自动注入 Bearer Token
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
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
  /**
   * 流式查询（NDJSON 格式）
   * 返回一个 async iterator，逐行读取事件
   * 
   * @example
   * const stream = queriesApi.stream(connId, sql);
   * for await (const event of stream) {
   *   if (event.type === 'rows') { ... }
   * }
   */
  stream: async function* (
    connectionId: string,
    query: string,
    batchSize?: number,
  ): AsyncGenerator<StreamEvent> {
    const token = getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/queries/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify({ connectionId, query, batchSize }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(err.error || 'Stream request failed');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留未完成的行

        for (const line of lines) {
          if (line.trim()) {
            yield JSON.parse(line) as StreamEvent;
          }
        }
      }

      // 处理最后一行
      if (buffer.trim()) {
        yield JSON.parse(buffer) as StreamEvent;
      }
    } finally {
      reader.releaseLock();
    }
  },
};

/** 流式查询事件类型 */
export type StreamEvent =
  | { type: 'start'; sql: string; timestamp: number }
  | { type: 'columns'; columns: Array<{ name: string; type: string; category: string }> }
  | { type: 'rows'; rows: Record<string, unknown>[]; rowCount: number }
  | { type: 'end'; rowCount: number; duration: number }
  | { type: 'error'; error: string };

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

// ==================== DDL ====================

export interface ColumnDDL {
  operation: 'add' | 'modify' | 'drop' | 'rename';
  name: string;
  newName?: string;
  dataType: string;
  nullable?: boolean;
  defaultValue?: string | null;
  hasDefault?: boolean;
  autoIncrement?: boolean;
  unsigned?: boolean;
  comment?: string;
  afterColumn?: string;
  position?: 'first' | 'after';
}

export interface IndexDDL {
  operation: 'add' | 'drop';
  name: string;
  type?: 'PRIMARY' | 'UNIQUE' | 'INDEX' | 'FULLTEXT' | 'SPATIAL';
  columns?: Array<{ name: string; length?: number; order?: 'ASC' | 'DESC' }>;
  algorithm?: 'BTREE' | 'HASH';
}

export interface ForeignKeyDDL {
  operation: 'add' | 'drop';
  name: string;
  columns?: string[];
  referencedTable?: string;
  referencedColumns?: string[];
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' | 'SET DEFAULT';
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' | 'SET DEFAULT';
}

export interface TableOptions {
  engine?: string;
  charset?: string;
  collation?: string;
  comment?: string;
  autoIncrement?: number;
  rowFormat?: string;
}

export interface TableDDLRequest {
  connectionId: string;
  database: string;
  operation: 'create' | 'alter' | 'rename' | 'drop';
  tableName: string;
  newTableName?: string;
  columns?: ColumnDDL[];
  indexes?: IndexDDL[];
  foreignKeys?: ForeignKeyDDL[];
  options?: TableOptions;
}

export const ddlApi = {
  execute: (connectionId: string, database: string, sql: string) =>
    api.post('/ddl/execute', { connectionId, database, sql }).then(r => r.data),
  table: (request: TableDDLRequest) =>
    api.post('/ddl/table', request).then(r => r.data),
  generate: (request: Omit<TableDDLRequest, 'connectionId' | 'database'>) =>
    api.post<{ sql: string }>('/ddl/generate', request).then(r => r.data.sql),
};

// ==================== Data ====================

export interface DataOperation {
  type: 'insert' | 'update' | 'delete';
  data?: Record<string, unknown>;
  where?: Record<string, unknown>;
}

export interface DataResult {
  success: boolean;
  affectedRows: number;
  insertId?: number;
  errors?: Array<{ index: number; error: string; code?: number }>;
}

export const dataApi = {
  insert: (connectionId: string, database: string, table: string, data: Record<string, unknown>) =>
    api.post<DataResult>('/data/insert', { connectionId, database, table, data }).then(r => r.data),
  update: (connectionId: string, database: string, table: string, data: Record<string, unknown>, where: Record<string, unknown>) =>
    api.put<DataResult>('/data/update', { connectionId, database, table, data, where }).then(r => r.data),
  delete: (connectionId: string, database: string, table: string, where: Record<string, unknown>) =>
    api.delete<{ data: DataResult }>('/data/delete', { data: { connectionId, database, table, where } }).then(r => r.data.data || r.data),
  batch: (connectionId: string, database: string, table: string, operations: DataOperation[]) =>
    api.post<DataResult>('/data/batch', { connectionId, database, table, operations }).then(r => r.data),
};

// ==================== Export ====================

export type ExportFormat = 'csv' | 'json' | 'sql';

export interface ExportOptions {
  includeStructure?: boolean;
  includeData?: boolean;
  includeHeaders?: boolean;
  delimiter?: string;
  enclosure?: string;
  encoding?: string;
  lineEnding?: string;
  insertMode?: 'INSERT' | 'REPLACE' | 'INSERT IGNORE';
  batchSize?: number;
  maxRows?: number;
  whereClause?: string;
}

export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  table: string;
  rowCount: number;
  data: string;
  filename: string;
  contentType: string;
  error?: string;
}

export const exportApi = {
  export: (connectionId: string, database: string, format: ExportFormat, tables: string[], options?: ExportOptions) =>
    api.post<ExportResult | { success: boolean; results: ExportResult[] }>('/export', {
      connectionId, database, format, tables, options,
    }).then(r => r.data),
};

// ==================== Import ====================

export interface DetectResult {
  delimiter: string;
  enclosure: string;
  lineEnding: string;
  hasHeader: boolean;
  columns: Array<{ name: string; type: string; sample: string }>;
  preview: string[][];
  rowCount: number;
}

export interface ImportOptions {
  delimiter?: string;
  enclosure?: string;
  lineEnding?: string;
  encoding?: string;
  hasHeader?: boolean;
  skipRows?: number;
  insertMode?: 'INSERT' | 'INSERT IGNORE' | 'REPLACE';
  truncateFirst?: boolean;
  batchSize?: number;
  columnMapping?: string[];
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errors: Array<{ row: number; error: string }>;
  duration: number;
}

export const importApi = {
  detect: (content: string, options?: { delimiter?: string; enclosure?: string }) =>
    api.post<DetectResult>('/import/detect', { content, options }).then(r => r.data),
  execute: (connectionId: string, database: string, table: string, content: string, options?: ImportOptions) =>
    api.post<ImportResult>('/import/execute', { connectionId, database, table, content, options }).then(r => r.data),
  copy: (connectionId: string, srcDb: string, srcTable: string, dstDb: string, dstTable: string, options?: CopyTableOptions) =>
    api.post<{ success: boolean; message: string }>('/import/copy', { connectionId, srcDb, srcTable, dstDb, dstTable, options }).then(r => r.data),
};

export interface CopyTableOptions {
  copyColumns?: string[];
  copyIndexes?: boolean;
  copyForeignKeys?: boolean;
  copyData?: boolean;
  whereClause?: string;
  dropIfExists?: boolean;
}

// ==================== Database Objects ====================

export interface RoutineParam {
  name: string;
  dataType: string;
  direction?: 'IN' | 'OUT' | 'INOUT';
}

export interface RoutineOptions {
  dataAccess?: 'CONTAINS SQL' | 'NO SQL' | 'READS SQL DATA' | 'MODIFIES SQL DATA';
  securityType?: 'DEFINER' | 'INVOKER';
  deterministic?: boolean;
  comment?: string;
}

export interface ObjectCodeResult {
  success: boolean;
  code: string;
  error?: string;
}

export interface ObjectDDLResult {
  success: boolean;
  sql: string;
  error?: string;
}

export const objectsApi = {
  createView: (connectionId: string, database: string, name: string, definition: string, operation: 'create' | 'alter' = 'create') =>
    api.post<ObjectDDLResult>('/objects/view', { connectionId, database, name, definition, operation }).then(r => r.data),

  createRoutine: (
    connectionId: string, database: string, name: string, type: 'PROCEDURE' | 'FUNCTION',
    body: string, params?: RoutineParam[], returns?: string, options?: RoutineOptions,
    operation: 'create' | 'alter' = 'create'
  ) =>
    api.post<ObjectDDLResult>('/objects/routine', { connectionId, database, name, type, body, params, returns, options, operation }).then(r => r.data),

  createTrigger: (
    connectionId: string, database: string, name: string, timing: 'BEFORE' | 'AFTER',
    event: 'INSERT' | 'UPDATE' | 'DELETE', table: string, body: string,
    operation: 'create' | 'alter' = 'create'
  ) =>
    api.post<ObjectDDLResult>('/objects/trigger', { connectionId, database, name, timing, event, table, body, operation }).then(r => r.data),

  dropObject: (connectionId: string, database: string, type: 'VIEW' | 'PROCEDURE' | 'FUNCTION' | 'TRIGGER', name: string) =>
    api.delete<ObjectDDLResult>(`/objects/${type}/${name}`, { data: { connectionId, database } }).then(r => r.data),

  getCode: (connectionId: string, database: string, type: 'VIEW' | 'PROCEDURE' | 'FUNCTION' | 'TRIGGER', name: string) =>
    api.get<ObjectCodeResult>(`/objects/${type}/${name}/code`, { params: { connectionId, database } }).then(r => r.data),
};

// ─── Admin API (Sprint 4) ───
export interface MySQLUser {
  User: string;
  Host: string;
  plugin: string;
  account_locked: string;
  password_expired: string;
  max_connections: number;
  max_user_connections: number;
}

export interface CreateUserData {
  username: string;
  host?: string;
  password?: string;
  authPlugin?: string;
}

export interface PrivilegeData {
  grant: string[];
  revoke: string[];
}

export const adminApi = {
  listUsers: (connectionId: string) =>
    api.get<MySQLUser[]>(`/admin/${connectionId}/users`).then(r => r.data),

  createUser: (connectionId: string, data: CreateUserData) =>
    api.post(`/admin/${connectionId}/users`, data).then(r => r.data),

  modifyUser: (connectionId: string, user: string, data: Partial<CreateUserData>) =>
    api.put(`/admin/${connectionId}/users/${user}`, data).then(r => r.data),

  dropUser: (connectionId: string, user: string) =>
    api.delete(`/admin/${connectionId}/users/${user}`).then(r => r.data),

  getPrivileges: (connectionId: string, user: string) =>
    api.get<{ grants: string[] }>(`/admin/${connectionId}/users/${user}/privileges`).then(r => r.data),

  modifyPrivileges: (connectionId: string, user: string, data: PrivilegeData) =>
    api.put(`/admin/${connectionId}/users/${user}/privileges`, data).then(r => r.data),
};

// ─── Preferences API (Sprint 4) ───
export interface AppPreferences {
  general?: { language?: string; theme?: 'light' | 'dark' | 'system'; autoReconnect?: boolean; checkUpdates?: boolean };
  editor?: { fontSize?: number; tabSize?: number; autoUpperCase?: boolean; completionDelay?: number };
  grid?: { fontSize?: number; maxColumnWidth?: number; maxRows?: number; nullBackground?: string };
  logging?: { maxLines?: number; logToFile?: boolean };
  shortcuts?: Record<string, string>;
  files?: { recentFiles?: string[] };
}

export const preferencesApi = {
  get: () =>
    api.get<AppPreferences>('/preferences').then(r => r.data),

  update: (prefs: Partial<AppPreferences>) =>
    api.put('/preferences', prefs).then(r => r.data),
};

// ─── Tools API (Sprint 4) ───
export interface MaintenanceRequest {
  connectionId: string;
  database: string;
  tables: string[];
  operation: 'CHECK' | 'ANALYZE' | 'CHECKSUM' | 'OPTIMIZE' | 'REPAIR';
  options?: string[];
}

export interface MaintenanceResult {
  table: string;
  op: string;
  msg_type: string;
  msg_text: string;
}

export interface FindTextRequest {
  connectionId: string;
  database: string;
  tables: string[];
  searchText: string;
  matchType?: 'LIKE' | 'REGEXP';
}

export interface FindTextResult {
  table: string;
  column: string;
  primaryKey?: string;
  primaryKeyValue?: string;
  matchedValue: string;
}

export interface SyncDiff {
  type: 'table' | 'column' | 'index' | 'fk';
  action: 'add' | 'drop' | 'modify';
  name: string;
  ddl: string;
}

export interface BulkEditRequest {
  connectionId: string;
  database: string;
  tables: string[];
  operation: 'engine' | 'charset' | 'collation';
  value: string;
}

export interface GenerateDataRequest {
  connectionId: string;
  database: string;
  table: string;
  rowCount: number;
  columns?: string[];
}

export const toolsApi = {
  maintenance: (data: MaintenanceRequest) =>
    api.post<MaintenanceResult[]>('/tools/maintenance', data).then(r => r.data),

  findText: (data: FindTextRequest) =>
    api.post<FindTextResult[]>('/tools/find', data).then(r => r.data),

  syncAnalyze: (data: { connectionId: string; sourceDb: string; targetDb: string }) =>
    api.post<{ data: SyncDiff[] }>('/tools/sync/analyze', data).then(r => r.data.data),

  bulkEdit: (data: BulkEditRequest) =>
    api.post<{ data: MaintenanceResult[] }>('/tools/bulk-edit', data).then(r => r.data.data),

  generateData: (data: GenerateDataRequest) =>
    api.post<{ data: { insertedRows: number } }>('/tools/generate-data', data).then(r => r.data.data),
};

// ─── Update API (Sprint 4) ───
export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseUrl?: string;
  releaseNotes?: string;
}

export const updateApi = {
  check: () =>
    api.get<UpdateCheckResult>('/update/check').then(r => r.data),
};

// ─── Server API (Sprint 5) ───
export interface ServerInfo {
  version: string;
  charset: string;
  collation: string;
  uptime: number;
  stats: {
    threadsConnected: number;
    threadsRunning: number;
    queries: number;
    questions: number;
    slowQueries: number;
    bytesReceived: number;
    bytesSent: number;
    totalConnections: number;
    abortedClients: number;
    abortedConnects: number;
  };
}

export interface ServerVariable {
  name: string;
  value: string;
}

export interface ServerProcess {
  Id: number;
  User: string;
  Host: string;
  db: string | null;
  Command: string;
  Time: number;
  State: string;
  Info: string | null;
}

export const serverApi = {
  getInfo: (connectionId: string) =>
    api.get<ServerInfo>(`/server/${connectionId}/info`).then(r => r.data),

  getVariables: (connectionId: string, filter?: string) =>
    api.get<ServerVariable[]>(`/server/${connectionId}/variables`, { params: { filter } }).then(r => r.data),

  setVariable: (connectionId: string, name: string, value: string) =>
    api.put(`/server/${connectionId}/variables/${name}`, { value }).then(r => r.data),

  getProcesses: (connectionId: string) =>
    api.get<ServerProcess[]>(`/server/${connectionId}/processes`).then(r => r.data),

  killProcess: (connectionId: string, pid: number) =>
    api.post(`/server/${connectionId}/processes/${pid}/kill`).then(r => r.data),
};

export default api;
