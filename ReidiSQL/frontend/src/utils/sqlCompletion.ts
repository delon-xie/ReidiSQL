/**
 * SQL 智能补全 — Monaco CompletionItemProvider (Sprint 5)
 */

import type { TreeNode } from '@/stores/objectTreeStore';

// Monaco 全局引用（在 SQLEditor onMount 时设置）
let monacoRef: any = null;

export function setMonacoRef(m: any): void {
  monacoRef = m;
}

// SQL 关键字
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'CREATE', 'ALTER', 'DROP', 'TABLE', 'DATABASE', 'INDEX', 'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'EVENT',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK', 'DEFAULT', 'AUTO_INCREMENT',
  'INNER', 'LEFT', 'RIGHT', 'OUTER', 'JOIN', 'ON', 'AS',
  'GROUP', 'BY', 'ORDER', 'ASC', 'DESC', 'HAVING', 'LIMIT', 'OFFSET',
  'UNION', 'ALL', 'DISTINCT', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT',
  'GRANT', 'REVOKE', 'FLUSH', 'SHOW', 'DESCRIBE', 'EXPLAIN', 'USE',
  'IF', 'WHILE', 'RETURN', 'DECLARE', 'CURSOR', 'FETCH', 'OPEN', 'CLOSE',
  'INT', 'VARCHAR', 'CHAR', 'TEXT', 'BLOB', 'DECIMAL', 'FLOAT', 'DOUBLE',
  'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR', 'BOOLEAN', 'JSON', 'ENUM',
  'ENGINE', 'CHARSET', 'COLLATE', 'COMMENT', 'UNSIGNED', 'ZEROFILL',
  'CASCADE', 'RESTRICT', 'NO', 'ACTION', 'TRUNCATE', 'RENAME',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'IFNULL', 'NULLIF',
  'CONCAT', 'SUBSTRING', 'UPPER', 'LOWER', 'TRIM', 'REPLACE', 'LENGTH',
  'NOW', 'CURDATE', 'CURTIME', 'DATE_FORMAT', 'DATE_ADD', 'DATE_SUB', 'DATEDIFF',
  'CAST', 'CONVERT', 'GROUP_CONCAT', 'JSON_EXTRACT', 'JSON_UNQUOTE',
];

// 动态数据源（从对象树提取）
let tableNames: string[] = [];
let columnNames: Record<string, string[]> = {};  // tableName -> columns[]
let viewNames: string[] = [];
let databaseNames: string[] = [];

/** 从对象树中提取补全数据 */
export function updateCompletionData(treeData: TreeNode[]): void {
  const tables: string[] = [];
  const columns: Record<string, string[]> = {};
  const views: string[] = [];
  const databases: string[] = [];

  for (const conn of treeData) {
    if (!conn.children) continue;
    for (const db of conn.children) {
      databases.push(db.title as string);
      if (!db.children) continue;
      for (const group of db.children) {
        if (group.type === 'table_group' && group.children) {
          for (const table of group.children) {
            const tableName = (table as any).tableName || (table.title as string);
            tables.push(tableName);
            if (table.children) {
              const cols: string[] = [];
              for (const child of table.children) {
                if (child.type === 'column') {
                  cols.push(child.title as string);
                }
              }
              if (cols.length > 0) columns[tableName] = cols;
            }
          }
        }
        if (group.type === 'view_group' && group.children) {
          for (const view of group.children) {
            views.push(view.title as string);
          }
        }
      }
    }
  }

  tableNames = [...new Set(tables)];
  columnNames = columns;
  viewNames = [...new Set(views)];
  databaseNames = [...new Set(databases)];
}

/** 注册 SQL 补全 Provider */
export function registerSQLCompletion(): { dispose: () => void } {
  if (!monacoRef) return { dispose: () => {} };
  const provider = monacoRef.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ['.', ' '],
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: any[] = [];

      // 关键字补全
      for (const kw of SQL_KEYWORDS) {
        suggestions.push({
          label: kw,
          kind: 14, // CompletionItemKind.Keyword
          insertText: kw,
          range,
          detail: '关键字',
        });
        // 小写版本
        suggestions.push({
          label: kw.toLowerCase(),
          kind: 14,
          insertText: kw.toLowerCase(),
          range,
          detail: '关键字',
        });
      }

      // 表名补全
      for (const t of tableNames) {
        suggestions.push({
          label: t,
          kind: 5, // CompletionItemKind.Class (table)
          insertText: `\`${t}\``,
          range,
          detail: '表',
        });
      }

      // 视图名补全
      for (const v of viewNames) {
        suggestions.push({
          label: v,
          kind: 5,
          insertText: `\`${v}\``,
          range,
          detail: '视图',
        });
      }

      // 数据库名补全
      for (const db of databaseNames) {
        suggestions.push({
          label: db,
          kind: 9, // CompletionItemKind.Module (database)
          insertText: `\`${db}\``,
          range,
          detail: '数据库',
        });
      }

      // 列名补全 — 收集所有表的列
      const allColumns = new Set<string>();
      for (const cols of Object.values(columnNames)) {
        for (const c of cols) {
          allColumns.add(c);
        }
      }
      for (const col of allColumns) {
        suggestions.push({
          label: col,
          kind: 4, // CompletionItemKind.Field
          insertText: `\`${col}\``,
          range,
          detail: '列',
        });
      }

      return { suggestions };
    },
  });

  return provider;
}
