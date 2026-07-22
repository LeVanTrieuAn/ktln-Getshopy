import { useState, useEffect } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Badge, Switch, Tooltip } from 'antd';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  DashboardOutlined, DollarOutlined, ReconciliationOutlined,
  AlertOutlined, CarOutlined, SettingOutlined, LogoutOutlined,
  GlobalOutlined, BellOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  ShoppingOutlined, StarOutlined,
} from '@ant-design/icons';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

const { Sider, Header, Content } = Layout;

const NAV_ITEMS = [
  { key: '/admin/dashboard',      icon: <DashboardOutlined />,       labelKey: 'nav.dashboard' },
  { key: '/admin/general',        icon: <SettingOutlined />,         labelKey: 'nav.general_management' },
  { key: '/admin/financial',      icon: <DollarOutlined />,          labelKey: 'nav.financial' },
  { key: '/admin/reconciliation', icon: <ReconciliationOutlined />,  labelKey: 'nav.reconciliation' },
  { key: '/admin/alerts',         icon: <AlertOutlined />,           labelKey: 'nav.alerts' },
  { key: '/admin/fulfillment',    icon: <CarOutlined />,             labelKey: 'nav.fulfillment' },
  { key: '/admin/reviews',        icon: <StarOutlined />,            labelKey: 'Đánh giá' },
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

  const bg = 'transparent';
  const siderBg = isDark ? 'rgba(17, 24, 39, 0.6)' : 'rgba(255, 255, 255, 0.7)';
  const headerBg = isDark ? 'rgba(17, 24, 39, 0.6)' : 'rgba(255, 255, 255, 0.7)';
  const contentBg = 'transparent';

  const userMenu = {
    items: [
      { key: 'logout', icon: <LogoutOutlined />, label: t('nav.logout'), danger: true },
    ],
    onClick: ({ key }) => { if (key === 'logout') { logout(); navigate('/login'); } },
  };

  return (
    <>
      <div className="ambient-glow" />
      <Layout style={{ minHeight: '100vh', background: bg }}>
      {/* ── SIDEBAR ── */}
      <Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={220}
        style={{
          background: siderBg,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
          borderRight: isDark ? '1px solid rgba(250, 204, 21, 0.1)' : '1px solid rgba(0,0,0,0.05)',
          position: 'fixed',
          height: '100vh',
          left: 0, top: 0,
          zIndex: 100,
          overflow: 'auto',
        }}
      >
        {/* Logo */}
        <div style={{
          padding: collapsed ? '20px 0' : '20px 24px',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          marginBottom: 8,
        }}>
          <div style={{
            width: 36, height: 36, flexShrink: 0,
            background: 'linear-gradient(135deg, #10b981, #047857)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            <ShoppingOutlined style={{ color: '#fff' }} />
          </div>
          {!collapsed && (
            <div>
              <div style={{ color: isDark ? '#fff' : '#1a1a1a', fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>Getshopy</div>
              <div style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#666', fontSize: 11, letterSpacing: '0.1em' }}>ENTERPRISE</div>
            </div>
          )}
        </div>

        <Menu
          theme={isDark ? "dark" : "light"}
          mode="inline"
          selectedKeys={[location.pathname]}
          style={{ background: 'transparent', border: 'none', padding: '0 8px' }}
          onClick={({ key }) => navigate(key)}
          items={NAV_ITEMS.map(item => ({
            key: item.key,
            icon: item.key === '/admin/alerts' && alertCount > 0
              ? <Badge count={alertCount} size="small" offset={[6, 0]}>{item.icon}</Badge>
              : item.icon,
            label: t(item.labelKey),
            style: { borderRadius: 8, marginBottom: 4 },
          }))}
        />

        {/* Collapse button */}
        <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center' }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ color: 'rgba(255,255,255,0.5)', width: '100%' }}
          />
        </div>
      </Sider>

      {/* ── MAIN ── */}
      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'margin 0.2s', background: contentBg }}>
        {/* HEADER */}
        <Header style={{
          background: headerBg,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 16,
          borderBottom: isDark ? '1px solid rgba(250, 204, 21, 0.1)' : '1px solid rgba(0,0,0,0.05)',
          position: 'sticky', top: 0, zIndex: 99,
        }}>
          {/* Dark mode */}
          <Tooltip title={isDark ? 'Light mode' : 'Dark mode'}>
            <Switch
              checked={isDark}
              onChange={toggleTheme}
              checkedChildren="Dark"
              unCheckedChildren="Light"
              size="default"
            />
          </Tooltip>

          {/* Language */}
          <Tooltip title="Switch language">
            <Button
              type="text"
              icon={<GlobalOutlined />}
              onClick={toggleLang}
              style={{ color: isDark ? '#fff' : '#555' }}
            >
              {lang.toUpperCase()}
            </Button>
          </Tooltip>

          {/* Alerts bell */}
          <Tooltip title="Active alerts">
            <Badge count={alertCount} size="small">
              <Button
                type="text"
                icon={<BellOutlined />}
                style={{ color: isDark ? '#fff' : '#555' }}
                onClick={() => navigate('/admin/alerts')}
              />
            </Badge>
          </Tooltip>

          {/* User */}
          <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '4px 8px', borderRadius: 8 }}>
              <Avatar
                style={{ background: 'linear-gradient(135deg, #10b981, #047857)', border: '1px solid rgba(255,255,255,0.1)' }}
                size={36}
              >
                {user?.full_name?.[0]?.toUpperCase() || 'A'}
              </Avatar>
              {!collapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ color: isDark ? '#fff' : '#333', fontSize: 14, fontWeight: 600, lineHeight: '20px' }}>
                    {user?.full_name || 'Administrator'}
                  </span>
                  <span style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#999', fontSize: 12, lineHeight: '16px', fontWeight: 500 }}>
                    {user?.role?.toUpperCase() || 'ADMIN'}
                  </span>
                </div>
              )}
            </div>
          </Dropdown>
        </Header>

        {/* CONTENT */}
        <Content style={{ padding: 24, minHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
    </>
  );
}
