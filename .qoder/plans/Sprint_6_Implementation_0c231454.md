# Sprint 6 实施计划

## 现状分析

Sprint 1-5 已完成核心路径（连接/查询/表设计/导入导出/对象编辑器/用户管理/服务器管理/暗色主题/SQL 补全等）。Sprint 6 补齐 PRD 中最后 3 个 P2 工具端点 + 关键 UI 体验缺口。

---

## Task 1: 后端 — 数据库同步、批量编辑、数据生成

**文件**: `node-backend/src/services/toolsService.ts` + `node-backend/src/routes/tools.ts`

在 `toolsService.ts` 中新增 3 个方法：

1. `syncAnalyze(req)` — 比较两个数据库的 schema 差异：
   - 输入：`{ connectionId, sourceDb, targetDb }`
   - 输出：`SyncDiff[]`（表/列/索引/外键差异列表 + 建议 DDL）
   - 实现：分别 `SHOW CREATE TABLE` 对比，列出缺失表、缺失列、类型差异

2. `bulkEdit(req)` — 批量修改多个表的属性：
   - 输入：`{ connectionId, database, tables[], operation: 'engine'|'charset'|'collation', value }`
   - 对每个表执行 `ALTER TABLE ... ENGINE/CHARSET/COLLATE = value`

3. `generateData(req)` — 为指定表生成测试数据：
   - 输入：`{ connectionId, database, table, rowCount, columns? }`
   - 实现：根据列类型随机生成合理数据（INT→随机数、VARCHAR→随机字符串、DATE→随机日期、ENUM→随机选项等）
   - 批量 INSERT

在 `routes/tools.ts` 中新增 3 个路由端点：
- `POST /api/tools/sync/analyze`
- `POST /api/tools/bulk-edit`
- `POST /api/tools/generate-data`

## Task 2: 前端 API — 扩展 toolsApi

**文件**: `frontend/src/lib/api.ts`

新增接口类型和 API 方法：
```typescript
export interface SyncDiff { type: 'table'|'column'|'index'|'fk'; action: 'add'|'drop'|'modify'; name: string; ddl: string; }
export interface BulkEditRequest { connectionId: string; database: string; tables: string[]; operation: 'engine'|'charset'|'collation'; value: string; }
export interface GenerateDataRequest { connectionId: string; database: string; table: string; rowCount: number; columns?: string[]; }

// 扩展 toolsApi
syncAnalyze: (data) => api.post('/tools/sync/analyze', data).then(...)
bulkEdit: (data) => api.post('/tools/bulk-edit', data).then(...)
generateData: (data) => api.post('/tools/generate-data', data).then(...)
```

## Task 3: SyncDB 组件 — 数据库同步

**文件**: 新建 `frontend/src/components/SyncDB.tsx`

Antd Modal + 双列布局：
- 顶部：选择源数据库和目标数据库（Select）
- "分析" 按钮触发 `toolsApi.syncAnalyze`
- 中间：Table 展示差异列表（类型、操作、对象名、DDL 预览）
- 底部："执行同步" 按钮逐条执行选中的 DDL
- 结果反馈：成功/失败统计

## Task 4: BulkEdit + GenerateData 组件

**文件**: 新建 `frontend/src/components/BulkEdit.tsx` + `frontend/src/components/GenerateData.tsx`

**BulkEdit** (~120 行)：
- Modal：选择数据库 → 多选表 → 选择操作（引擎/字符集/排序规则）→ 输入值 → 执行
- 结果 Table 展示每表执行结果

**GenerateData** (~150 行)：
- Modal：选择数据库 → 选择表 → 输入行数 → [可选] 选择列
- "生成" 按钮调用 `toolsApi.generateData`
- 显示生成统计

## Task 5: DataGrid 右键菜单

**文件**: `frontend/src/components/DataGrid.tsx`

在 AG Grid 外层添加 Antd Dropdown 右键菜单：
- 复制 (Ctrl+C) — 复制选中单元格值
- 复制为 SQL INSERT — `INSERT INTO table VALUES (...)`
- 复制为 CSV — CSV 格式行数据
- 复制为 JSON — JSON 格式行数据
- 设为 NULL — 将选中单元格设为 NULL
- 删除选中行 — 标记为 deleted
- 过滤此值 — `WHERE column = value` 追加到查询
- 升序/降序排序 — 按此列排序

需要新增 `onFilterValue?: (column: string, value: string) => void` 和 `onSortColumn?: (column: string, direction: 'ASC'|'DESC') => void` props。

## Task 6: DatabaseTree 右键菜单增强

**文件**: `frontend/src/components/DatabaseTree.tsx`

补齐 PRD 8.2 定义的缺失菜单项：

| 节点类型 | 新增菜单项 |
|---------|---------|
| 连接 | 断开连接 / 编辑连接 / 删除连接 / 新建查询 |
| 数据库 | 新建查询 / 新建表 / 新建视图 / 刷新（已有） |
| 表 | 打开数据(SELECT * LIMIT 1000) / 编辑表(已有) / 清空表(TRUNCATE) / 删除表(DROP) / 复制表名 / 生成 SELECT / 导出数据(已有) |
| 列 | 编辑 / 复制列名 |

新增 props 回调：`onNewQuery`, `onOpenData`, `onTruncateTable`, `onDropTable`, `onCopyName`, `onGenerateSelect`, `onEditConnection`, `onDeleteConnection`

## Task 7: 可拖拽分割条

**文件**: `frontend/src/App.tsx`

将 SQL 编辑器和结果网格之间的固定 `3px solid` 分割条替换为可拖拽分割条：
- 使用原生 mousedown/mousemove/mouseup 实现（无第三方依赖）
- 拖拽时 cursor: row-resize
- 存储比例到 localStorage（key: `reidisql_splitter_ratio`）
- 双击恢复默认 50/50
- 最小约束：编辑器 200px / 结果区 150px

## Task 8: MenuBar 菜单栏

**文件**: 新建 `frontend/src/components/MenuBar.tsx`

用 Antd Menu 组件实现结构化菜单栏（替代 Header 中的按钮堆）：
- File: 新建连接 / 导入 CSV / 导出数据 / 退出
- Edit: 撤销 / 重做 / 查找 / 替换
- View: 刷新对象树 / 切换主题
- Tools: 表工具 / 用户管理 / 服务器管理 / 数据库同步 / 批量编辑 / 数据生成
- Help: SQL 帮助 / 检查更新 / 关于

MenuBar 接收必要的回调 props，高度 ~32px。

## Task 9: App.tsx 集成 + 版本更新

**文件**: `frontend/src/App.tsx` + `node-backend/src/index.ts`

- 导入 SyncDB / BulkEdit / GenerateData / MenuBar 组件
- 新增 state 和回调处理
- 替换 Header 为 MenuBar + 简化工具条
- 版本 Tag 更新为 "Sprint 6"
- 后端版本号更新为 `0.6.0-sprint6`
- DatabaseTree 新增回调绑定

## Task 10: 编译验证

分别验证：
1. `cd node-backend && npx tsc --noEmit` — 后端 TypeScript 编译
2. `cd frontend && npx tsc --noEmit` — 前端 TypeScript 编译
3. `cd src-tauri && cargo check` — Rust 编译

修复所有编译错误。
