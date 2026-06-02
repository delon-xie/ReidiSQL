# ReidiSQL API 接口规范

> 本文档定义 ReidiSQL 前后端通信的 API 接口规范，包括 REST API、WebSocket 事件和 Tauri IPC 命令。

## 目录

1. [API 概览](#1-api-概览)
2. [REST API](#2-rest-api)
3. [WebSocket 事件](#3-websocket-事件)
4. [Tauri IPC 命令](#4-tauri-ipc-命令)
5. [错误处理](#5-错误处理)
6. [认证和授权](#6-认证和授权)
7. [数据模型](#7-数据模型)

---

## 1. API 概览

### 1.1 基础信息

- **Base URL**: `http://127.0.0.1:{random_port}/api/v1`
- **协议**: HTTP/1.1 + WebSocket
- **数据格式**: JSON
- **字符编码**: UTF-8
- **认证方式**: Token (Header: `X-Auth-Token`)

### 1.2 API 设计原则

- RESTful 风格
- 资源导向
- 统一的错误响应格式
- 版本控制（URL 路径）
- 支持分页、过滤、排序

### 1.3 通用响应格式

**成功响应**：
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-06-01T10:00:00Z",
    "requestId": "req_123456"
  }
}
```

**错误响应**：
```json
{
  "success": false,
  "error": {
    "code": "QUERY_EXECUTION_FAILED",
    "message": "查询执行失败",
    "details": "Table 'users' doesn't exist",
    "stack": "...",
    "requestId": "req_123456"
  },
  "meta": {
    "timestamp": "2026-06-01T10:00:00Z"
  }
}
```

---

## 2. REST API

### 2.1 连接管理

#### 2.1.1 获取连接列表

```http
GET /api/v1/connections
```

**Query Parameters**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 否 | 过滤数据库类型 |
| search | string | 否 | 搜索关键字 |

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "conn_001",
      "name": "Local MySQL",
      "type": "mysql",
      "host": "localhost",
      "port": 3306,
      "username": "root",
      "database": null,
      "sshEnabled": false,
      "lastConnected": "2026-06-01T09:30:00Z",
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

#### 2.1.2 创建连接

```http
POST /api/v1/connections
```

**Request Body**:
```json
{
  "name": "Production DB",
  "type": "mysql",
  "host": "192.168.1.100",
  "port": 3306,
  "username": "admin",
  "password": "encrypted_password",
  "database": "myapp",
  "ssh": {
    "enabled": true,
    "host": "ssh.example.com",
    "port": 22,
    "username": "deploy",
    "password": "ssh_password",
    "privateKey": null
  },
  "options": {
    "charset": "utf8mb4",
    "connectTimeout": 10000,
    "queryTimeout": 30000
  }
}
```

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "conn_002",
    "name": "Production DB",
    // ... 完整连接信息
  }
}
```

#### 2.1.3 测试连接

```http
POST /api/v1/connections/test
```

**Request Body**:
```json
{
  "type": "mysql",
  "host": "localhost",
  "port": 3306,
  "username": "root",
  "password": "password"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "connected": true,
    "serverVersion": "8.0.32",
    "responseTime": 45
  }
}
```

#### 2.1.4 更新连接

```http
PUT /api/v1/connections/:id
```

**Request Body**: 同创建连接（可选字段）

#### 2.1.5 删除连接

```http
DELETE /api/v1/connections/:id
```

**Response**: `204 No Content`

---

### 2.2 查询执行

#### 2.2.1 执行查询

```http
POST /api/v1/query/execute
```

**Request Body**:
```json
{
  "connectionId": "conn_001",
  "query": "SELECT * FROM users WHERE status = ?",
  "params": ["active"],
  "options": {
    "limit": 1000,
    "timeout": 30000
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "queryId": "query_123",
    "columns": [
      {
        "name": "id",
        "type": "INT",
        "nullable": false
      },
      {
        "name": "name",
        "type": "VARCHAR",
        "nullable": true
      }
    ],
    "rows": [
      { "id": 1, "name": "Alice" },
      { "id": 2, "name": "Bob" }
    ],
    "rowCount": 2,
    "affectedRows": null,
    "duration": 125,
    "hasMore": false
  }
}
```

#### 2.2.2 流式执行查询

```http
POST /api/v1/query/execute/stream
```

**Request Body**: 同执行查询，增加 `"stream": true`

**Response**: Server-Sent Events (SSE)

```
data: {"type":"columns","data":[...]}

data: {"type":"rows","data":[{"id":1,"name":"Alice"}]}

data: {"type":"rows","data":[{"id":2,"name":"Bob"}]}

data: {"type":"complete","data":{"rowCount":2,"duration":125}}
```

#### 2.2.3 取消查询

```http
POST /api/v1/query/:queryId/cancel
```

**Response**:
```json
{
  "success": true,
  "data": {
    "cancelled": true,
    "message": "查询已取消"
  }
}
```

#### 2.2.4 获取查询历史

```http
GET /api/v1/query/history
```

**Query Parameters**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| connectionId | string | 否 | 连接 ID |
| limit | number | 否 | 限制数量（默认 50） |
| offset | number | 否 | 偏移量 |

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "hist_001",
      "connectionId": "conn_001",
      "query": "SELECT * FROM users",
      "duration": 125,
      "rowCount": 100,
      "status": "success",
      "executedAt": "2026-06-01T10:00:00Z"
    }
  ],
  "meta": {
    "total": 500,
    "limit": 50,
    "offset": 0
  }
}
```

---

### 2.3 元数据查询

#### 2.3.1 获取数据库列表

```http
GET /api/v1/metadata/:connectionId/databases
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "name": "myapp",
      "charset": "utf8mb4",
      "collation": "utf8mb4_unicode_ci",
      "size": 10485760
    }
  ]
}
```

#### 2.3.2 获取表列表

```http
GET /api/v1/metadata/:connectionId/databases/:database/tables
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "name": "users",
      "type": "BASE TABLE",
      "engine": "InnoDB",
      "rows": 10000,
      "size": 2048576,
      "comment": "User table"
    }
  ]
}
```

#### 2.3.3 获取表结构

```http
GET /api/v1/metadata/:connectionId/databases/:database/tables/:table/columns
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "name": "id",
      "type": "INT",
      "nullable": false,
      "defaultValue": null,
      "autoIncrement": true,
      "comment": "Primary key",
      "ordinalPosition": 1
    },
    {
      "name": "name",
      "type": "VARCHAR(100)",
      "nullable": false,
      "defaultValue": null,
      "autoIncrement": false,
      "comment": null,
      "ordinalPosition": 2
    }
  ]
}
```

#### 2.3.4 获取索引信息

```http
GET /api/v1/metadata/:connectionId/databases/:database/tables/:table/indexes
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "name": "PRIMARY",
      "type": "PRIMARY",
      "columns": ["id"],
      "unique": true
    },
    {
      "name": "idx_email",
      "type": "INDEX",
      "columns": ["email"],
      "unique": true
    }
  ]
}
```

#### 2.3.5 获取外键信息

```http
GET /api/v1/metadata/:connectionId/databases/:database/tables/:table/foreign-keys
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "name": "fk_user_role",
      "column": "role_id",
      "referencedTable": "roles",
      "referencedColumn": "id",
      "onUpdate": "CASCADE",
      "onDelete": "RESTRICT"
    }
  ]
}
```

---

### 2.4 数据操作

#### 2.4.1 插入数据

```http
POST /api/v1/data/:connectionId/databases/:database/tables/:table
```

**Request Body**:
```json
{
  "rows": [
    {
      "name": "Charlie",
      "email": "charlie@example.com"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "affectedRows": 1,
    "insertId": 3
  }
}
```

#### 2.4.2 更新数据

```http
PUT /api/v1/data/:connectionId/databases/:database/tables/:table
```

**Request Body**:
```json
{
  "rows": [
    {
      "id": 1,
      "name": "Alice Updated"
    }
  ],
  "where": {
    "id": 1
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "affectedRows": 1
  }
}
```

#### 2.4.3 删除数据

```http
DELETE /api/v1/data/:connectionId/databases/:database/tables/:table
```

**Request Body**:
```json
{
  "where": {
    "id": [1, 2, 3]
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "affectedRows": 3
  }
}
```

---

### 2.5 导入导出

#### 2.5.1 导出数据

```http
POST /api/v1/export
```

**Request Body**:
```json
{
  "connectionId": "conn_001",
  "database": "myapp",
  "tables": ["users", "orders"],
  "format": "csv",
  "options": {
    "delimiter": ",",
    "enclosure": "\"",
    "encoding": "utf-8",
    "includeHeaders": true
  }
}
```

**Response**: 文件下载

#### 2.5.2 导入数据

```http
POST /api/v1/import/:connectionId/databases/:database/tables/:table
```

**Request**: `multipart/form-data`

**Form Fields**:
- `file`: 导入文件
- `format`: csv | json | sql
- `options`: JSON 字符串

**Response**:
```json
{
  "success": true,
  "data": {
    "importedRows": 1000,
    "skippedRows": 5,
    "errors": [
      {
        "row": 45,
        "error": "Invalid email format"
      }
    ]
  }
}
```

---

### 2.6 SSH 隧道

#### 2.6.1 创建 SSH 隧道

```http
POST /api/v1/ssh/tunnel
```

**Request Body**:
```json
{
  "host": "ssh.example.com",
  "port": 22,
  "username": "deploy",
  "password": null,
  "privateKey": "-----BEGIN RSA PRIVATE KEY-----...",
  "remoteHost": "db.internal",
  "remotePort": 3306
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "tunnelId": "tunnel_001",
    "localPort": 54321,
    "status": "connected"
  }
}
```

#### 2.6.2 关闭 SSH 隧道

```http
DELETE /api/v1/ssh/tunnel/:tunnelId
```

**Response**: `204 No Content`

---

## 3. WebSocket 事件

### 3.1 连接管理

**连接地址**: `ws://127.0.0.1:{port}/ws`

