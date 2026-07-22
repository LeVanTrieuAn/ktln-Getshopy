import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { AppProvider, useApp } from './context/AppContext';
import { CartProvider } from './context/CartContext';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import GeneralManagement from './pages/GeneralManagement';
import Financial from './pages/Financial';
import Reconciliation from './pages/Reconciliation';
import Alerts from './pages/Alerts';
import Fulfillment from './pages/Fulfillment';
import Reviews from './pages/Reviews';
import StoreLayout from './components/b2c/StoreLayout';
import Home from './pages/b2c/Home';
import ProductList from './pages/b2c/ProductList';
import ProductDetail from './pages/b2c/ProductDetail';
import Checkout from './pages/b2c/Checkout';
import Account from './pages/b2c/Account';
import Compare from './pages/b2c/Compare';

import './App.css';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { user } = useApp();
  if (!user && !localStorage.getItem('token')) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
};

// Theme Wrapper
const ThemeWrapper = ({ children }) => {
  const { isDark } = useApp();
  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#10b981', // Getshopy Green
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
};

export default function App() {
  return (
    <AppProvider>
      <CartProvider>
        <ThemeWrapper>
          <Router>
            <Routes>
              {/* B2B Admin Routes */}
              <Route path="/admin/login" element={<Login />} />
              <Route path="/admin" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="general" element={<GeneralManagement />} />
                <Route path="financial" element={<Financial />} />
                <Route path="reconciliation" element={<Reconciliation />} />
                <Route path="alerts" element={<Alerts />} />
                <Route path="fulfillment" element={<Fulfillment />} />
                <Route path="reviews" element={<Reviews />} />
              </Route>
              
              {/* B2C Storefront Routes */}
              <Route path="/" element={<StoreLayout />}>
                <Route index element={<Home />} />
                <Route path="shop" element={<ProductList />} />
                <Route path="product/:id" element={<ProductDetail />} />
                <Route path="compare" element={<Compare />} />
                <Route path="checkout" element={<Checkout />} />
                <Route path="account" element={<Account />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </ThemeWrapper>
      </CartProvider>
    </AppProvider>
  );
}
