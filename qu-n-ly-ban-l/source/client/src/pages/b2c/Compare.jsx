import { Table, Button, Typography, Empty, Rate, Tag } from 'antd';
import { DeleteOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { useCart } from '../../context/CartContext';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

export default function Compare() {
  const { isDark, compareList, toggleCompare, t } = useApp();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  if (!compareList || compareList.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px' }}>
        <Empty description={<span style={{ color: isDark ? '#ccc' : '#555', fontSize: 16 }}>{t('compare.empty')}</span>} />
        <Button type="primary" onClick={() => navigate('/shop')} style={{ marginTop: 24, background: '#10b981', border: 'none', height: 44, borderRadius: 8 }}>
          {t('compare.explore_btn')}
        </Button>
      </div>
    );
  }

  // Define table rows manually to build a vertical comparison view (columns are products)
  const columns = [
    {
      title: t('compare.feature'),
      dataIndex: 'feature',
      key: 'feature',
      fixed: 'left',
      width: 150,
      render: (text) => <strong style={{ color: isDark ? '#fff' : '#000' }}>{text}</strong>
    },
    ...compareList.map((product, index) => ({
      title: (
        <div style={{ textAlign: 'center', position: 'relative', padding: '16px 0' }}>
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => toggleCompare(product)}
            style={{ position: 'absolute', top: 0, right: 0 }}
          />
          <img src={product.image} alt={product.name} style={{ width: 120, height: 120, objectFit: 'contain', marginBottom: 16, background: '#fff', borderRadius: 8, padding: 8 }} />
          <div style={{ fontSize: 16, color: isDark ? '#fff' : '#000', height: 44, overflow: 'hidden' }}>{product.name}</div>
          <Button 
            type="primary" 
            icon={<ShoppingCartOutlined />} 
            onClick={() => { const pToAdd = { ...product }; if (product.variants?.[0]) { pToAdd.selectedVariant = product.variants[0]; pToAdd.price = product.variants[0].price; } addToCart(pToAdd, 1); }}
            style={{ background: '#10b981', border: 'none', marginTop: 12, borderRadius: 8 }}
          >
            {t('compare.add_to_cart')}
          </Button>
        </div>
      ),
      dataIndex: `product_${index}`,
      key: `product_${index}`,
      width: 300,
      align: 'center'
    }))
  ];

  const dataSource = [
    {
      key: 'price',
      feature: t('compare.price'),
      ...compareList.reduce((acc, p, i) => {
        acc[`product_${i}`] = <span style={{ color: '#ef4444', fontWeight: 800, fontSize: 18 }}>{p.price.toLocaleString('vi-VN')} đ</span>;
        return acc;
      }, {})
    },
    {
      key: 'brand',
      feature: t('compare.brand'),
      ...compareList.reduce((acc, p, i) => {
        acc[`product_${i}`] = <Tag color="blue">{p.brand_id}</Tag>;
        return acc;
      }, {})
    },
    {
      key: 'rating',
      feature: t('compare.rating'),
      ...compareList.reduce((acc, p, i) => {
        acc[`product_${i}`] = (
          <div>
            <Rate disabled defaultValue={p.rating} style={{ fontSize: 14, color: '#facc15' }} />
            <div style={{ color: isDark ? '#aaa' : '#666', fontSize: 12, marginTop: 4 }}>({p.sold} đã bán)</div>
          </div>
        );
        return acc;
      }, {})
    },
    {
      key: 'description',
      feature: t('compare.desc'),
      ...compareList.reduce((acc, p, i) => {
        acc[`product_${i}`] = <div style={{ color: isDark ? '#ccc' : '#444', textAlign: 'justify' }}>{p.description}</div>;
        return acc;
      }, {})
    }
  ];

  return (
    <div style={{ padding: '120px 24px 48px', maxWidth: 1200, margin: '0 auto' }}>
      <Title level={2} style={{ color: isDark ? '#fff' : '#111', marginBottom: 32, textAlign: 'center' }}>
        {t('compare.title')} ({compareList.length}/3)
      </Title>
      
      <div className="glass-panel" style={{ padding: 24, borderRadius: 24, overflowX: 'auto' }}>
        <Table 
          columns={columns} 
          dataSource={dataSource} 
          pagination={false} 
          bordered
          rowClassName={() => (isDark ? 'dark-table-row' : '')}
          style={{ minWidth: 800 }}
        />
      </div>

      <style>{`
        .dark-table-row td {
          background: rgba(255,255,255,0.02) !important;
          border-color: rgba(255,255,255,0.05) !important;
          color: #eee !important;
        }
        .ant-table-thead > tr > th {
          background: ${isDark ? 'rgba(255,255,255,0.05) !important' : '#f9fafb !important'};
          border-color: ${isDark ? 'rgba(255,255,255,0.05) !important' : '#f0f0f0 !important'};
          color: ${isDark ? '#fff !important' : '#000 !important'};
        }
      `}</style>
    </div>
  );
}
