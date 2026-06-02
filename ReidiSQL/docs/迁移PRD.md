# ReidiSQL 迁移 PRD：从 Delphi 到现代架构

> 本文档基于 10 份 Delphi 功能 PRD（`Delphi_PRD/01~10`）和现有架构设计，定义 ReidiSQL 新系统的开发规格。  
> 这是**唯一开发蓝图**——所有实现以此文档及其产出物（TypeScript 类型、OpenAPI 规范、组件规格）为准。

## 目录

1. [产品愿景与范围](#1-产品愿景与范围)
2. [技术架构确认](#2-技术架构确认)
3. [核心数据模型](#3-核心数据模型)
4. [功能模块与组件映射](#4-功能模块与组件映射)
5. [API 端点总表与差距分析](#5-api-端点总表与差距分析)
6. [核心用户流程](#6-核心用户流程)
7. [状态机定义](#7-状态机定义)
8. [页面与组件规格](#8-页面与组件规格)
9. [设计系统](#9-设计系统)
10. [实现路线图](#10-实现路线图)

---

## 1. 产品愿景与范围

### 1.1 产品定位

ReidiSQL = HeidiSQL 的现代化跨平台重写版，目标：
- 保留 HeidiSQL 95% 核心功能的效率体验
- 解决 HeidiSQL 的三大限制：**仅 Windows**、**UI 框架过时**、**单进程架构**
- 增加现代特性：**实时协作**、**智能补全**、**多标签工作区**

### 1.2 V1 MVP 范围

| 优先级 | 模块 | Delphi PRD 参考 | 状态 |
|--------|------|-----------------|------|
| **P0** | 连接管理（TCP/SSH） | PRD-01 | 必须 |
| **P0** | 主界面三栏布局 + 对象树 | PRD-02 | 必须 |
| **P0** | SQL 编辑器（高亮/补全/执行） | PRD-03 | 必须 |
| **P0** | 查询执行 + 结果网格 | PRD-04 | 必须 |
| **P1** | 表设计器（列/索引/外键） | PRD-05 | 应该 |
| **P1** | 数据导入导出（CSV/SQL） | PRD-06 | 应该 |
| **P1** | 视图/存储过程/触发器编辑 | PRD-07 | 应该 |
| **P2** | 用户管理与权限 | PRD-08 | 可以 |
| **P2** | 表工具/数据库同步/帮助 | PRD-09 | 可以 |
| **P2** | 偏好设置与配置 | PRD-10 | 可以 |

### 1.3 数据库支持矩阵

| 数据库 | V1 支持 | 驱动 | 说明 |
|--------|---------|------|------|
| MySQL/MariaDB | ✅ 完整 | `mysql2` | 主力数据库，功能最全 |
| PostgreSQL | ✅ 基础 | `pg` | V1 仅查询/结果/基础DDL |
| SQLite | ✅ 基础 | `better-sqlite3` | V1 仅查询/结果 |
| SQL Server | ⏳ V2 | `tedious` | 已引入驱动，V1 不实现 |

---

## 2. 技术架构确认

### 2.1 已确认的技术栈

| 层 | 技术 | 版本 | 用途 |
|----|------|------|------|
| 桌面壳 | Tauri 2.x | Rust | 原生窗口/文件系统/加密 |
| 前端 | React 18 + TypeScript | 5.4 | UI 框架 |
| UI 组件 | Ant Design 5 | 5.15 | 基础组件库 |
| SQL 编辑器 | Monaco Editor | 0.47 | 代码编辑（VS Code 同款） |
| 数据网格 | AG Grid Community | 31.x | 高性能数据展示 |
| 状态管理 | Zustand | 4.5 | 全局状态 |
| 数据请求 | TanStack Query | 5.28 | 服务端状态缓存 |
| 国际化 | i18next | 23.x | 多语言 |
| 后端 | Node.js + Express | 22.x / 4.18 | 数据库连接代理 |
| 日志 | Winston | 3.12 | 结构化日志 |
| 构建 | Vite 5 | 5.2 | 前端打包 |

### 2.2 三层架构

```
┌─ Tauri (Rust) ─────────────────────────────────────┐
│ 窗口管理 / 文件系统 / 加密 / 系统通知 / 进程管理    │
└──────────────────┬──────────────────────────────────┘
                   │ IPC (invoke / events)
┌─ React Frontend ─▼─────────────────────────────────┐
│ UI组件 / 状态管理 / Monaco编辑器 / AG Grid          │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP REST + WebSocket (localhost)
┌─ Node.js Backend ─▼────────────────────────────────┐
│ Express / mysql2 / pg / better-sqlite3 / ssh2       │
└──────────────────┬──────────────────────────────────┘
                   │ Database Protocols
┌─ Database Servers─▼────────────────────────────────┐
│ MySQL / MariaDB / PostgreSQL / SQLite               │
└─────────────────────────────────────────────────────┘
```

### 2.3 通信协议

| 路径 | 协议 | 用途 |
|------|------|------|
| Frontend ↔ Node.js | HTTP REST | CRUD 操作、元数据查询 |
| Frontend ↔ Node.js | WebSocket | 查询进度、日志推送、连接状态 |
| Frontend ↔ Tauri | IPC invoke | 文件读写、窗口操作、加密、系统信息 |
| Node.js ↔ DB | 原生协议 | 数据库连接与查询 |

---

## 3. 核心数据模型

> 完整 TypeScript 定义见 `shared/types.ts`（Phase 1 产出物）。此处列出关键接口。

### 3.1 连接配置

```typescript
/** 支持的数据库类型 */
type DatabaseType = 'mysql' | 'mariadb' | 'postgresql' | 'sqlite';

/** 网络类型 */
type NetType = 'tcp' | 'ssh_tunnel' | 'named_pipe' | 'socket';

/** 连接配置 */
interface ConnectionConfig {
  id: string;
  name: string;
  type: DatabaseType;
  netType: NetType;
  host: string;
  port: number;
  username: string;
  password?: string;          // 存储时加密
  database?: string;
  ssh?: SSHConfig;
  ssl?: SSLConfig;
  options: ConnectionOptions;
  // 元数据
  createdAt: string;          // ISO 8601
  updatedAt: string;
  lastConnectedAt?: string;
  color?: string;             // 连接标识色
}
```

### 3.2 查询结果

```typescript
interface QueryResult {
  queryId: string;
  sql: string;
  columns: ColumnDescriptor[];
  rows: Record<string, unknown>[];
  rowCount: number;
  affectedRows?: number;
  insertId?: number;
  duration: number;           // 毫秒
  hasMore: boolean;
  warnings: QueryWarning[];
}

interface ColumnDescriptor {
  name: string;
  type: string;               // 原始数据库类型
  category: DataTypeCategory; // 分类：integer/real/text/binary/temporal/spatial/other
  nullable: boolean;
  maxLength?: number;
  precision?: number;
  scale?: number;
  table?: string;             // 所属表
  flags?: string[];           // PRI/AUTO_INCREMENT/UNSIGNED 等
}
```

### 3.3 数据库元数据

```typescript
/** 数据库对象类型 */
type DBObjectType = 'database' | 'table' | 'view' | 'procedure' | 'function'
                  | 'trigger' | 'event' | 'column' | 'index' | 'foreign_key';

/** 数据库对象树节点 */
interface DBObjectNode {
  id: string;
  name: string;
  type: DBObjectType;
  parent?: string;            // 父节点ID
  database?: string;
  schema?: string;
  children?: DBObjectNode[];
  meta?: Record<string, unknown>;
}

/** 表元数据 */
interface TableMeta {
  name: string;
  engine: string;             // InnoDB/MyISAM/...
  charset: string;
  collation: string;
  rowCount: number;
  dataSize: number;           // bytes
  indexSize: number;
  autoIncrement?: number;
  comment: string;
  createdAt?: string;
  updatedAt?: string;
}

/** 列元数据 */
interface ColumnMeta {
  name: string;
  dataType: string;           // INT/VARCHAR/TEXT/...
  fullType: string;           // INT(11) UNSIGNED
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
}

/** 索引元数据 */
interface IndexMeta {
  name: string;
  type: 'PRIMARY' | 'UNIQUE' | 'INDEX' | 'FULLTEXT' | 'SPATIAL';
  columns: IndexColumn[];
  comment: string;
  algorithm: string;          // BTREE/HASH/RTREE
}

/** 外键元数据 */
interface ForeignKeyMeta {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onUpdate: ReferentialAction;
  onDelete: ReferentialAction;
}

type ReferentialAction = 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'SET DEFAULT';
```

### 3.4 用户与权限

```typescript
interface UserInfo {
  username: string;
  host: string;
  plugin: string;             // mysql_native_password/caching_sha2_password/...
  isRole: boolean;            // MariaDB is_role
  accountLocked: boolean;
  passwordExpired: boolean;
  sslType: string;
  maxConnections?: number;
  maxUserConnections?: number;
  privileges: PrivilegeGrant[];
  roles: RoleGrant[];
}

interface PrivilegeGrant {
  privilege: string;
  scope: 'global' | 'database' | 'table' | 'column' | 'routine';
  target: string;             // *.* / `db`.* / `db`.`table`
  columns?: string[];
  grantOption: boolean;
}
```

### 3.5 偏好设置

```typescript
interface AppPreferences {
  general: {
    language: string;           // 语言代码或空=自动检测
    theme: string;              // VCL 样式名
    iconPack: string;
    guiFont: FontConfig;
    allowMultipleInstances: boolean;
    autoReconnect: boolean;
    restoreLastDatabase: boolean;
    updateCheck: UpdateCheckConfig;
  };
  editor: {
    font: FontConfig;
    tabWidth: number;
    tabsToSpaces: boolean;
    autoUppercase: boolean;
    completionProposal: CompletionConfig;
    colorPreset: string;
    lineBreakStyle: 'windows' | 'unix' | 'mac';
    highlighterColors: Record<string, SyntaxColor>;
  };
  grid: {
    font: FontConfig;
    maxColumnWidth: number;
    rowsPerStep: number;
    maxRows: number;
    maxLineCount: number;
    textColors: Record<DataTypeCategory, string>;
    nullBackground: string;
    rowBackgroundEven: string;
    rowBackgroundOdd: string;
    highlightSameText: string;
    localNumberFormat: boolean;
    showRowId: boolean;
  };
  logging: {
    maxLines: number;
    snipLength: number;
    events: Record<LogEvent, boolean>;
    logToFile: boolean;
    logDirectory: string;
    showTimestamp: boolean;
    horizontalScrollbar: boolean;
    queryHistory: { enabled: boolean; keepDays: number };
  };
  shortcuts: Record<string, ShortcutConfig>;
  files: {
    promptSaveOnClose: boolean;
    restoreTabs: boolean;
    tabCloseOnDoubleClick: boolean;
    tabCloseOnMiddleClick: boolean;
  };
}
```

---

## 4. 功能模块与组件映射

### 4.1 模块 → React 组件映射

| Delphi 窗体 | React 组件路径 | 优先级 | 说明 |
|-------------|---------------|--------|------|
| `TfrmConnections` | `src/pages/ConnectionManager.tsx` | P0 | 连接管理对话框 |
| `TLoginForm` | `src/components/ConnectionLogin.tsx` | P0 | 快速连接面板 |
| `TMainForm` | `src/pages/MainLayout.tsx` | P0 | 三栏布局容器 |
| DBTree | `src/components/DatabaseTree.tsx` | P0 | 对象树（Antd Tree） |
| QueryTabs | `src/components/QueryTabs.tsx` | P0 | 多标签管理 |
| SynMemo | `src/components/SQLEditor.tsx` | P0 | Monaco 编辑器封装 |
| DataGrid | `src/components/DataGrid.tsx` | P0 | AG Grid 封装 |
| LogPanel | `src/components/LogPanel.tsx` | P0 | SQL 日志面板 |
| SidePanel | `src/components/SidePanel.tsx` | P1 | 左侧帮助面板（列/函数/关键字/片段/历史） |
| `TTableEditor` | `src/pages/TableEditor.tsx` | P1 | 表设计器 |
| `TfrmView` | `src/pages/ViewEditor.tsx` | P1 | 视图编辑器 |
| `TfrmRoutineEditor` | `src/pages/RoutineEditor.tsx` | P1 | 存储过程/函数编辑器 |
| `TfrmTriggerEditor` | `src/pages/TriggerEditor.tsx` | P1 | 触发器编辑器 |
| `TLoadData` | `src/pages/ImportWizard.tsx` | P1 | 数据导入向导 |
| `TfrmExportGrid` | `src/components/ExportDialog.tsx` | P1 | 数据导出对话框 |
| `TUserManagerForm` | `src/pages/UserManager.tsx` | P2 | 用户管理器 |
| `TfrmPreferences` | `src/pages/Preferences.tsx` | P2 | 偏好设置 |
| `TfrmTableTools` | `src/pages/TableTools.tsx` | P2 | 表工具集 |
| `TfrmSQLhelp` | `src/components/SQLHelp.tsx` | P2 | SQL 帮助 |
| `TAboutBox` | `src/components/AboutDialog.tsx` | P2 | 关于对话框 |

### 4.2 状态管理（Zustand Store）

```typescript
// stores/connectionStore.ts
interface ConnectionStore {
  connections: ConnectionConfig[];
  activeConnectionId: string | null;
  connectionStatus: Record<string, ConnectionStatus>;
  databases: Record<string, DatabaseInfo[]>;
  selectedDatabase: string | null;
  // actions
  addConnection: (config: ConnectionConfig) => void;
  removeConnection: (id: string) => void;
  connect: (id: string) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  selectDatabase: (name: string) => void;
}

// stores/queryStore.ts
interface QueryStore {
  tabs: QueryTab[];
  activeTabId: string;
  results: Record<string, QueryResult[]>;
  executingTabs: Set<string>;
  // actions
  addTab: () => void;
  closeTab: (id: string) => void;
  executeQuery: (tabId: string, sql: string) => Promise<void>;
  cancelQuery: (tabId: string) => void;
}

// stores/preferencesStore.ts
interface PreferencesStore {
  preferences: AppPreferences;
  updatePreference: <K extends keyof AppPreferences>(
    key: K, value: Partial<AppPreferences[K]>
  ) => void;
  resetToDefaults: () => void;
}

// stores/objectTreeStore.ts
interface ObjectTreeStore {
  expandedKeys: string[];
  selectedKeys: string[];
  treeData: DBObjectNode[];
  loading: Set<string>;
  // actions
  expandNode: (key: string) => void;
  selectNode: (key: string) => void;
  refreshNode: (key: string) => Promise<void>;
}
```

---

## 5. API 端点总表与差距分析

### 5.1 已定义的端点（API接口规范.md）

| 方法 | 路径 | 状态 |
|------|------|------|
| GET | `/connections` | ✅ 已定义 |
| POST | `/connections` | ✅ 已定义 |
| POST | `/connections/test` | ✅ 已定义 |
| PUT | `/connections/:id` | ✅ 已定义 |
| DELETE | `/connections/:id` | ✅ 已定义 |
| POST | `/query/execute` | ✅ 已定义 |
| POST | `/query/execute/stream` | ✅ 已定义 |
| POST | `/query/:id/cancel` | ✅ 已定义 |
| GET | `/query/history` | ✅ 已定义 |
| GET | `/metadata/:connId/databases` | ✅ 已定义 |
| GET | `/metadata/:connId/databases/:db/tables` | ✅ 已定义 |
| GET | `/metadata/:connId/databases/:db/tables/:t/columns` | ✅ 已定义 |
| GET | `/metadata/:connId/databases/:db/tables/:t/indexes` | ✅ 已定义 |
| GET | `/metadata/:connId/databases/:db/tables/:t/foreign-keys` | ✅ 已定义 |
| POST | `/data/:connId/.../:table` | ✅ 已定义 |
| PUT | `/data/:connId/.../:table` | ✅ 已定义 |
| DELETE | `/data/:connId/.../:table` | ✅ 已定义 |
| POST | `/export` | ✅ 已定义 |
| POST | `/import/.../:table` | ✅ 已定义 |
| POST | `/ssh/tunnel` | ✅ 已定义 |
| DELETE | `/ssh/tunnel/:id` | ✅ 已定义 |

### 5.2 需要补充的端点

| 方法 | 路径 | 优先级 | 说明 |
|------|------|--------|------|
| POST | `/connections/:id/connect` | P0 | 建立连接（区别于创建配置） |
| POST | `/connections/:id/disconnect` | P0 | 断开连接 |
| GET | `/connections/:id/status` | P0 | 连接状态 + 服务器版本 |
| GET | `/metadata/:connId/databases/:db/tables/:t/create-sql` | P0 | SHOW CREATE TABLE |
| GET | `/metadata/:connId/databases/:db/views` | P1 | 视图列表 |
| GET | `/metadata/:connId/databases/:db/views/:v/create-sql` | P1 | SHOW CREATE VIEW |
| GET | `/metadata/:connId/databases/:db/routines` | P1 | 存储过程/函数列表 |
| GET | `/metadata/:connId/databases/:db/routines/:r/create-sql` | P1 | SHOW CREATE |
| GET | `/metadata/:connId/databases/:db/triggers` | P1 | 触发器列表 |
| GET | `/metadata/:connId/databases/:db/events` | P1 | 事件列表 |
| POST | `/metadata/:connId/databases` | P1 | CREATE DATABASE |
| PUT | `/metadata/:connId/databases/:db` | P1 | ALTER DATABASE |
| DELETE | `/metadata/:connId/databases/:db` | P1 | DROP DATABASE |
| POST | `/metadata/:connId/databases/:db/tables` | P1 | CREATE TABLE (DDL) |
| PUT | `/metadata/:connId/databases/:db/tables/:t` | P1 | ALTER TABLE (DDL) |
| DELETE | `/metadata/:connId/databases/:db/tables/:t` | P1 | DROP TABLE |
| POST | `/metadata/:connId/databases/:db/views` | P1 | CREATE/ALTER VIEW |
| POST | `/metadata/:connId/databases/:db/routines` | P1 | CREATE/ALTER ROUTINE |
| POST | `/metadata/:connId/databases/:db/triggers` | P1 | CREATE TRIGGER |
| POST | `/metadata/:connId/databases/:db/events` | P1 | CREATE EVENT |
| GET | `/metadata/:connId/server-info` | P1 | 服务器版本/变量/状态 |
| GET | `/metadata/:connId/variables` | P2 | 服务器变量列表 |
| PUT | `/metadata/:connId/variables/:name` | P2 | SET 变量 |
| GET | `/metadata/:connId/processes` | P2 | SHOW PROCESSLIST |
| POST | `/metadata/:connId/processes/:pid/kill` | P2 | KILL 进程 |
| GET | `/admin/:connId/users` | P2 | 用户列表 |
| POST | `/admin/:connId/users` | P2 | CREATE USER |
| PUT | `/admin/:connId/users/:user` | P2 | ALTER USER |
| DELETE | `/admin/:connId/users/:user` | P2 | DROP USER |
| GET | `/admin/:connId/users/:user/privileges` | P2 | SHOW GRANTS |
| PUT | `/admin/:connId/users/:user/privileges` | P2 | GRANT/REVOKE |
| GET | `/preferences` | P2 | 读取偏好设置 |
| PUT | `/preferences` | P2 | 更新偏好设置 |
| POST | `/tools/maintenance` | P2 | CHECK/ANALYZE/OPTIMIZE/REPAIR |
| POST | `/tools/find` | P2 | 表内容搜索 |
| POST | `/tools/sync/analyze` | P2 | 数据库同步分析 |
| POST | `/tools/bulk-edit` | P2 | 批量表编辑 |
| POST | `/tools/generate-data` | P2 | 数据生成 |

### 5.3 WebSocket 事件补充

| 事件 | 方向 | 说明 |
|------|------|------|
| `query:progress` | S→C | 查询进度（已有） |
| `query:complete` | S→C | 查询完成（已有） |
| `query:error` | S→C | 查询错误（已有） |
| `query:log` | S→C | **新增**：SQL 日志条目推送 |
| `connection:status` | S→C | 连接状态变化（已有） |
| `connection:lost` | S→C | **新增**：连接意外断开 |
| `export:progress` | S→C | 导出进度（已有） |
| `import:progress` | S→C | **新增**：导入进度 |
| `object:changed` | S→C | **新增**：数据库对象变更通知 |
| `server:message` | S→C | **新增**：服务器消息/警告推送 |

---

## 6. 核心用户流程

### 6.1 F1: 首次启动 → 连接 → 查询

```
启动应用
  → [无连接时] 显示欢迎页 + "新建连接"引导
  → 用户点击 "新建连接"
  → 打开 ConnectionManager 对话框
  → 选择数据库类型 → 填写主机/端口/用户名/密码
  → [可选] 配置 SSH 隧道 / SSL
  → 点击 "测试连接" → 显示成功/失败反馈
  → 点击 "保存"
  → 自动连接 → 加载数据库列表 → 展开对象树
  → 用户双击数据库 → 加载表/视图/存储过程列表
  → 用户点击 "+" 新建查询标签
  → 在 Monaco 编辑器中输入 SQL
  → Ctrl+Enter 执行查询
  → 结果网格显示数据 + 消息面板显示执行时间
```

### 6.2 F2: 表设计（创建/修改）

```
右键对象树中的表/空区域 → "新建表" 或 "编辑表"
  → 打开 TableEditor 页面（新标签）
  → 列编辑区：添加/修改/删除列
  → 索引编辑区：添加/修改索引
  → 外键编辑区：添加/修改外键
  → 表选项区：引擎/排序规则/注释
  → SQL 预览面板实时显示 DDL
  → 点击 "保存" → 发送 DDL 到后端执行
  → [失败] 显示错误 + 保留编辑状态
  → [成功] 刷新对象树
```

### 6.3 F3: 数据导入

```
菜单 → 文件 → 导入 CSV/文本文件
  → 打开 ImportWizard（多步骤对话框）
  → Step 1: 选择文件 → 自动检测格式（分隔符/编码）
  → Step 2: 预览数据（前 20 行） → 调整列映射
  → Step 3: 选择目标表（新建或已有）
  → Step 4: 配置导入选项（截断/追加/替换/错误处理）
  → 点击 "导入" → 进度条显示
  → 完成：显示导入统计（成功行/失败行/错误详情）
```

### 6.4 F4: 数据编辑（网格内联编辑）

```
在结果网格中双击单元格 → 进入编辑模式
  → [数值列] 显示数字输入
  → [日期列] 显示日期选择器
  → [Enum列] 显示下拉选择
  → [Binary列] 显示十六进制编辑器
  → 编辑完成（Enter/Tab/失焦） → 标记为已修改（高亮）
  → 用户点击 "应用修改" 或 Ctrl+S
  → 生成 UPDATE 语句 → 发送到后端
  → [成功] 清除修改标记
  → [失败] 显示错误 + 保留修改状态
```

---

## 7. 状态机定义

### 7.1 连接状态机

```
                    ┌──────────────┐
                    │  DISCONNECTED │
                    └──────┬───────┘
                           │ connect()
                           ▼
                    ┌──────────────┐
                    │  CONNECTING   │
                    └──┬───────┬───┘
              success  │       │  error
                       ▼       ▼
              ┌────────────┐  ┌──────────┐
              │  CONNECTED  │  │  ERROR    │
              └──┬─────┬───┘  └──────────┘
   disconnect()  │     │  connection_lost
                 ▼     ▼
          ┌──────────────┐
          │  DISCONNECTED │  (可自动重连)
          └──────────────┘
```

**状态值**：`'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting'`

### 7.2 查询执行状态机

```
          ┌──────────┐
          │   IDLE    │
          └────┬─────┘
  execute()    │
               ▼
          ┌──────────┐
          │ PARSING   │ (分割多条语句)
          └────┬─────┘
               │
               ▼
          ┌──────────┐  cancel()  ┌───────────┐
          │ EXECUTING │──────────→│ CANCELLING │
          └──┬────┬──┘            └─────┬─────┘
    success  │    │  error              │
             ▼    ▼                     ▼
    ┌──────────┐ ┌────────┐    ┌──────────┐
    │ COMPLETE  │ │ ERROR   │    │ CANCELLED │
    └──────────┘ └────────┘    └──────────┘
             │        │              │
             └────────┴──────────────┘
                        │
                        ▼
                   ┌──────────┐
                   │   IDLE    │
                   └──────────┘
```

### 7.3 表编辑器状态机

```
     ┌────────────┐
     │   CLEAN     │ (无修改)
     └──────┬─────┘
  用户编辑  │
            ▼
     ┌────────────┐
     │   DIRTY     │ (有未保存修改)
     └──┬──────┬──┘
 save() │      │ discard()
        ▼      ▼
  ┌──────────┐ ┌──────────┐
  │  SAVING   │ │  CLEAN   │
  └──┬────┬──┘ └──────────┘
 ok  │    │ error
     ▼    ▼
 ┌────────┐ ┌──────────┐
 │ CLEAN  │ │  ERROR    │ (显示错误，保留DIRTY)
 └────────┘ └──────────┘
```

---

## 8. 页面与组件规格

### 8.1 主布局 (MainLayout)

```
┌──────────────────────────────────────────────────────────────────┐
│ MenuBar  (File | Edit | View | Tools | Help)                    │
├──────────────────────────────────────────────────────────────────┤
│ Toolbar  (🔌连接 | 📄新建查询 | ▶执行 | ⏹停止 | 🔄刷新)       │
├──────────┬───────────────────────────────────────────────────────┤
│          │ QueryTabs  [查询1] [查询2] [+]                        │
│ SideBar  ├───────────────────────────────────────────────────────┤
│ (240px)  │ ┌─ Splitter ───────────────────────────────────────┐│
│          │ │ SQLEditor (Monaco)                                ││
│ DBTree   │ │                                                   ││
│          │ ├────────────────────────────────────────────────────┤│
│ + Help   │ │ ResultTabs [结果1] [结果2] [消息] [分析]          ││
│ Panel    │ │ DataGrid (AG Grid)                                ││
│          │ └───────────────────────────────────────────────────┘│
├──────────┴───────────────────────────────────────────────────────┤
│ StatusBar: 连接名 | 数据库 | 服务器版本 | 光标位置 | 执行时间   │
└──────────────────────────────────────────────────────────────────┘
```

**响应式规则**：
| 窗口宽度 | 行为 |
|----------|------|
| ≥ 1200px | 三栏正常显示 |
| 1000-1200px | 侧边栏收窄至 200px |
| < 1000px（最小值） | 侧边栏可折叠为图标模式 |

**Splitter 行为**：
- SQL 编辑器与结果面板之间的分割条可拖拽
- 记忆上次位置（持久化到 localStorage）
- 双击恢复默认比例（50/50）

### 8.2 数据库对象树 (DatabaseTree)

**数据结构**：
```
🔌 connection-name
  📁 database_1
    📁 Tables
      📋 table_1
        📋 table_2
    📁 Views
      👁 view_1
    📁 Procedures
      ⚙ proc_1
    📁 Functions
      ƒ func_1
    📁 Triggers
      ⚡ trigger_1
    📁 Events
      📅 event_1
  📁 database_2
```

**右键菜单**：
| 节点类型 | 菜单项 |
|----------|--------|
| 连接 | 断开 / 编辑 / 删除 / 新建查询 |
| 数据库 | 新建查询 / 新建表 / 新建视图 / 重命名 / 删除 / 复制名 |
| Tables 分组 | 新建表 / 刷新 |
| 表 | 打开 / 编辑 / 清空 / 删除 / 复制名 / 生成SELECT / 导出数据 |
| 列 | 编辑 / 删除 / 复制名 |
| 视图/存储过程/触发器 | 编辑 / 删除 / 复制 CREATE 语句 |

**懒加载**：首次展开节点时从后端加载子节点。

### 8.3 SQL 编辑器 (SQLEditor)

**Monaco 配置**：
| 配置项 | 值 | 来源 |
|--------|----|------|
| `language` | `sql` / `mysql` | 根据连接类型 |
| `theme` | 联动应用主题 | preferences |
| `fontSize` | 用户配置 | preferences.editor.font |
| `tabSize` | 用户配置 | preferences.editor.tabWidth |
| `insertSpaces` | 用户配置 | preferences.editor.tabsToSpaces |
| `autoClosingBrackets` | `always` | 默认 |
| `minimap.enabled` | `false` | 默认 |
| `lineNumbers` | `on` | 默认 |
| `wordWrap` | `off` | 默认 |

**自定义功能**：
| 功能 | 实现方式 |
|------|----------|
| SQL 语法高亮 | Monaco 内置 SQL 语言 + 自定义 Token |
| 代码补全 | Monaco CompletionProvider：关键字 + 表名 + 列名 + 函数 |
| 执行选中语句 | `getModel().getValueInRange(editor.getSelection())` |
| 执行当前语句 | 根据光标位置解析语句边界（分号分隔） |
| 快捷键 Ctrl+Enter | 执行当前/选中语句 |
| 快捷键 Ctrl+Shift+Enter | 执行全部 |
| 快捷键 Ctrl+F | 查找（Monaco 内置） |
| 快捷键 Ctrl+H | 替换（Monaco 内置） |
| 括号匹配高亮 | Monaco `matchBrackets` + 自定义颜色 |

### 8.4 数据网格 (DataGrid)

**AG Grid 配置**：
| 配置项 | 值 |
|--------|----|
| `rowSelection` | `multiple` |
| `singleClickEdit` | `false`（双击编辑） |
| `undoRedoCellEditing` | `true` |
| `enableCellTextSelection` | `true` |
| `columnDefs` | 动态生成（根据 QueryResult.columns） |
| `pagination` | 客户端分页 + 服务端分批加载 |

**列类型 → 单元格渲染器**：
| DataTypeCategory | 渲染器 | 编辑器 |
|------------------|--------|--------|
| integer | NumberRenderer（右对齐，类型色） | NumberEditor |
| real | NumberRenderer（右对齐，小数位） | NumberEditor |
| text | TextRenderer（截断+tooltip） | TextEditor |
| binary | HexRenderer（十六进制显示） | HexEditor |
| temporal | DateRenderer（格式化显示） | DatePickerEditor |
| spatial | WKTRenderer（WKT文本） | TextEditor |
| other | DefaultRenderer | TextEditor |

**右键菜单**：
- 复制 / 复制为 SQL INSERT / 复制为 CSV / 复制为 JSON
- 删除选中行 / 编辑 / 设为 NULL
- 过滤此值 / 排序

---

## 9. 设计系统

### 9.1 主题方案

使用 Ant Design 5 的 ConfigProvider 主题系统：

| Token | 亮色模式 | 暗色模式 |
|-------|----------|----------|
| `colorPrimary` | `#1677ff` | `#1668dc` |
| `colorBgContainer` | `#ffffff` | `#141414` |
| `colorBgLayout` | `#f5f5f5` | `#000000` |
| `colorText` | `#000000e0` | `#ffffffd9` |
| `borderRadius` | `6px` | `6px` |
| `fontSize` | `14px` | `14px` |

### 9.2 数据类型颜色（默认值）

| 类型 | 亮色前景 | 暗色前景 |
|------|----------|----------|
| Integer | `#0000FF` | `#8597FF` |
| Real | `#4800FF` | `#7D7DD0` |
| Text | `#008000` | `#73D573` |
| Binary | `#800080` | `#7F76C9` |
| Temporal | `#800000` | `#C97373` |
| Spatial | `#808000` | `#73CECE` |
| Other | `#808080` | `#C1C173` |
| NULL | 灰色斜体 + 自定义背景 | 同 |

### 9.3 间距系统

| Token | 值 | 用途 |
|-------|----|------|
| `spacing-xs` | 4px | 紧凑元素间距 |
| `spacing-sm` | 8px | 表单元素间距 |
| `spacing-md` | 12px | 区块内间距 |
| `spacing-lg` | 16px | 面板 padding |
| `spacing-xl` | 24px | 区块间距 |

### 9.4 排版系统

| 用途 | 字体 | 大小 |
|------|------|------|
| SQL 编辑器 | `JetBrains Mono` / `Consolas` / `monospace` | 13px |
| 数据网格 | `系统默认` | 13px |
| 界面文本 | `系统默认` | 14px |
| 标题 H1 | `系统默认` | 20px bold |
| 标题 H2 | `系统默认` | 16px bold |

---

## 10. 实现路线图

### Sprint 1: 连接 + 查询（P0 核心路径）
**目标**：从启动到执行查询完整可用

| 任务 | 前端 | 后端 |
|------|------|------|
| 连接配置 CRUD | ConnectionManager UI | connectionService 实现 |
| 连接/断开 | 连接状态管理 | connect/disconnect API |
| 对象树加载 | DatabaseTree 组件 | metadata API |
| SQL 编辑器 | Monaco 封装 + 补全 | — |
| 查询执行 | executeQuery + 结果展示 | queryService 实现 |
| 结果网格 | AG Grid 封装 | — |
| 日志面板 | LogPanel 组件 | WebSocket 日志推送 |

### Sprint 2: 表设计 + 数据编辑
| 任务 | 前端 | 后端 |
|------|------|------|
| 表设计器 UI | TableEditor 页面 | DDL 执行 API |
| 列/索引/外键编辑 | 子编辑器组件 | ALTER TABLE 生成 |
| 网格内联编辑 | 编辑器注册 | UPDATE/INSERT/DELETE |
| 数据导出 | ExportDialog | 导出 API |

### Sprint 3: 导入 + 数据库对象
| 任务 | 前端 | 后端 |
|------|------|------|
| CSV 导入向导 | ImportWizard 页面 | 导入 API + 格式检测 |
| 视图编辑器 | ViewEditor | DDL API |
| 存储过程/函数编辑器 | RoutineEditor | DDL API |
| 触发器编辑器 | TriggerEditor | DDL API |

### Sprint 4: 管理 + 工具 + 偏好
| 任务 | 前端 | 后端 |
|------|------|------|
| 用户管理器 | UserManager 页面 | admin API |
| 偏好设置 | Preferences 页面 | preferences API |
| 表工具集 | TableTools 页面 | tools API |
| SQL 帮助 | SQLHelp 组件 | — |
| 更新检查 | — | update API |

---

## 附录 A: Delphi → TypeScript 术语映射

| Delphi 术语 | TypeScript 术语 |
|-------------|-----------------|
| `TDBConnection` | `ConnectionConfig` + `ConnectionService` |
| `TDBObject` | `DBObjectNode` |
| `TDBQuery` | `QueryResult` |
| `TTableColumn` | `ColumnMeta` |
| `TTableIndex` | `IndexMeta` |
| `TForeignKey` | `ForeignKeyMeta` |
| `TSynMemo` | Monaco Editor instance |
| `TVirtualStringTree` | AG Grid / Antd Tree |
| `TListView` | AG Grid |
| `TPageControl` | Antd Tabs |
| `TActionList` | React commands + keyboard shortcuts |
| `AppSettings` (注册表) | `AppPreferences` (JSON 文件) |
| `SHOW CREATE TABLE` | `GET /metadata/.../create-sql` |
| `GRANT/REVOKE` | `PUT /admin/.../privileges` |

## 附录 B: 配置存储方案

| Delphi 方案 | 新方案 | 说明 |
|-------------|--------|------|
| Windows 注册表 | JSON 文件 | `~/.reidisql/preferences.json` |
| 会话配置 | JSON 文件 | `~/.reidisql/connections.json` |
| 查询历史 | SQLite | `~/.reidisql/history.db` |
| 代码片段 | 文件系统 | `~/.reidisql/snippets/` |
| 窗口状态 | localStorage | 前端存储 |
