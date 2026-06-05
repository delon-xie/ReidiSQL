/**
 * Preferences — 偏好设置组件 (Sprint 4)
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal, Tabs, Form, InputNumber, Select, Switch, Button,
  message, Spin, ColorPicker, Space,
} from 'antd';
import { preferencesApi, AppPreferences } from '@/lib/api';

interface PreferencesProps {
  open: boolean;
  onClose: () => void;
}

const Preferences: React.FC<PreferencesProps> = ({ open, onClose }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const prefs = await preferencesApi.get();
      // Flatten nested structure for form
      form.setFieldsValue({
        // General
        language: prefs.general?.language || 'zh-CN',
        theme: prefs.general?.theme || 'system',
        autoReconnect: prefs.general?.autoReconnect ?? true,
        checkUpdates: prefs.general?.checkUpdates ?? true,
        // Editor
        fontSize: prefs.editor?.fontSize || 14,
        tabSize: prefs.editor?.tabSize || 2,
        autoUpperCase: prefs.editor?.autoUpperCase ?? false,
        completionDelay: prefs.editor?.completionDelay || 300,
        // Grid
        gridFontSize: prefs.grid?.fontSize || 13,
        maxColumnWidth: prefs.grid?.maxColumnWidth || 300,
        maxRows: prefs.grid?.maxRows || 1000,
        nullBackground: prefs.grid?.nullBackground || '#f5f5f5',
        // Logging
        logMaxLines: prefs.logging?.maxLines || 5000,
        logToFile: prefs.logging?.logToFile ?? false,
      });
    } catch (err: any) {
      message.error(`加载偏好设置失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    if (open) loadPreferences();
  }, [open, loadPreferences]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = form.getFieldsValue();
      const prefs: Partial<AppPreferences> = {
        general: {
          language: values.language,
          theme: values.theme,
          autoReconnect: values.autoReconnect,
          checkUpdates: values.checkUpdates,
        },
        editor: {
          fontSize: values.fontSize,
          tabSize: values.tabSize,
          autoUpperCase: values.autoUpperCase,
          completionDelay: values.completionDelay,
        },
        grid: {
          fontSize: values.gridFontSize,
          maxColumnWidth: values.maxColumnWidth,
          maxRows: values.maxRows,
          nullBackground: values.nullBackground,
        },
        logging: {
          maxLines: values.logMaxLines,
          logToFile: values.logToFile,
        },
      };
      await preferencesApi.update(prefs);
      message.success('偏好设置已保存');
    } catch (err: any) {
      message.error(`保存失败: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Modal.confirm({
      title: '重置为默认设置？',
      content: '这将恢复所有偏好设置到默认值。',
      onOk: async () => {
        try {
          await preferencesApi.update({});
          await loadPreferences();
          message.success('已重置为默认设置');
        } catch (err: any) {
          message.error(`重置失败: ${err.message}`);
        }
      },
    });
  };

  return (
    <Modal
      title="偏好设置"
      open={open}
      onCancel={onClose}
      width={650}
      destroyOnClose
      footer={
        <Space>
          <Button onClick={handleReset}>重置默认</Button>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>保存</Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" size="small">
          <Tabs items={[
            {
              key: 'general',
              label: '通用',
              children: (
                <>
                  <Form.Item name="language" label="语言">
                    <Select options={[
                      { label: '简体中文', value: 'zh-CN' },
                      { label: 'English', value: 'en-US' },
                    ]} />
                  </Form.Item>
                  <Form.Item name="theme" label="主题">
                    <Select options={[
                      { label: '跟随系统', value: 'system' },
                      { label: '浅色', value: 'light' },
                      { label: '深色', value: 'dark' },
                    ]} />
                  </Form.Item>
                  <Form.Item name="autoReconnect" label="自动重连" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name="checkUpdates" label="启动时检查更新" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </>
              ),
            },
            {
              key: 'editor',
              label: '编辑器',
              children: (
                <>
                  <Form.Item name="fontSize" label="字体大小 (px)">
                    <InputNumber min={10} max={24} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="tabSize" label="Tab 宽度">
                    <InputNumber min={1} max={8} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="autoUpperCase" label="SQL 关键字自动大写" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name="completionDelay" label="代码补全延迟 (ms)">
                    <InputNumber min={100} max={2000} step={50} style={{ width: '100%' }} />
                  </Form.Item>
                </>
              ),
            },
            {
              key: 'grid',
              label: '数据网格',
              children: (
                <>
                  <Form.Item name="gridFontSize" label="字体大小 (px)">
                    <InputNumber min={10} max={20} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="maxColumnWidth" label="最大列宽 (px)">
                    <InputNumber min={100} max={1000} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="maxRows" label="最大显示行数">
                    <InputNumber min={100} max={100000} step={100} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="nullBackground" label="NULL 值背景色">
                    <ColorPicker format="hex" showText />
                  </Form.Item>
                </>
              ),
            },
            {
              key: 'logging',
              label: '日志',
              children: (
                <>
                  <Form.Item name="logMaxLines" label="最大日志行数">
                    <InputNumber min={500} max={50000} step={500} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="logToFile" label="日志写入文件" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </>
              ),
            },
          ]} />
        </Form>
      </Spin>
    </Modal>
  );
};

export default Preferences;
