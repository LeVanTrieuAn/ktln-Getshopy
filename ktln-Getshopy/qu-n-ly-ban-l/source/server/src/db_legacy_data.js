/**
 * db_legacy_data.js
 * Fallback data khi db.json không tìm thấy.
 * Seed.js sẽ dùng db.json trước; file này chỉ là backup tối thiểu.
 */
module.exports = {
  users: [
    {
      full_name: 'Admin',
      email: 'admin@getshopy.vn',
      password_hash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36iMTD6T.p7EFZP8e9e3K3K', // admin123
      role: 'admin',
      status: 'active'
    }
  ],
  b2c_customers: [],
  categories: [],
  brands: [],
  branches: [
    { id: 'HCM001', name: 'Chi nhánh TP.HCM', address: 'TP. Hồ Chí Minh' },
    { id: 'HN001',  name: 'Chi nhánh Hà Nội', address: 'Hà Nội' },
    { id: 'DN001',  name: 'Chi nhánh Đà Nẵng', address: 'Đà Nẵng' }
  ],
  products: [],
  flash_sales: []
};
