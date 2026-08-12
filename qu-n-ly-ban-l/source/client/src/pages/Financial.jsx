import { useState, useEffect } from 'react';
import { Card, Table, Tag, Row, Col, Select, DatePicker, Typography, Space } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, DollarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

const { Text } = Typography;

export default function Financial() {
  const { t, isDark } = useApp();
  const [summary, setSummary] = useState({ total_in: 0, total_out: 0, net_cash: 0 });
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [branch, setBranch] = useState('ALL');
  const [dates, setDates] = useState([dayjs().subtract(7, 'day'), dayjs()]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = {
          branch_id: branch,
          date_from: dates?.[0]?.format('YYYY-MM-DD'),
          date_to: dates?.[1]?.format('YYYY-MM-DD'),
        };
        const [sumRes, vouchRes] = await Promise.all([
          api.financialSummary(params),
          api.financialVouchers(params)
        ]);
        setSummary(sumRes);
        setVouchers(vouchRes);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [branch, dates]);

  const textColor = isDark ? '#fff' : '#1a1a2e';
  const subColor = isDark ? 'rgba(255,255,255,0.5)' : '#888';

  const fmt = (v) => v ? v.toLocaleString('vi-VN') : '0';

  const columns = [
    { title: 'Mã Phiếu', dataIndex: 'voucher_id', render: v => <Text strong style={{ color: textColor }}>{v}</Text> },
    { title: 'Loại', dataIndex: 'type', render: v => v === 'IN' ? <Tag color="success">Phiếu Thu</Tag> : <Tag color="error">Phiếu Chi</Tag> },
    { title: 'Danh mục', dataIndex: 'category', render: v => <Text style={{ color: subColor }}>{v}</Text> },
    { title: 'Số tiền', dataIndex: 'amount', align: 'right', render: (v, r) => <Text strong style={{ color: r.type === 'IN' ? '#10b981' : '#ef4444' }}>{r.type === 'IN' ? '+' : '-'}{fmt(v)}</Text> },
    { title: 'Chi nhánh', dataIndex: 'branch_id', render: v => <Text style={{ color: subColor }}>{v}</Text> },
    { title: 'Mã Đơn (Nếu có)', dataIndex: 'order_id', render: v => <Text style={{ color: subColor }}>{v || '-'}</Text> },
    { title: 'Ngày chứng từ', dataIndex: 'voucher_date', render: v => <Text style={{ color: subColor }}>{dayjs(v).format('DD/MM/YYYY HH:mm')}</Text> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, color: textColor, fontSize: 22, fontWeight: 700 }}>Dòng Tiền Tài Chính</h2>
          <p style={{ margin: '4px 0 0', color: subColor, fontSize: 13 }}>Sổ phụ thu chi tổng hợp từ toàn bộ hệ thống chi nhánh</p>
        </div>
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
          <DatePicker.RangePicker value={dates} onChange={setDates} />
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card className="glass-panel glass-panel-elevated">
            <div style={{ color: subColor, display: 'flex', alignItems: 'center', gap: 8 }}><ArrowUpOutlined style={{ color: '#10b981' }}/> Tổng Thu (Vào)</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#10b981', marginTop: 8 }}>{fmt(summary.total_in)} VNĐ</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className="glass-panel glass-panel-elevated">
            <div style={{ color: subColor, display: 'flex', alignItems: 'center', gap: 8 }}><ArrowDownOutlined style={{ color: '#ef4444' }}/> Tổng Chi (Ra)</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ef4444', marginTop: 8 }}>{fmt(summary.total_out)} VNĐ</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className="glass-panel glass-panel-elevated" style={{ background: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5', border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #d1fae5' }}>
            <div style={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#047857', display: 'flex', alignItems: 'center', gap: 8 }}><DollarOutlined /> Dòng Tiền Thuần</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: summary.net_cash >= 0 ? '#10b981' : '#ef4444', marginTop: 8 }}>
              {summary.net_cash >= 0 ? '+' : ''}{fmt(summary.net_cash)} VNĐ
            </div>
          </Card>
        </Col>
      </Row>

      <Card className="glass-panel" styles={{ body: {} }}>
        <Table
          columns={columns}
          dataSource={vouchers}
          rowKey="voucher_id"
          loading={loading}
          pagination={{ pageSize: 15 }}
          style={{ background: 'transparent' }}
        />
      </Card>
    </div>
  );
}
