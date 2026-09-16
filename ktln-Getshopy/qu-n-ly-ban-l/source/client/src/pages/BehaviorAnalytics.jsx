import { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Statistic, Table, Spin, Tag, Segmented, Select, Empty, Progress, Tooltip } from 'antd';
import {
  EyeOutlined, ShoppingCartOutlined, DollarOutlined, UserOutlined,
  SearchOutlined, RiseOutlined, MobileOutlined, DesktopOutlined,
  TabletOutlined, FunnelPlotOutlined, RobotOutlined, HeartOutlined,
  ArrowUpOutlined, ArrowDownOutlined, ThunderboltOutlined, ClockCircleOutlined,
  FireOutlined, BarChartOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n?.toLocaleString('vi-VN') || '0';
}

// ── KPI Card ─────────────────────────────────────────────────────
function MetricCard({ title, value, suffix = '', icon, color, change, subtext, loading, isDark }) {
  return (
    <Card
      loading={loading}
      className="glass-panel glass-panel-elevated"
      style={{ height: '100%', transition: 'transform 0.2s', cursor: 'default' }}
      styles={{ body: { padding: '20px 24px' } }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#888', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: isDark ? '#fff' : '#111', lineHeight: 1.2 }}>
            {value}{suffix && <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 2 }}>{suffix}</span>}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, minHeight: 18 }}>
            {change !== undefined && change !== null && (
              <span style={{ color: change >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                {change >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(change)}%
                <span style={{ color: isDark ? 'rgba(255,255,255,0.35)' : '#999', fontWeight: 400, marginLeft: 4 }}>vs kỳ trước</span>
              </span>
            )}
            {subtext && <span style={{ color: isDark ? 'rgba(255,255,255,0.35)' : '#999' }}>{subtext}</span>}
          </div>
        </div>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: `linear-gradient(135deg, ${color}22, ${color}11)`,
          border: `1px solid ${color}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, color: color,
        }}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ── Funnel Stage ─────────────────────────────────────────────────
function FunnelStage({ label, value, total, color, icon, isDark }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{
      textAlign: 'center', flex: 1, padding: '20px 12px',
      background: isDark ? `${color}11` : `${color}08`,
      borderRadius: 16, border: `1px solid ${color}22`,
    }}>
      <div style={{ fontSize: 28, color, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: isDark ? '#fff' : '#111' }}>{fmtNum(value)}</div>
      <div style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.5)' : '#666', marginTop: 4 }}>{label}</div>
      <Progress
        percent={pct}
        showInfo={false}
        strokeColor={color}
        trailColor={isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0'}
        size="small"
        style={{ marginTop: 8 }}
      />
      <div style={{ fontSize: 11, fontWeight: 700, color, marginTop: 4 }}>{pct}%</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function BehaviorAnalytics() {
  const { isDark } = useApp();
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  // Data states
  const [overview, setOverview] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [searchData, setSearchData] = useState(null);
  const [devices, setDevices] = useState([]);
  const [hourly, setHourly] = useState([]);
  const [referrers, setReferrers] = useState([]);
  const [dailyTrend, setDailyTrend] = useState([]);
  const [aiPerf, setAiPerf] = useState(null);
  const [productSort, setProductSort] = useState('views');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, fn, tp, sr, dv, hr, rf, dt, ai] = await Promise.all([
        api.analytics.behaviorOverview(days),
        api.analytics.behaviorFunnel(days),
        api.analytics.behaviorTopProducts(days, productSort, 10),
        api.analytics.behaviorSearch(days),
        api.analytics.behaviorDevices(days),
        api.analytics.behaviorHourly(1),
        api.analytics.behaviorReferrers(days),
        api.analytics.behaviorDailyTrend(30),
        api.analytics.behaviorAiPerf(days),
      ]);
      setOverview(ov);
      setFunnel(fn);
      setTopProducts(tp);
      setSearchData(sr);
      setDevices(dv);
      setHourly(hr);
      setReferrers(rf);
      setDailyTrend(dt);
      setAiPerf(ai);
    } catch (err) {
      console.error('[BehaviorAnalytics]', err);
    } finally {
      setLoading(false);
    }
  }, [days, productSort]);

  useEffect(() => { load(); }, [load]);

  const textColor = isDark ? '#fff' : '#111';
  const subColor = isDark ? 'rgba(255,255,255,0.5)' : '#888';
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : '#f0f0f0';
  const cardStyle = { boxShadow: '0 2px 16px rgba(0,0,0,0.06)' };

  // ── Charts ──────────────────────────────────────────────────────

  // Daily trend chart
  const trendChartOpt = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { data: ['Views', 'Carts', 'Purchases', 'Sessions'], textStyle: { color: subColor }, bottom: 0 },
    xAxis: { type: 'category', data: dailyTrend.map(d => d.date?.slice(5)), axisLabel: { color: subColor }, axisLine: { lineStyle: { color: gridColor } } },
    yAxis: [
      { type: 'value', axisLabel: { color: subColor, formatter: v => fmtNum(v) }, splitLine: { lineStyle: { color: gridColor } } },
    ],
    series: [
      { name: 'Views', type: 'line', data: dailyTrend.map(d => d.views), smooth: true, lineStyle: { color: '#6366f1', width: 2 }, itemStyle: { color: '#6366f1' }, symbol: 'none', areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(99,102,241,0.2)' }, { offset: 1, color: 'rgba(99,102,241,0)' }] } } },
      { name: 'Carts', type: 'line', data: dailyTrend.map(d => d.carts), smooth: true, lineStyle: { color: '#f59e0b', width: 2 }, itemStyle: { color: '#f59e0b' }, symbol: 'none' },
      { name: 'Purchases', type: 'line', data: dailyTrend.map(d => d.purchases), smooth: true, lineStyle: { color: '#10b981', width: 2 }, itemStyle: { color: '#10b981' }, symbol: 'none' },
      { name: 'Sessions', type: 'bar', data: dailyTrend.map(d => d.sessions), itemStyle: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 20 },
    ],
    grid: { left: 8, right: 8, top: 16, bottom: 36, containLabel: true },
  };

  // Hourly activity chart
  const hourlyChartOpt = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: hourly.map(h => `${h.hour}h`), axisLabel: { color: subColor }, axisLine: { lineStyle: { color: gridColor } } },
    yAxis: { type: 'value', axisLabel: { color: subColor }, splitLine: { lineStyle: { color: gridColor } } },
    series: [
      { name: 'Views', type: 'bar', data: hourly.map(h => h.views), itemStyle: { borderRadius: [4, 4, 0, 0], color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#6366f1' }, { offset: 1, color: '#818cf8' }] } }, barMaxWidth: 18 },
      { name: 'Carts', type: 'bar', data: hourly.map(h => h.carts), itemStyle: { borderRadius: [4, 4, 0, 0], color: '#f59e0b' }, barMaxWidth: 18 },
      { name: 'Purchases', type: 'bar', data: hourly.map(h => h.purchases), itemStyle: { borderRadius: [4, 4, 0, 0], color: '#10b981' }, barMaxWidth: 18 },
    ],
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
  };

  // Device pie chart
  const deviceColors = { mobile: '#6366f1', desktop: '#10b981', tablet: '#f59e0b', unknown: '#94a3b8' };
  const deviceChartOpt = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: p => `${p.name}<br/>${fmtNum(p.value)} events (${p.percent}%)` },
    series: [{
      type: 'pie', radius: ['50%', '78%'], center: ['50%', '50%'],
      data: devices.map(d => ({ name: d.device, value: d.events })),
      label: { show: true, formatter: '{b}\n{d}%', color: subColor, fontSize: 11 },
      itemStyle: { borderRadius: 8, borderWidth: 3, borderColor: isDark ? '#111827' : '#fff' },
      color: devices.map(d => deviceColors[d.device] || '#94a3b8'),
    }],
  };

  // Referrer pie chart
  const refColors = { direct: '#10b981', search: '#6366f1', category: '#f59e0b', recommendation: '#ec4899', chatbot: '#8b5cf6', flash_sale: '#ef4444' };
  const referrerChartOpt = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie', radius: ['50%', '78%'], center: ['50%', '50%'],
      data: referrers.map(r => ({ name: r.source, value: r.events })),
      label: { show: true, formatter: '{b}\n{d}%', color: subColor, fontSize: 11 },
      itemStyle: { borderRadius: 8, borderWidth: 3, borderColor: isDark ? '#111827' : '#fff' },
      color: referrers.map(r => refColors[r.source] || '#94a3b8'),
    }],
  };

  // Product table columns
  const productColumns = [
    {
      title: '#', width: 40, render: (_, __, i) => (
        <span style={{ fontWeight: 700, color: i < 3 ? '#f59e0b' : subColor }}>{i + 1}</span>
      ),
    },
    {
      title: 'Sản phẩm', dataIndex: 'name', ellipsis: true, render: (name, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {r.image && <img src={r.image} alt="" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5' }} />}
          <span style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{name}</span>
        </div>
      ),
    },
    { title: <><EyeOutlined /> Views</>, dataIndex: 'view_count', width: 90, sorter: (a, b) => a.view_count - b.view_count, render: v => <span style={{ fontWeight: 600 }}>{fmtNum(v)}</span> },
    { title: <><ShoppingCartOutlined /> Giỏ</>, dataIndex: 'cart_count', width: 80, sorter: (a, b) => a.cart_count - b.cart_count, render: v => <span style={{ color: '#f59e0b', fontWeight: 600 }}>{fmtNum(v)}</span> },
    { title: <><DollarOutlined /> Mua</>, dataIndex: 'purchase_count', width: 80, sorter: (a, b) => a.purchase_count - b.purchase_count, render: v => <span style={{ color: '#10b981', fontWeight: 600 }}>{fmtNum(v)}</span> },
    {
      title: 'V→C %', dataIndex: 'view_to_cart', width: 80, sorter: (a, b) => a.view_to_cart - b.view_to_cart,
      render: v => <Tag color={v > 10 ? 'green' : v > 5 ? 'orange' : 'red'} style={{ fontWeight: 600 }}>{v}%</Tag>,
    },
    {
      title: <><ClockCircleOutlined /> Dwell</>, dataIndex: 'avg_dwell_sec', width: 80,
      render: v => <span>{v}s</span>,
    },
    {
      title: 'Score', dataIndex: 'behavior_score', width: 80, sorter: (a, b) => a.behavior_score - b.behavior_score,
      render: v => <span style={{ fontWeight: 700, color: '#6366f1' }}>{fmtNum(v)}</span>,
    },
  ];

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: textColor, fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChartOutlined style={{ color: '#6366f1' }} /> Behavior Analytics
          </h2>
          <p style={{ margin: '4px 0 0', color: subColor, fontSize: 13 }}>
            Phân tích hành vi người dùng — Dữ liệu từ ClickHouse OLAP
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#6366f1', marginLeft: 8, animation: 'pulse 2s infinite' }} />
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { label: '📊 Tổng quan', value: 'overview' },
              { label: '🔥 Sản phẩm', value: 'products' },
              { label: '🔍 Tìm kiếm', value: 'search' },
              { label: '🤖 AI Insights', value: 'ai' },
            ]}
            size="middle"
          />
          <Select
            value={days}
            onChange={setDays}
            style={{ width: 130 }}
            options={[
              { value: 1, label: 'Hôm nay' },
              { value: 7, label: '7 ngày' },
              { value: 14, label: '14 ngày' },
              { value: 30, label: '30 ngày' },
            ]}
          />
        </div>
      </div>

      {/* ═══ TAB: OVERVIEW ═══ */}
      {tab === 'overview' && (
        <>
          {/* KPI Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={8} lg={4}><MetricCard loading={loading} title="Tổng Events" value={fmtNum(overview?.total_events)} icon={<ThunderboltOutlined />} color="#6366f1" change={overview?.events_change} isDark={isDark} /></Col>
            <Col xs={12} sm={8} lg={4}><MetricCard loading={loading} title="Sessions" value={fmtNum(overview?.unique_sessions)} icon={<UserOutlined />} color="#10b981" change={overview?.sessions_change} isDark={isDark} /></Col>
            <Col xs={12} sm={8} lg={4}><MetricCard loading={loading} title="Lượt xem" value={fmtNum(overview?.total_views)} icon={<EyeOutlined />} color="#6366f1" change={overview?.views_change} isDark={isDark} /></Col>
            <Col xs={12} sm={8} lg={4}><MetricCard loading={loading} title="Thêm giỏ" value={fmtNum(overview?.total_carts)} icon={<ShoppingCartOutlined />} color="#f59e0b" isDark={isDark} /></Col>
            <Col xs={12} sm={8} lg={4}><MetricCard loading={loading} title="Mua hàng" value={fmtNum(overview?.total_purchases)} icon={<DollarOutlined />} color="#10b981" change={overview?.purchases_change} isDark={isDark} /></Col>
            <Col xs={12} sm={8} lg={4}><MetricCard loading={loading} title="Tìm kiếm" value={fmtNum(overview?.total_searches)} icon={<SearchOutlined />} color="#ec4899" isDark={isDark} /></Col>
          </Row>

          {/* Conversion Rates */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={8}>
              <Card className="glass-panel" style={cardStyle} styles={{ body: { textAlign: 'center', padding: '24px 16px' } }}>
                <Statistic title={<span style={{ color: subColor }}>View → Cart</span>} value={overview?.view_to_cart_rate || 0} suffix="%" valueStyle={{ color: '#f59e0b', fontWeight: 800 }} loading={loading} />
              </Card>
            </Col>
            <Col xs={8}>
              <Card className="glass-panel" style={cardStyle} styles={{ body: { textAlign: 'center', padding: '24px 16px' } }}>
                <Statistic title={<span style={{ color: subColor }}>Cart → Purchase</span>} value={overview?.cart_to_purchase_rate || 0} suffix="%" valueStyle={{ color: '#10b981', fontWeight: 800 }} loading={loading} />
              </Card>
            </Col>
            <Col xs={8}>
              <Card className="glass-panel" style={cardStyle} styles={{ body: { textAlign: 'center', padding: '24px 16px' } }}>
                <Statistic title={<span style={{ color: subColor }}>Avg Dwell Time</span>} value={overview?.avg_dwell_sec || 0} suffix="s" valueStyle={{ color: '#6366f1', fontWeight: 800 }} loading={loading} />
              </Card>
            </Col>
          </Row>

          {/* Funnel */}
          <Card title={<span style={{ color: textColor, fontWeight: 700 }}><FunnelPlotOutlined style={{ color: '#6366f1' }} /> Conversion Funnel</span>} className="glass-panel" style={{ ...cardStyle, marginBottom: 24 }} styles={{ body: {} }}>
            {loading ? <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div> : (
              <div style={{ display: 'flex', gap: 12, padding: '8px 0' }}>
                <FunnelStage label="Lượt xem" value={Number(funnel?.views || 0)} total={Number(funnel?.views || 1)} color="#6366f1" icon={<EyeOutlined />} isDark={isDark} />
                <div style={{ display: 'flex', alignItems: 'center', color: subColor, fontSize: 20 }}>→</div>
                <FunnelStage label="Thêm giỏ hàng" value={Number(funnel?.carts || 0)} total={Number(funnel?.views || 1)} color="#f59e0b" icon={<ShoppingCartOutlined />} isDark={isDark} />
                <div style={{ display: 'flex', alignItems: 'center', color: subColor, fontSize: 20 }}>→</div>
                <FunnelStage label="Yêu thích" value={Number(funnel?.wishlists || 0)} total={Number(funnel?.views || 1)} color="#ec4899" icon={<HeartOutlined />} isDark={isDark} />
                <div style={{ display: 'flex', alignItems: 'center', color: subColor, fontSize: 20 }}>→</div>
                <FunnelStage label="Mua hàng" value={Number(funnel?.purchases || 0)} total={Number(funnel?.views || 1)} color="#10b981" icon={<DollarOutlined />} isDark={isDark} />
              </div>
            )}
          </Card>

          {/* Daily Trend + Hourly */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={14}>
              <Card title={<span style={{ color: textColor, fontWeight: 700 }}><RiseOutlined style={{ color: '#6366f1' }} /> Xu hướng 30 ngày</span>} className="glass-panel" style={cardStyle} styles={{ body: {} }}>
                {loading ? <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>
                  : dailyTrend.length > 0 ? <ReactECharts option={trendChartOpt} style={{ height: 280 }} />
                  : <Empty description="Chưa có dữ liệu" />}
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title={<span style={{ color: textColor, fontWeight: 700 }}><ClockCircleOutlined style={{ color: '#f59e0b' }} /> Hoạt động theo giờ</span>} className="glass-panel" style={cardStyle} styles={{ body: {} }}>
                {loading ? <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>
                  : hourly.length > 0 ? <ReactECharts option={hourlyChartOpt} style={{ height: 280 }} />
                  : <Empty description="Chưa có dữ liệu" />}
              </Card>
            </Col>
          </Row>

          {/* Devices + Referrers */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title={<span style={{ color: textColor, fontWeight: 700 }}><MobileOutlined style={{ color: '#6366f1' }} /> Thiết bị</span>} className="glass-panel" style={cardStyle} styles={{ body: {} }}>
                {loading ? <Spin style={{ padding: 40 }} /> :
                  devices.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <ReactECharts option={deviceChartOpt} style={{ height: 220, flex: 1 }} />
                      <div style={{ flex: 1, padding: '0 16px' }}>
                        {devices.map(d => (
                          <div key={d.device} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${gridColor}` }}>
                            <span style={{ color: textColor, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {d.device === 'mobile' ? <MobileOutlined /> : d.device === 'tablet' ? <TabletOutlined /> : <DesktopOutlined />}
                              {d.device}
                            </span>
                            <span style={{ fontWeight: 700, color: deviceColors[d.device] }}>{fmtNum(d.sessions)} sessions</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <Empty description="Chưa có dữ liệu" />}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title={<span style={{ color: textColor, fontWeight: 700 }}><RiseOutlined style={{ color: '#10b981' }} /> Nguồn traffic</span>} className="glass-panel" style={cardStyle} styles={{ body: {} }}>
                {loading ? <Spin style={{ padding: 40 }} /> :
                  referrers.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <ReactECharts option={referrerChartOpt} style={{ height: 220, flex: 1 }} />
                      <div style={{ flex: 1, padding: '0 16px' }}>
                        {referrers.map(r => (
                          <div key={r.source} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${gridColor}` }}>
                            <span style={{ color: textColor }}>{r.source}</span>
                            <span style={{ fontWeight: 700, color: refColors[r.source] || '#94a3b8' }}>{fmtNum(r.events)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <Empty description="Chưa có dữ liệu" />}
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* ═══ TAB: PRODUCTS ═══ */}
      {tab === 'products' && (
        <Card
          title={<span style={{ color: textColor, fontWeight: 700 }}><FireOutlined style={{ color: '#ef4444' }} /> Top sản phẩm theo hành vi</span>}
          extra={
            <Select value={productSort} onChange={v => setProductSort(v)} style={{ width: 160 }}
              options={[
                { value: 'views', label: '👁 Lượt xem' },
                { value: 'carts', label: '🛒 Thêm giỏ' },
                { value: 'purchases', label: '💰 Mua hàng' },
                { value: 'score', label: '⚡ Behavior Score' },
              ]}
            />
          }
          className="glass-panel" style={cardStyle} styles={{ body: {} }}
        >
          {loading ? <Spin style={{ padding: 40 }} /> : (
            <Table
              dataSource={topProducts}
              columns={productColumns}
              rowKey="product_id"
              pagination={false}
              size="small"
              style={{ background: 'transparent' }}
            />
          )}
        </Card>
      )}

      {/* ═══ TAB: SEARCH ═══ */}
      {tab === 'search' && (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card title={<span style={{ color: textColor, fontWeight: 700 }}><SearchOutlined style={{ color: '#6366f1' }} /> Top tìm kiếm</span>} className="glass-panel" style={cardStyle} styles={{ body: {} }}>
              {loading ? <Spin style={{ padding: 40 }} /> : (
                <Table
                  dataSource={searchData?.top_queries || []}
                  rowKey="query"
                  pagination={false}
                  size="small"
                  columns={[
                    { title: '#', width: 40, render: (_, __, i) => <span style={{ fontWeight: 700, color: i < 3 ? '#f59e0b' : subColor }}>{i + 1}</span> },
                    { title: 'Từ khóa', dataIndex: 'query', render: v => <Tag color="blue" style={{ fontWeight: 600 }}>{v}</Tag> },
                    { title: 'Lần tìm', dataIndex: 'count', width: 90, sorter: (a, b) => a.count - b.count, render: v => <span style={{ fontWeight: 700 }}>{v}</span> },
                    { title: 'TB kết quả', dataIndex: 'avg_results', width: 100, render: v => <span>{v}</span> },
                    { title: '0 kết quả', dataIndex: 'zero_results', width: 100, render: v => v > 0 ? <Tag color="red">{v}</Tag> : <span style={{ color: '#10b981' }}>—</span> },
                  ]}
                />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card
              title={<span style={{ color: textColor, fontWeight: 700 }}>⚠️ Tìm kiếm không có kết quả</span>}
              className="glass-panel" style={cardStyle} styles={{ body: {} }}
            >
              <p style={{ color: subColor, fontSize: 13, marginBottom: 16 }}>Khách hàng tìm kiếm nhưng không tìm thấy sản phẩm — cơ hội mở rộng danh mục!</p>
              {loading ? <Spin style={{ padding: 40 }} /> : (
                (searchData?.zero_result_queries || []).length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {searchData.zero_result_queries.map(q => (
                      <Tag key={q.query} color="volcano" style={{ fontSize: 13, padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}>
                        {q.query} <span style={{ opacity: 0.7 }}>({q.count})</span>
                      </Tag>
                    ))}
                  </div>
                ) : <Empty description="Không có tìm kiếm 0 kết quả" />
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* ═══ TAB: AI INSIGHTS ═══ */}
      {tab === 'ai' && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card className="glass-panel" style={cardStyle} styles={{ body: { textAlign: 'center', padding: 24 } }}>
                <RobotOutlined style={{ fontSize: 36, color: '#6366f1', marginBottom: 12 }} />
                <Statistic title={<span style={{ color: subColor }}>Recommendation Events</span>} value={aiPerf?.recommendation?.events || 0} valueStyle={{ color: textColor, fontWeight: 800 }} loading={loading} />
                <div style={{ marginTop: 8 }}>
                  <Tag color="purple" style={{ fontWeight: 600 }}>CTR: {aiPerf?.recommendation?.ctr || 0}%</Tag>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card className="glass-panel" style={cardStyle} styles={{ body: { textAlign: 'center', padding: 24 } }}>
                <RobotOutlined style={{ fontSize: 36, color: '#10b981', marginBottom: 12 }} />
                <Statistic title={<span style={{ color: subColor }}>Chatbot Events</span>} value={aiPerf?.chatbot?.events || 0} valueStyle={{ color: textColor, fontWeight: 800 }} loading={loading} />
                <div style={{ marginTop: 8 }}>
                  <Tag color="green" style={{ fontWeight: 600 }}>Carts: {aiPerf?.chatbot?.carts || 0}</Tag>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card className="glass-panel" style={cardStyle} styles={{ body: { textAlign: 'center', padding: 24 } }}>
                <ThunderboltOutlined style={{ fontSize: 36, color: '#f59e0b', marginBottom: 12 }} />
                <Statistic title={<span style={{ color: subColor }}>Behavior Coverage</span>} value={aiPerf?.coverage?.pct || 0} suffix="%" valueStyle={{ color: textColor, fontWeight: 800 }} loading={loading} />
                <div style={{ marginTop: 8 }}>
                  <span style={{ color: subColor, fontSize: 12 }}>{fmtNum(aiPerf?.coverage?.sessions_with_data || 0)} / {fmtNum(aiPerf?.coverage?.total_sessions || 0)} sessions</span>
                </div>
              </Card>
            </Col>
          </Row>

          <Card title={<span style={{ color: textColor, fontWeight: 700 }}>🧠 AI Recommendation Performance</span>} className="glass-panel" style={cardStyle} styles={{ body: {} }}>
            <Row gutter={[24, 24]}>
              <Col xs={24} md={12}>
                <div style={{ padding: 24, background: isDark ? 'rgba(99,102,241,0.08)' : '#eef2ff', borderRadius: 16, border: '1px solid rgba(99,102,241,0.2)' }}>
                  <h4 style={{ color: '#6366f1', margin: '0 0 16px', fontWeight: 700 }}>📊 Recommendation Engine</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div><div style={{ color: subColor, fontSize: 12, marginBottom: 4 }}>Events</div><div style={{ fontSize: 24, fontWeight: 800, color: textColor }}>{fmtNum(aiPerf?.recommendation?.events || 0)}</div></div>
                    <div><div style={{ color: subColor, fontSize: 12, marginBottom: 4 }}>Carts from Rec</div><div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{fmtNum(aiPerf?.recommendation?.carts || 0)}</div></div>
                    <div><div style={{ color: subColor, fontSize: 12, marginBottom: 4 }}>Purchases from Rec</div><div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{fmtNum(aiPerf?.recommendation?.purchases || 0)}</div></div>
                    <div><div style={{ color: subColor, fontSize: 12, marginBottom: 4 }}>Click-Through Rate</div><div style={{ fontSize: 24, fontWeight: 800, color: '#6366f1' }}>{aiPerf?.recommendation?.ctr || 0}%</div></div>
                  </div>
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ padding: 24, background: isDark ? 'rgba(16,185,129,0.08)' : '#ecfdf5', borderRadius: 16, border: '1px solid rgba(16,185,129,0.2)' }}>
                  <h4 style={{ color: '#10b981', margin: '0 0 16px', fontWeight: 700 }}>💬 Chatbot Conversion</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div><div style={{ color: subColor, fontSize: 12, marginBottom: 4 }}>Chatbot Events</div><div style={{ fontSize: 24, fontWeight: 800, color: textColor }}>{fmtNum(aiPerf?.chatbot?.events || 0)}</div></div>
                    <div><div style={{ color: subColor, fontSize: 12, marginBottom: 4 }}>Cart from Chat</div><div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{fmtNum(aiPerf?.chatbot?.carts || 0)}</div></div>
                  </div>
                  <div style={{ marginTop: 16, padding: 12, background: isDark ? 'rgba(0,0,0,0.2)' : '#fff', borderRadius: 10 }}>
                    <div style={{ color: subColor, fontSize: 12, marginBottom: 4 }}>Data Coverage (sessions có ≥5 events)</div>
                    <Progress percent={aiPerf?.coverage?.pct || 0} strokeColor="#10b981" style={{ marginTop: 4 }} />
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
