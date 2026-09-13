import { useState, useEffect } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Badge, Tooltip, ConfigProvider, theme as antdTheme } from 'antd';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  DashboardOutlined, DollarOutlined, ReconciliationOutlined,
  AlertOutlined, CarOutlined, SettingOutlined, LogoutOutlined,
  GlobalOutlined, BellOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  ShoppingOutlined, StarOutlined, RobotOutlined, BarChartOutlined,
  MoonOutlined, SunOutlined,
} from '@ant-design/icons';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { mono, antdMonoTokens } from '../theme/monochrome';

const { Sider, Header, Content } = Layout;

const NAV_ITEMS = [
  { key: '/admin/dashboard',      icon: <DashboardOutlined />,       labelKey: 'nav.dashboard' },
  { key: '/admin/general',        icon: <SettingOutlined />,         labelKey: 'nav.general_management' },
  { key: '/admin/financial',      icon: <DollarOutlined />,          labelKey: 'nav.financial' },
  { key: '/admin/reconciliation', icon: <ReconciliationOutlined />,  labelKey: 'nav.reconciliation' },
  { key: '/admin/alerts',         icon: <AlertOutlined />,           labelKey: 'nav.alerts' },
  { key: '/admin/fulfillment',    icon: <CarOutlined />,             labelKey: 'nav.fulfillment' },
  { key: '/admin/reviews',        icon: <StarOutlined />,            labelKey: 'Đánh giá' },
  { key: '/admin/behavior',       icon: <BarChartOutlined />,        labelKey: 'Behavior Analytics' },
  { key: '/admin/chatbot',        icon: <RobotOutlined />,           labelKey: 'Quản lý Chatbot AI' },
];

