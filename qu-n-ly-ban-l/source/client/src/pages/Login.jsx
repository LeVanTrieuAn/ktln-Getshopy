import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, message, Switch, Select, Alert } from 'antd';
import { UserOutlined, LockOutlined, GlobalOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export default function Login() {
  const { login, isDark, toggleTheme, lang, toggleLang, t } = useApp();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  async function onFinish({ email, password }) {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.login(email, password);
      login(res.user, res.token);
      message.success(t('login.welcome_back') + res.user.full_name);
      navigate('/admin/dashboard');
    } catch (err) {
      setErrorMsg(err.message || t('login.failed'));
      message.error(err.message || t('login.failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="ambient-glow" />
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Top controls */}
        <div style={{ position: 'absolute', top: 24, right: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
          <Button
            size="small" ghost
            icon={<GlobalOutlined />}
            onClick={toggleLang}
            style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}
          >
            {lang === 'vi' ? 'EN' : 'VI'}
          </Button>
          <Switch
            checked={isDark}
            onChange={toggleTheme}
            checkedChildren="Dark"
            unCheckedChildren="Light"
          />
        </div>

        {/* Login Card */}
        <div className="glass-panel glass-panel-elevated" style={{
          width: 420,
          padding: '48px 40px',
        }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{
              width: 64, height: 64,
              background: 'linear-gradient(135deg, #10b981, #047857)',
              borderRadius: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: 32,
            }}>
              <ShoppingOutlined style={{ color: '#fff' }} />
            </div>
            <h1 style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              color: isDark ? '#fff' : '#1a1a2e',
              letterSpacing: '-0.5px',
            }}>Getshopy Analytics</h1>
            <p style={{ margin: '8px 0 0', color: isDark ? 'rgba(255,255,255,0.5)' : '#888', fontSize: 14 }}>
              {t('login.subtitle')}
            </p>
          </div>

          <Form layout="vertical" onFinish={onFinish} autoComplete="off">
            {errorMsg && (
              <Alert 
                message={errorMsg} 
                type="error" 
                showIcon 
                style={{ marginBottom: 24, borderRadius: 10 }} 
              />
            )}
            <Form.Item name="email" rules={[{ required: true, message: t('login.email_required') }]}>
              <Input
                prefix={<UserOutlined style={{ color: '#888' }} />}
                placeholder={t('login.email_placeholder')}
                size="large"
                style={{
                  borderRadius: 10,
                  background: isDark ? 'rgba(255,255,255,0.08)' : '#f5f5f7',
                  border: 'none',
                  color: isDark ? '#fff' : '#000',
                }}
              />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: t('login.password_required') }]}>
              <Input.Password
                prefix={<LockOutlined style={{ color: '#888' }} />}
                placeholder={t('login.password_placeholder')}
                size="large"
                style={{
                  borderRadius: 10,
                  background: isDark ? 'rgba(255,255,255,0.08)' : '#f5f5f7',
                  border: 'none',
                }}
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
                style={{
                  height: 48,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: 16,
                  boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
                }}
              >
                {t('login.sign_in')}
              </Button>
            </Form.Item>
          </Form>

          <div style={{ marginTop: 20, textAlign: 'center', color: isDark ? 'rgba(255,255,255,0.3)' : '#888', fontSize: 12 }}>
            admin@gmail.com / admin
          </div>
        </div>
      </div>
    </>
  );
}
