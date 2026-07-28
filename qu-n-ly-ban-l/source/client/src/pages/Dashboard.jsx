import { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Select, DatePicker, Statistic, Tag, Table, Spin, Segmented, Modal, Form, Input, InputNumber, FloatButton, message, Tabs, Cascader, Upload, Space, Button, Slider } from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, ShoppingCartOutlined,
  DollarOutlined, BankOutlined, WarningOutlined, SyncOutlined, PlusOutlined, UploadOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

function fmtVND(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' tr';
  return n?.toLocaleString('vi-VN') || '0';
}

const cityOptions = [
  {
    value: 'Hà Nội', label: 'Hà Nội',
    children: [
      {
        value: 'Quận Ba Đình', label: 'Quận Ba Đình',
        children: [{ value: 'Phường Phúc Xá', label: 'Phường Phúc Xá' }, { value: 'Phường Trúc Bạch', label: 'Phường Trúc Bạch' }],
      },
      {
        value: 'Quận Đống Đa', label: 'Quận Đống Đa',
        children: [{ value: 'Phường Láng Hạ', label: 'Phường Láng Hạ' }, { value: 'Phường Ô Chợ Dừa', label: 'Phường Ô Chợ Dừa' }],
      },
    ],
  },
  {
    value: 'Hồ Chí Minh', label: 'Hồ Chí Minh',
    children: [
      {
        value: 'Quận 1', label: 'Quận 1',
        children: [{ value: 'Phường Bến Nghé', label: 'Phường Bến Nghé' }, { value: 'Phường Bến Thành', label: 'Phường Bến Thành' }],
      },
      {
        value: 'Quận 3', label: 'Quận 3',
        children: [{ value: 'Phường 1', label: 'Phường 1' }, { value: 'Phường 2', label: 'Phường 2' }],
      },
    ],
  },
  {
    value: 'Đà Nẵng', label: 'Đà Nẵng',
    children: [
      {
        value: 'Quận Hải Châu', label: 'Quận Hải Châu',
        children: [{ value: 'Phường Hải Châu I', label: 'Phường Hải Châu I' }, { value: 'Phường Thạch Thang', label: 'Phường Thạch Thang' }],
      },
    ],
  },
];

