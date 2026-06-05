/**
 * StatusBar — 底部状态栏 (Sprint 5)
 */

import React, { useMemo } from 'react';
import { Tag } from 'antd';
import {
  ApiOutlined, DatabaseOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore } from '@/stores/queryStore';

const StatusBar: React.FC = () => {
  const { connections, activeConnectionId, activeDatabase } = useConnectionStore();
  const { tabs, activeTabId } = useQueryStore();

  const activeConn = useMemo(
    () => connections.find(c => c.id === activeConnectionId),
    [connections, activeConnectionId]
  );

  const activeTab = tabs.find(t => t.id === activeTabId);
  const result = activeTab?.result;
  const duration = result?.duration;

  const connName = activeConn?.name || '未连接';
  const connType = activeConn?.type || '';

  return (
    <div style={{
      height: 28,
      background: activeConnectionId ? '#001529' : '#f0f0f0',
      color: activeConnectionId ? '#ffffffd9' : '#666',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 16,
      fontSize: 12,
      borderTop: '1px solid #d9d9d9',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      <span>
        <ApiOutlined style={{ marginRight: 4 }} />
        {connName}
        {connType && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{connType}</Tag>}
      </span>

      {activeDatabase && (
        <span>
          <DatabaseOutlined style={{ marginRight: 4 }} />
          {activeDatabase}
        </span>
      )}

      <div style={{ flex: 1 }} />

      {duration !== undefined && (
        <span>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {duration}ms
          {result?.rowCount !== undefined && ` | ${result.rowCount} 行`}
        </span>
      )}

      <span style={{ opacity: 0.6 }}>ReidiSQL v0.5.0</span>
    </div>
  );
};

export default StatusBar;
