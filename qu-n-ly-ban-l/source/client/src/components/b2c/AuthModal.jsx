import React, { useState } from 'react';
import { Form, Input, Button, Divider, message, Alert } from 'antd';
import {
  UserOutlined, LockOutlined, GoogleOutlined, FacebookOutlined,
  MailOutlined, PhoneOutlined, CloseOutlined, ShoppingOutlined
} from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

/* ─── Keyframe injection (chỉ 1 lần) ───────────────────────────── */
const STYLE_ID = 'auth-modal-keyframes';
if (!document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes authFadeIn {
      from { opacity: 0; transform: translateY(24px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)   scale(1);    }
    }
    @keyframes authSlideTab {
      from { opacity: 0; transform: translateX(16px); }
      to   { opacity: 1; transform: translateX(0);    }
    }
    .auth-overlay {
      position: fixed; inset: 0; z-index: 1200;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      padding: 16px;
    }
    .auth-card {
      animation: authFadeIn 0.32s cubic-bezier(0.34,1.2,0.64,1) both;
    }
    .auth-tab-content {
      animation: authSlideTab 0.22s ease both;
    }
    .auth-input-wrap .ant-input,
    .auth-input-wrap .ant-input-affix-wrapper {
      border-radius: 12px !important;
      font-size: 14px !important;
      transition: border-color 0.2s, box-shadow 0.2s !important;
    }
    .auth-input-wrap .ant-input-affix-wrapper:focus-within {
      box-shadow: 0 0 0 3px rgba(16,185,129,0.18) !important;
      border-color: #10b981 !important;
    }
    .auth-social-btn {
      transition: transform 0.15s, box-shadow 0.15s !important;
      border-radius: 12px !important;
    }
    .auth-social-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0,0,0,0.12) !important;
    }
    .auth-submit-btn {
      transition: transform 0.15s, box-shadow 0.15s !important;
      border-radius: 12px !important;
    }
    .auth-submit-btn:not(:disabled):hover {
      transform: translateY(-2px) !important;
      box-shadow: 0 6px 20px rgba(16,185,129,0.4) !important;
    }
  `;
  document.head.appendChild(s);
}

export default function AuthModal({ open, onClose }) {
  const { b2cLogin, isDark, t } = useApp();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('login');
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();

  if (!open) return null;

  /* ─── Handlers ─────────────────────────────────────────────── */
  const handleLogin = async (values) => {
    setLoading(true); setErrorMsg('');
    try {
      const res = await api.b2c.login(values.email, values.password);
      b2cLogin(res.user, res.token);
      message.success(`Chào mừng, ${res.user.full_name}.`);
      loginForm.resetFields(); onClose();
    } catch (err) {
      setErrorMsg(err.message || t('auth.login_fail'));
    } finally { setLoading(false); }
  };

  const handleRegister = async (values) => {
    setLoading(true);
    try {
      const res = await api.b2c.register(values);
      b2cLogin(res.user, res.token);
      message.success(`Tài khoản đã được tạo thành công. Chào mừng, ${res.user.full_name}.`);
      registerForm.resetFields(); onClose();
    } catch (err) {
      message.error(err.message || t('auth.register_fail'));
    } finally { setLoading(false); }
  };

  const handleSocialLogin = async (provider) => {
    setLoading(true);
    try {
      const res = await api.b2c.socialLogin({
        provider,
        email: `${provider}_${Date.now().toString().slice(-4)}@example.com`,
        full_name: provider === 'google' ? 'Google User' : 'Facebook User',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`
      });
      b2cLogin(res.user, res.token);
      message.success(`Đăng nhập bằng ${provider === 'google' ? 'Google' : 'Facebook'} thành công.`);
      onClose();
    } catch (err) {
      message.error(err.message || t('auth.social_fail'));
    } finally { setLoading(false); }
  };

  const switchTab = (tab) => { setActiveTab(tab); setErrorMsg(''); };

  /* ─── Theme tokens ──────────────────────────────────────────── */
  const bg        = isDark ? '#0f172a' : '#ffffff';
  const surface   = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc';
  const border    = isDark ? 'rgba(255,255,255,0.1)'  : '#e2e8f0';
  const textMain  = isDark ? '#f1f5f9' : '#0f172a';
  const textSub   = isDark ? '#94a3b8' : '#64748b';
  const inputBg   = isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc';
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0';

  const inputStyle = {
    background: inputBg,
    borderColor: inputBorder,
    color: textMain,
    height: 46,
  };

  /* ─── Render ────────────────────────────────────────────────── */
  return (
    <div className="auth-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="auth-card"
        style={{
          width: '100%', maxWidth: 440,
          background: bg,
          borderRadius: 24,
          boxShadow: isDark
            ? '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)'
            : '0 32px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* ── Gradient header strip ── */}
        <div style={{
          height: 5,
          background: 'linear-gradient(90deg, #10b981 0%, #06b6d4 50%, #8b5cf6 100%)',
        }} />

        {/* ── Close button ── */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 20, right: 20,
            width: 32, height: 32, borderRadius: 8,
            border: 'none', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            color: textSub, fontSize: 14,
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
        >
          <CloseOutlined />
        </button>

        <div style={{ padding: '32px 36px 36px' }}>
          {/* ── Brand ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #10b981, #047857)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShoppingOutlined style={{ color: '#fff', fontSize: 18 }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 20, color: textMain }}>Getshopy</span>
          </div>

          {/* ── Tab switcher (custom, không dùng antd Tabs) ── */}
          <div style={{
            display: 'flex', gap: 4,
            background: surface, borderRadius: 12, padding: 4,
            border: `1px solid ${border}`,
            marginBottom: 28,
          }}>
            {[
              { key: 'login',    label: 'Đăng nhập' },
              { key: 'register', label: 'Đăng ký' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                style={{
                  flex: 1, padding: '10px 0',
                  border: 'none', borderRadius: 9, cursor: 'pointer',
                  fontWeight: 700, fontSize: 14,
                  transition: 'all 0.22s ease',
                  background: activeTab === tab.key
                    ? (isDark ? '#1e293b' : '#ffffff')
                    : 'transparent',
                  color: activeTab === tab.key ? '#10b981' : textSub,
                  boxShadow: activeTab === tab.key
                    ? '0 2px 8px rgba(0,0,0,0.1)'
                    : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Heading ── */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: textMain, lineHeight: 1.2, letterSpacing: '-0.3px' }}>
              {activeTab === 'login' ? 'Đăng nhập tài khoản' : 'Tạo tài khoản mới'}
            </div>
            <div style={{ fontSize: 13, color: textSub, marginTop: 6, lineHeight: 1.6 }}>
              {activeTab === 'login'
                ? 'Nhập thông tin đăng nhập của bạn để tiếp tục'
                : 'Điền thông tin bên dưới để tạo tài khoản'}
            </div>
          </div>

          {/* ── Error alert ── */}
          {errorMsg && activeTab === 'login' && (
            <Alert
              message={errorMsg} type="error" showIcon closable
              onClose={() => setErrorMsg('')}
              style={{ marginBottom: 20, borderRadius: 10, fontSize: 13 }}
            />
          )}

          {/* ── Forms ── */}
          <div key={activeTab} className="auth-tab-content auth-input-wrap">
            {activeTab === 'login' ? (
              <Form form={loginForm} layout="vertical" onFinish={handleLogin} requiredMark={false}>
                <Form.Item name="email" style={{ marginBottom: 14 }}
                  rules={[{ required: true, message: 'Vui lòng nhập email' }, { type: 'email', message: 'Email không hợp lệ' }]}>
                  <Input
                    size="large"
                    prefix={<MailOutlined style={{ color: '#10b981', fontSize: 15 }} />}
                    placeholder="Email của bạn"
                    style={inputStyle}
                  />
                </Form.Item>
                <Form.Item name="password" style={{ marginBottom: 20 }}
                  rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}>
                  <Input.Password
                    size="large"
                    prefix={<LockOutlined style={{ color: '#10b981', fontSize: 15 }} />}
                    placeholder="Mật khẩu"
                    style={inputStyle}
                  />
                </Form.Item>
                <Button
                  className="auth-submit-btn"
                  type="primary" htmlType="submit" size="large" block loading={loading}
                  style={{
                    height: 48, fontWeight: 700, fontSize: 15,
                    background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                    border: 'none',
                  }}
                >
                  Đăng nhập
                </Button>
              </Form>
            ) : (
              <Form form={registerForm} layout="vertical" onFinish={handleRegister} requiredMark={false}>
                <Form.Item name="full_name" style={{ marginBottom: 14 }}
                  rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
                  <Input
                    size="large"
                    prefix={<UserOutlined style={{ color: '#10b981', fontSize: 15 }} />}
                    placeholder="Họ và tên"
                    style={inputStyle}
                  />
                </Form.Item>
                <Form.Item name="email" style={{ marginBottom: 14 }}
                  rules={[{ required: true, message: 'Vui lòng nhập email' }, { type: 'email', message: 'Email không hợp lệ' }]}>
                  <Input
                    size="large"
                    prefix={<MailOutlined style={{ color: '#10b981', fontSize: 15 }} />}
                    placeholder="Email"
                    style={inputStyle}
                  />
                </Form.Item>
                <Form.Item name="phone" style={{ marginBottom: 14 }}>
                  <Input
                    size="large"
                    prefix={<PhoneOutlined style={{ color: '#10b981', fontSize: 15 }} />}
                    placeholder="Số điện thoại (không bắt buộc)"
                    style={inputStyle}
                  />
                </Form.Item>
                <Form.Item name="password" style={{ marginBottom: 20 }}
                  rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }, { min: 6, message: 'Mật khẩu tối thiểu 6 ký tự' }]}>
                  <Input.Password
                    size="large"
                    prefix={<LockOutlined style={{ color: '#10b981', fontSize: 15 }} />}
                    placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                    style={inputStyle}
                  />
                </Form.Item>
                <Button
                  className="auth-submit-btn"
                  type="primary" htmlType="submit" size="large" block loading={loading}
                  style={{
                    height: 48, fontWeight: 700, fontSize: 15,
                    background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                    border: 'none',
                  }}
                >
                  Tạo tài khoản
                </Button>
              </Form>
            )}
          </div>

          {/* ── Divider ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: border }} />
            <span style={{ fontSize: 12, color: textSub, whiteSpace: 'nowrap' }}>Hoặc tiếp tục với</span>
            <div style={{ flex: 1, height: 1, background: border }} />
          </div>

          {/* ── Social buttons ── */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="auth-social-btn"
              onClick={() => handleSocialLogin('google')}
              disabled={loading}
              style={{
                flex: 1, height: 46, border: `1px solid ${border}`,
                background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                borderRadius: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                color: textMain, fontWeight: 600, fontSize: 13,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button
              className="auth-social-btn"
              onClick={() => handleSocialLogin('facebook')}
              disabled={loading}
              style={{
                flex: 1, height: 46, border: `1px solid ${border}`,
                background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                borderRadius: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                color: textMain, fontWeight: 600, fontSize: 13,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </button>
          </div>

          {/* ── Footer switch ── */}
          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: textSub }}>
            {activeTab === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
            <span
              onClick={() => switchTab(activeTab === 'login' ? 'register' : 'login')}
              style={{ color: '#10b981', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              {activeTab === 'login' ? 'Đăng ký' : 'Đăng nhập'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