function KPICard({ title, value, suffix = '', prefix, change, icon, color, loading }) {
  const { isDark } = useApp();
  return (
    <Card
      loading={loading}
      className="glass-panel glass-panel-elevated"
      style={{
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'default',
        height: '100%',
      }}
      styles={{ body: {} }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#888', fontSize: 13, marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: isDark ? '#fff' : '#1a1a2e', lineHeight: 1.2 }}>
            {prefix}{value}{suffix}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, minHeight: 20 }}>
            {change !== undefined && (
              change >= 0
                ? <span style={{ color: '#52c41a' }}><ArrowUpOutlined /> {change}% so với hôm qua</span>
                : <span style={{ color: '#ff4d4f' }}><ArrowDownOutlined /> {Math.abs(change)}% so với hôm qua</span>
            )}
          </div>
        </div>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: `linear-gradient(135deg, ${color}33, ${color}22)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, color: color,
        }}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { t, isDark } = useApp();
  const [branch, setBranch] = useState('ALL');
  const [date, setDate] = useState(dayjs());
  const [kpis, setKpis] = useState(null);
  const [hourData, setHourData] = useState([]);
  const [branchData, setBranchData] = useState([]);
  const [catData, setCatData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartTab, setChartTab] = useState('branch');
  const [dropdownBranches, setDropdownBranches] = useState([{ value: 'ALL', label: 'Tất cả chi nhánh' }]);

  const loadMasterData = useCallback(async () => {
    try {
      const br = await api.b2b.getBranches();
      const uniqueBr = Array.from(new Map(br.map(item => [item.id, item])).values());
      setDropdownBranches([{ value: 'ALL', label: 'Tất cả chi nhánh' }, ...uniqueBr.map(b => ({ value: b.id, label: b.name }))]);
    } catch(e) {}
  }, []);

  useEffect(() => { loadMasterData(); }, [loadMasterData]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dateStr = date.format('YYYY-MM-DD');
      const [k, h, b, c, tr] = await Promise.all([
        api.kpis({ branch_id: branch, date: dateStr }),
        api.revenueByHour({ branch_id: branch, date: dateStr }),
        api.revenueByBranch({ branch_id: branch }),
        api.revenueByCategory({ branch_id: branch }),
        api.revenueTrend({ days: 30, branch_id: branch }),
      ]);
      setKpis(k);
      setHourData(h);
      setBranchData(b);
      setCatData(c);
      setTrendData(tr);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [branch, date]);

  useEffect(() => { load(); }, [load]);

  // WebSocket live update
  useEffect(() => {
    const ws = new WebSocket(import.meta.env.VITE_WS_URL || 'ws://localhost:8080');
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'KPI_UPDATE') {
          setKpis(prev => prev ? { ...prev, revenue_today: msg.data.revenue_today, orders_today: msg.data.orders_today } : prev);
        }
      } catch {}
    };
    ws.onerror = () => {
      // Suppress WebSocket error warning in console
    };
    return () => {
      if (ws.readyState === 1) ws.close();
    };
  }, []);

  const textColor = isDark ? '#fff' : '#1a1a2e';
  const subColor = isDark ? 'rgba(255,255,255,0.5)' : '#888';
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#fff';
  const cardBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f0f0f0';

  // ECharts theme
  const chartBg = 'transparent';
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : '#f0f0f0';

  const hourChartOpt = {
    backgroundColor: chartBg,
    tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}h<br/>💰 ${fmtVND(p[0].value)}<br/>📦 ${p[1]?.value} đơn` },
    legend: { data: ['Doanh thu', 'Đơn hàng'], textStyle: { color: subColor } },
    xAxis: { type: 'category', data: hourData.map(h => h.hour.split(':')[0]), axisLine: { lineStyle: { color: gridColor } }, axisLabel: { color: subColor } },
    yAxis: [
      { type: 'value', axisLabel: { color: subColor, formatter: v => fmtVND(v) }, splitLine: { lineStyle: { color: gridColor } } },
      { type: 'value', axisLabel: { color: subColor }, splitLine: { show: false } },
    ],
    series: [
      {
        name: 'Doanh thu', type: 'bar', data: hourData.map(h => h.revenue), yAxisIndex: 0,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#047857' }] } },
      },
      {
        name: 'Đơn hàng', type: 'line', data: hourData.map(h => h.orders), yAxisIndex: 1,
        smooth: true, symbol: 'circle', symbolSize: 6,
        lineStyle: { color: '#facc15', width: 2 },
        itemStyle: { color: '#facc15' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(250,204,21,0.2)' }, { offset: 1, color: 'rgba(250,204,21,0)' }] } },
      },
    ],
    grid: { left: 16, right: 16, top: 40, bottom: 24, containLabel: true },
  };

  const branchChartOpt = {
    backgroundColor: chartBg,
    tooltip: { trigger: 'axis', formatter: p => `${p[0].name}<br/>💰 ${fmtVND(p[0].value)}` },
    xAxis: { type: 'value', axisLabel: { color: subColor, formatter: v => fmtVND(v) }, splitLine: { lineStyle: { color: gridColor } } },
    yAxis: { type: 'category', data: branchData.slice(0, 7).map(b => b.branch_name.split(' - ')[1] || b.branch_name), axisLabel: { color: subColor } },
    series: [{
      type: 'bar', data: branchData.slice(0, 7).map(b => b.revenue),
      itemStyle: { borderRadius: [0, 6, 6, 0], color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#facc15' }] } },
      label: { show: true, position: 'right', color: subColor, formatter: p => fmtVND(p.value) },
    }],
    grid: { left: 16, right: 80, top: 16, bottom: 16, containLabel: true },
  };

  const catChartOpt = {
    backgroundColor: chartBg,
    tooltip: { trigger: 'item', formatter: p => `${p.name}<br/>💰 ${fmtVND(p.value)} (${p.percent}%)` },
    legend: { orient: 'vertical', right: 10, top: 'middle', textStyle: { color: subColor } },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['40%', '50%'],
      data: catData.map(c => ({ name: c.category, value: c.revenue })),
      label: { show: false },
      emphasis: { scale: true, scaleSize: 8 },
      itemStyle: { borderRadius: 6, borderWidth: 2, borderColor: isDark ? '#111' : '#fff' },
    }],
  };

  const trendChartOpt = {
    backgroundColor: chartBg,
    tooltip: { trigger: 'axis', formatter: p => `${p[0].name}<br/>💰 ${fmtVND(p[0].value)}` },
    xAxis: { type: 'category', data: trendData.map(d => d.date?.slice(5)), axisLabel: { color: subColor, interval: 4 }, axisLine: { lineStyle: { color: gridColor } } },
    yAxis: { type: 'value', axisLabel: { color: subColor, formatter: v => fmtVND(v) }, splitLine: { lineStyle: { color: gridColor } } },
    series: [{
      type: 'line', data: trendData.map(d => d.revenue), smooth: true,
      lineStyle: { color: '#10b981', width: 3 },
      symbol: 'none',
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(16,185,129,0.3)' }, { offset: 1, color: 'rgba(16,185,129,0)' }] } },
    }],
    grid: { left: 16, right: 16, top: 16, bottom: 24, containLabel: true },
  };

  const cardStyle = { boxShadow: '0 2px 12px rgba(0,0,0,0.06)' };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, color: textColor, fontSize: 22, fontWeight: 700 }}>
            {t('dashboard.title')}
          </h2>
          <p style={{ margin: '4px 0 0', color: subColor, fontSize: 13 }}>
            Dữ liệu cập nhật real-time qua CDC Kafka Pipeline
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#52c41a', marginLeft: 8, animation: 'pulse 2s infinite' }} />
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Select
            value={branch}
            onChange={setBranch}
            style={{ width: 200 }}
            options={dropdownBranches}
          />
          <DatePicker
            value={date}
            onChange={d => d && setDate(d)}
            allowClear={false}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            loading={loading} title={t('dashboard.revenue_today')}
            value={fmtVND(kpis?.revenue_today)} change={kpis?.revenue_vs_yesterday_pct}
            icon={<DollarOutlined />} color="#10b981"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            loading={loading} title={t('dashboard.orders_today')}
            value={kpis?.orders_today?.toLocaleString()} suffix=" đơn"
            icon={<ShoppingCartOutlined />} color="#52c41a"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            loading={loading} title={t('dashboard.cash_collected')}
            value={fmtVND(kpis?.cash_collected)}
            icon={<BankOutlined />} color="#facc15"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            loading={loading} title={t('dashboard.void_rate')}
            value={kpis?.void_rate} suffix="%"
            icon={<WarningOutlined />} color={kpis?.void_rate > 10 ? '#ff4d4f' : '#13c2c2'}
          />
        </Col>
      </Row>

      {/* Secondary KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card className="glass-panel glass-panel-elevated" style={cardStyle} styles={{ body: {} }}>
            <Statistic
              title={<span style={{ color: subColor }}>{t('dashboard.avg_order')}</span>}
              value={kpis?.avg_order_value ? Math.round(kpis.avg_order_value / 1000) : 0}
              suffix=" nghìn đ"
              valueStyle={{ color: textColor, fontWeight: 700 }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="glass-panel glass-panel-elevated" style={cardStyle} styles={{ body: {} }}>
            <Statistic
              title={<span style={{ color: subColor }}>{t('dashboard.net_cash')}</span>}
              value={fmtVND(kpis?.net_cash)}
              valueStyle={{ color: kpis?.net_cash > 0 ? '#10b981' : '#ff4d4f', fontWeight: 700 }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="glass-panel glass-panel-elevated" style={cardStyle} styles={{ body: {} }}>
            <Statistic
              title={<span style={{ color: subColor }}>{t('dashboard.pending_recon')}</span>}
              value={kpis?.pending_recon}
              suffix=" hóa đơn"
              valueStyle={{ color: kpis?.pending_recon > 50 ? '#facc15' : textColor, fontWeight: 700 }}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* Revenue by Hour */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24}>
          <Card
            title={<span style={{ color: textColor, fontWeight: 600 }}>{t('dashboard.revenue_by_hour')}</span>}
            extra={<Tag color="green" icon={<SyncOutlined spin />}>Live</Tag>}
            className="glass-panel"
            style={cardStyle}
            styles={{ body: {} }}
          >
            {loading ? <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>
              : <ReactECharts option={hourChartOpt} style={{ height: 280 }} />}
          </Card>
        </Col>
      </Row>

      {/* Branch + Category + Trend */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={<span style={{ color: textColor, fontWeight: 600 }}>Phân tích chi nhánh & danh mục</span>}
            extra={
              <Segmented
                value={chartTab}
                onChange={setChartTab}
                options={[{ label: 'Chi nhánh', value: 'branch' }, { label: 'Danh mục', value: 'category' }, { label: 'Xu hướng', value: 'trend' }]}
                size="small"
              />
            }
            className="glass-panel"
            style={cardStyle}
            styles={{ body: {} }}
          >
            {loading ? <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div> : (
              <>
                {chartTab === 'branch' && <ReactECharts option={branchChartOpt} style={{ height: 280 }} />}
                {chartTab === 'category' && <ReactECharts option={catChartOpt} style={{ height: 280 }} />}
                {chartTab === 'trend' && <ReactECharts option={trendChartOpt} style={{ height: 280 }} />}
              </>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={<span style={{ color: textColor, fontWeight: 600 }}>Top chi nhánh</span>}
            className="glass-panel"
            style={{ ...cardStyle, height: '100%' }}
            styles={{ body: {} }}
          >
            {loading ? <Spin style={{ padding: 24 }} /> : (
              <Table
                size="small"
                dataSource={branchData.slice(0, 7)}
                rowKey="branch_id"
                pagination={false}
                style={{ background: 'transparent' }}
                columns={[
                  { title: '#', dataIndex: 'rank', width: 36, render: v => <span style={{ color: v <= 3 ? '#facc15' : subColor, fontWeight: v <= 3 ? 700 : 400 }}>{v}</span> },
                  { title: 'Chi nhánh', dataIndex: 'branch_name', render: v => <span style={{ color: textColor, fontSize: 12 }}>{v.split(' - ').pop()}</span> },
                  { title: 'Doanh thu', dataIndex: 'revenue', align: 'right', render: v => <span style={{ color: '#10b981', fontWeight: 600 }}>{fmtVND(v)}</span> },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
