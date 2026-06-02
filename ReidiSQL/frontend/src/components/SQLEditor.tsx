/**
 * SQL 编辑器 — Monaco Editor 封装
 */

import React, { useRef, useCallback } from 'react';
import { Button, Spin, Alert } from 'antd';
import { PlayCircleOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { useQueryStore } from '@/stores/queryStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useLogStore } from '@/stores/logStore';

const SQLEditor: React.FC = () => {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const { tabs, activeTabId, setActiveTab, closeTab, addTab, updateTabSQL, executeQuery } = useQueryStore();
  const { activeConnectionId } = useConnectionStore();
  const { addMessage } = useLogStore();

  const activeTab = tabs.find(t => t.id === activeTabId);
  const sql = activeTab?.sql || '';
  const executing = activeTab?.executing || false;
  const error = activeTab?.error;

  const handleEditorMount = useCallback((editor: MonacoEditor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

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

        {/* 执行按钮 */}
        <div style={{ marginLeft: 'auto' }}>
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
          theme="vs-dark"
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
    </div>
  );
};

export default SQLEditor;
