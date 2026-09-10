import React, { useState } from 'react';
import { Form, Input, Button, message, Alert } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

/* ─── Styles & Keyframes ───────────────────────────────────────── */
const STYLE_ID = 'auth-modal-modern-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes authFadeIn {
      from { opacity: 0; transform: translateY(20px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0)   scale(1);    }
    }
    .auth-overlay {
      position: fixed; inset: 0; z-index: 1200;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      padding: 20px;
    }
    .auth-card-modern {
      animation: authFadeIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    /* Outer Input Affix Wrapper */
    .auth-card-modern .ant-input-affix-wrapper {
      background: #f4f5f7 !important;
      border: 1.5px solid transparent !important;
      border-radius: 14px !important;
      height: 52px !important;
      padding: 0 16px !important;
      display: flex !important;
      align-items: center !important;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
      box-shadow: none !important;
    }
    .auth-card-modern .ant-input-affix-wrapper:hover {
      background: #ededf0 !important;
      border-color: transparent !important;
    }
    .auth-card-modern .ant-input-affix-wrapper:focus-within,
    .auth-card-modern .ant-input-affix-wrapper-focused {
      background: #ffffff !important;
      border-color: #18181b !important;
      box-shadow: 0 0 0 3px rgba(24, 24, 27, 0.08) !important;
    }
    /* Inner input - must be completely transparent without independent borders or padding */
    .auth-card-modern .ant-input-affix-wrapper input.ant-input {
      background: transparent !important;
      border: none !important;
      border-radius: 0 !important;
      height: 100% !important;
      padding: 0 0 0 8px !important;
      font-size: 15px !important;
      color: #18181b !important;
      box-shadow: none !important;
      outline: none !important;
    }
    .auth-card-modern .ant-input-affix-wrapper input.ant-input::placeholder {
      color: #a1a1aa !important;
      font-size: 14.5px !important;
    }
    /* Fix Chrome/Safari autofill deformed box */
    .auth-card-modern input:-webkit-autofill,
    .auth-card-modern input:-webkit-autofill:hover,
    .auth-card-modern input:-webkit-autofill:focus,
    .auth-card-modern input:-webkit-autofill:active {
      -webkit-box-shadow: 0 0 0 1000px #f4f5f7 inset !important;
      -webkit-text-fill-color: #18181b !important;
      transition: background-color 5000s ease-in-out 0s !important;
      border-radius: 4px !important;
    }
    .auth-card-modern .ant-input-affix-wrapper:focus-within input:-webkit-autofill,
    .auth-card-modern .ant-input-affix-wrapper-focused input:-webkit-autofill {
      -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
    }
    .auth-card-modern .ant-input-prefix {
      margin-right: 6px !important;
      display: flex !important;
      align-items: center !important;
      font-size: 16px !important;
      color: #71717a !important;
    }
    .auth-card-modern .ant-input-suffix {
      display: flex !important;
      align-items: center !important;
    }
    .auth-social-pill {
      transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }
    .auth-social-pill:hover {
      border-color: #18181b !important;
      background: #fafafa !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06) !important;
    }
    .auth-social-pill:active {
      transform: scale(0.97) !important;
    }
  `;
  document.head.appendChild(s);
}

export default function AuthModal({ open, onClose, onSuccess }) {
  const { b2cLogin, t } = useApp();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();

  if (!open) return null;

  /* ─── Handlers ─────────────────────────────────────────────── */
  const handleLogin = async (values) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.b2c.login(values.email, values.password);
      b2cLogin(res.user, res.token);
      message.success(`Chào mừng, ${res.user.full_name}.`);
      loginForm.resetFields();
      if (typeof onSuccess === 'function') {
        onSuccess(res.user);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || t('auth.login_fail'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.b2c.register(values);
      b2cLogin(res.user, res.token);
      message.success(`Tài khoản đã tạo thành công. Chào mừng, ${res.user.full_name}.`);
      registerForm.resetFields();
      if (typeof onSuccess === 'function') {
        onSuccess(res.user);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || t('auth.register_fail'));
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    setLoading(true);
    try {
      const res = await api.b2c.socialLogin({
        provider,
        email: `${provider}_${Date.now().toString().slice(-4)}@example.com`,
        full_name: provider === 'google' ? 'Google User' : provider === 'facebook' ? 'Facebook User' : 'Apple User',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`
      });
      b2cLogin(res.user, res.token);
      message.success(`Đăng nhập bằng ${provider.charAt(0).toUpperCase() + provider.slice(1)} thành công.`);
      if (typeof onSuccess === 'function') {
        onSuccess(res.user);
      }
      onClose();
    } catch (err) {
      message.error(err.message || t('auth.social_fail'));
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setErrorMsg('');
  };

  return (
    <div className="auth-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="auth-card-modern"
        style={{
          width: '100%',
          maxWidth: 500,
          background: '#ffffff',
          borderRadius: 28,
          boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.06)',
          overflow: 'hidden',
          position: 'relative',
          padding: '40px 42px 34px',
        }}
      >
        {/* ── Close button ── */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.04)',
            color: '#71717a',
            fontSize: 14,
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.08)';
            e.currentTarget.style.color = '#18181b';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
            e.currentTarget.style.color = '#71717a';
          }}
        >
          <CloseOutlined />
        </button>

        {/* ── Top Icon Badge (->]) ── */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            width: 58,
            height: 58,
            borderRadius: 20,
            background: '#ffffff',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </div>
        </div>

        {/* ── Title & Subtitle ── */}
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <h2 style={{
            fontSize: 26,
            fontWeight: 800,
            color: '#18181b',
            margin: '0 0 8px',
            letterSpacing: '-0.02em',
          }}>
            {activeTab === 'login' ? 'Đăng nhập tài khoản' : 'Tạo tài khoản mới'}
          </h2>
          <p style={{
            fontSize: 14,
            color: '#71717a',
            margin: '0 auto',
            maxWidth: 380,
            lineHeight: 1.5,
          }}>
            {activeTab === 'login'
              ? 'Chào mừng bạn quay lại GetShopy. Đăng nhập để mua hàng và nhận ưu đãi.'
              : 'Đăng ký tài khoản để tích điểm thành viên, theo dõi đơn hàng và bảo hành.'}
          </p>
        </div>

        {/* ── Error alert ── */}
        {errorMsg && (
          <Alert
            message={errorMsg}
            type="error"
            showIcon
            closable
            onClose={() => setErrorMsg('')}
            style={{ marginBottom: 18, borderRadius: 12, fontSize: 13.5 }}
          />
        )}

        {/* ── Form Section ── */}
        {activeTab === 'login' ? (
          <Form form={loginForm} layout="vertical" onFinish={handleLogin} requiredMark={false}>
            {/* Email Field */}
            <Form.Item
              name="email"
              style={{ marginBottom: 16 }}
              rules={[
                { required: true, message: 'Vui lòng nhập email' },
                { type: 'email', message: 'Email không hợp lệ' }
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="Địa chỉ Email (vd: user@example.com)"
              />
            </Form.Item>

            {/* Password Field */}
            <Form.Item
              name="password"
              style={{ marginBottom: 12 }}
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Mật khẩu của bạn"
              />
            </Form.Item>

            {/* Forgot password */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
              <span
                onClick={() => message.info('Vui lòng liên hệ bộ phận hỗ trợ GetShopy để đặt lại mật khẩu.')}
                style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: '#71717a',
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#18181b'}
                onMouseLeave={e => e.currentTarget.style.color = '#71717a'}
              >
                Quên mật khẩu?
              </span>
            </div>

            {/* Submit Button */}
            <Button
              htmlType="submit"
              loading={loading}
              style={{
                width: '100%',
                height: 52,
                borderRadius: 14,
                background: '#18181b',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#27272a'}
              onMouseLeave={e => e.currentTarget.style.background = '#18181b'}
            >
              Đăng nhập
            </Button>
          </Form>
        ) : (
          <Form form={registerForm} layout="vertical" onFinish={handleRegister} requiredMark={false}>
            {/* Full Name */}
            <Form.Item
              name="full_name"
              style={{ marginBottom: 16 }}
              rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Họ và tên của bạn"
              />
            </Form.Item>

            {/* Email */}
            <Form.Item
              name="email"
              style={{ marginBottom: 16 }}
              rules={[
                { required: true, message: 'Vui lòng nhập email' },
                { type: 'email', message: 'Email không hợp lệ' }
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="Địa chỉ Email"
              />
            </Form.Item>

            {/* Phone (Optional) */}
            <Form.Item name="phone" style={{ marginBottom: 16 }}>
              <Input
                prefix={<PhoneOutlined />}
                placeholder="Số điện thoại (tùy chọn)"
              />
            </Form.Item>

            {/* Password */}
            <Form.Item
              name="password"
              style={{ marginBottom: 20 }}
              rules={[
                { required: true, message: 'Vui lòng nhập mật khẩu' },
                { min: 6, message: 'Mật khẩu tối thiểu 6 ký tự' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Mật khẩu (tối thiểu 6 ký tự)"
              />
            </Form.Item>

            {/* Submit Button */}
            <Button
              htmlType="submit"
              loading={loading}
              style={{
                width: '100%',
                height: 52,
                borderRadius: 14,
                background: '#18181b',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#27272a'}
              onMouseLeave={e => e.currentTarget.style.background = '#18181b'}
            >
              Tạo tài khoản
            </Button>
          </Form>
        )}

        {/* ── Dotted Divider ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          margin: '24px 0 20px',
        }}>
          <div style={{ flex: 1, borderTop: '1.5px dotted #e4e4e7' }} />
          <span style={{ fontSize: 13, color: '#a1a1aa', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Hoặc tiếp tục với
          </span>
          <div style={{ flex: 1, borderTop: '1.5px dotted #e4e4e7' }} />
        </div>

        {/* ── Social Login Row ── */}
        <div style={{ display: 'flex', gap: 12 }}>
          {/* Google */}
          <button
            type="button"
            className="auth-social-pill"
            onClick={() => handleSocialLogin('google')}
            disabled={loading}
            title="Sign in with Google"
            style={{
              flex: 1,
              height: 50,
              borderRadius: 14,
              background: '#ffffff',
              border: '1.5px solid #e4e4e7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </button>

          {/* Facebook */}
          <button
            type="button"
            className="auth-social-pill"
            onClick={() => handleSocialLogin('facebook')}
            disabled={loading}
            title="Sign in with Facebook"
            style={{
              flex: 1,
              height: 50,
              borderRadius: 14,
              background: '#ffffff',
              border: '1.5px solid #e4e4e7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </button>

          {/* Apple */}
          <button
            type="button"
            className="auth-social-pill"
            onClick={() => handleSocialLogin('apple')}
            disabled={loading}
            title="Sign in with Apple"
            style={{
              flex: 1,
              height: 50,
              borderRadius: 14,
              background: '#ffffff',
              border: '1.5px solid #e4e4e7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="#000000">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.05-.03.07-.42 1.44-1.38 2.82M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.58.67-1.09 1.74-.95 2.77.99.08 2.06-.52 2.68-1.27z"/>
            </svg>
          </button>
        </div>

        {/* ── Switcher between Login & Register ── */}
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13.5, color: '#71717a' }}>
          {activeTab === 'login' ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
          <span
            onClick={() => switchTab(activeTab === 'login' ? 'register' : 'login')}
            style={{
              color: '#18181b',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: 3
            }}
          >
            {activeTab === 'login' ? 'Đăng ký ngay' : 'Đăng nhập ngay'}
          </span>
        </div>
      </div>
    </div>
  );
}
