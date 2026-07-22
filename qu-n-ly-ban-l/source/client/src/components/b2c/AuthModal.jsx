import React, { useState } from 'react';
import { Modal, Form, Input, Button, Divider, message, Tabs, Alert } from 'antd';
import { UserOutlined, LockOutlined, GoogleOutlined, FacebookOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

export default function AuthModal({ open, onClose }) {
  const { b2cLogin, isDark, t } = useApp();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'

  const handleLogin = async (values) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.b2c.login(values.email, values.password);
      b2cLogin(res.user, res.token);
      message.success(`${t('auth.login_success')} ${res.user.full_name}!`);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || t('auth.login_fail'));
      message.error(err.message || t('auth.login_fail'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values) => {
    setLoading(true);
    try {
      const res = await api.b2c.register(values);
      b2cLogin(res.user, res.token);
      message.success(`${t('auth.register_success')} ${res.user.full_name}!`);
      onClose();
    } catch (err) {
      message.error(err.message || t('auth.register_fail'));
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    setLoading(true);
    try {
      // Mock social payload for thesis presentation purposes
      const mockPayload = {
        provider,
        email: `${provider}_user_${Date.now().toString().slice(-4)}@example.com`,
        full_name: `${provider === 'google' ? 'Google' : 'Facebook'} User`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`
      };
      
      const res = await api.b2c.socialLogin(mockPayload);
      b2cLogin(res.user, res.token);
      message.success(t('auth.social_success').replace('{provider}', provider === 'google' ? 'Google' : 'Facebook'));
      onClose();
    } catch (err) {
      message.error(err.message || t('auth.social_fail'));
    } finally {
      setLoading(false);
    }
  };

  const inputStyles = {
    background: isDark ? 'rgba(255,255,255,0.05)' : '#f9f9f9',
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#eee',
    color: isDark ? '#fff' : '#000',
    borderRadius: 8
  };

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      footer={null}
      width={400}
      styles={{ 
        content: { 
          background: isDark ? '#1a1a2e' : '#fff',
          borderRadius: 20,
          padding: 32,
          border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none'
        }
      }}
    >
      <Tabs 
        activeKey={activeTab} 
        onChange={(k) => { setActiveTab(k); setErrorMsg(''); }} 
        centered 
        items={[
          { key: 'login', label: <span style={{ fontSize: 16, fontWeight: 600 }}>{t('auth.login')}</span> },
          { key: 'register', label: <span style={{ fontSize: 16, fontWeight: 600 }}>{t('auth.register')}</span> }
        ]} 
      />

      <div style={{ marginTop: 24 }}>
        {errorMsg && activeTab === 'login' && (
          <Alert message={errorMsg} type="error" showIcon style={{ marginBottom: 16, borderRadius: 8 }} />
        )}
        {activeTab === 'login' ? (
          <Form layout="vertical" onFinish={handleLogin} requiredMark={false}>
            <Form.Item name="email" rules={[{ required: true, message: t('auth.email_required') }]}>
              <Input size="large" prefix={<MailOutlined style={{ color: '#888' }} />} placeholder={t('auth.email_placeholder')} style={inputStyles} />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: t('auth.password_required') }]}>
              <Input.Password size="large" prefix={<LockOutlined style={{ color: '#888' }} />} placeholder={t('auth.password_placeholder')} style={inputStyles} />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={loading} style={{ background: '#10b981', borderColor: '#10b981', borderRadius: 8, fontWeight: 600 }}>
              {t('auth.login')}
            </Button>
          </Form>
        ) : (
          <Form layout="vertical" onFinish={handleRegister} requiredMark={false}>
            <Form.Item name="full_name" rules={[{ required: true, message: t('auth.name_required') }]}>
              <Input size="large" prefix={<UserOutlined style={{ color: '#888' }} />} placeholder={t('auth.name_placeholder')} style={inputStyles} />
            </Form.Item>
            <Form.Item name="email" rules={[{ required: true, message: t('auth.email_required') }]}>
              <Input size="large" prefix={<MailOutlined style={{ color: '#888' }} />} placeholder={t('auth.email_placeholder')} style={inputStyles} />
            </Form.Item>
            <Form.Item name="phone">
              <Input size="large" prefix={<PhoneOutlined style={{ color: '#888' }} />} placeholder={t('auth.phone_placeholder')} style={inputStyles} />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: t('auth.password_required') }]}>
              <Input.Password size="large" prefix={<LockOutlined style={{ color: '#888' }} />} placeholder={t('auth.password_placeholder')} style={inputStyles} />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={loading} style={{ background: '#10b981', borderColor: '#10b981', borderRadius: 8, fontWeight: 600 }}>
              {t('auth.create_account')}
            </Button>
          </Form>
        )}

        <Divider style={{ color: isDark ? '#666' : '#999', fontSize: 13, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#eee' }}>{t('auth.or_continue_with')}</Divider>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <Button 
            size="large" 
            block 
            icon={<GoogleOutlined style={{ color: '#ea4335' }} />} 
            onClick={() => handleSocialLogin('google')}
            style={{ borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', color: isDark ? '#fff' : '#000', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#ddd' }}
          >
            Google
          </Button>
          <Button 
            size="large" 
            block 
            icon={<FacebookOutlined style={{ color: '#1877f2' }} />} 
            onClick={() => handleSocialLogin('facebook')}
            style={{ borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', color: isDark ? '#fff' : '#000', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#ddd' }}
          >
            Facebook
          </Button>
        </div>
      </div>
    </Modal>
  );
}
