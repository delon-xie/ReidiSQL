/**
 * CSV 导入向导组件
 * 5 步向导：文件选择 → 格式检测 → 目标选择 → 导入选项 → 执行
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Modal, Steps, Button, Upload, Select, Table, InputNumber, Switch, Typography, Space, Alert, message } from 'antd';
import { InboxOutlined, FileExcelOutlined } from '@ant-design/icons';
import { importApi, metadataApi, DetectResult, ImportResult, ImportOptions } from '../lib/api';

const { Dragger } = Upload;
const { Title, Text } = Typography;
const { Option } = Select;

export interface ImportWizardProps {
  open: boolean;
  connectionId: string;
  database: string;
  table?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ImportWizard: React.FC<ImportWizardProps> = ({ open, connectionId, database, table: initialTable, onClose, onSuccess }) => {
  const [current, setCurrent] = useState(0);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [detectResult, setDetectResult] = useState<DetectResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  // 目标选择
  const [targetDatabase, setTargetDatabase] = useState(database);
  const [targetTable, setTargetTable] = useState(initialTable || '');
  const [databases, setDatabases] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedColumns] = useState<string[]>([]);

  // 导入选项
  const [insertMode, setInsertMode] = useState<'INSERT' | 'INSERT IGNORE' | 'REPLACE'>('INSERT');
  const [truncateFirst, setTruncateFirst] = useState(false);
  const [batchSize, setBatchSize] = useState(500);

  const steps = ['文件选择', '格式预览', '目标选择', '导入选项', '执行结果'];

  // 加载数据库列表
  const loadDatabases = useCallback(async () => {
    if (!connectionId) return;
    try {
      const result = await metadataApi.databases(connectionId);
      setDatabases(result.map((d: any) => d.name || d));
    } catch (err) {
      console.error('Failed to load databases:', err);
    }
  }, [connectionId]);

  // 加载表列表
  const loadTables = useCallback(async (db: string) => {
    if (!connectionId || !db) return;
    try {
      const result = await metadataApi.tables(connectionId, db);
      setTables(result.map((t: any) => t.name || t));
    } catch (err) {
      console.error('Failed to load tables:', err);
    }
  }, [connectionId]);

  // 文件选择
  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileContent(content);
      setFileName(file.name);
      // 自动检测格式
      importApi.detect(content).then(result => {
        setDetectResult(result);
      }).catch(err => {
        message.error(`格式检测失败: ${err.message}`);
      });
    };
    reader.readAsText(file);
    return false; // 阻止默认上传
  }, []);

  // 选择数据库
  const handleDatabaseChange = useCallback((db: string) => {
    setTargetDatabase(db);
    setTargetTable('');
    loadTables(db);
  }, [loadTables]);

  // 选择表
  const handleTableChange = useCallback((tbl: string) => {
    setTargetTable(tbl);
  }, []);

  // 执行导入
  const handleExecute = useCallback(async () => {
    if (!fileContent || !targetDatabase || !targetTable) return;

    setLoading(true);
    try {
      const options: ImportOptions = {
        delimiter: detectResult?.delimiter,
        enclosure: detectResult?.enclosure,
        hasHeader: detectResult?.hasHeader,
        insertMode,
        truncateFirst,
        batchSize,
        columnMapping: selectedColumns.length > 0 ? selectedColumns : undefined,
      };

      const result = await importApi.execute(connectionId, targetDatabase, targetTable, fileContent, options);
      setImportResult(result);

      if (result.success) {
        message.success(`导入成功: ${result.importedRows} 行`);
        onSuccess();
      } else {
        message.warning(`导入完成，有 ${result.errors.length} 个错误`);
      }
    } catch (err: any) {
      message.error(`导入失败: ${err.message}`);
      setImportResult({
        success: false,
        totalRows: 0,
        importedRows: 0,
        skippedRows: 0,
        errors: [{ row: 0, error: err.message }],
        duration: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [connectionId, targetDatabase, targetTable, fileContent, detectResult, insertMode, truncateFirst, batchSize, selectedColumns, onSuccess]);

  // 下一步
  const handleNext = useCallback(() => {
    if (current === 1 && !databases.length) {
      loadDatabases();
    }
    if (current === 1 && targetDatabase && !tables.length) {
      loadTables(targetDatabase);
    }
    setCurrent(prev => Math.min(prev + 1, steps.length - 1));
  }, [current, databases, targetDatabase, tables, loadDatabases, loadTables]);

  // 上一步
  const handlePrev = useCallback(() => {
    setCurrent(prev => Math.max(prev - 1, 0));
  }, []);

  // 重置
  const handleClose = useCallback(() => {
    setCurrent(0);
    setFileContent('');
    setFileName('');
    setDetectResult(null);
    setImportResult(null);
    onClose();
  }, [onClose]);

  // 预览表格列
  const previewColumns = useMemo(() => {
    if (!detectResult?.preview?.[0]) return [];
    return detectResult.preview[0].map((_, idx) => ({
      title: detectResult.hasHeader ? detectResult.preview[0][idx] : `col_${idx}`,
      dataIndex: idx,
      key: idx,
      ellipsis: true,
      width: 150,
    }));
  }, [detectResult]);

  // 预览数据
  const previewData = useMemo(() => {
    if (!detectResult?.preview) return [];
    const start = detectResult.hasHeader ? 1 : 0;
    return detectResult.preview.slice(start, start + 5).map((row, idx) => {
      const obj: Record<string, unknown> = { key: idx };
      row.forEach((val, i) => { obj[i] = val; });
      return obj;
    });
  }, [detectResult]);

  // 列选择表格 (预留，暂未使用)
  void useMemo(() => {
    if (!detectResult?.columns) return [];
    return detectResult.columns.map((col, idx) => ({
      key: idx,
      name: col.name,
      type: col.type,
      sample: col.sample,
      selected: selectedColumns.includes(col.name) || selectedColumns.length === 0,
    }));
  }, [detectResult, selectedColumns]);

  const renderStep = () => {
    switch (current) {
      case 0: // 文件选择
        return (
          <div style={{ padding: 24 }}>
            <Dragger
              accept=".csv,.txt,.tsv"
              beforeUpload={handleFileUpload}
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽 CSV 文件到此区域</p>
              <p className="ant-upload-hint">支持 .csv, .txt, .tsv 格式</p>
            </Dragger>
            {fileName && (
              <Alert
                type="success"
                message={`已选择: ${fileName}`}
                description={fileContent ? `${fileContent.split('\n').length} 行` : ''}
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </div>
        );

      case 1: // 格式预览
        if (!detectResult) return <div>检测中...</div>;
        return (
          <div style={{ padding: 16 }}>
            <Space style={{ marginBottom: 16 }}>
              <Text>分隔符: <strong>{detectResult.delimiter === '\t' ? 'Tab' : detectResult.delimiter}</strong></Text>
              <Text>包围符: <strong>{detectResult.enclosure}</strong></Text>
              <Text>表头: <strong>{detectResult.hasHeader ? '是' : '否'}</strong></Text>
              <Text>数据行: <strong>{detectResult.rowCount}</strong></Text>
            </Space>
            <Table
              columns={previewColumns}
              dataSource={previewData}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
            <div style={{ marginTop: 16 }}>
              <Title level={5}>列类型检测</Title>
              <Table
                columns={[
                  { title: '列名', dataIndex: 'name', key: 'name' },
                  { title: '类型', dataIndex: 'type', key: 'type' },
                  { title: '示例', dataIndex: 'sample', key: 'sample', ellipsis: true },
                ]}
                dataSource={detectResult.columns.map((c, i) => ({ ...c, key: i }))}
                pagination={false}
                size="small"
              />
            </div>
          </div>
        );

      case 2: // 目标选择
        return (
          <div style={{ padding: 24 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text>目标数据库:</Text>
                <Select
                  style={{ width: 300, marginLeft: 8 }}
                  value={targetDatabase || undefined}
                  onChange={handleDatabaseChange}
                  placeholder="选择数据库"
                  showSearch
                >
                  {databases.map(db => <Option key={db} value={db}>{db}</Option>)}
                </Select>
              </div>
              <div>
                <Text>目标表:</Text>
                <Select
                  style={{ width: 300, marginLeft: 8 }}
                  value={targetTable || undefined}
                  onChange={handleTableChange}
                  placeholder="选择表"
                  showSearch
                >
                  {tables.map(t => <Option key={t} value={t}>{t}</Option>)}
                </Select>
              </div>
            </Space>
          </div>
        );

      case 3: // 导入选项
        return (
          <div style={{ padding: 24 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text>重复键处理:</Text>
                <Select
                  style={{ width: 200, marginLeft: 8 }}
                  value={insertMode}
                  onChange={setInsertMode}
                >
                  <Option value="INSERT">默认 (INSERT)</Option>
                  <Option value="INSERT IGNORE">忽略 (INSERT IGNORE)</Option>
                  <Option value="REPLACE">替换 (REPLACE)</Option>
                </Select>
              </div>
              <div>
                <Switch checked={truncateFirst} onChange={setTruncateFirst} />
                <Text style={{ marginLeft: 8 }}>导入前清空表</Text>
              </div>
              <div>
                <Text>批量大小:</Text>
                <InputNumber
                  style={{ width: 100, marginLeft: 8 }}
                  min={1}
                  max={5000}
                  value={batchSize}
                  onChange={(v) => setBatchSize(v || 500)}
                />
                <Text type="secondary" style={{ marginLeft: 8 }}>行/批</Text>
              </div>
            </Space>
          </div>
        );

      case 4: // 执行结果
        if (!importResult) {
          return (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <FileExcelOutlined style={{ fontSize: 48, color: '#1890ff' }} />
              <p style={{ marginTop: 16 }}>准备导入数据...</p>
              <p><Text type="secondary">{detectResult?.rowCount} 行 → {targetDatabase}.{targetTable}</Text></p>
            </div>
          );
        }
        return (
          <div style={{ padding: 24 }}>
            <Alert
              type={importResult.success ? 'success' : 'warning'}
              message={importResult.success ? '导入成功' : '导入完成，有错误'}
              description={`${importResult.importedRows} / ${importResult.totalRows} 行导入成功，耗时 ${importResult.duration}ms`}
              showIcon
            />
            {importResult.errors.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Title level={5}>错误详情</Title>
                <Table
                  columns={[
                    { title: '行号', dataIndex: 'row', key: 'row', width: 80 },
                    { title: '错误', dataIndex: 'error', key: 'error' },
                  ]}
                  dataSource={importResult.errors.slice(0, 50).map((e, i) => ({ ...e, key: i }))}
                  size="small"
                  pagination={false}
                />
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const canNext = () => {
    if (current === 0) return !!fileContent;
    if (current === 1) return !!detectResult;
    if (current === 2) return !!targetDatabase && !!targetTable;
    if (current === 3) return true;
    return false;
  };

  return (
    <Modal
      title={<Space><FileExcelOutlined /> 导入 CSV 文件</Space>}
      open={open}
      onCancel={handleClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={handleClose}>关闭</Button>,
        current > 0 && current < 4 && <Button key="prev" onClick={handlePrev}>上一步</Button>,
        current < 3 && <Button key="next" type="primary" onClick={handleNext} disabled={!canNext()}>下一步</Button>,
        current === 3 && <Button key="execute" type="primary" loading={loading} onClick={handleExecute}>执行导入</Button>,
        current === 4 && importResult?.success && <Button key="done" type="primary" onClick={handleClose}>完成</Button>,
      ]}
    >
      <Steps
        current={current}
        size="small"
        items={steps.map(s => ({ title: s }))}
        style={{ marginBottom: 16 }}
      />
      {renderStep()}
    </Modal>
  );
};

export default ImportWizard;
