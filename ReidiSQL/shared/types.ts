/**
 * ReidiSQL Shared Type Definitions
 * 
 * 前后端共享的类型定义。此文件是所有数据模型的唯一真相来源。
 * 
 * 使用方式:
 *   import { ConnectionConfig, QueryResult } from '@reidisql/shared';
 */

// ============================================================
// 1. 通用 API 类型
// ============================================================

/** 统一 API 响应包装 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: ResponseMeta;
  error?: ApiError;
}

export interface ResponseMeta {
  timestamp: string;
  requestId: string;
  total?: number;
  limit?: number;
  offset?: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: string;
  errorCode?: number;
  sqlState?: string;
  query?: string;
  position?: number;
  requestId?: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================
// 2. 数据库类型与枚举
// ============================================================

/** 支持的数据库类型 */
export type DatabaseType = 'mysql' | 'mariadb' | 'postgresql' | 'sqlite' | 'mssql' | 'firebird';

/** 网络类型 */
export type NetType = 'tcp' | 'ssh_tunnel' | 'named_pipe' | 'socket';

/** 数据类型分类（对应 Delphi TDBDatatypeCategoryIndex） */
export type DataTypeCategory =
  | 'integer'
  | 'real'
  | 'text'
  | 'binary'
  | 'temporal'
  | 'spatial'
  | 'other';

/** 数据库对象类型 */
export type DBObjectType =
  | 'server'
  | 'database'
  | 'table_group'
  | 'view_group'
  | 'procedure_group'
  | 'function_group'
  | 'trigger_group'
  | 'event_group'
  | 'table'
  | 'view'
  | 'procedure'
  | 'function'
  | 'trigger'
  | 'event'
  | 'column'
  | 'index'
  | 'foreign_key';

/** 参照操作 */
export type ReferentialAction =
  | 'RESTRICT'
  | 'CASCADE'
  | 'SET NULL'
  | 'NO ACTION'
  | 'SET DEFAULT';

/** 索引类型 */
export type IndexType = 'PRIMARY' | 'UNIQUE' | 'INDEX' | 'FULLTEXT' | 'SPATIAL';

/** 索引算法 */
export type IndexAlgorithm = 'BTREE' | 'HASH' | 'RTREE';

/** 连接状态 */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'reconnecting';

/** 查询执行状态 */
export type QueryStatus =
  | 'idle'
  | 'parsing'
  | 'executing'
  | 'complete'
  | 'error'
  | 'cancelling'
  | 'cancelled';

/** 日志事件类型 */
export type LogEvent = 'error' | 'userSQL' | 'sql' | 'script' | 'info' | 'debug';

/** 换行符风格 */
export type LineBreakStyle = 'windows' | 'unix' | 'mac';

// ============================================================
// 3. 连接配置
// ============================================================

export interface ConnectionConfig {
  id: string;
  name: string;
  type: DatabaseType;
  netType: NetType;
  host: string;
  port: number;
  username: string;
  password?: string;
  database?: string;
  ssh?: SSHConfig;
  ssl?: SSLConfig;
  options: ConnectionOptions;
  // 元数据
  createdAt: string;
  updatedAt: string;
  lastConnectedAt?: string;
  color?: string;
}

export interface SSHConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key' | 'agent';
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface SSLConfig {
  enabled: boolean;
  ca?: string;
  cert?: string;
  key?: string;
  verifyServerIdentity?: boolean;
}

export interface ConnectionOptions {
  charset?: string;
  connectTimeout?: number;    // ms, default 10000
  queryTimeout?: number;      // ms, default 30000
  maxRetries?: number;
  keepAlive?: boolean;
  compression?: boolean;
  namedPipe?: string;         // 命名管道路径
  socket?: string;            // Unix socket 路径
  startupScript?: string;     // 连接后执行的 SQL
}

