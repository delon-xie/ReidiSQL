/**
 * ReidiSQL 核心组件配置规格
 * 
 * Monaco Editor、AG Grid、数据库对象树的详细配置规范。
 * 此文件定义组件实例化时的默认配置，供各组件封装引用。
 */

/**
 * SQL 编辑器默认配置
 * 对应 Delphi 的 SynMemo + SynSQLSyn 配置
 * 基于 Monaco Editor IStandaloneEditorConstructionOptions
 */
export const defaultMonacoOptions = {
  // 基础
  language: 'mysql',
  theme: 'vs',                          // 亮色: 'vs', 暗色: 'vs-dark'
  automaticLayout: true,
  readOnly: false,

  // 字体
  fontFamily: "'JetBrains Mono', 'Consolas', 'monospace'",
  fontSize: 13,
  lineHeight: 20,
  fontLigatures: true,

  // 缩进
  tabSize: 2,
  insertSpaces: true,
  detectIndentation: false,

  // 编辑器行为
  wordWrap: 'off',
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  smoothScrolling: true,

  // 行号与缩进线
  lineNumbers: 'on',
  renderLineHighlight: 'all',
  renderIndentGuides: true,
  highlightActiveIndentGuide: true,

  // 括号
  matchBrackets: 'always',
  bracketPairColorization: { enabled: true },
  autoClosingBrackets: 'always',
  autoClosingQuotes: 'always',
  autoSurround: 'brackets',

  // 代码补全
  quickSuggestions: {
    other: true,
    comments: false,
    strings: false,
  },
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnCommitCharacter: true,
  snippetSuggestions: 'inline',

  // Minimap
  minimap: { enabled: false },

  // 搜索
  find: {
    addExtraSpaceOnTop: false,
    autoFindInSelection: 'multiline',
    seedSearchStringFromSelection: 'always',
  },

  // 滚动
  scrollBeyondLastLine: false,
  scrollbar: {
    vertical: 'auto',
    horizontal: 'auto',
    useShadows: false,
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
  },

  // 其他
  padding: { top: 4 },
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  contextmenu: true,
};

/**
 * SQL 语言补全提供器配置
 * 对应 Delphi 的 SynCompletionProposal
 */
export interface CompletionProviderConfig {
  /** 启用代码补全 */
  enabled: boolean;
  /** 触发延迟 (ms) */
  delay: number;
  /** 中间字符匹配 */
  searchOnMid: boolean;
  /** 自动大写关键字 */
  autoUppercase: boolean;
}

export const defaultCompletionConfig: CompletionProviderConfig = {
  enabled: true,
  delay: 200,
  searchOnMid: true,
  autoUppercase: true,
};

/**
 * SQL 关键字列表（MySQL 常用）
 * 用于 Monaco 语法补全提供器
 */
export const mysqlKeywords = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'CREATE', 'ALTER', 'DROP', 'TABLE', 'DATABASE', 'INDEX',
  'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'EVENT',
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'CROSS', 'ON',
  'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL',
  'AS', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
  'UNION', 'ALL', 'DISTINCT', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'IF', 'BEGIN', 'DECLARE', 'CURSOR', 'OPEN', 'FETCH', 'CLOSE',
  'COMMIT', 'ROLLBACK', 'START', 'TRANSACTION', 'SAVEPOINT',
  'GRANT', 'REVOKE', 'PRIVILEGES', 'TO', 'IDENTIFIED',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT',
  'UNIQUE', 'CHECK', 'DEFAULT', 'AUTO_INCREMENT', 'UNSIGNED',
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT',
  'FLOAT', 'DOUBLE', 'DECIMAL', 'NUMERIC',
  'CHAR', 'VARCHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT',
  'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB',
  'DATE', 'TIME', 'DATETIME', 'TIMESTAMP', 'YEAR',
  'BOOLEAN', 'BOOL', 'ENUM', 'SET', 'JSON',
  'ENGINE', 'CHARSET', 'CHARACTER', 'COLLATE', 'COMMENT',
  'SHOW', 'DESCRIBE', 'EXPLAIN', 'USE', 'STATUS', 'VARIABLES',
  'PROCESSLIST', 'KILL', 'FLUSH', 'RESET',
];

/**
 * MySQL 内置函数列表
 */
