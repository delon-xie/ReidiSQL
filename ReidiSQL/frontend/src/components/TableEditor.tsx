/**
 * 表设计器组件 - 可视化创建/修改表结构
 */

import React, { useState, useCallback } from 'react';
import {
  Modal, Tabs, Button, Input, Select, Form, Space, Tag, Popconfirm,
  Table, InputNumber, Switch, message, Typography,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EyeOutlined, SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useTableEditorStore } from '../stores/tableEditorStore';
import { ddlApi } from '../lib/api';

const { Text } = Typography;
const { TextArea } = Input;

const DATA_TYPES = [
  'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT',
  'VARCHAR', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT',
  'DECIMAL', 'FLOAT', 'DOUBLE',
  'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR',
  'BOOLEAN', 'ENUM', 'SET', 'JSON', 'BLOB', 'BINARY', 'VARBINARY',
  'POINT', 'GEOMETRY', 'POLYGON',
];

const ENGINES = ['InnoDB', 'MyISAM', 'MEMORY', 'ARCHIVE', 'CSV'];
const CHARSETS = ['utf8mb4', 'utf8', 'latin1', 'ascii', 'binary'];
const COLLATIONS = ['utf8mb4_unicode_ci', 'utf8mb4_general_ci', 'utf8_unicode_ci', 'utf8_general_ci'];
const INDEX_TYPES = ['PRIMARY', 'UNIQUE', 'INDEX', 'FULLTEXT', 'SPATIAL'];
const REF_ACTIONS = ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT'];

interface TableEditorProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (tableName: string) => void;
}