/** 创建/更新连接请求体（密码可能未加密） */
export type CreateConnectionInput = Omit<ConnectionConfig, 'id' | 'createdAt' | 'updatedAt'>;

/** 连接测试结果 */
export interface ConnectionTestResult {
  connected: boolean;
  serverVersion?: string;
  serverType?: string;
  responseTime?: number;      // ms
  error?: string;
}

/** 连接信息（不含敏感信息） */
export interface ConnectionInfo {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  username: string;
  database?: string;
  status: ConnectionStatus;
  serverVersion?: string;
  lastConnectedAt?: string;
  color?: string;
}

// ============================================================
// 4. 查询相关
// ============================================================

export interface QueryExecuteRequest {
  connectionId: string;
  database?: string;
  sql: string;
  params?: unknown[];
  options?: QueryExecuteOptions;
}

export interface QueryExecuteOptions {
  limit?: number;             // 最大行数
  timeout?: number;           // 超时 ms
  stream?: boolean;           // 流式返回
  explain?: boolean;          // EXPLAIN 模式
  selectedOnly?: boolean;     // 仅执行选中语句
}

export interface QueryResult {
  queryId: string;
  sql: string;
  columns: ColumnDescriptor[];
  rows: Record<string, unknown>[];
  rowCount: number;
  affectedRows?: number;
  insertId?: number;
  duration: number;           // ms
  hasMore: boolean;
  warnings: QueryWarning[];
  multipleResults?: boolean;  // 是否多结果集
  resultIndex?: number;       // 当前结果集索引
}

export interface ColumnDescriptor {
  name: string;
  type: string;               // 原始数据库类型 e.g. "INT", "VARCHAR(255)"
  category: DataTypeCategory;
  nullable: boolean;
  maxLength?: number;
  precision?: number;
  scale?: number;
  table?: string;
  database?: string;
  flags: ColumnFlag[];
}

export type ColumnFlag =
  | 'PRIMARY_KEY'
  | 'AUTO_INCREMENT'
  | 'UNSIGNED'
  | 'ZEROFILL'
  | 'UNIQUE'
  | 'MULTIPLE_KEY'
  | 'BINARY'
  | 'ENUM'
  | 'SET'
  | 'BLOB'
  | 'GENERATED';

export interface QueryWarning {
  level: 'Note' | 'Warning' | 'Error';
  code: number;
  message: string;
}

export interface QueryHistoryItem {
  id: string;
  connectionId: string;
  connectionName: string;
  database?: string;
  sql: string;
  duration: number;
  rowCount?: number;
  affectedRows?: number;
  status: 'success' | 'error';
  errorMessage?: string;
  executedAt: string;
}

/** 查询标签页状态 */
export interface QueryTab {
  id: string;
  title: string;
  sql: string;
  connectionId?: string;
  database?: string;
  filePath?: string;          // 关联的 .sql 文件
  isDirty: boolean;
  isExecuting: boolean;
  results: QueryResult[];
  messages: LogMessage[];
  cursorLine: number;
  cursorColumn: number;
}

// ============================================================
// 5. 数据库元数据
// ============================================================

/** 数据库信息 */
export interface DatabaseInfo {
  name: string;
  charset: string;
  collation: string;
  size: number;               // bytes
  tableCount?: number;
}

/** 数据库对象树节点 */
export interface DBObjectNode {
  id: string;
  key: string;                // 唯一路径 e.g. "conn1/db1/tables/users"
  name: string;
  type: DBObjectType;
  parentKey?: string;
  database?: string;
  schema?: string;
  icon?: string;
  isLeaf: boolean;
  children?: DBObjectNode[];
  meta?: Record<string, unknown>;
}