export const mysqlFunctions = [
  'ABS', 'AVG', 'CEILING', 'COALESCE', 'CONCAT', 'CONCAT_WS', 'COUNT',
  'CURDATE', 'CURTIME', 'DATE', 'DATE_ADD', 'DATE_SUB', 'DATEDIFF',
  'DAY', 'DAYNAME', 'DAYOFWEEK', 'DAYOFYEAR',
  'FLOOR', 'FORMAT', 'FOUND_ROWS',
  'GROUP_CONCAT', 'HEX', 'HOUR',
  'IF', 'IFNULL', 'INSERT', 'INSTR', 'ISNULL',
  'JSON_EXTRACT', 'JSON_OBJECT', 'JSON_ARRAY',
  'LEFT', 'LENGTH', 'LOCATE', 'LOWER', 'LPAD', 'LTRIM',
  'MAX', 'MD5', 'MIN', 'MINUTE', 'MOD', 'MONTH', 'MONTHNAME',
  'NOW', 'NULLIF',
  'RAND', 'REPLACE', 'REVERSE', 'RIGHT', 'ROUND', 'ROW_COUNT', 'RPAD', 'RTRIM',
  'SECOND', 'SHA1', 'SHA2', 'SIGN', 'SLEEP', 'SQRT',
  'SUBSTR', 'SUBSTRING', 'SUBSTRING_INDEX', 'SUM',
  'TIME', 'TIMEDIFF', 'TIMESTAMP', 'TRIM', 'TRUNCATE',
  'UPPER', 'USER', 'UUID',
  'VERSION', 'WEEK', 'WEEKDAY', 'YEAR',
];

// ============================================================
// 2. AG Grid 配置
// ============================================================

/**
 * 数据网格默认配置
 * 对应 Delphi 的 VirtualStringTree 结果网格
 */
export const defaultGridOptions = {
  // 行选择
  rowSelection: 'multiple' as const,
  suppressRowClickSelection: false,

  // 编辑
  singleClickEdit: false,       // 双击编辑（与 Delphi 一致）
  stopEditingWhenCellsLoseFocus: true,
  undoRedoCellEditing: true,
  undoRedoCellEditingLimit: 20,

  // 列
  suppressMovableColumns: false,
  suppressSizeToFit: false,
  autoSizeStrategy: {
    type: 'fitGridWidth' as const,
    defaultMinWidth: 60,
    columnLimits: [],
  },

  // 行
  animateRows: false,          // 禁用动画提升性能
  getRowHeight: undefined,     // 使用默认行高

  // 分页（客户端）
  pagination: false,
  paginationPageSize: 1000,

  // 性能
  rowBuffer: 10,
  suppressColumnVirtualisation: false,
  suppressRowVirtualisation: false,

  // 文本选择
  enableCellTextSelection: true,
  ensureDomOrder: true,

  // 排序
  multiSortKey: 'ctrl' as const,

  // 外观
  headerHeight: 32,
  rowHeight: 28,
};

/**
 * 网格列类型 → 单元格渲染器配置
 * 对应 Delphi 的 TDBDatatypeCategoryIndex 颜色映射
 */
export const columnTypeRenderers = {
  integer: {
    cellStyle: { textAlign: 'right' },
    cellRenderer: 'NumberRenderer',
  },
  real: {
    cellStyle: { textAlign: 'right' },
    cellRenderer: 'NumberRenderer',
  },
  text: {
    cellStyle: { textAlign: 'left' },
    cellRenderer: 'TextRenderer',
  },
  binary: {
    cellStyle: { textAlign: 'left', fontFamily: 'monospace' },
    cellRenderer: 'HexRenderer',
  },
  temporal: {
    cellStyle: { textAlign: 'center' },
    cellRenderer: 'DateRenderer',
  },
  spatial: {
    cellStyle: { textAlign: 'left', fontFamily: 'monospace', fontSize: '12px' },
    cellRenderer: 'WKTRenderer',
  },
  other: {
    cellStyle: { textAlign: 'left' },
    cellRenderer: 'DefaultRenderer',
  },
} as const;

/**
 * 网格右键菜单项
 * 对应 Delphi 的 PopupMenu 项
 */
export const gridContextMenuItems = [
  {
    id: 'copy',
    label: '复制',
    shortcut: 'Ctrl+C',
  },
  {
    id: 'copyAsInsert',
    label: '复制为 INSERT 语句',
  },
  {
    id: 'copyAsCSV',
    label: '复制为 CSV',
  },
  {
    id: 'copyAsJSON',
    label: '复制为 JSON',
  },
  {
    id: 'separator',
  },
  {
    id: 'setNull',
    label: '设为 NULL',
  },
  {
    id: 'deleteRows',
    label: '删除选中行',
    shortcut: 'Ctrl+Delete',
  },
  {
    id: 'separator',
  },
  {
    id: 'filterValue',
    label: '过滤此值',
  },
  {
    id: 'sortAsc',
    label: '升序排序',
  },
  {
    id: 'sortDesc',
    label: '降序排序',
  },
] as const;

