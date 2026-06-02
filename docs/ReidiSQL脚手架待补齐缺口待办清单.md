# ReidiSQL 脚手架待补齐缺口 — 待办事项清单

> 本清单基于 [ReidiSQL脚手架与系统架构设计理念匹配度分析报告.md](./ReidiSQL脚手架与系统架构设计理念匹配度分析报告.md) 第六章"待补齐的关键缺口"整理，按优先级 P0 / P1 / P2 排序。

---

## 总览

| 优先级 | 缺口数 | 说明 |
|--------|--------|------|
| 🔴 P0 | 3 | 必须补齐，影响架构安全与可用 |
| 🟡 P1 | 4 | 强烈建议，影响架构纯粹性 |
| 🟢 P2 | 3 | 锦上添花，影响架构扩展性 |
| **合计** | **10** | — |

---

## 🔴 P0 - 必须补齐（影响架构安全与可用）

### [ ] 1. Tauri 启动 Node.js 子进程

- **所属**：进程模型 / 进程生命周期管理
- **背景**：架构设计文档第 3.2 节要求 Main Process（Tauri）托管 Node.js Service
- **现状**：[main.rs](../../ReidiSQL/src-tauri/src/main.rs) 中的 `start_node_backend` 仍为 TODO
- **影响**：当前 Node.js 服务需手动启动，无法实现"开箱即用"
- **建议实现要点**：
  - 进程拉起（`std::process::Command` 或 `tokio::process`）
  - 端口发现（Node.js 启动后回写端口到 Tauri）
  - Token 协商（与缺口 #2 联动）
  - 崩溃监控与自动重启
- **预计涉及文件**：`src-tauri/src/main.rs`、`src-tauri/Cargo.toml`
- **状态**：⬜ 待开始

---

### [ ] 2. 随机端口 + Token 认证

- **所属**：安全设计 / 进程间通信
- **背景**：架构设计文档第 6 节"安全设计"明确要求
- **现状**：
  - [index.ts](../../ReidiSQL/node-backend/src/index.ts) 中端口固定为 3001
  - CORS 配置为 `*`，无任何认证
- **影响**：进程间通信无安全屏障，恶意进程可访问 Node.js 服务
- **建议实现要点**：
  - Node.js 启动时生成一次性 Token（如 `crypto.randomBytes(32).toString('hex')`）
  - 监听端口改为 OS 随机空闲端口（`portastic` 或 `0` 由 OS 分配）
  - 启动时通过 stdout / 文件回写 `{ port, token }` 给 Tauri
  - 所有 HTTP 请求校验 `Authorization: Bearer <token>`
  - Tauri 侧统一封装 HTTP 客户端自动注入 Token
- **预计涉及文件**：`node-backend/src/index.ts`、`src-tauri/src/main.rs`、`frontend/src/lib/api.ts`
- **状态**：⬜ 待开始

---

### [ ] 3. 密码加密存储

- **所属**：安全设计 / 配置持久化
- **背景**：架构设计文档第 6 节"安全设计"要求保护用户连接密码
- **现状**：[configStore.ts](../../ReidiSQL/node-backend/src/services/configStore.ts) 推测以明文存储
- **影响**：用户密码泄露风险
- **建议实现要点**：
  - 引入对称加密：`node:crypto` 的 AES-256-GCM
  - 主密钥（Master Key）由 OS Keychain 保护：
    - macOS：Keychain
    - Windows：DPAPI
    - Linux：libsecret
  - 或使用 Tauri `stronghold` 插件
  - 加密单元：`{ iv, ciphertext, authTag }` 一并持久化
- **预计涉及文件**：`node-backend/src/services/configStore.ts`、`shared/types.ts`
- **状态**：⬜ 待开始

---

## 🟡 P1 - 强烈建议（影响架构纯粹性）

### [ ] 4. 统一驱动接口抽象

- **所属**：数据访问层 / 设计模式
- **背景**：架构设计文档第 4.1.1 节定义了 `DatabaseDriver` 接口范式
- **现状**：[connectionService.ts](../../ReidiSQL/node-backend/src/services/connectionService.ts) 使用 if-else 分支处理不同数据库类型
- **影响**：违背"开闭原则"，新增数据库类型需修改核心服务
- **建议实现要点**：
  ```typescript
  interface DatabaseDriver {
    connect(config: ConnectionConfig): Promise<Connection>;
    disconnect(connectionId: string): Promise<void>;
    executeQuery(connectionId: string, query: string, params?: any[]): Promise<QueryResult>;
    getMetadata(connectionId: string): Promise<DatabaseMetadata>;
    startTransaction(connectionId: string): Promise<string>;
    commitTransaction(transactionId: string): Promise<void>;
    rollbackTransaction(transactionId: string): Promise<void>;
  }
  ```
  - 拆出 `MysqlDriver` / `PgDriver` / `SqliteDriver` / `MssqlDriver` / `FirebirdDriver`
  - 通过 `DriverFactory` 注入到 `ConnectionManager`
  - 消除 if-else 类型分支
- **预计涉及文件**：`node-backend/src/services/connectionService.ts`、`node-backend/src/drivers/*`
- **状态**：⬜ 待开始

---

### [ ] 5. React Query 集成

- **所属**：状态管理 / 服务端缓存
- **背景**：架构设计文档第 2.3 节"状态管理"明确将 React Query 列为服务端状态方案
- **现状**：依赖已加入 [package.json](../../ReidiSQL/frontend/package.json) 但代码中尚未使用
- **影响**：查询结果、对象树等"服务端状态"全部通过 Zustand 管理，职责不清
- **建议实现要点**：
  - 在 `main.tsx` 注入 `QueryClientProvider`
  - 用于：
    - 查询结果缓存
    - 对象树懒加载
    - 元数据获取
  - 保留 Zustand 负责纯客户端状态（UI 开关、当前选中 tab 等）
