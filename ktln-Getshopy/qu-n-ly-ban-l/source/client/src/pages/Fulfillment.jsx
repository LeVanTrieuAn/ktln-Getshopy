import { useState, useEffect } from 'react';
import { Card, Table, Tag, Typography, Row, Col, Progress } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

const { Text } = Typography;

export default function Fulfillment() {
  const { t, isDark } = useApp();
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [items, sum] = await Promise.all([
          api.fulfillment(),
          api.slaSummary()
        ]);
        setData(items);
        setSummary(sum);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const textColor = isDark ? '#fff' : '#1a1a2e';
  const subColor = isDark ? 'rgba(255,255,255,0.5)' : '#888';
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#fff';

  const columns = [
    { title: 'Mã đơn', dataIndex: 'order_id', render: v => <Text strong style={{ color: textColor }}>{v}</Text> },
    { title: 'Chi nhánh', dataIndex: 'branch_name', render: v => <Text style={{ color: subColor }}>{v}</Text> },
    { title: 'Sản phẩm', dataIndex: 'product_name', render: v => <Text style={{ color: subColor }}>{v}</Text> },
    { title: 'Thời gian đặt', dataIndex: 'order_date', render: v => <Text style={{ color: subColor }}>{dayjs(v).format('DD/MM HH:mm')}</Text> },
    { title: 'Thời gian XL', dataIndex: 'hours_elapsed', render: v => <Text style={{ color: textColor }}>{Math.max(0, v || 0)}h</Text> },
    {
      title: 'Trạng thái', dataIndex: 'sla_status',
      render: (v) => {
        if (v === 'ON_TIME') return <Tag color="success" icon={<CheckCircleOutlined />}>Đúng hạn</Tag>;
        if (v === 'BREACHED') return <Tag color="error" icon={<ExclamationCircleOutlined />}>Trễ hẹn</Tag>;
        return <Tag color="warning" icon={<ClockCircleOutlined />}>Đang xử lý</Tag>;
      }
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: textColor, fontSize: 22, fontWeight: 700 }}>
          {t('fulfillment.title')}
        </h2>
        <p style={{ margin: '4px 0 0', color: subColor, fontSize: 13 }}>
          Theo dõi tiến độ xuất kho và cảnh báo vi phạm thời gian cam kết (SLA)
        </p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card style={{ background: cardBg, borderColor: isDark ? '#333' : '#f0f0f0', borderRadius: 12 }}>
            <div style={{ color: subColor }}>{t('fulfillment.on_time_rate')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
              <Progress type="circle" percent={summary.on_time_rate || 0} size={60} strokeColor="#52c41a" />
              <span style={{ fontSize: 24, fontWeight: 'bold', color: textColor }}>{summary.on_time_rate}%</span>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card style={{ background: cardBg, borderColor: isDark ? '#333' : '#f0f0f0', borderRadius: 12 }}>
            <div style={{ color: subColor }}>{t('fulfillment.breach_count')}</div>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#ff4d4f', marginTop: 8 }}>{summary.breach_count || 0}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card style={{ background: cardBg, borderColor: isDark ? '#333' : '#f0f0f0', borderRadius: 12 }}>
            <div style={{ color: subColor }}>{t('fulfillment.avg_hours')}</div>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fa8c16', marginTop: 8 }}>{summary.avg_fulfillment_hours || 0} <span style={{ fontSize: 16 }}>giờ</span></div>
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 16, background: cardBg, border: isDark ? '1px solid #333' : '1px solid #f0f0f0' }} styles={{ body: {} }}>
        <Table columns={columns} dataSource={data} rowKey="order_id" loading={loading} pagination={false} style={{ background: 'transparent' }} />
      </Card>
    </div>
  );
}