/** 表元数据 */
export interface TableMeta {
  name: string;
  engine: string;
  charset: string;
  collation: string;
  rowCount: number;
  dataSize: number;           // bytes
  indexSize: number;
  autoIncrement?: number;
  comment: string;
  rowFormat?: string;
  createOptions?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** 列元数据 */
export interface ColumnMeta {
  name: string;
  dataType: string;           // 基础类型 e.g. "INT", "VARCHAR"
  fullType: string;           // 完整类型 e.g. "INT(11) UNSIGNED"
  category: DataTypeCategory;
  length?: number;
  precision?: number;
  scale?: number;
  nullable: boolean;
  defaultValue: string | null;
  hasDefault: boolean;
  autoIncrement: boolean;
  unsigned: boolean;
  zerofill: boolean;
  charset?: string;
  collation?: string;
  comment: string;
  ordinalPosition: number;
  extra: string;
  generation?: string;        // GENERATED ALWAYS AS 表达式
  virtuality?: string;        // VIRTUAL / STORED
}

/** 索引列 */
export interface IndexColumn {
  name: string;
  length?: number;
  order: 'ASC' | 'DESC';
}

/** 索引元数据 */
export interface IndexMeta {
  name: string;
  type: IndexType;
  columns: IndexColumn[];
  comment: string;
  algorithm: IndexAlgorithm;
  keyBlockSize?: number;
  parser?: string;
}

/** 外键元数据 */
export interface ForeignKeyMeta {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedDatabase?: string;
  referencedColumns: string[];
  onUpdate: ReferentialAction;
  onDelete: ReferentialAction;
}

/** 视图元数据 */
export interface ViewMeta {
  name: string;
  algorithm: 'UNDEFINED' | 'MERGE' | 'TEMPTABLE';
  definer: string;
  securityType: 'DEFINER' | 'INVOKER';
  checkOption: 'NONE' | 'CASCADED' | 'LOCAL';
  isUpdatable: boolean;
  createSql: string;
}

/** 存储过程/函数元数据 */
export interface RoutineMeta {
  name: string;
  type: 'PROCEDURE' | 'FUNCTION';
  definer: string;
  parameters: RoutineParameter[];
  returnType?: string;        // 仅 FUNCTION
  dataType?: string;          // RETURNS 类型
  deterministic: boolean;
  dataAccess: 'CONTAINS SQL' | 'NO SQL' | 'READS SQL DATA' | 'MODIFIES SQL DATA';
  securityType: 'DEFINER' | 'INVOKER';
  comment: string;
  createSql: string;
}

export interface RoutineParameter {
  name: string;
  dataType: string;
  direction: 'IN' | 'OUT' | 'INOUT';
  ordinalPosition: number;
}

/** 触发器元数据 */
export interface TriggerMeta {
  name: string;
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  definer: string;
  createSql: string;
}

/** 事件调度器元数据 */
export interface EventMeta {
  name: string;
  definer: string;
  schedule: EventSchedule;
  status: 'ENABLED' | 'DISABLED' | 'SLAVESIDE_DISABLED';
  preserve: boolean;          // ON COMPLETION PRESERVE
  comment: string;
  createSql: string;
}

export interface EventSchedule {
  type: 'once' | 'recurring';
  at?: string;                // AT datetime
  every?: string;             // EVERY N interval
  interval?: string;          // YEAR/MONTH/DAY/HOUR/MINUTE/SECOND/...
  starts?: string;
  ends?: string;
}

// ============================================================
// 6. 数据操作
// ============================================================

/** 数据修改请求 */
export interface DataModificationRequest {
  connectionId: string;
  database: string;
  table: string;
  operations: DataOperation[];
}

export type DataOperation =
  | { type: 'insert'; data: Record<string, unknown> }
  | { type: 'update'; data: Record<string, unknown>; where: Record<string, unknown> }
  | { type: 'delete'; where: Record<string, unknown> };

/** 数据修改结果 */
export interface DataModificationResult {
  affectedRows: number;
  insertId?: number;
  errors?: DataOperationError[];
}

export interface DataOperationError {
  operationIndex: number;
  error: string;
  errorCode?: number;
}

// ============================================================
// 7. DDL 操作
// ============================================================

/** CREATE/ALTER TABLE 请求 */
export interface TableDDLRequest {
  connectionId: string;
  database: string;
  operation: 'create' | 'alter' | 'rename' | 'drop';
  tableName: string;
  newTableName?: string;      // rename 时使用
  columns?: ColumnDDL[];
  indexes?: IndexDDL[];
  foreignKeys?: ForeignKeyDDL[];
  options?: TableOptions;
}

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
  afterColumn?: string;       // AFTER 定位
  position?: 'first' | 'after';
}