- **预计涉及文件**：`frontend/src/main.tsx`、`frontend/src/components/*`、`frontend/src/hooks/*`
- **状态**：⬜ 待开始

---

### [ ] 6. 大结果集流式返回

- **所属**：性能设计 / 数据访问
- **背景**：架构设计文档第 7 节"性能设计"要求流畅处理百万级数据
- **现状**：[queryService.ts](../../ReidiSQL/node-backend/src/services/queryService.ts) 推测一次性返回全部结果
- **影响**：大表查询会爆内存；前端一次性渲染大量行会卡顿
- **建议实现要点**：
  - 后端：查询接口支持 `ReadableStream` 或 `application/x-ndjson`
  - mysql2：使用 `connection.query(...).stream()`
  - pg：使用 `pg-query-stream`
  - 前端：AG-Grid 启用 `rowModelType: 'infinite'` / `serverSide`
  - 支持查询取消（AbortController）
- **预计涉及文件**：`node-backend/src/services/queryService.ts`、`frontend/src/components/DataGrid.tsx`
- **状态**：⬜ 待开始

---

### [ ] 7. Commitlint 配置

- **所属**：工程化 / 提交规范
- **背景**：架构设计文档第 2.6 节"开发和测试"明确要求
- **现状**：Husky 已配置但缺少 commit-msg 钩子的 commitlint
- **影响**：提交信息不规范，版本日志难以生成
- **建议实现要点**：
  - 安装 `@commitlint/cli` `@commitlint/config-conventional`
  - 创建 `commitlint.config.js`（推荐 conventional 规范）
  - 在 Husky 中添加 `commit-msg` 钩子：`npx --no-install commitlint --edit "$1"`
  - 在 [package.json](../../ReidiSQL/package.json) 的 husky 区段完善
- **预计涉及文件**：根 `package.json`、`.husky/commit-msg`、`commitlint.config.js`
- **状态**：⬜ 待开始

---

## 🟢 P2 - 锦上添花（影响架构扩展性）

### [ ] 8. 插件系统骨架

- **所属**：扩展性设计 / 架构
- **背景**：架构设计文档第 8 节"扩展性设计"要求插件化架构
- **现状**：无 `extensions/` 目录，无插件 Manifest 设计
- **影响**：第三方扩展能力缺失，生态难以发展
- **建议实现要点**：
  - 创建 `extensions/` 目录 + 插件 Manifest（`plugin.json`）
  - 定义插件能力声明（菜单项、面板、命令、数据库驱动）
  - 前端：动态加载插件 UI（lazy import）
  - 后端：插件进程隔离（gRPC / MessagePort）
  - 安全沙箱：插件权限声明与最小授权
- **预计涉及文件**：`extensions/*`、`shared/plugin-types.ts`、`frontend/src/plugin-loader.ts`
- **状态**：⬜ 待开始

---

### [ ] 9. 更新器配置

- **所属**：部署架构 / 持续交付
- **背景**：架构设计文档第 9 节"部署架构"涉及自动更新
- **现状**：[tauri.conf.json](../../ReidiSQL/src-tauri/tauri.conf.json) 未配置 updater
- **影响**：用户需手动下载安装新版本
- **建议实现要点**：
  - 集成 Tauri `tauri-plugin-updater`
  - 配置更新服务器（GitHub Releases / 自托管）
  - 签名密钥（pub/private key pair）
  - 增量更新与全量更新策略
  - 用户更新提示 UI
- **预计涉及文件**：`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、`src-tauri/src/main.rs`
- **状态**：⬜ 待开始

---

### [ ] 10. 日志分级与回滚

- **所属**：可维护性 / 可观测性
- **背景**：架构设计文档第 7 节"性能设计"提及
- **现状**：Winston 已引入但配置较简单
- **影响**：生产环境问题排查困难
- **建议实现要点**：
  - 配置分级：error / warn / info / debug
  - 多 transport：控制台 + 文件（按日轮转 `winston-daily-rotate-file`）
  - 环形缓冲：保留最近 N MB 日志
  - 前端 LogPanel 支持日志分级过滤
  - 结构化日志（JSON）便于 ELK 采集
- **预计涉及文件**：`node-backend/src/utils/logger.ts`、`frontend/src/stores/logStore.ts`
- **状态**：⬜ 待开始

---

## 进度跟踪

### 完成度统计

- P0：0 / 3 (0%)
- P1：0 / 4 (0%)
- P2：0 / 3 (0%)
- **总进度**：0 / 10 (0%)

### 推荐执行顺序

1. **Sprint 1 收尾阶段**：#1（Tauri 启动 Node.js）+ #2（随机端口 + Token）一并完成
2. **Sprint 2 重构窗口**：#4（驱动接口抽象）+ #5（React Query 集成）
3. **Sprint 2-3 性能优化**：#6（流式返回）+ #3（密码加密）
4. **Sprint 3 工程化**：#7（Commitlint）+ #10（日志分级）
5. **Sprint 4+ 生态建设**：#8（插件系统）+ #9（更新器）

---

## 关联文档

- [ReidiSQL脚手架与系统架构设计理念匹配度分析报告.md](./ReidiSQL脚手架与系统架构设计理念匹配度分析报告.md)
- [架构设计文档.md](../../ReidiSQL/docs/架构设计文档.md)
- [系统架构设计.md](./系统架构设计.md)
- [新架构开发指南.md](../../ReidiSQL/docs/新架构开发指南.md)
- [代码规范.md](../../ReidiSQL/docs/代码规范.md)