**认证**: 在 WebSocket 握手时添加 Header `X-Auth-Token`

### 3.2 事件类型

#### 3.2.1 查询进度

**Server → Client**:
```json
{
  "event": "query:progress",
  "data": {
    "queryId": "query_123",
    "status": "executing",
    "progress": 45,
    "rowsFetched": 4500,
    "elapsedTime": 1250
  }
}
```

#### 3.2.2 查询完成

**Server → Client**:
```json
{
  "event": "query:complete",
  "data": {
    "queryId": "query_123",
    "status": "success",
    "rowCount": 10000,
    "duration": 2500
  }
}
```

#### 3.2.3 查询错误

**Server → Client**:
```json
{
  "event": "query:error",
  "data": {
    "queryId": "query_123",
    "error": {
      "code": "QUERY_TIMEOUT",
      "message": "查询超时"
    }
  }
}
```

#### 3.2.4 连接状态变化

**Server → Client**:
```json
{
  "event": "connection:status",
  "data": {
    "connectionId": "conn_001",
    "status": "connected",
    "timestamp": "2026-06-01T10:00:00Z"
  }
}
```

#### 3.2.5 导出进度

**Server → Client**:
```json
{
  "event": "export:progress",
  "data": {
    "exportId": "export_001",
    "progress": 60,
    "exportedRows": 6000,
    "totalRows": 10000
  }
}
```

