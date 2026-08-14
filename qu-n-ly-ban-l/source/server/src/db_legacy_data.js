const defaultData = {
    users: [
        {
            id: 1,
            full_name: 'Administrator',
            email: 'admin@gmail.com',
            password_hash: '$2b$10$089ukYeJUlyaI23BRcsZ.uLySQJ/MbiOiyjrh7yBHIDnJBj1WtRIm', // 'admin'
            role: 'admin',
            status: 'active'
        }
    ],
    b2c_customers: [
        {
            id: 101,
            full_name: 'Khách hàng 1',
            email: 'khachhang@gmail.com',
            password_hash: '$2b$10$089ukYeJUlyaI23BRcsZ.uLySQJ/MbiOiyjrh7yBHIDnJBj1WtRIm', // 'admin'
            phone: '0901234567',
            address: '123 Đường B2C, TP. HCM',
            loyalty_points: 1500
        }
    ],
    categories: [
        { id: 'c1', name: 'Điện thoại thông minh', icon: 'MobileOutlined' },
        { id: 'c2', name: 'Máy tính xách tay', icon: 'LaptopOutlined' },
        { id: 'c3', name: 'Máy tính bảng', icon: 'TabletOutlined' },
        { id: 'c4', name: 'Phụ kiện công nghệ', icon: 'AudioOutlined' }
    ],
    brands: [
        { id: 'b1', name: 'Apple' },
        { id: 'b2', name: 'Samsung' },
        { id: 'b3', name: 'Sony' }
    ],
    products: [
        { 
            id: 1, name: 'iPhone 15 Pro Max 256GB', price: 34990000, original_price: 38990000, 
            category_id: 'c1', brand_id: 'b1', stock: 15, rating: 4.8, sold: 1200,
            image: 'https://store.storeimages.cdn-apple.com/8756/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-7inch-naturaltitanium?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1692845702708',
            images: [],
            description: 'Điện thoại cao cấp nhất của Apple với khung Titanium siêu nhẹ, chip A17 Pro và camera tele 5x.',
            variants: [{ color: 'Titan Tự Nhiên', stock: 5 }, { color: 'Titan Xanh', stock: 10 }]
        },
        { 
            id: 2, name: 'iPhone 15 128GB', price: 22990000, original_price: 24990000, 
            category_id: 'c1', brand_id: 'b1', stock: 32, rating: 4.5, sold: 850,
            image: 'https://store.storeimages.cdn-apple.com/8756/as-images.apple.com/is/iphone-15-finish-select-202309-6-1inch-blue?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1692923777972',
            images: [], description: 'Dynamic Island, camera 48MP và cổng USB-C.', variants: []
        },
        { 
            id: 3, name: 'MacBook Air M3 13-inch 256GB', price: 27990000, original_price: 29990000, 
            category_id: 'c2', brand_id: 'b1', stock: 10, rating: 4.9, sold: 420,
            image: 'https://placehold.co/904x840/1a1a2e/ffffff?text=MacBook+Air+M3',
            images: [], description: 'Laptop mỏng nhẹ với sức mạnh của chip M3.', variants: []
        },
        { 
            id: 4, name: 'MacBook Pro 14-inch M3 Pro', price: 49990000, original_price: 52990000, 
            category_id: 'c2', brand_id: 'b1', stock: 5, rating: 5.0, sold: 150,
            image: 'https://placehold.co/904x840/1a1a2e/ffffff?text=MacBook+Pro+14-inch+M3+Pro',
            images: [], description: 'Sức mạnh Pro đích thực trong màu Space Black hoàn toàn mới.', variants: []
        },
        { 
            id: 5, name: 'iPad Pro 11-inch M4', price: 28990000, original_price: 30990000, 
            category_id: 'c3', brand_id: 'b1', stock: 8, rating: 4.7, sold: 310,
            image: 'https://store.storeimages.cdn-apple.com/8756/as-images.apple.com/is/ipad-pro-11-select-wifi-spaceblack-202405?wid=940&hei=1112&fmt=png-alpha&.v=1713306918366',
            images: [], description: 'Mỏng không tưởng, mạnh phi thường với màn hình OLED và chip M4.', variants: []
        },
        { 
            id: 6, name: 'AirPods Pro (2nd gen)', price: 6190000, original_price: 6990000, 
            category_id: 'c4', brand_id: 'b1', stock: 50, rating: 4.8, sold: 3200,
            image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?q=80&w=1000&auto=format&fit=crop',
            images: [], description: 'Khử tiếng ồn chủ động tốt hơn gấp 2 lần.', variants: []
        }
    ],
    reviews: [
        { id: 1, product_id: 1, customer_id: 101, rating: 5, comment: 'Máy dùng rất mượt, pin trâu.', date: '2023-11-01' }
    ],
    flash_sales: [
        { id: 1, title: 'Đón Hè Rực Rỡ - Giảm Sốc 50%', end_time: new Date(Date.now() + 86400000 * 3).toISOString() }
    ],
    flash_sale_items: [
        { flash_sale_id: 1, product_id: 6, discount_price: 4990000, limit: 100, sold: 45 }
    ],
    voucher_tiers: [
        { id: 1, name: 'Ưu đãi Thành viên mới', min_points_required: 0, min_lifetime_spend_vnd: 0, discount_amount_vnd: 50000, active: 1 },
        { id: 2, name: 'Voucher Khách Hạng Vàng', min_points_required: 1000, min_lifetime_spend_vnd: 20000000, discount_amount_vnd: 500000, active: 1 }
    ],
    customer_vouchers: [],
    orders: [],
    order_details: []
};
module.exports = defaultData;