const TableEditor: React.FC<TableEditorProps> = ({ open, onClose, onSuccess }) => {
  const store = useTableEditorStore();
  const [executing, setExecuting] = useState(false);

  // ========== 列编辑器 ==========
  const columnsTableColumns = [
    {
      title: '列名',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (_: any, record: any) => (
        <Input
          size="small"
          value={record.name}
          onChange={(e) => store.updateColumn(record.key, { name: e.target.value })}
          placeholder="列名"
        />
      ),
    },
    {
      title: '类型',
      dataIndex: 'dataType',
      key: 'dataType',
      width: 140,
      render: (_: any, record: any) => (
        <Select
          size="small"
          value={record.dataType}
          onChange={(v) => store.updateColumn(record.key, { dataType: v })}
          style={{ width: '100%' }}
          showSearch
          options={DATA_TYPES.map(t => ({ label: t, value: t }))}
        />
      ),
    },
    {
      title: 'NOT NULL',
      dataIndex: 'nullable',
      key: 'nullable',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Switch
          size="small"
          checked={!record.nullable}
          onChange={(v) => store.updateColumn(record.key, { nullable: !v })}
        />
      ),
    },
    {
      title: 'AI',
      dataIndex: 'autoIncrement',
      key: 'autoIncrement',
      width: 60,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Switch
          size="small"
          checked={record.autoIncrement}
          onChange={(v) => store.updateColumn(record.key, { autoIncrement: v })}
        />
      ),
    },
    {
      title: 'Unsigned',
      dataIndex: 'unsigned',
      key: 'unsigned',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Switch
          size="small"
          checked={record.unsigned}
          onChange={(v) => store.updateColumn(record.key, { unsigned: v })}
        />
      ),
    },
    {
      title: '默认值',
      dataIndex: 'defaultValue',
      key: 'defaultValue',
      width: 140,
      render: (_: any, record: any) => (
        <Input
          size="small"
          value={record.defaultValue || ''}
          onChange={(e) => store.updateColumn(record.key, { hasDefault: true, defaultValue: e.target.value || null })}
          placeholder="默认值"
        />
      ),
    },
    {
      title: '注释',
      dataIndex: 'comment',
      key: 'comment',
      width: 160,
      render: (_: any, record: any) => (
        <Input
          size="small"
          value={record.comment || ''}
          onChange={(e) => store.updateColumn(record.key, { comment: e.target.value })}
          placeholder="注释"
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: any, record: any) => (
        <Popconfirm
          title="确定删除此列？"
          onConfirm={() => store.removeColumn(record.key)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  // ========== 索引编辑器 ==========
  const indexesTableColumns = [
    {
      title: '索引名',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (_: any, record: any) => (
        <Input
          size="small"
          value={record.name}
          onChange={(e) => store.updateIndex(record.key, { name: e.target.value })}
          placeholder="索引名"
          disabled={record.type === 'PRIMARY'}
        />
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (_: any, record: any) => (
        <Select
          size="small"
          value={record.type}
          onChange={(v) => store.updateIndex(record.key, { type: v })}
          options={INDEX_TYPES.map(t => ({ label: t, value: t }))}
        />
      ),
    },
    {
      title: '列',
      dataIndex: 'columns',
      key: 'columns',
      width: 200,
      render: (_: any, record: any) => (
        <Select
          size="small"
          mode="tags"
          value={(record.columns || []).map((c: any) => c.name || c)}
          onChange={(values: string[]) => {
            store.updateIndex(record.key, {
              columns: values.map(v => ({ name: v })),
            });
          }}
          placeholder="选择列"
          options={store.columns.filter(c => c.name).map(c => ({ label: c.name, value: c.name }))}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: any, record: any) => (
        <Popconfirm
          title="确定删除此索引？"
          onConfirm={() => store.removeIndex(record.key)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} disabled={record.type === 'PRIMARY'} />
        </Popconfirm>
      ),
    },
  ];

  // ========== 外键编辑器 ==========
  const foreignKeysTableColumns = [
    {
      title: '约束名',
      dataIndex: 'name',
      key: 'name',
      width: 140,
      render: (_: any, record: any) => (
        <Input
          size="small"
          value={record.name}
          onChange={(e) => store.updateForeignKey(record.key, { name: e.target.value })}
          placeholder="约束名"
        />
      ),
    },
    {
      title: '列',
      dataIndex: 'columns',
      key: 'columns',
      width: 140,
      render: (_: any, record: any) => (
        <Select
          size="small"
          mode="tags"
          value={record.columns || []}
          onChange={(v: string[]) => store.updateForeignKey(record.key, { columns: v })}
          placeholder="选择列"
          options={store.columns.filter(c => c.name).map(c => ({ label: c.name, value: c.name }))}
        />
      ),
    },
    {
      title: '引用表',
      dataIndex: 'referencedTable',
      key: 'referencedTable',
      width: 140,
      render: (_: any, record: any) => (
        <Input
          size="small"
          value={record.referencedTable || ''}
          onChange={(e) => store.updateForeignKey(record.key, { referencedTable: e.target.value })}
          placeholder="引用表"
        />
      ),
    },
    {
      title: '引用列',
      dataIndex: 'referencedColumns',
      key: 'referencedColumns',
      width: 140,
      render: (_: any, record: any) => (
        <Select
          size="small"
          mode="tags"
          value={record.referencedColumns || []}
          onChange={(v: string[]) => store.updateForeignKey(record.key, { referencedColumns: v })}
          placeholder="引用列"
        />
      ),
    },
    {
      title: 'ON DELETE',
      dataIndex: 'onDelete',
      key: 'onDelete',
      width: 110,
      render: (_: any, record: any) => (
        <Select
          size="small"
          value={record.onDelete || 'RESTRICT'}
          onChange={(v) => store.updateForeignKey(record.key, { onDelete: v })}
          options={REF_ACTIONS.map(a => ({ label: a, value: a }))}
        />
      ),
    },
    {
      title: 'ON UPDATE',
      dataIndex: 'onUpdate',
      key: 'onUpdate',
      width: 110,
      render: (_: any, record: any) => (
        <Select
          size="small"
          value={record.onUpdate || 'RESTRICT'}
          onChange={(v) => store.updateForeignKey(record.key, { onUpdate: v })}
          options={REF_ACTIONS.map(a => ({ label: a, value: a }))}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: any, record: any) => (
        <Popconfirm
          title="确定删除此外键？"
          onConfirm={() => store.removeForeignKey(record.key)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  // ========== 预览 SQL ==========
  const handlePreviewSQL = useCallback(async () => {
    try {
      const operation = store.mode === 'create' ? 'create' : 'alter';
      const sql = await ddlApi.generate({
        operation,
        tableName: store.tableName,
        newTableName: store.newTableName || undefined,
        columns: store.toColumnDDLs(),
        indexes: store.toIndexDDLs(),
        foreignKeys: store.toForeignKeyDDLs(),
        options: store.options,
      });
      store.setPreviewSQL(sql);
      store.setShowPreview(true);
    } catch (err: any) {
      message.error(`生成 SQL 失败: ${err.message}`);
    }
  }, [store]);

  // ========== 执行 ==========
  const handleExecute = useCallback(async () => {
    if (!store.tableName) {
      message.warning('请输入表名');
      return;
    }
    if (store.columns.length === 0) {
      message.warning('至少需要定义一列');
      return;
    }

    setExecuting(true);
    try {
      const operation = store.mode === 'create' ? 'create' : 'alter';
      const result = await ddlApi.table({
        connectionId: store.connectionId,
        database: store.database,
        operation,
        tableName: store.tableName,
        newTableName: store.newTableName || undefined,
        columns: store.toColumnDDLs(),
        indexes: store.toIndexDDLs(),
        foreignKeys: store.toForeignKeyDDLs(),
        options: store.options,
      });

      if (result.success) {
        message.success(`${store.mode === 'create' ? '创建' : '修改'}表 ${store.tableName} 成功`);
        onSuccess?.(store.tableName);
        onClose();
      } else {
        message.error(`执行失败: ${result.error}`);
      }
    } catch (err: any) {
      message.error(`执行失败: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  }, [store, onClose, onSuccess]);

  // ========== 渲染 ==========
  const tabItems = [
    {
      key: 'columns',
      label: (
        <span>列 <Tag>{store.columns.length}</Tag></span>
      ),
      children: (
        <div>
          <Table
            dataSource={store.columns}
            columns={columnsTableColumns}
            rowKey="key"
            size="small"
            pagination={false}
            scroll={{ y: 350 }}
          />
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={store.addColumn}
            style={{ width: '100%', marginTop: 8 }}
          >
            添加列
          </Button>
        </div>
      ),
    },
    {
      key: 'indexes',
      label: (
        <span>索引 <Tag>{store.indexes.length}</Tag></span>
      ),
      children: (
        <div>
          <Table
            dataSource={store.indexes}
            columns={indexesTableColumns}
            rowKey="key"
            size="small"
            pagination={false}
            scroll={{ y: 350 }}
          />
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={store.addIndex}
            style={{ width: '100%', marginTop: 8 }}
          >
            添加索引
          </Button>
        </div>
      ),
    },
    {
      key: 'foreignKeys',
      label: (
        <span>外键 <Tag>{store.foreignKeys.length}</Tag></span>
      ),
      children: (
        <div>
          <Table
            dataSource={store.foreignKeys}
            columns={foreignKeysTableColumns}
            rowKey="key"
            size="small"
            pagination={false}
            scroll={{ y: 350 }}
          />
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={store.addForeignKey}
            style={{ width: '100%', marginTop: 8 }}
          >
            添加外键
          </Button>
        </div>
      ),
    },
    {
      key: 'options',
      label: '选项',
      children: (
        <Form layout="vertical" size="small">
          <Form.Item label="引擎">
            <Select
              value={store.options.engine}
              onChange={(v) => store.updateOptions({ engine: v })}
              options={ENGINES.map(e => ({ label: e, value: e }))}
            />
          </Form.Item>
          <Form.Item label="字符集">
            <Select
              value={store.options.charset}
              onChange={(v) => store.updateOptions({ charset: v })}
              options={CHARSETS.map(c => ({ label: c, value: c }))}
            />
          </Form.Item>
          <Form.Item label="排序规则">
            <Select
              value={store.options.collation}
              onChange={(v) => store.updateOptions({ collation: v })}
              options={COLLATIONS.map(c => ({ label: c, value: c }))}
            />
          </Form.Item>
          <Form.Item label="表注释">
            <Input
              value={store.options.comment || ''}
              onChange={(e) => store.updateOptions({ comment: e.target.value })}
              placeholder="表注释"
            />
          </Form.Item>
          <Form.Item label="AUTO_INCREMENT">
            <InputNumber
              value={store.options.autoIncrement}
              onChange={(v) => store.updateOptions({ autoIncrement: v ?? undefined })}
              min={1}
              style={{ width: '100%' }}
              placeholder="自增起始值"
            />
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={
          <Space>
            <span>{store.mode === 'create' ? '创建新表' : `修改表 ${store.tableName}`}</span>
          </Space>
        }
        open={open}
        onCancel={onClose}
        width={900}
        footer={
          <Space>
            <Button icon={<CloseOutlined />} onClick={onClose}>取消</Button>
            <Button icon={<EyeOutlined />} onClick={handlePreviewSQL}>预览 SQL</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={executing}
              onClick={handleExecute}
              disabled={!store.tableName || store.columns.length === 0}
            >
              {store.mode === 'create' ? '创建表' : '应用修改'}
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Text strong>表名：</Text>
            <Input
              value={store.tableName}
              onChange={(e) => store.setTableName(e.target.value)}
              placeholder="输入表名"
              style={{ width: 250 }}
              disabled={store.mode === 'alter'}
            />
            {store.mode === 'alter' && (
              <>
                <Text>重命名为：</Text>
                <Input
                  value={store.newTableName}
                  onChange={(e) => store.setNewTableName(e.target.value)}
                  placeholder="新表名（可选）"
                  style={{ width: 200 }}
                />
              </>
            )}
          </Space>
        </div>

        <Tabs
          activeKey={store.activeTab}
          onChange={(key) => store.setActiveTab(key as any)}
          items={tabItems}
        />
      </Modal>

      {/* SQL 预览对话框 */}
      <Modal
        title="SQL 预览"
        open={store.showPreview}
        onCancel={() => store.setShowPreview(false)}
        footer={null}
        width={700}
      >
        <TextArea
          value={store.previewSQL}
          readOnly
          autoSize={{ minRows: 5, maxRows: 25 }}
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
      </Modal>
    </>
  );
};

export default TableEditor;
