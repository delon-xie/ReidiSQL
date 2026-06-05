/**
 * 触发器编辑器组件
 * 配置 Timing/Event/Table + 编辑 SQL body
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Input, Select, Button, Space, Typography, message, Spin } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { objectsApi, metadataApi } from '../lib/api';

const { Text } = Typography;
const { Option } = Select;

export interface TriggerEditorProps {
  open: boolean;
  connectionId: string;
  database: string;
  triggerName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const TriggerEditor: React.FC<TriggerEditorProps> = ({
  open, connectionId, database, triggerName, onClose, onSuccess
}) => {
  const [name, setName] = useState(triggerName || '');
  const [timing, setTiming] = useState<'BEFORE' | 'AFTER'>('BEFORE');
  const [event, setEvent] = useState<'INSERT' | 'UPDATE' | 'DELETE'>('INSERT');
  const [table, setTable] = useState('');
  const [body, setBody] = useState('BEGIN\n  -- Trigger body\nEND');
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!triggerName;

  // 加载表列表
  useEffect(() => {
    if (open && connectionId && database) {
      metadataApi.tables(connectionId, database)
        .then(result => {
          setTables(result.map((t: any) => t.name || t));
        })
        .catch(err => {
          console.error('Failed to load tables:', err);
        });
    }
  }, [open, connectionId, database]);

  // 加载现有触发器定义
  useEffect(() => {
    if (open && triggerName && connectionId && database) {
      setLoading(true);
      setName(triggerName);
      objectsApi.getCode(connectionId, database, 'TRIGGER', triggerName)
        .then(result => {
          if (result.code) {
            // 解析触发器定义
            const timingMatch = result.code.match(/(BEFORE|AFTER)/i);
            const eventMatch = result.code.match(/(INSERT|UPDATE|DELETE)/i);
            const tableMatch = result.code.match(/ON\s+`?(\w+)`?/i);
            const bodyMatch = result.code.match(/FOR EACH ROW\s+([\s\S]+)$/i);

            if (timingMatch) setTiming(timingMatch[1].toUpperCase() as 'BEFORE' | 'AFTER');
            if (eventMatch) setEvent(eventMatch[1].toUpperCase() as 'INSERT' | 'UPDATE' | 'DELETE');
            if (tableMatch) setTable(tableMatch[1]);
            if (bodyMatch) setBody(bodyMatch[1].trim());
            else setBody(result.code);
          }
        })
        .catch(err => {
          message.error(`加载触发器定义失败: ${err.message}`);
        })
        .finally(() => setLoading(false));
    } else if (open && !triggerName) {
      setName('');
      setTiming('BEFORE');
      setEvent('INSERT');
      setTable('');
      setBody('BEGIN\n  -- Trigger body\nEND');
    }
  }, [open, triggerName, connectionId, database]);

  // 保存
  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      message.warning('请输入触发器名称');
      return;
    }
    if (!table) {
      message.warning('请选择目标表');
      return;
    }
    if (!body.trim()) {
      message.warning('请输入触发器 Body');
      return;
    }

    setSaving(true);
    try {
      const result = await objectsApi.createTrigger(
        connectionId,
        database,
        name.trim(),
        timing,
        event,
        table,
        body.trim(),
        isEdit ? 'alter' : 'create'
      );

      if (result.success) {
        message.success(`触发器 ${name} ${isEdit ? '更新' : '创建'}成功`);
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
  }, [connectionId, database, name, timing, event, table, body, isEdit, onSuccess, onClose]);

  return (
    <Modal
      title={<Space><ThunderboltOutlined /> {isEdit ? '编辑' : '新建'}触发器</Space>}
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
          <Space>
            <Text>名称:</Text>
            <Input
              style={{ width: 200 }}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="触发器名称"
              disabled={isEdit}
            />
          </Space>
          <Space>
            <Text>时机:</Text>
            <Select value={timing} onChange={setTiming} style={{ width: 120 }}>
              <Option value="BEFORE">BEFORE</Option>
              <Option value="AFTER">AFTER</Option>
            </Select>
            <Text>事件:</Text>
            <Select value={event} onChange={setEvent} style={{ width: 120 }}>
              <Option value="INSERT">INSERT</Option>
              <Option value="UPDATE">UPDATE</Option>
              <Option value="DELETE">DELETE</Option>
            </Select>
            <Text>表:</Text>
            <Select
              style={{ width: 200 }}
              value={table || undefined}
              onChange={setTable}
              placeholder="选择表"
              showSearch
              disabled={isEdit}
            >
              {tables.map(t => <Option key={t} value={t}>{t}</Option>)}
            </Select>
          </Space>
          <div>
            <Text>触发器 Body (FOR EACH ROW 后执行):</Text>
            <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, marginTop: 8 }}>
              <Editor
                height={250}
                language="sql"
                value={body}
                onChange={(val) => setBody(val || '')}
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

export default TriggerEditor;
