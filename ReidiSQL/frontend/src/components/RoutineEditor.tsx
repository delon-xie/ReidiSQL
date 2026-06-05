/**
 * 存储过程/函数编辑器组件
 * 支持参数定义、选项配置、SQL body 编辑
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Input, Select, Button, Space, Typography, message, Spin, Table, Tabs } from 'antd';
import { PlusOutlined, DeleteOutlined, FunctionOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { objectsApi, RoutineParam, RoutineOptions } from '../lib/api';

const { Text } = Typography;
const { Option } = Select;

export interface RoutineEditorProps {
  open: boolean;
  connectionId: string;
  database: string;
  routineName?: string;
  routineType?: 'PROCEDURE' | 'FUNCTION';
  onClose: () => void;
  onSuccess: () => void;
}

const RoutineEditor: React.FC<RoutineEditorProps> = ({
  open, connectionId, database, routineName, routineType: initialType, onClose, onSuccess
}) => {
  const [name, setName] = useState(routineName || '');
  const [type, setType] = useState<'PROCEDURE' | 'FUNCTION'>(initialType || 'PROCEDURE');
  const [returns, setReturns] = useState('INT');
  const [body, setBody] = useState('BEGIN\n  -- SQL body here\nEND');
  const [params, setParams] = useState<RoutineParam[]>([]);
  const [options, setOptions] = useState<RoutineOptions>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('options');

  const isEdit = !!routineName;

  // 加载现有定义
  useEffect(() => {
    if (open && routineName && connectionId && database) {
      setLoading(true);
      setName(routineName);
      setType(initialType || 'PROCEDURE');

      const objType = initialType === 'FUNCTION' ? 'FUNCTION' : 'PROCEDURE';
      objectsApi.getCode(connectionId, database, objType, routineName)
        .then(result => {
          if (result.code) {
            // 简单解析 — 提取 body
            const bodyMatch = result.code.match(/(BEGIN[\s\S]+END)/i);
            if (bodyMatch) {
              setBody(bodyMatch[1]);
            } else {
              setBody(result.code);
            }
          }
        })
        .catch(err => {
          message.error(`加载定义失败: ${err.message}`);
        })
        .finally(() => setLoading(false));
    } else if (open && !routineName) {
      setName('');
      setType('PROCEDURE');
      setReturns('INT');
      setBody('BEGIN\n  -- SQL body here\nEND');
      setParams([]);
      setOptions({});
    }
  }, [open, routineName, initialType, connectionId, database]);

  // 添加参数
  const addParam = useCallback(() => {
    setParams(prev => [...prev, { name: '', dataType: 'INT', direction: 'IN' }]);
  }, []);

  // 删除参数
  const removeParam = useCallback((index: number) => {
    setParams(prev => prev.filter((_, i) => i !== index));
  }, []);

  // 更新参数
  const updateParam = useCallback((index: number, field: keyof RoutineParam, value: string) => {
    setParams(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  }, []);

  // 保存
  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      message.warning('请输入名称');
      return;
    }
    if (!body.trim()) {
      message.warning('请输入 SQL Body');
      return;
    }

    setSaving(true);
    try {
      const result = await objectsApi.createRoutine(
        connectionId,
        database,
        name.trim(),
        type,
        body.trim(),
        params.filter(p => p.name.trim()),
        type === 'FUNCTION' ? returns : undefined,
        options,
        isEdit ? 'alter' : 'create'
      );

      if (result.success) {
        message.success(`${type === 'FUNCTION' ? '函数' : '存储过程'} ${name} ${isEdit ? '更新' : '创建'}成功`);
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
  }, [connectionId, database, name, type, body, params, returns, options, isEdit, onSuccess, onClose]);

  // 参数表格列
  const paramColumns = [
    {
      title: '#',
      key: 'index',
      width: 40,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (val: string, _: unknown, index: number) => (
        <Input size="small" value={val} onChange={e => updateParam(index, 'name', e.target.value)} placeholder="参数名" />
      ),
    },
    {
      title: '类型',
      dataIndex: 'dataType',
      key: 'dataType',
      width: 150,
      render: (val: string, _: unknown, index: number) => (
        <Input size="small" value={val} onChange={e => updateParam(index, 'dataType', e.target.value)} placeholder="INT, VARCHAR(50)..." />
      ),
    },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      width: 100,
      render: (val: string, _: unknown, index: number) => (
        <Select size="small" value={val || 'IN'} onChange={v => updateParam(index, 'direction', v)} disabled={type === 'FUNCTION'}>
          <Option value="IN">IN</Option>
          <Option value="OUT">OUT</Option>
          <Option value="INOUT">INOUT</Option>
        </Select>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 40,
      render: (_: unknown, __: unknown, index: number) => (
        <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeParam(index)} />
      ),
    },
  ];

  return (
    <Modal
      title={<Space><FunctionOutlined /> {isEdit ? '编辑' : '新建'} {type === 'FUNCTION' ? '函数' : '存储过程'}</Space>}
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
              placeholder="名称"
              disabled={isEdit}
            />
            {!isEdit && (
              <>
                <Text>类型:</Text>
                <Select value={type} onChange={setType} style={{ width: 120 }}>
                  <Option value="PROCEDURE">存储过程</Option>
                  <Option value="FUNCTION">函数</Option>
                </Select>
              </>
            )}
            {type === 'FUNCTION' && (
              <>
                <Text>返回类型:</Text>
                <Input
                  style={{ width: 150 }}
                  value={returns}
                  onChange={e => setReturns(e.target.value)}
                  placeholder="INT, VARCHAR(50)..."
                />
              </>
            )}
          </Space>

          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={[
              {
                key: 'options',
                label: '选项',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <Space>
                      <Text>数据访问:</Text>
                      <Select
                        style={{ width: 200 }}
                        value={options.dataAccess}
                        onChange={v => setOptions(prev => ({ ...prev, dataAccess: v }))}
                        allowClear
                        placeholder="默认"
                      >
                        <Option value="CONTAINS SQL">CONTAINS SQL</Option>
                        <Option value="NO SQL">NO SQL</Option>
                        <Option value="READS SQL DATA">READS SQL DATA</Option>
                        <Option value="MODIFIES SQL DATA">MODIFIES SQL DATA</Option>
                      </Select>
                    </Space>
                    <Space>
                      <Text>安全类型:</Text>
                      <Select
                        style={{ width: 150 }}
                        value={options.securityType}
                        onChange={v => setOptions(prev => ({ ...prev, securityType: v }))}
                        allowClear
                        placeholder="默认"
                      >
                        <Option value="DEFINER">DEFINER</Option>
                        <Option value="INVOKER">INVOKER</Option>
                      </Select>
                    </Space>
                  </Space>
                ),
              },
              {
                key: 'params',
                label: `参数 (${params.length})`,
                children: (
                  <div>
                    <Button icon={<PlusOutlined />} size="small" onClick={addParam} style={{ marginBottom: 8 }}>
                      添加参数
                    </Button>
                    <Table
                      columns={paramColumns}
                      dataSource={params.map((p, i) => ({ ...p, key: i }))}
                      pagination={false}
                      size="small"
                    />
                  </div>
                ),
              },
              {
                key: 'body',
                label: 'SQL Body',
                children: null,
              },
            ]}
          />

          <div style={{ border: '1px solid #d9d9d9', borderRadius: 6 }}>
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
        </Space>
      </Spin>
    </Modal>
  );
};

export default RoutineEditor;