export interface IndexDDL {
  operation: 'add' | 'drop';
  name: string;
  type?: IndexType;
  columns?: IndexColumn[];
  algorithm?: IndexAlgorithm;
}

export interface ForeignKeyDDL {
  operation: 'add' | 'drop';
  name: string;
  columns?: string[];
  referencedTable?: string;
  referencedColumns?: string[];
  onUpdate?: ReferentialAction;
  onDelete?: ReferentialAction;
}

export interface TableOptions {
  engine?: string;
  charset?: string;
  collation?: string;
  comment?: string;
  autoIncrement?: number;
  rowFormat?: string;
}

// ============================================================
// 8. 用户与权限
// ============================================================

export interface UserInfo {
  username: string;
  host: string;
  plugin: string;
  isRole: boolean;
  accountLocked: boolean;
  passwordExpired: boolean;
  sslType: string;
  maxConnections?: number;
  maxUserConnections?: number;
  maxQuestions?: number;
  maxUpdates?: number;
  passwordLastChanged?: string;
  passwordLifetime?: number;
  privileges: PrivilegeGrant[];
  roles: RoleGrant[];
}

export interface PrivilegeGrant {
  privilege: string;
  scope: 'global' | 'database' | 'table' | 'column' | 'routine';
  target: string;
  columns?: string[];
  grantOption: boolean;
}

export interface RoleGrant {
  role: string;
  host: string;
  withAdminOption: boolean;
  isDefault: boolean;
}

export interface CreateUserRequest {
  username: string;
  host: string;
  password?: string;
  plugin?: string;
  privileges?: PrivilegeGrant[];
  roles?: string[];
  ssl?: UserSSLConfig;
  resourceLimits?: UserResourceLimits;
}

export interface UserSSLConfig {
  requireSSL?: boolean;
  requireX509?: boolean;
  cipher?: string;
  issuer?: string;
  subject?: string;
}

export interface UserResourceLimits {
  maxQueriesPerHour?: number;
  maxUpdatesPerHour?: number;
  maxConnectionsPerHour?: number;
  maxUserConnections?: number;
}

// ============================================================
// 9. 偏好设置
// ============================================================

export interface AppPreferences {
  general: GeneralPreferences;
  editor: EditorPreferences;
  grid: GridPreferences;
  logging: LoggingPreferences;
  shortcuts: Record<string, ShortcutConfig>;
  files: FilePreferences;
}

export interface GeneralPreferences {
  language: string;
  theme: 'light' | 'dark' | 'system';
  guiFont: FontConfig;
  allowMultipleInstances: boolean;
  autoReconnect: boolean;
  restoreLastDatabase: boolean;
  updateCheck: UpdateCheckConfig;
  usageStatistics: boolean;
  wheelZoom: boolean;
  displayBars: boolean;
  mysqlBinariesPath: string;
  customSnippetsDirectory: string;
  webSearchBaseUrl: string;
}

export interface UpdateCheckConfig {
  enabled: boolean;
  intervalDays: number;
  checkBuilds: boolean;
}

export interface EditorPreferences {
  font: FontConfig;
  tabWidth: number;
  tabsToSpaces: boolean;
  autoUppercase: boolean;
  completionProposal: CompletionConfig;
  colorPreset: string;
  lineBreakStyle: LineBreakStyle;
  highlighterColors: Record<string, SyntaxColor>;
  activeLineColor: string;
  matchingBraceForeground: string;
  matchingBraceBackground: string;
}

