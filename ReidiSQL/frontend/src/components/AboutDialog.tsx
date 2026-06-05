/**
 * AboutDialog — 关于对话框 (Sprint 5)
 */

import React, { useEffect, useState } from 'react';
import { Modal, Typography, Space, Divider, Tag, Spin } from 'antd';
import { GithubOutlined } from '@ant-design/icons';
import api from '@/lib/api';

const { Title, Text, Paragraph } = Typography;

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

const TECH_STACK = [
  { name: 'Tauri 2.x', color: 'orange', desc: '桌面应用框架' },
  { name: 'React 18', color: 'blue', desc: 'UI 框架' },
  { name: 'TypeScript', color: 'geekblue', desc: '类型安全' },
  { name: 'Ant Design 5', color: 'cyan', desc: 'UI 组件库' },
  { name: 'Monaco Editor', color: 'purple', desc: 'SQL 编辑器' },
  { name: 'AG Grid', color: 'green', desc: '数据网格' },
  { name: 'Express', color: 'magenta', desc: 'Node.js 后端' },
  { name: 'mysql2 / pg / sqlite3', color: 'gold', desc: '数据库驱动' },
  { name: 'Zustand', color: 'volcano', desc: '状态管理' },
  { name: 'Vite', color: 'lime', desc: '构建工具' },
];

const AboutDialog: React.FC<AboutDialogProps> = ({ open, onClose }) => {
  const [version, setVersion] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      api.get<{ version: string }>('/health')
        .then(r => setVersion(r.data.version))
        .catch(() => setVersion('unknown'))
        .finally(() => setLoading(false));
    }
  }, [open]);

  return (
    <Modal
      title="关于 ReidiSQL"
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      centered
    >
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        <Title level={2} style={{ margin: 0 }}>ReidiSQL</Title>
        <Paragraph type="secondary" style={{ marginBottom: 4 }}>
          现代化跨平台数据库管理工具
        </Paragraph>
        {loading ? <Spin size="small" /> : <Tag color="blue" style={{ fontSize: 14 }}>v{version}</Tag>}
      </div>

      <Divider style={{ margin: '8px 0' }} />

      <Paragraph strong style={{ marginBottom: 8 }}>技术栈</Paragraph>
      <Space wrap size={[6, 6]}>
        {TECH_STACK.map(t => (
          <Tag key={t.name} color={t.color}>
            {t.name} <Text type="secondary" style={{ fontSize: 11 }}>· {t.desc}</Text>
          </Tag>
        ))}
      </Space>

      <Divider style={{ margin: '12px 0 8px' }} />

      <div style={{ textAlign: 'center' }}>
        <Space>
          <GithubOutlined />
          <a href="https://github.com/your-org/reidisql" target="_blank" rel="noopener noreferrer">
            GitHub Repository
          </a>
        </Space>
      </div>
    </Modal>
  );
};

export default AboutDialog;
