/**
 * SQL 编辑器 — Monaco Editor 封装 (Sprint 5: +theme, +history, +completion)
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Button, Spin, Alert, Drawer, List, Typography, Empty, Tooltip } from 'antd';
import { PlayCircleOutlined, PlusOutlined, CloseOutlined, HistoryOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { useQueryStore } from '@/stores/queryStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useLogStore } from '@/stores/logStore';
import { registerSQLCompletion, updateCompletionData, setMonacoRef } from '@/utils/sqlCompletion';
import { useObjectTreeStore } from '@/stores/objectTreeStore';

const { Text } = Typography;

interface SQLEditorProps {
  isDark?: boolean;
}

const SQLEditor: React.FC<SQLEditorProps> = ({ isDark = false }) => {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const { tabs, activeTabId, setActiveTab, closeTab, addTab, updateTabSQL, executeQuery, history, fetchHistory } = useQueryStore();
  const { activeConnectionId } = useConnectionStore();
  const { addMessage } = useLogStore();
  const { treeData } = useObjectTreeStore();

  const [historyOpen, setHistoryOpen] = useState(false);
  const completionDisposableRef = useRef<{ dispose: () => void } | null>(null);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const sql = activeTab?.sql || '';
  const executing = activeTab?.executing || false;
  const error = activeTab?.error;

  // 更新补全数据源
  useEffect(() => {
    updateCompletionData(treeData);
  }, [treeData]);

  const handleEditorMount = useCallback((editor: MonacoEditor.IStandaloneCodeEditor, monacoInstance: any) => {
    editorRef.current = editor;

    // 保存 monaco 引用供补全使用
    setMonacoRef(monacoInstance);

    // 注册 SQL 补全
    if (!completionDisposableRef.current) {
      completionDisposableRef.current = registerSQLCompletion();
    }

    // 添加 Ctrl+Enter 快捷键执行查询
    editor.addCommand(
      // eslint-disable-next-line no-bitwise
      2048 | 3, // KeyMod.CtrlCmd | KeyCode.Enter
      () => {
        if (activeConnectionId) {
          executeQuery(activeConnectionId);
        }
      },
    );
  }, [activeConnectionId, executeQuery]);

  const handleExecute = useCallback(async () => {
    if (!activeConnectionId) {
      addMessage('warn', 'No active connection. Please connect first.');
      return;
    }

    // 如果有选中内容，只执行选中的
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      const model = editorRef.current.getModel();
      if (model && selection && !selection.isEmpty()) {
        const selectedText = model.getValueInRange(selection);
        updateTabSQL(activeTabId, selectedText);
        await executeQuery(activeConnectionId);
        updateTabSQL(activeTabId, sql); // 恢复原始 SQL
        return;
      }
    }

    await executeQuery(activeConnectionId);
  }, [activeConnectionId, activeTabId, executeQuery, updateTabSQL, sql, addMessage]);

  const handleOpenHistory = useCallback(() => {
    if (activeConnectionId) {
      fetchHistory(activeConnectionId);
    }
    setHistoryOpen(true);
  }, [activeConnectionId, fetchHistory]);

  const handleHistorySelect = useCallback((sqlText: string) => {
    updateTabSQL(activeTabId, sqlText);
    setHistoryOpen(false);
  }, [activeTabId, updateTabSQL]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab 栏 */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f0f0', padding: '0 8px', gap: 2, overflow: 'auto' }}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              borderBottom: tab.id === activeTabId ? '2px solid #1677ff' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 13,
              color: tab.id === activeTabId ? '#1677ff' : '#666',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.executing && <Spin size="small" style={{ marginRight: 4 }} />}
            {tab.title}
            {tabs.length > 1 && (
              <CloseOutlined
                style={{ fontSize: 10, marginLeft: 4 }}
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              />
            )}
          </div>
        ))}
        <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => addTab()} />

        {/* 执行按钮 + 历史 */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <Tooltip title="查询历史">
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={handleOpenHistory}
              disabled={!activeConnectionId}
            />
          </Tooltip>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={executing}
            onClick={handleExecute}
            disabled={!activeConnectionId}
            size="small"
          >
            {executing ? '执行中...' : '执行 (Ctrl+Enter)'}
          </Button>
        </div>
      </div>

      {/* 编辑器 */}
      <div style={{ flex: 1, minHeight: 200 }}>
        <Editor
          height="100%"
          language="sql"
          theme={isDark ? 'vs-dark' : 'vs'}
          value={sql}
          onChange={(v) => updateTabSQL(activeTabId, v || '')}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineHeight: 24,
            automaticLayout: true,
            wordWrap: 'on',
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            tabSize: 2,
            scrollBeyondLastLine: false,
            renderLineHighlight: 'all',
            bracketPairColorization: { enabled: true },
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            matchBrackets: 'always',
            find: { addExtraSpaceOnTop: false, autoFindInSelection: 'always' },
          }}
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert
          type="error"
          message={error}
          closable
          style={{ margin: '4px 8px' }}
          showIcon
        />
      )}

      {/* 查询历史抽屉 */}
      <Drawer
        title="查询历史"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        width={500}
        destroyOnClose
      >
        {history.length === 0 ? (
          <Empty description="暂无历史记录" />
        ) : (
          <List
            size="small"
            dataSource={history}
            renderItem={(item: any) => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => handleHistorySelect(item.sql)}
              >
                <List.Item.Meta
                  title={<Text code ellipsis style={{ maxWidth: 440 }}>{item.sql}</Text>}
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.executedAt || item.createdAt || ''} | {item.duration ? `${item.duration}ms` : ''}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </div>
  );
};

export default SQLEditor;
