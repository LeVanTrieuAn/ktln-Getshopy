import { useState, useEffect } from 'react';
import { Card, List, Tag, Typography, Space, Button, Badge } from 'antd';
import { AlertOutlined, BellOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

const { Text, Title } = Typography;

export default function Alerts() {
  const { t, isDark } = useApp();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.activeAlerts();
        setAlerts(res);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const textColor = isDark ? '#fff' : '#1a1a2e';
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#fff';

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: textColor, fontSize: 22, fontWeight: 700 }}>
          {t('alerts.title')}
        </h2>
        <p style={{ margin: '4px 0 0', color: isDark ? 'rgba(255,255,255,0.5)' : '#888', fontSize: 13 }}>
          Hệ thống phát hiện gian lận và cảnh báo bất thường thời gian thực
        </p>
      </div>

      <Card style={{ borderRadius: 16, background: cardBg, border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f0f0f0' }}>
        <List
          loading={loading}
          dataSource={alerts}
          renderItem={(item) => {
            let color = 'default';
            if (item.severity === 'CRITICAL') color = 'darkred';
            if (item.severity === 'HIGH') color = 'red';
            if (item.severity === 'MEDIUM') color = 'orange';
            if (item.severity === 'LOW') color = 'blue';

            return (
              <List.Item
                actions={[<Button key="ack" type="primary" size="small">{t('alerts.acknowledge')}</Button>]}
                style={{ padding: '16px 0', borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f0f0f0' }}
              >
                <List.Item.Meta
                  avatar={<Badge dot color={color}><AlertOutlined style={{ fontSize: 24, color }} /></Badge>}
                  title={<Text strong style={{ color: textColor }}>{item.message}</Text>}
                  description={
                    <Space size="large">
                      <Tag color={color}>{t(`alerts.severity.${item.severity}`)}</Tag>
                      <Text type="secondary" style={{ color: isDark ? '#aaa' : '#666' }}>{item.rule_name}</Text>
                      <Text type="secondary" style={{ color: isDark ? '#aaa' : '#666' }}>{dayjs(item.triggered_at).format('DD/MM/YYYY HH:mm:ss')}</Text>
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
          locale={{ emptyText: t('alerts.no_alerts') }}
        />
      </Card>
    </div>
  );
}