export default function AppLayout() {
  const { t, isDark, toggleTheme, toggleLang, lang, user, logout } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    api.activeAlerts().then(res => setAlertCount(res.length)).catch(console.error);
  }, []);

  const c = mono(isDark);

  const userMenu = {
    items: [
      { key: 'logout', icon: <LogoutOutlined />, label: t('nav.logout'), danger: true },
    ],
    onClick: ({ key }) => { if (key === 'logout') { logout(); navigate('/login'); } },
  };

  return (
    // ConfigProvider lồng: chỉ khu /admin đổi sang tông đơn sắc, gian hàng B2C
    // vẫn giữ token gốc ở App.jsx.
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: antdMonoTokens(isDark),
        components: {
          Menu: {
            itemSelectedBg: isDark ? 'rgba(250,250,250,0.10)' : '#0a0a0a',
            itemSelectedColor: isDark ? c.fg : '#ffffff',
            itemHoverBg: isDark ? 'rgba(250,250,250,0.06)' : '#f4f4f5',
            itemColor: c.sub,
            itemHeight: 40,
          },
          Table: { headerBg: c.soft, headerColor: c.sub, rowHoverBg: c.soft, borderColor: c.lineSoft },
          Card: { headerBg: 'transparent', colorBorderSecondary: c.line },
          Segmented: { itemSelectedBg: c.inv, itemSelectedColor: c.invFg, trackBg: c.soft },
          Tag: { defaultBg: c.soft, defaultColor: c.sub },
        },
      }}
    >
      <div className="admin-mono" style={{ '--am-fg': c.fg, '--am-sub': c.sub, '--am-line': c.line, '--am-soft': c.soft, '--am-surface': c.surface }}>
        <style>{ADMIN_CSS}</style>
        <Layout style={{ minHeight: '100vh', background: c.layout }}>
          {/* ── SIDEBAR ── */}
          <Sider
            collapsible
            collapsed={collapsed}
            trigger={null}
            width={232}
            style={{
              background: c.surface,
              borderRight: `1px solid ${c.line}`,
              position: 'fixed',
              height: '100vh',
              left: 0, top: 0,
              zIndex: 100,
              overflow: 'auto',
            }}
          >
            {/* Logo — khối vuông đảo màu thay cho gradient xanh */}
            <div style={{
              padding: collapsed ? '18px 0' : '18px 20px',
              display: 'flex', alignItems: 'center', gap: 12,
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderBottom: `1px solid ${c.line}`,
              marginBottom: 10,
            }}>
              <div style={{
                width: 34, height: 34, flexShrink: 0,
                background: c.inv,
                borderRadius: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17,
              }}>
                <ShoppingOutlined style={{ color: c.invFg }} />
              </div>
              {!collapsed && (
                <div>
                  <div style={{ color: c.fg, fontWeight: 700, fontSize: 15.5, lineHeight: 1.2, letterSpacing: '-0.01em' }}>Getshopy</div>
                  <div style={{ color: c.mute, fontSize: 10, letterSpacing: '0.14em', fontWeight: 600 }}>ENTERPRISE</div>
                </div>
              )}
            </div>

            <Menu
              theme={isDark ? 'dark' : 'light'}
              mode="inline"
              selectedKeys={[location.pathname]}
              style={{ background: 'transparent', border: 'none', padding: '0 10px' }}
              onClick={({ key }) => navigate(key)}
              items={NAV_ITEMS.map(item => ({
                key: item.key,
                icon: item.key === '/admin/alerts' && alertCount > 0
                  ? <Badge count={alertCount} size="small" offset={[6, 0]}>{item.icon}</Badge>
                  : item.icon,
                label: t(item.labelKey),
                style: { borderRadius: 8, marginBottom: 3 },
              }))}
            />

            {/* Collapse button */}
            <div style={{ position: 'absolute', bottom: 16, left: 10, right: 10 }}>
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ color: c.sub, width: '100%', border: `1px solid ${c.line}` }}
              />
            </div>
          </Sider>

          {/* ── MAIN ── */}
          <Layout style={{ marginLeft: collapsed ? 80 : 232, transition: 'margin 0.2s', background: c.layout }}>
            {/* HEADER */}
            <Header style={{
              background: c.surface,
              padding: '0 24px',
              height: 60,
              lineHeight: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 6,
              borderBottom: `1px solid ${c.line}`,
              position: 'sticky', top: 0, zIndex: 99,
            }}>
              {/* Sáng/tối — nút icon thay cho Switch có chữ, gọn và hợp tông hơn */}
              <Tooltip title={isDark ? 'Chuyển nền sáng' : 'Chuyển nền tối'}>
                <Button
                  type="text"
                  icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                  onClick={toggleTheme}
                  style={{ color: c.sub }}
                />
              </Tooltip>

              <Tooltip title="Đổi ngôn ngữ">
                <Button type="text" icon={<GlobalOutlined />} onClick={toggleLang} style={{ color: c.sub, fontSize: 13 }}>
                  {lang.toUpperCase()}
                </Button>
              </Tooltip>

              <Tooltip title="Cảnh báo đang mở">
                <Badge count={alertCount} size="small" color={c.fg}>
                  <Button type="text" icon={<BellOutlined />} style={{ color: c.sub }} onClick={() => navigate('/admin/alerts')} />
                </Badge>
              </Tooltip>

              <div style={{ width: 1, height: 22, background: c.line, margin: '0 8px' }} />

              {/* User */}
              <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
                <div className="am-user">
                  <Avatar style={{ background: c.inv, color: c.invFg, fontWeight: 600 }} size={32}>
                    {user?.full_name?.[0]?.toUpperCase() || 'A'}
                  </Avatar>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ color: c.fg, fontSize: 13, fontWeight: 600, lineHeight: '17px' }}>
                      {user?.full_name || 'Administrator'}
                    </span>
                    <span style={{ color: c.mute, fontSize: 10.5, lineHeight: '14px', fontWeight: 600, letterSpacing: '0.07em' }}>
                      {user?.role?.toUpperCase() || 'ADMIN'}
                    </span>
                  </div>
                </div>
              </Dropdown>
            </Header>

            {/* CONTENT */}
            <Content style={{ padding: 24, minHeight: 'calc(100vh - 60px)' }}>
              <Outlet />
            </Content>
          </Layout>
        </Layout>
      </div>
    </ConfigProvider>
  );
}

/**
 * Ghi đè các lớp dùng chung (.glass-panel, .ambient-glow) chỉ trong phạm vi
 * .admin-mono. Các lớp đó đang gắn viền vàng và nền phát sáng xanh — sửa trực
 * tiếp trong App.css sẽ đổi luôn giao diện B2C.
 */
const ADMIN_CSS = `
.admin-mono .ambient-glow { display: none; }
.admin-mono .glass-panel {
  background: var(--am-surface) !important;
  border: 1px solid var(--am-line) !important;
  backdrop-filter: none; -webkit-backdrop-filter: none;
  border-radius: 14px;
}
.admin-mono .glass-panel-elevated { box-shadow: none !important; }
.admin-mono .ant-card-head { border-bottom: 1px solid var(--am-line); min-height: 50px; }
.admin-mono .ant-table-thead > tr > th { font-weight: 600; font-size: 12px;
  text-transform: uppercase; letter-spacing: .05em; }
.admin-mono .am-user { display: flex; align-items: center; gap: 10px; cursor: pointer;
  padding: 4px 8px; border-radius: 9px; transition: background .15s; }
.admin-mono .am-user:hover { background: var(--am-soft); }
`;