---

## 4. Tauri IPC 命令

### 4.1 文件系统

#### 4.1.1 读取文件

```typescript
// Frontend call
const content = await invoke('read_file', {
  path: '/path/to/file.sql'
});
```

**Rust Command**:
```rust
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| e.to_string())
}
```

#### 4.1.2 写入文件

```typescript
await invoke('write_file', {
  path: '/path/to/file.sql',
  content: 'SELECT * FROM users;'
});
```

### 4.2 窗口管理

#### 4.2.1 设置窗口标题

```typescript
await invoke('set_window_title', {
  title: 'ReidiSQL - Local MySQL'
});
```

#### 4.2.2 显示通知

```typescript
await invoke('show_notification', {
  title: '查询完成',
  body: '成功执行 10,000 行查询',
  icon: 'success'
});
```

### 4.3 配置管理

#### 4.3.1 读取配置

```typescript
const config = await invoke('get_config', {
  key: 'editor.fontSize'
});
```

#### 4.3.2 保存配置

```typescript
await invoke('set_config', {
  key: 'editor.fontSize',
  value: 14
});
```

### 4.4 系统信息

#### 4.4.1 获取平台信息

```typescript
const platform = await invoke('get_platform_info');
// { os: "macos", arch: "x86_64", version: "14.0" }
```

### 4.5 加密

#### 4.5.1 加密密码

```typescript
const encrypted = await invoke('encrypt_password', {
  plaintext: 'my_password'
});
```

#### 4.5.2 解密密码

```typescript
const decrypted = await invoke('decrypt_password', {
  ciphertext: 'encrypted_data'
});
```

---

## 5. 错误处理