// ============================================================
// 3. 数据库对象树配置
// ============================================================

/**
 * 对象树配置（基于 Ant Design Tree）
 * 对应 Delphi 的 MainForm.DBTree
 */
export const defaultTreeConfig = {
  showLine: false,
  showIcon: true,
  blockNode: true,
  selectable: true,
  multiple: false,
  draggable: false,
  virtual: true,              // 虚拟滚动（大量节点时）
  height: undefined,          // 由容器决定
};

/**
 * 对象树节点图标映射
 */
export const treeNodeIcons: Record<string, string> = {
  server: 'database',
  database: 'database',
  table_group: 'folder',
  view_group: 'folder',
  procedure_group: 'folder',
  function_group: 'folder',
  trigger_group: 'folder',
  event_group: 'folder',
  table: 'table',
  view: 'eye',
  procedure: 'setting',
  function: 'function',
  trigger: 'thunderbolt',
  event: 'schedule',
  column_integer: 'number',
  column_text: 'file-text',
  column_binary: 'code',
  column_temporal: 'clock-circle',
  column_spatial: 'environment',
  column_other: 'tag',
  index: 'key',
  foreign_key: 'link',
};

/**
 * 对象树懒加载策略
 * 对应 Delphi 中展开节点时按需加载的逻辑
 */
export const treeLazyLoadRules = {
  /** 连接节点展开 → 加载数据库列表 */
  server: {
    api: 'GET /metadata/{connectionId}/databases',
    childType: 'database',
  },
  /** 数据库节点展开 → 加载对象分组（Tables/Views/...） */
  database: {
    // 静态分组节点，不需要 API 调用
    children: ['table_group', 'view_group', 'procedure_group', 'function_group', 'trigger_group', 'event_group'],
  },
  /** 表分组展开 → 加载表列表 */
  table_group: {
    api: 'GET /metadata/{connectionId}/databases/{database}/tables',
    childType: 'table',
  },
  /** 视图分组展开 → 加载视图列表 */
  view_group: {
    api: 'GET /metadata/{connectionId}/databases/{database}/views',
    childType: 'view',
  },
  /** 存储过程分组展开 → 加载列表 */
  procedure_group: {
    api: 'GET /metadata/{connectionId}/databases/{database}/routines?type=PROCEDURE',
    childType: 'procedure',
  },
  /** 函数分组展开 → 加载列表 */
  function_group: {
    api: 'GET /metadata/{connectionId}/databases/{database}/routines?type=FUNCTION',
    childType: 'function',
  },
  /** 触发器分组展开 → 加载列表 */
  trigger_group: {
    api: 'GET /metadata/{connectionId}/databases/{database}/triggers',
    childType: 'trigger',
  },
  /** 事件分组展开 → 加载列表 */
  event_group: {
    api: 'GET /metadata/{connectionId}/databases/{database}/events',
    childType: 'event',
  },
  /** 表节点展开 → 加载列/索引/外键 */
  table: {
    apis: [
      'GET /metadata/{connectionId}/databases/{database}/tables/{table}/columns',
      'GET /metadata/{connectionId}/databases/{database}/tables/{table}/indexes',
      'GET /metadata/{connectionId}/databases/{database}/tables/{table}/foreign-keys',
    ],
  },
};

/**
 * 对象树右键菜单定义
 * 对应 Delphi 的 DBTree.OnMouseDown 右键处理
 */
