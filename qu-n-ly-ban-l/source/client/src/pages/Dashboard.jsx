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
import { mono, chartRamp } from '../theme/monochrome';

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

/**
 * Thẻ chỉ số. Không còn tham số `color`: phân cấp bằng độ đậm chữ và khối
 * icon đảo nền, thay vì mỗi thẻ một sắc độ. Biến động so với hôm qua đọc
 * được nhờ HÌNH (mũi tên + viên nhộng đặc/rỗng), không nhờ đỏ-xanh — bảng
 * màu xám thuần thì đỏ và xanh quy về cùng một mức xám, mất luôn ý nghĩa.
 */
function KPICard({ title, value, suffix = '', prefix, change, icon, loading }) {
  const { isDark } = useApp();
  const c = mono(isDark);
  const up = change >= 0;
  return (
    <Card
      loading={loading}
      className="glass-panel glass-panel-elevated am-kpi"
      style={{ height: '100%' }}
      styles={{ body: { padding: 18 } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: c.sub, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
            {title}
          </div>
          <div style={{ fontSize: 27, fontWeight: 700, color: c.fg, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
            {prefix}{value}{suffix}
          </div>
          <div style={{ marginTop: 10, minHeight: 22 }}>
            {change !== undefined && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11.5, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                border: `1px solid ${up ? c.inv : c.line}`,
                background: up ? c.inv : 'transparent',
                color: up ? c.invFg : c.sub,
              }}>
                {up ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                {Math.abs(change)}% so với hôm qua
              </span>
            )}
          </div>
        </div>
        <div style={{
          width: 42, height: 42, flexShrink: 0, borderRadius: 11,
          border: `1px solid ${c.line}`, background: c.soft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: c.fg,
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
    // M-07: Dựa vào window.location để tự động detect host, hoạt động cả local lẫn production
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.hostname}:8080`;
    const ws = new WebSocket(wsHost);
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

  // Đặt tên M chứ không phải c: trong file này `c` đã là biến destructure ở
  // load() và là tham số của catData.map(c => …) — trùng tên sẽ bị che lặng lẽ.
  const M = mono(isDark);
  const ramp = chartRamp(isDark);
  const textColor = M.fg;
  const subColor = M.sub;

  // ECharts — toàn bộ thang xám. Chuỗi dữ liệu phân biệt bằng KIỂU (cột /
  // đường / nét đứt) và bậc xám, không bằng sắc độ.
  const chartBg = 'transparent';
  const gridColor = M.lineSoft;
  const axisLabel = { color: subColor, fontSize: 11 };
  const tipStyle = {
    backgroundColor: M.surface,
    borderColor: M.line,
    textStyle: { color: M.fg, fontSize: 12 },
    extraCssText: 'box-shadow:0 6px 20px rgba(0,0,0,.12);border-radius:10px;',
  };

  const hourChartOpt = {
    backgroundColor: chartBg,
    tooltip: { trigger: 'axis', ...tipStyle, formatter: p => `<b>${p[0].name}:00</b><br/>Doanh thu: ${fmtVND(p[0].value)}<br/>Đơn hàng: ${p[1]?.value ?? 0}` },
    legend: { data: ['Doanh thu', 'Đơn hàng'], textStyle: { color: subColor, fontSize: 11 }, icon: 'roundRect', itemWidth: 12, itemHeight: 8, top: 0 },
    xAxis: {
      type: 'category', data: hourData.map(h => h.hour.split(':')[0]),
      axisLine: { lineStyle: { color: M.line } }, axisTick: { show: false }, axisLabel,
    },
    yAxis: [
      { type: 'value', axisLabel: { ...axisLabel, formatter: v => fmtVND(v) }, splitLine: { lineStyle: { color: gridColor } } },
      { type: 'value', axisLabel, splitLine: { show: false } },
    ],
    series: [
      {
        name: 'Doanh thu', type: 'bar', data: hourData.map(h => h.revenue), yAxisIndex: 0,
        barMaxWidth: 22,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: ramp[0] }, { offset: 1, color: ramp[3] }] },
        },
      },
      {
        // Nét đứt để tách khỏi cột dù cùng thang xám — hai chuỗi trên một
        // biểu đồ mà chỉ khác độ đậm thì in trắng đen sẽ dính vào nhau.
        name: 'Đơn hàng', type: 'line', data: hourData.map(h => h.orders), yAxisIndex: 1,
        smooth: true, symbol: 'circle', symbolSize: 5,
        lineStyle: { color: M.fg, width: 2, type: 'dashed' },
        itemStyle: { color: M.fg, borderColor: M.surface, borderWidth: 1.5 },
      },
    ],
    grid: { left: 16, right: 16, top: 34, bottom: 20, containLabel: true },
  };

  const branchChartOpt = {
    backgroundColor: chartBg,
    tooltip: { trigger: 'axis', ...tipStyle, formatter: p => `<b>${p[0].name}</b><br/>Doanh thu: ${fmtVND(p[0].value)}` },
    xAxis: { type: 'value', axisLabel: { ...axisLabel, formatter: v => fmtVND(v) }, splitLine: { lineStyle: { color: gridColor } } },
    yAxis: {
      type: 'category', data: branchData.slice(0, 7).map(b => b.branch_name.split(' - ')[1] || b.branch_name),
      axisLabel, axisLine: { lineStyle: { color: M.line } }, axisTick: { show: false },
    },
    series: [{
      type: 'bar', barMaxWidth: 20,
      // Hạng cao nhất đậm nhất — thứ hạng đọc được ngay cả khi bỏ nhãn.
      data: branchData.slice(0, 7).map((b, i) => ({
        value: b.revenue,
        itemStyle: { borderRadius: [0, 5, 5, 0], color: ramp[Math.min(i, ramp.length - 1)] },
      })),
      label: { show: true, position: 'right', color: subColor, fontSize: 11, formatter: p => fmtVND(p.value) },
    }],
    grid: { left: 16, right: 76, top: 10, bottom: 10, containLabel: true },
  };

  const catChartOpt = {
    backgroundColor: chartBg,
    color: ramp,
    tooltip: { trigger: 'item', ...tipStyle, formatter: p => `<b>${p.name}</b><br/>${fmtVND(p.value)} · ${p.percent}%` },
    legend: { orient: 'vertical', right: 4, top: 'middle', textStyle: { color: subColor, fontSize: 11 }, icon: 'circle', itemWidth: 8, itemHeight: 8 },
    series: [{
      type: 'pie', radius: ['52%', '74%'], center: ['36%', '50%'],
      data: catData.map(x => ({ name: x.category, value: x.revenue })),
      label: { show: false },
      emphasis: { scale: true, scaleSize: 6, itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,.18)' } },
      itemStyle: { borderRadius: 4, borderWidth: 2, borderColor: M.surface },
    }],
  };

  const trendChartOpt = {
    backgroundColor: chartBg,
    tooltip: { trigger: 'axis', ...tipStyle, formatter: p => `<b>${p[0].name}</b><br/>Doanh thu: ${fmtVND(p[0].value)}` },
    xAxis: {
      type: 'category', data: trendData.map(d => d.date?.slice(5)),
      axisLabel: { ...axisLabel, interval: 4 }, axisLine: { lineStyle: { color: M.line } }, axisTick: { show: false },
    },
    yAxis: { type: 'value', axisLabel: { ...axisLabel, formatter: v => fmtVND(v) }, splitLine: { lineStyle: { color: gridColor } } },
    series: [{
      type: 'line', data: trendData.map(d => d.revenue), smooth: true,
      lineStyle: { color: M.fg, width: 2.5 },
      symbol: 'none',
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: isDark
            ? [{ offset: 0, color: 'rgba(250,250,250,0.22)' }, { offset: 1, color: 'rgba(250,250,250,0)' }]
            : [{ offset: 0, color: 'rgba(10,10,10,0.16)' }, { offset: 1, color: 'rgba(10,10,10,0)' }],
        },
      },
    }],
    grid: { left: 16, right: 16, top: 12, bottom: 20, containLabel: true },
  };

  const cardStyle = {};   // viền + nền do .admin-mono .glass-panel lo, không đổ bóng

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, color: textColor, fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {t('dashboard.title')}
          </h2>
          <p style={{ margin: '5px 0 0', color: subColor, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: M.fg, animation: 'pulse 2s infinite' }} />
            Dữ liệu cập nhật real-time qua CDC Kafka Pipeline
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
            icon={<DollarOutlined />}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            loading={loading} title={t('dashboard.orders_today')}
            value={kpis?.orders_today?.toLocaleString()} suffix=" đơn"
            icon={<ShoppingCartOutlined />}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            loading={loading} title={t('dashboard.cash_collected')}
            value={fmtVND(kpis?.cash_collected)}
            icon={<BankOutlined />}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            loading={loading} title={t('dashboard.void_rate')}
            value={kpis?.void_rate} suffix="%"
            icon={<WarningOutlined />}
          />
        </Col>
      </Row>

      {/* Secondary KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card className="glass-panel glass-panel-elevated" style={cardStyle} styles={{ body: {} }}>
            <Statistic
              title={<span style={{ color: subColor, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t('dashboard.avg_order')}</span>}
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
              title={<span style={{ color: subColor, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t('dashboard.net_cash')}</span>}
              value={fmtVND(kpis?.net_cash)}
              valueStyle={{ color: kpis?.net_cash >= 0 ? textColor : M.danger, fontWeight: 700 }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="glass-panel glass-panel-elevated" style={cardStyle} styles={{ body: {} }}>
            <Statistic
              title={<span style={{ color: subColor, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t('dashboard.pending_recon')}</span>}
              value={kpis?.pending_recon}
              suffix=" hóa đơn"
              valueStyle={{ color: textColor, fontWeight: 700 }}
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
            extra={
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600,
                letterSpacing: '0.08em', padding: '3px 10px', borderRadius: 20,
                border: `1px solid ${M.line}`, color: subColor,
              }}>
                <SyncOutlined spin style={{ fontSize: 10 }} /> LIVE
              </span>
            }
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
                rowKey={(r, i) => `${r.branch_id}-${r.branch_name}-${i}`}
                pagination={false}
                style={{ background: 'transparent' }}
                columns={[
                  {
                    title: '#', dataIndex: 'rank', width: 44,
                    // Ba hạng đầu: huy hiệu đảo nền. Trước đây dùng chữ vàng —
                    // thang xám thì vàng tụt xuống gần bằng xám nhạt, mất nhấn.
                    render: v => (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: v <= 3 ? M.inv : 'transparent',
                        color: v <= 3 ? M.invFg : M.mute,
                        border: v <= 3 ? 'none' : `1px solid ${M.line}`,
                      }}>{v}</span>
                    ),
                  },
                  { title: 'Chi nhánh', dataIndex: 'branch_name', render: v => <span style={{ color: textColor, fontSize: 12.5 }}>{v.split(' - ').pop()}</span> },
                  { title: 'Doanh thu', dataIndex: 'revenue', align: 'right', render: v => <span style={{ color: textColor, fontWeight: 700, fontSize: 12.5 }}>{fmtVND(v)}</span> },
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
