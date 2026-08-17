import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme, Spin } from 'antd';
import { StyleProvider, createCache } from '@ant-design/cssinjs';
import { AppProvider, useApp } from './context/AppContext';
import { CartProvider } from './context/CartContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Eager: critical path (antd + trang chủ B2C load ngay) ────────
import StoreLayout from './components/b2c/StoreLayout';
import Home from './pages/b2c/Home';

// ── Lazy: Admin routes (ECharts + PDF + Maps — chỉ load khi vào /admin) ──
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

// ── Lazy: B2C sub-routes (không cần cho first paint) ─────────────
const ProductList   = lazy(() => import('./pages/b2c/ProductList'));
const ProductDetail = lazy(() => import('./pages/b2c/ProductDetail'));
const Checkout      = lazy(() => import('./pages/b2c/Checkout'));
const Account       = lazy(() => import('./pages/b2c/Account'));
const Compare       = lazy(() => import('./pages/b2c/Compare'));

import './App.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

// Cache CSS-in-JS để tránh regenerate styles mỗi render → giảm TBT
const styleCache = createCache();

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

const ThemeWrapper = ({ children }) => {
  const { isDark } = useApp();
  return (
      <StyleProvider cache={styleCache} layer>
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
      </StyleProvider>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <CartProvider>
          <ThemeWrapper>
            <Router>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* B2B Admin Routes — lazy loaded */}
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

                  {/* B2C Storefront — Home eager, sub-routes lazy */}
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
        </CartProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}