### 5.1 错误码定义

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `INVALID_REQUEST` | 400 | 请求格式错误 |
| `AUTHENTICATION_FAILED` | 401 | 认证失败 |
| `FORBIDDEN` | 403 | 权限不足 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `CONNECTION_FAILED` | 503 | 连接失败 |
| `QUERY_EXECUTION_FAILED` | 500 | 查询执行失败 |
| `TIMEOUT` | 504 | 超时 |
| `INTERNAL_ERROR` | 500 | 内部错误 |

### 5.2 错误响应示例

```json
{
  "success": false,
  "error": {
    "code": "QUERY_EXECUTION_FAILED",
    "message": "SQL 语法错误",
    "details": "You have an error in your SQL syntax near 'FORM' at line 1",
    "errorCode": 1064,
    "sqlState": "42000",
    "query": "SELECT * FORM users",
    "position": 10,
    "requestId": "req_123456"
  },
  "meta": {
    "timestamp": "2026-06-01T10:00:00Z"
  }
}
```

---

## 6. 认证和授权

### 6.1 Token 认证

Node.js 服务启动时生成随机 Token：

```typescript
const authToken = crypto.randomBytes(32).toString('hex');
```

Tauri 后端获取 Token 并传递给前端：

```rust
#[tauri::command]
async fn get_node_service_token(state: State<'_, AppState>) -> String {
    state.node_service.get_token().await
}
```

前端在所有请求中携带 Token：

```typescript
axios.interceptors.request.use(config => {
  config.headers['X-Auth-Token'] = authToken;
  return config;
});
```

### 6.2 CORS 配置

```typescript
app.use(cors({
  origin: 'tauri://localhost',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-Auth-Token'],
  credentials: true
}));
```

---

## 7. 数据模型

### 7.1 Connection

```typescript
interface Connection {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'sqlite' | 'mssql' | 'firebird';
  host: string;
  port: number;
  username: string;
  password?: string;
  database?: string;
  ssh?: SSHConfig;
  ssl?: SSLConfig;
  options: ConnectionOptions;
  createdAt: string;
  updatedAt: string;
  lastConnected?: string;
}

interface SSHConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

interface SSLConfig {
  enabled: boolean;
  ca?: string;
  cert?: string;
  key?: string;
  verify?: boolean;
}

interface ConnectionOptions {
  charset?: string;
  connectTimeout?: number;
  queryTimeout?: number;
  maxRetries?: number;
}
```

### 7.2 QueryResult

```typescript
interface QueryResult {
  queryId: string;
  columns: Column[];
  rows: Row[];
  rowCount: number;
  affectedRows?: number;
  insertId?: number;
  duration: number;
  hasMore: boolean;
}

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  maxLength?: number;
  precision?: number;
  scale?: number;
}

type Row = Record<string, any>;
```

### 7.3 TableMetadata

```typescript
interface TableMetadata {
  name: string;
  type: 'BASE TABLE' | 'VIEW' | 'SYSTEM TABLE';
  engine?: string;
  charset?: string;
  collation?: string;
  rows?: number;
  size?: number;
  comment?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

### 7.4 ColumnMetadata

```typescript
interface ColumnMetadata {
  name: string;
  type: string;
  fullType: string;
  nullable: boolean;
  defaultValue: any;
  autoIncrement: boolean;
  comment?: string;
  ordinalPosition: number;
  characterMaximumLength?: number;
  numericPrecision?: number;
  numericScale?: number;
}
```

---

## 附录

### A. 速率限制

| API | 限制 |
|-----|------|
| 查询执行 | 100 次/分钟 |
| 元数据查询 | 200 次/分钟 |
| 导入导出 | 10 次/分钟 |

### B. 分页参数

```typescript
interface PaginationParams {
  limit?: number;    // 默认 50，最大 1000
  offset?: number;   // 默认 0
  sortBy?: string;   // 排序字段
  sortOrder?: 'asc' | 'desc';  // 排序方向
}
```

### C. 响应头

| Header | 说明 |
|--------|------|
| `X-Request-Id` | 请求唯一标识 |
| `X-Response-Time` | 响应时间（毫秒） |
| `X-RateLimit-Limit` | 速率限制 |
| `X-RateLimit-Remaining` | 剩余请求数 |

---

**API 版本**: v1.0.0  
**最后更新**: 2026-06-01  
**维护者**: ReidiSQL 开发团队
