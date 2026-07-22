import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Select, DatePicker, Row, Col, Space, Input, Tooltip, Typography } from 'antd';
import { SearchOutlined, CheckCircleOutlined, SyncOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

const { Text } = Typography;

export default function Reconciliation() {
  const { t, isDark } = useApp();
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ MATCHED: 0, PENDING: 0, MISMATCH: 0 });
  const [loading, setLoading] = useState(false);
  const [branch, setBranch] = useState('ALL');
  const [status, setStatus] = useState('');
  const [dates, setDates] = useState([dayjs().subtract(7, 'day'), dayjs()]);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.reconciliation({
        branch_id: branch,
        status,
        date_from: dates?.[0]?.format('YYYY-MM-DD'),
        date_to: dates?.[1]?.format('YYYY-MM-DD'),
        page,
        page_size: 20
      });
      setData(res.items);
      setSummary(res.summary);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [branch, status, dates, page]);

  useEffect(() => { load(); }, [load]);

  const textColor = isDark ? '#fff' : '#1a1a2e';
  const subColor = isDark ? 'rgba(255,255,255,0.5)' : '#888';
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#fff';
  const cardBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f0f0f0';

  const columns = [
    {
      title: t('recon.order_id'),
      dataIndex: 'order_id',
      key: 'order_id',
      render: (text) => <Text strong style={{ color: isDark ? '#fff' : 'inherit' }}>{text}</Text>,
    },
    {
      title: t('recon.branch'),
      dataIndex: 'branch_name',
      key: 'branch_name',
      render: (text) => <Text style={{ color: subColor, fontSize: 13 }}>{text}</Text>,
    },
    {
      title: t('recon.product'),
      dataIndex: 'product_name',
      key: 'product_name',
      render: (text) => <Text style={{ color: subColor, fontSize: 13 }}>{text}</Text>,
    },
    {
      title: t('recon.sale_amount'),
      dataIndex: 'sale_amount',
      key: 'sale_amount',
      align: 'right',
      render: (val) => <Text style={{ color: textColor }}>{val.toLocaleString('vi-VN')}</Text>,
    },
    {
      title: t('recon.received'),
      dataIndex: 'received_amount',
      key: 'received_amount',
      align: 'right',
      render: (val) => <Text style={{ color: '#52c41a' }}>{val.toLocaleString('vi-VN')}</Text>,
    },
    {
      title: t('recon.gap'),
      dataIndex: 'gap',
      key: 'gap',
      align: 'right',
      render: (val) => {
        let color = val === 0 ? subColor : (val > 0 ? '#fa8c16' : '#ff4d4f');
        return <Text strong style={{ color }}>{val.toLocaleString('vi-VN')}</Text>;
      },
    },
    {
      title: t('recon.status'),
      key: 'recon_status',
      dataIndex: 'recon_status',
      align: 'center',
      render: (status) => {
        let color = 'default', icon = null, text = '';
        if (status === 'MATCHED') { color = 'success'; icon = <CheckCircleOutlined />; text = t('recon.matched'); }
        if (status === 'PENDING') { color = 'warning'; icon = <SyncOutlined spin />; text = t('recon.pending'); }
        if (status === 'MISMATCH') { color = 'error'; icon = <ExclamationCircleOutlined />; text = t('recon.mismatch'); }
        return <Tag color={color} icon={icon}>{text}</Tag>;
      },
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, color: textColor, fontSize: 22, fontWeight: 700 }}>
            {t('recon.title')}
          </h2>
          <p style={{ margin: '4px 0 0', color: subColor, fontSize: 13 }}>
            Tự động đối soát đơn hàng và phiếu thu từ hệ thống kế toán
          </p>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card style={{ borderRadius: 12, background: isDark ? 'rgba(82, 196, 26, 0.1)' : '#f6ffed', borderColor: isDark ? 'rgba(82, 196, 26, 0.2)' : '#b7eb8f' }}>
            <div style={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#389e0d' }}>{t('recon.matched')}</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>{summary.MATCHED.toLocaleString()}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card style={{ borderRadius: 12, background: isDark ? 'rgba(250, 140, 22, 0.1)' : '#fffbe6', borderColor: isDark ? 'rgba(250, 140, 22, 0.2)' : '#ffe58f' }}>
            <div style={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#d46b08' }}>{t('recon.pending')}</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fa8c16' }}>{summary.PENDING.toLocaleString()}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card style={{ borderRadius: 12, background: isDark ? 'rgba(255, 77, 79, 0.1)' : '#fff1f0', borderColor: isDark ? 'rgba(255, 77, 79, 0.2)' : '#ffa39e' }}>
            <div style={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#cf1322' }}>{t('recon.mismatch')}</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>{summary.MISMATCH.toLocaleString()}</div>
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 16, background: cardBg, border: cardBorder }} styles={{ body: {} }}>
        <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Select
              value={branch}
              onChange={setBranch}
              style={{ width: 180 }}
              options={[
                { value: 'ALL', label: t('common.all_branches') },
                { value: 'HN001', label: 'HN - Hoàn Kiếm' },
                { value: 'HCM002', label: 'HCM - Bình Thạnh' },
              ]}
            />
            <Select
              value={status}
              onChange={setStatus}
              style={{ width: 150 }}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'MATCHED', label: t('recon.matched') },
                { value: 'PENDING', label: t('recon.pending') },
                { value: 'MISMATCH', label: t('recon.mismatch') },
              ]}
            />
            <DatePicker.RangePicker value={dates} onChange={setDates} />
          </Space>
          <Input.Search placeholder={t('common.search')} style={{ width: 200 }} onSearch={() => load()} />
        </Space>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="order_id"
          loading={loading}
          pagination={{ current: page, onChange: setPage, pageSize: 20, total: 500 }}
          style={{ background: 'transparent' }}
        />
      </Card>
    </div>
  );
}
