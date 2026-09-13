import { useState, useEffect, useMemo } from 'react';
import { Typography, Select, Button, Spin, Row, Col, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useCart } from '../../context/CartContext';
import { api } from '../../services/api';
import { generateSpecs } from '../../utils/specsGenerator';

const { Title, Text } = Typography;

// Helper to strip emoji/icons from strings to strictly satisfy "Không sử dụng các icon"
function cleanText(str) {
  if (!str) return '';
  return str.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
}

export default function Compare() {
  const { isDark, compareList, toggleCompare } = useApp();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [device1Id, setDevice1Id] = useState(null);
  const [device2Id, setDevice2Id] = useState(null);

  // Fetch product list for selectors
  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        const res = await api.b2c.getProducts('ALL', '', 'newest', '', 1, 100);
        const list = Array.isArray(res) ? res : (res?.data || []);
        setProducts(list);

        // Pre-select devices based on compareList or first available products
        if (compareList && compareList.length >= 2) {
          setDevice1Id(compareList[0].id);
          setDevice2Id(compareList[1].id);
        } else if (compareList && compareList.length === 1) {
          setDevice1Id(compareList[0].id);
          const other = list.find(p => p.id !== compareList[0].id);
          if (other) setDevice2Id(other.id);
        } else if (list.length >= 2) {
          setDevice1Id(list[0].id);
          setDevice2Id(list[1].id);
        }
      } catch (err) {
        message.error('Không thể tải danh sách sản phẩm để so sánh');
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  const device1 = useMemo(() => {
    return products.find(p => p.id === device1Id) || (compareList && compareList.find(p => p.id === device1Id)) || null;
  }, [products, device1Id, compareList]);

  const device2 = useMemo(() => {
    return products.find(p => p.id === device2Id) || (compareList && compareList.find(p => p.id === device2Id)) || null;
  }, [products, device2Id, compareList]);

  // Options for device selectors
  const productOptions = useMemo(() => {
    return products.map(p => ({
      value: p.id,
      label: `${p.name} — ${(Number(p.price) || 0).toLocaleString('vi-VN')} đ`
    }));
  }, [products]);

  // Generate and align specifications for side-by-side comparison
  const comparisonSections = useMemo(() => {
    if (!device1 && !device2) return [];

    const specs1 = device1 ? generateSpecs(device1) : [];
    const specs2 = device2 ? generateSpecs(device2) : [];

    // Unified sections in order of appearance
    const sectionMap = new Map();

    const processSpecs = (specsList, devKey) => {
      specsList.forEach(s => {
        const title = cleanText(s.section) || 'Thông số chung';
        if (!sectionMap.has(title)) {
          sectionMap.set(title, new Map());
        }
        const rowMap = sectionMap.get(title);
        (s.rows || []).forEach(([label, val]) => {
          const cleanLabel = cleanText(label);
          if (!rowMap.has(cleanLabel)) {
            rowMap.set(cleanLabel, { dev1: '—', dev2: '—' });
          }
          const rowData = rowMap.get(cleanLabel);
          rowData[devKey] = val || '—';
        });
      });
    };

    if (device1) processSpecs(specs1, 'dev1');
    if (device2) processSpecs(specs2, 'dev2');

    const result = [];
    sectionMap.forEach((rowMap, sectionName) => {
      const rows = [];
      rowMap.forEach((values, label) => {
        rows.push({
          label,
          val1: values.dev1,
          val2: values.dev2,
          isDifferent: values.dev1 !== values.dev2 && values.dev1 !== '—' && values.dev2 !== '—'
        });
      });
      result.push({ section: sectionName, rows });
    });

    return result;
  }, [device1, device2]);

  const handleSwap = () => {
    const temp = device1Id;
    setDevice1Id(device2Id);
    setDevice2Id(temp);
  };

  const handleAddToCart = (product) => {
    if (!product) return;
    const pToAdd = { ...product };
    if (product.variants?.[0]) {
      pToAdd.selectedVariant = product.variants[0];
      const vP = Number(product.variants[0].price);
      pToAdd.price = !isNaN(vP) && vP > 0 ? vP : Number(product.price || 0);
    } else {
      pToAdd.price = Number(product.price || 0);
    }
    addToCart(pToAdd, 1, true);
    message.success(`Đã thêm ${product.name} vào giỏ hàng`);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '140px 20px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '100px 24px 60px' }}>
      {/* Top Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          display: 'inline-block',
          padding: '4px 14px',
          borderRadius: 20,
          background: isDark ? '#27272a' : '#f4f4f5',
          color: isDark ? '#e4e4e7' : '#18181b',
          border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 1,
          marginBottom: 12
        }}>
          CÔNG CỤ SO SÁNH THIẾT BỊ
        </div>
        <Title level={2} style={{ color: isDark ? '#fff' : '#18181b', margin: '0 0 10px', fontWeight: 800 }}>
          So Sánh Chi Tiết Thiết Bị
        </Title>
        <p style={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 15, maxWidth: 640, margin: '0 auto' }}>
          Chọn 2 thiết bị bất kỳ trong cửa hàng để đối chiếu bảng thông số kỹ thuật song song, giúp bạn đưa ra lựa chọn mua sắm chính xác nhất.
        </p>
      </div>

      {/* Device Selectors Card */}
      <div 
        style={{ 
          background: isDark ? '#18181b' : '#ffffff',
          border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
          borderRadius: 20,
          padding: 24,
          marginBottom: 32,
          boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)'
        }}
      >
        <Row gutter={[24, 20]} align="middle">
          <Col xs={24} md={10}>
            <div style={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
              Thiết bị 1:
            </div>
            <Select
              showSearch
              size="large"
              placeholder="Tìm kiếm và chọn thiết bị 1..."
              optionFilterProp="label"
              value={device1Id}
              onChange={setDevice1Id}
              options={productOptions}
              style={{ width: '100%' }}
            />
          </Col>

          <Col xs={24} md={4} style={{ textAlign: 'center' }}>
            <Button
              onClick={handleSwap}
              style={{
                borderRadius: 10,
                fontWeight: 600,
                borderColor: isDark ? '#3f3f46' : '#d4d4d8',
                background: isDark ? '#27272a' : '#f4f4f5',
                color: isDark ? '#fff' : '#18181b',
                width: '100%',
                maxWidth: 140,
                height: 40
              }}
            >
              Đổi vị trí
            </Button>
          </Col>

          <Col xs={24} md={10}>
            <div style={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
              Thiết bị 2:
            </div>
            <Select
              showSearch
              size="large"
              placeholder="Tìm kiếm và chọn thiết bị 2..."
              optionFilterProp="label"
              value={device2Id}
              onChange={setDevice2Id}
              options={productOptions}
              style={{ width: '100%' }}
            />
          </Col>
        </Row>
      </div>

      {/* Side by Side Comparison Container */}
      <div 
        style={{ 
          background: isDark ? '#18181b' : '#ffffff',
          border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)'
        }}
      >
        {/* Sticky Table Header with Device Cards */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr style={{ background: isDark ? '#202024' : '#fafafa', borderBottom: `2px solid ${isDark ? '#27272a' : '#e4e4e7'}` }}>
                <th style={{ width: '26%', padding: '24px 20px', textAlign: 'left', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 800, fontSize: 18, color: isDark ? '#fff' : '#18181b' }}>
                    Thông số kỹ thuật
                  </div>
                  <div style={{ fontSize: 13, color: isDark ? '#a1a1aa' : '#71717a', marginTop: 6, fontWeight: 'normal' }}>
                    So sánh song song 2 thiết bị
                  </div>
                </th>

                {/* Device 1 Header */}
                <th style={{ width: '37%', padding: '24px 20px', textAlign: 'center', verticalAlign: 'top', borderLeft: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}` }}>
                  {device1 ? (
                    <div>
                      <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: 14, padding: 12, marginBottom: 14, border: '1px solid #e4e4e7' }}>
                        <img 
                          src={device1.image || (device1.images && device1.images[0]) || '/images/commerce/prod_mouse.jpg'} 
                          alt={device1.name} 
                          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} 
                        />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: isDark ? '#fff' : '#18181b', marginBottom: 6 }}>
                        {device1.name}
                      </div>
                      <div style={{ color: isDark ? '#fff' : '#18181b', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                        {(Number(device1.price) || 0).toLocaleString('vi-VN')} đ
                      </div>
                      <div style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#71717a', marginBottom: 14 }}>
                        Đánh giá: 4.8 / 5.0 ({device1.sold || 0} đã bán)
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Button
                          onClick={() => navigate(`/product/${device1.id}`)}
                          style={{
                            borderRadius: 10,
                            fontWeight: 600,
                            borderColor: isDark ? '#3f3f46' : '#d4d4d8',
                            background: isDark ? '#27272a' : '#ffffff',
                            color: isDark ? '#fff' : '#18181b'
                          }}
                        >
                          Chi tiết
                        </Button>
                        <Button
                          type="primary"
                          onClick={() => handleAddToCart(device1)}
                          style={{
                            background: '#18181b',
                            borderColor: '#18181b',
                            borderRadius: 10,
                            fontWeight: 600,
                            color: '#ffffff'
                          }}
                        >
                          Thêm vào giỏ
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '40px 0', color: isDark ? '#a1a1aa' : '#71717a' }}>
                      Chưa chọn thiết bị 1
                    </div>
                  )}
                </th>

                {/* Device 2 Header */}
                <th style={{ width: '37%', padding: '24px 20px', textAlign: 'center', verticalAlign: 'top', borderLeft: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}` }}>
                  {device2 ? (
                    <div>
                      <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: 14, padding: 12, marginBottom: 14, border: '1px solid #e4e4e7' }}>
                        <img 
                          src={device2.image || (device2.images && device2.images[0]) || '/images/commerce/prod_mouse.jpg'} 
                          alt={device2.name} 
                          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} 
                        />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: isDark ? '#fff' : '#18181b', marginBottom: 6 }}>
                        {device2.name}
                      </div>
                      <div style={{ color: isDark ? '#fff' : '#18181b', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                        {(Number(device2.price) || 0).toLocaleString('vi-VN')} đ
                      </div>
                      <div style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#71717a', marginBottom: 14 }}>
                        Đánh giá: 4.8 / 5.0 ({device2.sold || 0} đã bán)
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Button
                          onClick={() => navigate(`/product/${device2.id}`)}
                          style={{
                            borderRadius: 10,
                            fontWeight: 600,
                            borderColor: isDark ? '#3f3f46' : '#d4d4d8',
                            background: isDark ? '#27272a' : '#ffffff',
                            color: isDark ? '#fff' : '#18181b'
                          }}
                        >
                          Chi tiết
                        </Button>
                        <Button
                          type="primary"
                          onClick={() => handleAddToCart(device2)}
                          style={{
                            background: '#18181b',
                            borderColor: '#18181b',
                            borderRadius: 10,
                            fontWeight: 600,
                            color: '#ffffff'
                          }}
                        >
                          Thêm vào giỏ
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '40px 0', color: isDark ? '#a1a1aa' : '#71717a' }}>
                      Chưa chọn thiết bị 2
                    </div>
                  )}
                </th>
              </tr>
            </thead>

            {/* Parallel Specs Table Body */}
            <tbody>
              {comparisonSections.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '48px 20px', textAlign: 'center', color: isDark ? '#a1a1aa' : '#71717a' }}>
                    Vui lòng chọn 2 thiết bị từ danh sách trên để hiển thị bảng so sánh thông số.
                  </td>
                </tr>
              ) : (
                comparisonSections.map((sec, secIdx) => (
                  <>
                    {/* Section Header Row */}
                    <tr key={`sec-${secIdx}`} style={{ background: isDark ? '#27272a' : '#f4f4f5' }}>
                      <td 
                        colSpan={3} 
                        style={{ 
                          padding: '12px 20px', 
                          fontWeight: 700, 
                          fontSize: 13, 
                          letterSpacing: 1, 
                          textTransform: 'uppercase', 
                          color: isDark ? '#ffffff' : '#18181b',
                          borderTop: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
                          borderBottom: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`
                        }}
                      >
                        {sec.section}
                      </td>
                    </tr>

                    {/* Spec Rows */}
                    {sec.rows.map((r, rIdx) => (
                      <tr 
                        key={`row-${secIdx}-${rIdx}`}
                        style={{ 
                          borderBottom: `1px solid ${isDark ? '#27272a' : '#f4f4f5'}`,
                          background: rIdx % 2 === 1 ? (isDark ? '#1c1c20' : '#fafafa') : 'transparent'
                        }}
                      >
                        <td style={{ padding: '14px 20px', fontWeight: 600, fontSize: 14, color: isDark ? '#d4d4d8' : '#3f3f46' }}>
                          {r.label}
                        </td>
                        <td style={{ 
                          padding: '14px 20px', 
                          fontSize: 14, 
                          color: isDark ? '#ffffff' : '#18181b', 
                          borderLeft: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
                          fontWeight: r.isDifferent ? 600 : 400
                        }}>
                          {r.val1}
                        </td>
                        <td style={{ 
                          padding: '14px 20px', 
                          fontSize: 14, 
                          color: isDark ? '#ffffff' : '#18181b', 
                          borderLeft: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
                          fontWeight: r.isDifferent ? 600 : 400
                        }}>
                          {r.val2}
                        </td>
                      </tr>
                    ))}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
