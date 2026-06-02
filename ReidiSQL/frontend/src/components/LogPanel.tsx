/**
 * 日志面板 — 底部日志查看器
 */

import React, { useRef, useEffect } from 'react';
import { Tag, Button, Empty } from 'antd';
import { ClearOutlined } from '@ant-design/icons';
import { useLogStore } from '@/stores/logStore';
import dayjs from 'dayjs';

const LEVEL_COLORS: Record<string, string> = {
  info: 'blue',
  warn: 'orange',
  error: 'red',
  debug: 'default',
  success: 'green',
};

const LogPanel: React.FC = () => {
  const { messages, clearMessages, connected } = useLogStore();
  const listRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid #f0f0f0', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#666' }}>
          日志 ({messages.length})
        </span>
        <Tag color={connected ? 'green' : 'default'} style={{ fontSize: 11 }}>
          {connected ? 'WS Connected' : 'WS Disconnected'}
        </Tag>
        <div style={{ marginLeft: 'auto' }}>
          <Button type="text" size="small" icon={<ClearOutlined />} onClick={clearMessages}>
            清空
          </Button>
        </div>
      </div>

      {/* 日志列表 */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: 12,
          lineHeight: '20px',
          padding: '4px 0',
          backgroundColor: '#fafafa',
        }}
      >
        {messages.length === 0 ? (
          <Empty description="暂无日志" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 20 }} />
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                padding: '1px 8px',
                borderBottom: '1px solid #f5f5f5',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <span style={{ color: '#999', flexShrink: 0, width: 70 }}>
                {dayjs(msg.timestamp).format('HH:mm:ss')}
              </span>
              <Tag
                color={LEVEL_COLORS[msg.level] || 'default'}
                style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: '2px 0' }}
              >
                {msg.level.toUpperCase()}
              </Tag>
              {msg.source && (
                <span style={{ color: '#8c8c8c', flexShrink: 0 }}>[{msg.source}]</span>
              )}
              <span style={{ wordBreak: 'break-all' }}>{msg.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogPanel;
