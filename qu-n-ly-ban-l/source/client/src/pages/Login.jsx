import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, message, Alert, Tooltip, ConfigProvider, theme as antdTheme } from 'antd';
import {
  UserOutlined, LockOutlined, GlobalOutlined, ShoppingOutlined,
  MoonOutlined, SunOutlined, ArrowRightOutlined,
} from '@ant-design/icons';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { mono, antdMonoTokens } from '../theme/monochrome';

export default function Login() {
  const { login, isDark, toggleTheme, lang, toggleLang, t } = useApp();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const c = mono(isDark);

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
    } finally {
      setLoading(false);
    }
  }

  return (
    // Cùng ConfigProvider lồng như AppLayout. Trang này render NGOÀI AppLayout
    // nên không thừa hưởng token đơn sắc — phải khai báo lại ở đây.
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: antdMonoTokens(isDark),
      }}
    >
      <div className="admin-login" style={{
        '--al-fg': c.fg, '--al-sub': c.sub, '--al-mute': c.mute,
        '--al-line': c.line, '--al-soft': c.soft, '--al-surface': c.surface,
        '--al-inv': c.inv, '--al-inv-fg': c.invFg,
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: c.layout, padding: 24, position: 'relative',
      }}>
        <style>{LOGIN_CSS}</style>

        {/* Điều khiển góc trên phải.
            Bản cũ dùng Button ghost với color:'#fff' cứng — trên nền sáng là
            chữ trắng trên nền trắng, bấm đúng chỗ mới thấy. */}
        <div className="al-top">
          <Tooltip title={isDark ? 'Chuyển nền sáng' : 'Chuyển nền tối'}>
            <button type="button" className="al-icon-btn" onClick={toggleTheme}>
              {isDark ? <SunOutlined /> : <MoonOutlined />}
            </button>
          </Tooltip>
          <Tooltip title="Đổi ngôn ngữ">
            <button type="button" className="al-icon-btn al-icon-btn-wide" onClick={toggleLang}>
              <GlobalOutlined /> {lang === 'vi' ? 'EN' : 'VI'}
            </button>
          </Tooltip>
        </div>

        <div className="al-card">
          <div className="al-head">
            <div className="al-logo"><ShoppingOutlined /></div>
            <h1 className="al-title">Getshopy</h1>
            <div className="al-kicker">BẢNG ĐIỀU KHIỂN QUẢN TRỊ</div>
            <p className="al-sub">{t('login.subtitle')}</p>
          </div>

          <Form layout="vertical" onFinish={onFinish} autoComplete="off" requiredMark={false}>
            {errorMsg && (
              <Alert message={errorMsg} type="error" showIcon style={{ marginBottom: 18, borderRadius: 10 }} />
            )}

            <label className="al-label" htmlFor="login_email">Email</label>
            <Form.Item name="email" rules={[{ required: true, message: t('login.email_required') }]}>
              <Input
                id="login_email"
                prefix={<UserOutlined style={{ color: c.mute }} />}
                placeholder={t('login.email_placeholder')}
                size="large"
                autoComplete="username"
              />
            </Form.Item>

            <label className="al-label" htmlFor="login_password">Mật khẩu</label>
            <Form.Item name="password" rules={[{ required: true, message: t('login.password_required') }]}>
              <Input.Password
                id="login_password"
                prefix={<LockOutlined style={{ color: c.mute }} />}
                placeholder={t('login.password_placeholder')}
                size="large"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 22 }}>
              <Button type="primary" htmlType="submit" size="large" block loading={loading} className="al-submit">
                {t('login.sign_in')} {!loading && <ArrowRightOutlined style={{ fontSize: 13 }} />}
              </Button>
            </Form.Item>
          </Form>

          <div className="al-hint">
            <span className="al-hint-tag">DEMO</span>
            <code>admin@gmail.com</code> / <code>admin</code>
          </div>
        </div>

        <div className="al-foot">Khu vực dành cho nhân viên · Khách hàng mua sắm tại trang chủ</div>
      </div>
    </ConfigProvider>
  );
}

const LOGIN_CSS = `
.admin-login .al-top { position: absolute; top: 22px; right: 22px; display: flex; gap: 8px; }
.admin-login .al-icon-btn {
  height: 34px; min-width: 34px; padding: 0 9px; border-radius: 9px;
  border: 1px solid var(--al-line); background: var(--al-surface); color: var(--al-sub);
  font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
  justify-content: center; transition: background .15s, color .15s, border-color .15s;
}
.admin-login .al-icon-btn:hover { background: var(--al-inv); border-color: var(--al-inv); color: var(--al-inv-fg); }
.admin-login .al-icon-btn-wide { font-weight: 600; letter-spacing: .04em; }

.admin-login .al-card {
  width: 100%; max-width: 396px; padding: 40px 36px 30px;
  background: var(--al-surface); border: 1px solid var(--al-line); border-radius: 18px;
  box-shadow: 0 18px 48px rgba(0,0,0,.09);
}

.admin-login .al-head { text-align: center; margin-bottom: 28px; }
.admin-login .al-logo {
  width: 54px; height: 54px; margin: 0 auto 16px; border-radius: 15px;
  background: var(--al-inv); color: var(--al-inv-fg);
  display: flex; align-items: center; justify-content: center; font-size: 25px;
}
.admin-login .al-title { margin: 0; font-size: 25px; font-weight: 700; color: var(--al-fg); letter-spacing: -.025em; }
.admin-login .al-kicker { margin-top: 6px; font-size: 10px; font-weight: 700; letter-spacing: .17em; color: var(--al-mute); }
.admin-login .al-sub { margin: 12px 0 0; font-size: 13px; color: var(--al-sub); line-height: 1.55; }

.admin-login .al-label {
  display: block; margin-bottom: 6px; font-size: 11.5px; font-weight: 600;
  letter-spacing: .05em; text-transform: uppercase; color: var(--al-sub);
}
.admin-login .ant-form-item { margin-bottom: 15px; }
.admin-login .ant-input-affix-wrapper { border-radius: 10px; background: var(--al-soft); }
.admin-login .ant-input-affix-wrapper:focus-within { background: var(--al-surface); }

.admin-login .al-submit {
  height: 46px; border-radius: 10px; font-weight: 600; font-size: 15px;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
}

.admin-login .al-hint {
  margin-top: 24px; padding-top: 18px; border-top: 1px dashed var(--al-line);
  text-align: center; font-size: 12px; color: var(--al-sub);
  display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;
}
.admin-login .al-hint-tag {
  font-size: 9.5px; font-weight: 700; letter-spacing: .1em; padding: 2px 7px;
  border-radius: 5px; background: var(--al-inv); color: var(--al-inv-fg);
}
.admin-login .al-hint code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px;
  padding: 2px 6px; border-radius: 5px; background: var(--al-soft);
  border: 1px solid var(--al-line); color: var(--al-fg);
}

.admin-login .al-foot {
  position: absolute; bottom: 22px; left: 0; right: 0; text-align: center;
  font-size: 11.5px; color: var(--al-mute); padding: 0 24px;
}

@media (max-width: 440px) {
  .admin-login .al-card { padding: 32px 22px 26px; }
  .admin-login .al-foot { position: static; margin-top: 24px; }
}
`;