export const treeContextMenu: Record<string, Array<{ id: string; label: string; icon?: string; divider?: boolean }>> = {
  server: [
    { id: 'disconnect', label: '断开连接', icon: 'disconnect' },
    { id: 'divider1', label: '', divider: true },
    { id: 'editConnection', label: '编辑连接', icon: 'edit' },
    { id: 'newQuery', label: '新建查询', icon: 'plus' },
  ],
  database: [
    { id: 'newQuery', label: '新建查询', icon: 'plus' },
    { id: 'newTable', label: '新建表', icon: 'table' },
    { id: 'newView', label: '新建视图', icon: 'eye' },
    { id: 'divider1', label: '', divider: true },
    { id: 'renameDatabase', label: '重命名', icon: 'edit' },
    { id: 'dropDatabase', label: '删除', icon: 'delete' },
    { id: 'divider2', label: '', divider: true },
    { id: 'copyName', label: '复制名称', icon: 'copy' },
  ],
  table_group: [
    { id: 'newTable', label: '新建表', icon: 'table' },
    { id: 'refresh', label: '刷新', icon: 'reload' },
  ],
  table: [
    { id: 'openTable', label: '打开表', icon: 'eye' },
    { id: 'editTable', label: '编辑表', icon: 'edit' },
    { id: 'divider1', label: '', divider: true },
    { id: 'truncateTable', label: '清空表', icon: 'delete' },
    { id: 'dropTable', label: '删除表', icon: 'delete' },
    { id: 'divider2', label: '', divider: true },
    { id: 'generateSelect', label: '生成 SELECT', icon: 'code' },
    { id: 'generateInsert', label: '生成 INSERT', icon: 'code' },
    { id: 'divider3', label: '', divider: true },
    { id: 'exportData', label: '导出数据', icon: 'download' },
    { id: 'copyName', label: '复制名称', icon: 'copy' },
  ],
  view: [
    { id: 'editView', label: '编辑', icon: 'edit' },
    { id: 'dropView', label: '删除', icon: 'delete' },
    { id: 'copyCreateSql', label: '复制 CREATE 语句', icon: 'copy' },
  ],
  procedure: [
    { id: 'editRoutine', label: '编辑', icon: 'edit' },
    { id: 'executeRoutine', label: '执行', icon: 'play-circle' },
    { id: 'dropRoutine', label: '删除', icon: 'delete' },
    { id: 'copyCreateSql', label: '复制 CREATE 语句', icon: 'copy' },
  ],
  function: [
    { id: 'editRoutine', label: '编辑', icon: 'edit' },
    { id: 'dropRoutine', label: '删除', icon: 'delete' },
    { id: 'copyCreateSql', label: '复制 CREATE 语句', icon: 'copy' },
  ],
  trigger: [
    { id: 'editTrigger', label: '编辑', icon: 'edit' },
    { id: 'dropTrigger', label: '删除', icon: 'delete' },
    { id: 'copyCreateSql', label: '复制 CREATE 语句', icon: 'copy' },
  ],
  event: [
    { id: 'editEvent', label: '编辑', icon: 'edit' },
    { id: 'dropEvent', label: '删除', icon: 'delete' },
    { id: 'copyCreateSql', label: '复制 CREATE 语句', icon: 'copy' },
  ],
};

// ============================================================
// 4. 快捷键定义
// ============================================================

/**
 * 全局快捷键映射
 * 对应 Delphi 的 ActionList1 快捷键
 */
export const defaultShortcuts: Record<string, { key: string; description: string }> = {
  // 文件
  'file.newQuery':       { key: 'Ctrl+N',     description: '新建查询标签' },
  'file.openQuery':      { key: 'Ctrl+O',     description: '打开 SQL 文件' },
  'file.saveQuery':      { key: 'Ctrl+S',     description: '保存查询' },
  'file.saveQueryAs':    { key: 'Ctrl+Shift+S', description: '另存为' },
  'file.closeTab':       { key: 'Ctrl+W',     description: '关闭当前标签' },

  // 编辑
  'edit.find':           { key: 'Ctrl+F',     description: '查找' },
  'edit.replace':        { key: 'Ctrl+H',     description: '替换' },
  'edit.findNext':       { key: 'F3',         description: '查找下一个' },
  'edit.findPrevious':   { key: 'Shift+F3',   description: '查找上一个' },
  'edit.goToLine':       { key: 'Ctrl+G',     description: '跳转到行' },

  // 查询
  'query.execute':       { key: 'Ctrl+Enter', description: '执行当前/选中语句' },
  'query.executeAll':    { key: 'Ctrl+Shift+Enter', description: '执行所有语句' },
  'query.cancel':        { key: 'Ctrl+Alt+Break', description: '取消查询' },
  'query.newTab':        { key: 'Ctrl+T',     description: '新建查询标签' },
  'query.explain':       { key: 'Ctrl+E',     description: 'EXPLAIN 查询' },

  // 视图
  'view.toggleSider':    { key: 'Ctrl+B',     description: '切换侧边栏' },
  'view.toggleLog':      { key: 'Ctrl+L',     description: '切换日志面板' },
  'view.refresh':        { key: 'F5',         description: '刷新' },

  // 工具
  'tools.preferences':   { key: 'Ctrl+,',     description: '偏好设置' },
  'tools.sqlHelp':       { key: 'F1',         description: 'SQL 帮助' },

  // 数据
  'data.deleteRows':     { key: 'Ctrl+Delete', description: '删除选中行' },
  'data.setNull':        { key: 'Ctrl+0',     description: '设为 NULL' },
  'data.applyChanges':   { key: 'Ctrl+Shift+Enter', description: '应用修改' },
  'data.discardChanges': { key: 'Ctrl+Z',     description: '放弃修改' },
};
