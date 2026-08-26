// Dùng relative URL '/api' để Vite proxy tự động forward sang backend :8080
// — Không bị lỗi CORS, không cần hardcode port
// — VITE_API_URL vẫn có thể override cho production deploy
const BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('b2c_token') || localStorage.getItem('token');
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  });
  if (res.status === 401) {
    if (path.includes('/login')) {
      throw new Error((await res.json()).error || 'Request failed');
    }
    localStorage.clear();
    if (path.startsWith('/b2c')) {
      window.location.href = '/';
    } else {
      window.location.href = '/admin/login';
    }
    return;
  }
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
  return res.json();
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),

  kpis: (params = {}) => request('/dashboard/kpis?' + new URLSearchParams(params)),
  revenueByHour: (params = {}) => request('/analytics/revenue/by-hour?' + new URLSearchParams(params)),
  revenueByBranch: (params = {}) => request('/analytics/revenue/by-branch?' + new URLSearchParams(params)),
  revenueByCategory: (params = {}) => request('/analytics/revenue/by-category?' + new URLSearchParams(params)),
  revenueTrend: (params = {}) => request('/analytics/revenue/trend?' + new URLSearchParams(params)),

  analytics: {
    getOrders: (cursor, limit = 20) => request('/analytics/orders?' + new URLSearchParams({ 
      ...(cursor ? { cursor } : {}), 
      limit 
    }))
  },

  financialSummary: (params = {}) => request('/financial/summary?' + new URLSearchParams(params)),
  financialVouchers: (params = {}) => request('/financial/vouchers?' + new URLSearchParams(params)),

  reconciliation: (params = {}) => request('/reconciliation/status?' + new URLSearchParams(params)),
  activeAlerts: () => request('/alerts/active'),
  alertHistory: () => request('/alerts/history'),

  fulfillment: (params = {}) => request('/supply-chain/fulfillment?' + new URLSearchParams(params)),
  slaSummary: (params = {}) => request('/supply-chain/sla-summary?' + new URLSearchParams(params)),

  health: () => request('/health'),

  simulateSale: (data) => request('/admin/simulate-sale', { method: 'POST', body: JSON.stringify(data) }),

  // ─── AI APIs ─────────────────────────────────────────────────
  ai: {
    getRecommendations: (email) => request('/b2c/recommendations?' + new URLSearchParams({ email: email || '' })),
    getCampaignSuggestions: () => request('/b2b/campaign-suggestions'),
    smartSearch: (query) => request('/ai/smart-search', { method: 'POST', body: JSON.stringify({ query }) }),
    visualSearch: (imageBase64) => request('/b2c/visual-search', { method: 'POST', body: JSON.stringify({ imageBase64 }) }),
    smartSearchWithImage: (query, imageBase64) => request('/ai/smart-search-image', { method: 'POST', body: JSON.stringify({ query, imageBase64 }) }),
  },

  // ─── B2B APIs ────────────────────────────────────────────────
  b2b: {
    getReviews: () => request('/b2b/reviews'),
    replyReview: (id, reply) => request(`/b2b/reviews/${id}/reply`, { method: 'POST', body: JSON.stringify({ reply }) }),
    
    // Master Data
    getBranches: () => request('/b2b/branches'),
    addBranch: (data) => request('/b2b/branches', { method: 'POST', body: JSON.stringify(data) }),
    updateBranch: (id, data) => request(`/b2b/branches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBranch: (id) => request(`/b2b/branches/${id}`, { method: 'DELETE' }),

    getBrands: () => request('/b2b/brands'),
    addBrand: (data) => request('/b2b/brands', { method: 'POST', body: JSON.stringify(data) }),
    updateBrand: (id, data) => request(`/b2b/brands/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBrand: (id) => request(`/b2b/brands/${id}`, { method: 'DELETE' }),
    
    getProducts: () => request('/b2b/products'),
    addProduct: (data) => request('/b2b/products', { method: 'POST', body: JSON.stringify(data) }),
    updateProduct: (id, data) => request(`/b2b/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteProduct: (id) => request(`/b2b/products/${id}`, { method: 'DELETE' }),
    
    getFlashSales: () => request('/b2b/flash-sales'),
    addFlashSale: (data) => request('/b2b/flash-sales', { method: 'POST', body: JSON.stringify(data) }),
    updateFlashSale: (id, data) => request(`/b2b/flash-sales/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteFlashSale: (id) => request(`/b2b/flash-sales/${id}`, { method: 'DELETE' }),
  },

  // ─── B2C APIs ────────────────────────────────────────────────
  b2c: {
    // Auth
    register: (data) => request('/b2c/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (email, password) => request('/b2c/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    socialLogin: (data) => request('/b2c/auth/social', { method: 'POST', body: JSON.stringify(data) }),
    
    // Store
    getCategories: () => request('/b2c/categories'),
    getBrands: () => request('/b2c/brands'),
    getFlashSales: () => request('/b2c/flash-sales'),
    getProducts: (category_id = 'ALL', search = '', sort = 'newest', branch_id = '', page = 1, limit = 12) => 
      request('/b2c/products?' + new URLSearchParams({ category_id, search, sort, branch_id, page, limit })),
    getProductDetails: (id) => request(`/b2c/products/${id}`),
    checkout: (data) => request('/b2c/checkout', { method: 'POST', body: JSON.stringify(data) }),
    applyVoucher: (code, cart_total) => request('/b2c/cart/apply-voucher', { method: 'POST', body: JSON.stringify({ code, cart_total }) }),
    getMyOrders: (email) => request('/b2c/orders/me?' + new URLSearchParams({ email })),
    addReview: (productId, data) => request(`/b2c/products/${productId}/reviews`, { method: 'POST', body: JSON.stringify(data) })
  }
};
