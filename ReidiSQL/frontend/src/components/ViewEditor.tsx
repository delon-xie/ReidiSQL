/**
 * 视图编辑器组件
 * 支持新建和编辑模式，使用 Monaco Editor 编辑 SQL 定义
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Input, Button, Space, Typography, message, Spin } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { objectsApi } from '../lib/api';

const { Text } = Typography;

export interface ViewEditorProps {
  open: boolean;
  connectionId: string;
  database: string;
  viewName?: string; // 编辑模式时传入
  onClose: () => void;
  onSuccess: () => void;
}

const ViewEditor: React.FC<ViewEditorProps> = ({ open, connectionId, database, viewName, onClose, onSuccess }) => {
  const [name, setName] = useState(viewName || '');
  const [definition, setDefinition] = useState('SELECT 1 AS id');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!viewName;

  // 加载现有视图定义
  useEffect(() => {
    if (open && viewName && connectionId && database) {
      setLoading(true);
      setName(viewName);
      objectsApi.getCode(connectionId, database, 'VIEW', viewName)
        .then(result => {
          if (result.code) {
            // 从 CREATE VIEW ... AS 中提取 SELECT 部分
            const match = result.code.match(/AS\s+([\s\S]+)$/i);
            if (match) {
              setDefinition(match[1].trim());
            } else {
              setDefinition(result.code);
            }
          }
        })
        .catch(err => {
          message.error(`加载视图定义失败: ${err.message}`);
        })
        .finally(() => setLoading(false));
    } else if (open && !viewName) {
      setName('');
      setDefinition('SELECT 1 AS id');
    }
  }, [open, viewName, connectionId, database]);

  // 执行保存
  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      message.warning('请输入视图名称');
      return;
    }
    if (!definition.trim()) {
      message.warning('请输入 SQL 定义');
      return;
    }

    setSaving(true);
    try {
      const result = await objectsApi.createView(
        connectionId,
        database,
        name.trim(),
        definition.trim(),
        isEdit ? 'alter' : 'create'
      );

      if (result.success) {
        message.success(`视图 ${name} ${isEdit ? '更新' : '创建'}成功`);
        onSuccess();
        onClose();
      } else {
        message.error(result.error || '操作失败');
      }
    } catch (err: any) {
      message.error(`操作失败: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [connectionId, database, name, definition, isEdit, onSuccess, onClose]);

  return (
    <Modal
      title={<Space><CodeOutlined /> {isEdit ? '编辑视图' : '新建视图'}</Space>}
      open={open}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button key="save" type="primary" loading={saving} onClick={handleSave}>
          {isEdit ? '更新' : '创建'}
        </Button>,
      ]}
    >
      <Spin spinning={loading}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text>视图名称:</Text>
            <Input
              style={{ width: 300, marginLeft: 8 }}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="输入视图名称"
              disabled={isEdit}
            />
          </div>
          <div>
            <Text>SQL 定义 (AS 后面的 SELECT 语句):</Text>
            <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, marginTop: 8 }}>
              <Editor
                height={300}
                language="sql"
                value={definition}
                onChange={(val) => setDefinition(val || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  fontSize: 14,
                }}
              />
            </div>
          </div>
        </Space>
      </Spin>
    </Modal>
  );
};

export default ViewEditor;
