/**
 * UpdateCheck — 版本更新检查组件 (Sprint 4)
 */

import React, { useEffect, useState } from 'react';
import { Modal, Spin, Tag, Space, Typography, Button, Result } from 'antd';
import { CloudDownloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { updateApi, UpdateCheckResult } from '@/lib/api';

const { Text, Paragraph } = Typography;

interface UpdateCheckProps {
  open: boolean;
  onClose: () => void;
}

const UpdateCheck: React.FC<UpdateCheckProps> = ({ open, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setError(null);
      setResult(null);
      updateApi.check()
        .then(data => setResult(data))
        .catch(err => setError(err.message || '检查更新失败'))
        .finally(() => setLoading(false));
    }
  }, [open]);

  return (
    <Modal
      title={<><CloudDownloadOutlined /> 检查更新</>}
      open={open}
      onCancel={onClose}
      footer={
        result?.hasUpdate ? (
          <Space>
            <Button onClick={onClose}>稍后</Button>
            <Button
              type="primary"
              icon={<CloudDownloadOutlined />}
              onClick={() => {
                if (result?.releaseUrl) {
                  window.open(result.releaseUrl, '_blank');
                }
              }}
            >
              前往下载
            </Button>
          </Space>
        ) : (
          <Button onClick={onClose}>关闭</Button>
        )
      }
      width={500}
      destroyOnClose
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">正在检查更新...</Text>
          </div>
        </div>
      )}

      {error && (
        <Result
          status="error"
          title="检查更新失败"
          subTitle={error}
        />
      )}

      {result && !loading && !error && (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Text>当前版本:</Text>
            <Tag color="blue">v{result.currentVersion}</Tag>
          </Space>

          {result.hasUpdate ? (
            <>
              <Result
                status="info"
                icon={<CloudDownloadOutlined />}
                title="发现新版本"
                subTitle={
                  <Space>
                    <Text>最新版本:</Text>
                    <Tag color="green" style={{ fontSize: 16 }}>v{result.latestVersion}</Tag>
                  </Space>
                }
              />
              {result.releaseNotes && (
                <div style={{ maxHeight: 200, overflow: 'auto', background: '#fafafa', padding: 12, borderRadius: 6 }}>
                  <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 13 }}>
                    {result.releaseNotes}
                  </Paragraph>
                </div>
              )}
            </>
          ) : (
            <Result
              status="success"
              icon={<CheckCircleOutlined />}
              title="已是最新版本"
              subTitle={`当前版本 v${result.currentVersion} 已是最新`}
            />
          )}
        </div>
      )}
    </Modal>
  );
};

export default UpdateCheck;
