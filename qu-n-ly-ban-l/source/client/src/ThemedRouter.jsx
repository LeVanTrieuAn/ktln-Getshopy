/**
 * ThemedRouter.jsx
 * Chứa ConfigProvider (antd) + Router + tất cả routes.
 * Được lazy-load từ App.jsx để defer việc parse/exec vendor-antd (1.4MB).
 */
import { lazy, Suspense } from 'react';
import { ConfigProvider, theme, Spin } from 'antd';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext';

// ── Eager: critical path B2C ───────────────────────────────────
import StoreLayout from './components/b2c/StoreLayout';
import Home from './pages/b2c/Home';

// ── Lazy: Admin routes (ECharts, PDF, Maps) ───────────────────
const AppLayout         = lazy(() => import('./components/AppLayout'));
const Login             = lazy(() => import('./pages/Login'));
const Dashboard         = lazy(() => import('./pages/Dashboard'));
const GeneralManagement = lazy(() => import('./pages/GeneralManagement'));
const Financial         = lazy(() => import('./pages/Financial'));
const Reconciliation    = lazy(() => import('./pages/Reconciliation'));
const Alerts            = lazy(() => import('./pages/Alerts'));
const Fulfillment       = lazy(() => import('./pages/Fulfillment'));
const Reviews           = lazy(() => import('./pages/Reviews'));
const DataLakeDemo      = lazy(() => import('./pages/DataLakeDemo'));

// ── Lazy: B2C sub-routes ──────────────────────────────────────
const ProductList   = lazy(() => import('./pages/b2c/ProductList'));
const ProductDetail = lazy(() => import('./pages/b2c/ProductDetail'));
const Checkout      = lazy(() => import('./pages/b2c/Checkout'));
const Account       = lazy(() => import('./pages/b2c/Account'));
const Compare       = lazy(() => import('./pages/b2c/Compare'));

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <Spin size="large" />
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user } = useApp();
  if (!user && !localStorage.getItem('token')) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
};

function ThemeWrapper({ children }) {
  const { isDark } = useApp();
  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#10b981',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          borderRadius: 12,
          colorBgContainer: isDark ? '#111827' : '#ffffff',
          colorBgLayout: isDark ? '#050814' : '#f8f9ff',
          colorText: isDark ? '#ffffff' : '#1a1a1a',
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}

export default function ThemedRouter() {
  return (
    <ThemeWrapper>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* B2B Admin Routes */}
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard"      element={<Dashboard />} />
              <Route path="general"        element={<GeneralManagement />} />
              <Route path="financial"      element={<Financial />} />
              <Route path="reconciliation" element={<Reconciliation />} />
              <Route path="alerts"         element={<Alerts />} />
              <Route path="fulfillment"    element={<Fulfillment />} />
              <Route path="reviews"        element={<Reviews />} />
            </Route>

            {/* B2C Storefront */}
            <Route path="/" element={<StoreLayout />}>
              <Route index           element={<Home />} />
              <Route path="shop"     element={<ProductList />} />
              <Route path="product/:id" element={<ProductDetail />} />
              <Route path="compare"  element={<Compare />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="account"  element={<Account />} />
              <Route path="data-lake" element={<DataLakeDemo />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </ThemeWrapper>
  );
}