export interface CompletionConfig {
  enabled: boolean;
  delay: number;              // ms
  searchOnMid: boolean;
}

export interface SyntaxColor {
  foreground: string;
  background: string;
  bold: boolean;
  italic: boolean;
}

export interface GridPreferences {
  font: FontConfig;
  maxColumnWidth: number;
  rowsPerStep: number;
  maxRows: number;
  maxLineCount: number;
  textColors: Record<DataTypeCategory, string>;
  textColorsPreset: string;
  nullBackground: string;
  rowBackgroundEven: string;
  rowBackgroundOdd: string;
  highlightSameText: string;
  localNumberFormat: boolean;
  lowercaseHex: boolean;
  showRowId: boolean;
  columnHeaderClickSort: boolean;
  realTrailingZeros: number;
  longSortRowThreshold: number;
  maxQueryResults: number;
  hintsOnResultTabs: boolean;
}

export interface LoggingPreferences {
  maxLines: number;
  snipLength: number;
  events: Record<LogEvent, boolean>;
  logToFile: boolean;
  logDirectory: string;
  showTimestamp: boolean;
  horizontalScrollbar: boolean;
  queryHistory: {
    enabled: boolean;
    keepDays: number;
  };
}

export interface FilePreferences {
  promptSaveOnClose: boolean;
  restoreTabs: boolean;
  tabCloseOnDoubleClick: boolean;
  tabCloseOnMiddleClick: boolean;
  tabIconsGrayscaleMode: number;
  reformatter: string;
}

export interface FontConfig {
  name: string;
  size: number;
}

export interface ShortcutConfig {
  key1: string;               // e.g. "Ctrl+N"
  key2?: string;
}

// ============================================================
// 10. WebSocket 事件
// ============================================================

/** WebSocket 事件基础 */
export interface WSEvent<T = unknown> {
  event: string;
  data: T;
  timestamp: string;
}

export interface WSQueryProgress {
  queryId: string;
  status: 'executing' | 'fetching';
  rowsFetched: number;
  elapsedTime: number;
}

export interface WSQueryComplete {
  queryId: string;
  status: 'success';
  rowCount: number;
  duration: number;
}

export interface WSQueryError {
  queryId: string;
  error: ApiError;
}

export interface WSQueryLog {
  level: LogEvent;
  message: string;
  sql?: string;
  connectionId: string;
}

export interface WSConnectionStatus {
  connectionId: string;
  status: ConnectionStatus;
  serverVersion?: string;
  error?: string;
}

export interface WSExportProgress {
  exportId: string;
  progress: number;           // 0-100
  exportedRows: number;
  totalRows: number;
}

export interface WSImportProgress {
  importId: string;
  progress: number;
  importedRows: number;
  totalRows?: number;
  currentFile?: string;
}

// ============================================================
// 11. 导入导出
// ============================================================

/** 导出请求 */
export interface ExportRequest {
  connectionId: string;
  database: string;
  tables: string[];
  format: ExportFormat;
  options: ExportOptions;
  output: ExportOutput;
}

export type ExportFormat = 'sql' | 'csv' | 'json' | 'xml' | 'html' | 'excel';

export interface ExportOptions {
  // SQL 选项
  includeStructure?: boolean;
  includeData?: boolean;
  includeDropTable?: boolean;
  includeCreateTable?: boolean;
  insertMode?: 'INSERT' | 'REPLACE' | 'INSERT IGNORE' | 'UPDATE' | 'INSERT UPDATE';
  batchSize?: number;
  // CSV 选项
  delimiter?: string;
  enclosure?: string;
  escape?: string;
  encoding?: string;
  includeHeaders?: boolean;
  lineEnding?: LineBreakStyle;
  // 通用
  compression?: 'none' | 'zip' | 'gzip';
}

export type ExportOutput =
  | { type: 'file'; path: string }
  | { type: 'clipboard' }
  | { type: 'server' };

/** 导入请求 */
export interface ImportRequest {
  connectionId: string;
  database: string;
  table: string;
  filePath: string;
  format: 'csv' | 'sql' | 'json';
  options: ImportOptions;
}

export interface ImportOptions {
  // CSV 选项
  delimiter?: string;
  enclosure?: string;
  escape?: string;
  encoding?: string;
  hasHeaders?: boolean;
  skipLines?: number;
  // 通用
  truncateFirst?: boolean;
  onError?: 'abort' | 'continue' | 'ignore';
  batchSize?: number;
}

export interface ImportResult {
  importedRows: number;
  skippedRows: number;
  errors: ImportError[];
  duration: number;
}

export interface ImportError {
  row: number;
  column?: string;
  error: string;
  rawValue?: string;
}

// ============================================================
// 12. 工具功能
// ============================================================

/** 表维护操作 */
export type MaintenanceOperation = 'check' | 'analyze' | 'checksum' | 'optimize' | 'repair';

export interface MaintenanceRequest {
  connectionId: string;
  database: string;
  tables: string[];
  operation: MaintenanceOperation;
  options?: MaintenanceOptions;
}

export interface MaintenanceOptions {
  quick?: boolean;
  fast?: boolean;
  medium?: boolean;
  extended?: boolean;
  changed?: boolean;
  forUpgrade?: boolean;
}

export interface MaintenanceResult {
  database: string;
  table: string;
  operation: MaintenanceOperation;
  status: 'OK' | 'Error' | 'Warning' | 'Info';
  message: string;
}

/** 服务器变量 */
export interface ServerVariable {
  name: string;
  value: string;
  scope: 'global' | 'session';
  readOnly: boolean;
  type: 'string' | 'numeric' | 'boolean' | 'enum';
  enumValues?: string[];
}

/** 服务器进程 */
export interface ServerProcess {
  id: number;
  user: string;
  host: string;
  database?: string;
  command: string;
  time: number;
  state: string;
  info?: string;
}

// ============================================================
// 13. Tauri IPC 命令类型
// ============================================================

export interface TauriCommands {
  read_file(args: { path: string }): Promise<string>;
  write_file(args: { path: string; content: string }): Promise<void>;
  select_directory(args: { title?: string }): Promise<string | null>;
  select_file(args: { title?: string; filters?: FileFilter[] }): Promise<string | null>;
  save_file(args: { title?: string; defaultPath?: string; filters?: FileFilter[] }): Promise<string | null>;
  set_window_title(args: { title: string }): Promise<void>;
  show_notification(args: { title: string; body: string; icon?: string }): Promise<void>;
  get_config(args: { key: string }): Promise<unknown>;
  set_config(args: { key: string; value: unknown }): Promise<void>;
  get_platform_info(): Promise<PlatformInfo>;
  encrypt_data(args: { plaintext: string }): Promise<string>;
  decrypt_data(args: { ciphertext: string }): Promise<string>;
  open_url(args: { url: string }): Promise<void>;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface PlatformInfo {
  os: string;
  arch: string;
  version: string;
  appVersion: string;
  isWine: boolean;
}

// ============================================================
// 14. 辅助类型
// ============================================================

/** 日志消息 */
export interface LogMessage {
  id: string;
  timestamp: string;
  level: LogEvent;
  message: string;
  sql?: string;
  connectionId?: string;
}

/** 主题配置 */
export interface ThemeConfig {
  name: string;
  isDark: boolean;
  colors: {
    primary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };
}

/** 数据类型颜色映射 */
export type DataTypeColorMap = Record<DataTypeCategory, string>;

/** 颜色预设 */
export interface ColorPreset {
  name: string;
  colors: DataTypeColorMap;
}
