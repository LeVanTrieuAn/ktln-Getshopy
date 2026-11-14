import { useState, useEffect, useMemo } from 'react';
import { Typography, Select, Button, Spin, Row, Col, Input, Tag, message } from 'antd';
import { CloseOutlined, RobotOutlined, BulbOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useCart } from '../../context/CartContext';
import { api } from '../../services/api';
import { generateSpecs } from '../../utils/specsGenerator';
import { getProductImage, handleImageError } from '../../utils/categoryResolver';

const { Title, Text } = Typography;

const PRESET_NEEDS = [
  { label: 'Chơi game & Hiệu năng cao', value: 'Chơi game đồ họa nặng, cần chip mạnh và tản nhiệt tốt' },
  { label: 'Chụp ảnh & Quay video đẹp', value: 'Chụp ảnh sắc nét, camera góc rộng, quay video 4K chống rung' },
  { label: 'Pin trâu & Dùng bền bỉ', value: 'Pin dung lượng lớn, sạc nhanh, dùng bền bỉ suốt ngày dài' },
  { label: 'Học tập & Văn phòng nhẹ gọn', value: 'Thiết kế gọn nhẹ, mượt mà các tác vụ văn phòng, học tập và lướt web' },
  { label: 'Tối ưu ngân sách & Kinh tế', value: 'Mức giá rẻ nhất, tính năng cơ bản đầy đủ và tiết kiệm chi phí' },
];

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
  const [device1Id, setDevice1Id] = useState(null);
  const [device2Id, setDevice2Id] = useState(null);

  const [userNeeds, setUserNeeds] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState(null);

  // Clear AI advice when comparison devices change
  useEffect(() => {
    setAiResult(null);
    setAiError(null);
  }, [device1Id, device2Id]);

  // Initialize selected devices from compareList
  useEffect(() => {
    setLoading(true);
    if (compareList && compareList.length >= 2) {
      if (!device1Id) setDevice1Id(compareList[0].id);
      if (!device2Id) setDevice2Id(compareList[1].id);
    } else if (compareList && compareList.length === 1) {
      if (!device1Id) setDevice1Id(compareList[0].id);
    }
    setLoading(false);
  }, [compareList]);

  const device1 = useMemo(() => {
    return (compareList && compareList.find(p => p.id === device1Id)) || null;
  }, [device1Id, compareList]);

  const device2 = useMemo(() => {
    return (compareList && compareList.find(p => p.id === device2Id)) || null;
  }, [device2Id, compareList]);

  // Options for device selectors
  const productOptions = useMemo(() => {
    if (!compareList) return [];
    return compareList.map(p => ({
      value: p.id,
      label: `${p.name} — ${(Number(p.price) || 0).toLocaleString('vi-VN')} đ`
    }));
  }, [compareList]);

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

  const handleGetAiAdvice = async (customNeeds = userNeeds) => {
    if (!device1 || !device2) {
      message.warning('Vui lòng chọn đủ 2 thiết bị để AI tư vấn so sánh');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await api.ai.compareAdvice({
        device1Id: device1.id,
        device2Id: device2.id,
        userNeeds: customNeeds,
        device1Data: {
          id: device1.id,
          name: device1.name,
          price: device1.price,
          description: device1.description,
          rating: device1.rating,
          sold: device1.sold,
          category_id: device1.category_id
        },
        device2Data: {
          id: device2.id,
          name: device2.name,
          price: device2.price,
          description: device2.description,
          rating: device2.rating,
          sold: device2.sold,
          category_id: device2.category_id
        }
      });
      if (res && res.success) {
        setAiResult(res);
      } else {
        setAiError(res?.error || 'Không thể lấy tư vấn AI lúc này');
      }
    } catch (err) {
      console.error('Error fetching AI compare advice:', err);
      setAiError(err.message || 'Lỗi kết nối khi gọi AI tư vấn');
    } finally {
      setAiLoading(false);
    }
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
        
        {/* Saved products list */}
        {compareList && compareList.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#a1a1aa' : '#71717a', marginBottom: 12 }}>
              Các sản phẩm bạn đã chọn để so sánh:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
              {compareList.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                  background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                  border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
                  borderRadius: 20, fontSize: 13, color: isDark ? '#e4e4e7' : '#18181b',
                  boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.04)'
                }}>
                  <span style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                  </span>
                  <CloseOutlined 
                    onClick={() => {
                      toggleCompare(p);
                      if (device1Id === p.id) setDevice1Id(null);
                      if (device2Id === p.id) setDevice2Id(null);
                    }}
                    style={{ fontSize: 11, cursor: 'pointer', color: '#ef4444' }} 
                  />
                </div>
              ))}
            </div>
          </div>
        )}
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
              allowClear
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
              allowClear
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

      {/* AI Comparison Advisor Card */}
      <div
        style={{
          background: isDark ? '#18181b' : '#ffffff',
          border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
          borderRadius: 20,
          padding: 24,
          marginBottom: 32,
          boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: isDark ? '#27272a' : '#f4f4f5',
              border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
              color: isDark ? '#ffffff' : '#18181b'
            }}>
              <RobotOutlined style={{ fontSize: 18 }} />
            </span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: isDark ? '#ffffff' : '#18181b' }}>
                AI Gợi Ý & Tư Vấn Chọn Thiết Bị
              </div>
              <div style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#71717a' }}>
                Mô hình AI phân tích thông số kỹ thuật thực và nhu cầu cụ thể của bạn
              </div>
            </div>
          </div>
        </div>

        {/* User Needs Input */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#d4d4d8' : '#3f3f46', marginBottom: 8 }}>
            Nhập nhu cầu sử dụng của bạn:
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Input
              size="large"
              placeholder="Ví dụ: Cần máy chụp ảnh đẹp, pin trâu dùng cả ngày hoặc ngân sách dưới 15 triệu..."
              value={userNeeds}
              onChange={(e) => setUserNeeds(e.target.value)}
              onPressEnter={() => handleGetAiAdvice(userNeeds)}
              disabled={aiLoading}
              style={{
                flex: 1,
                minWidth: 260,
                borderRadius: 12,
                background: isDark ? '#27272a' : '#ffffff',
                borderColor: isDark ? '#3f3f46' : '#d4d4d8',
                color: isDark ? '#ffffff' : '#18181b'
              }}
            />
            <Button
              type="primary"
              size="large"
              loading={aiLoading}
              onClick={() => handleGetAiAdvice(userNeeds)}
              icon={<BulbOutlined />}
              disabled={!device1 || !device2}
              style={{
                borderRadius: 12,
                background: isDark ? '#ffffff' : '#18181b',
                borderColor: isDark ? '#ffffff' : '#18181b',
                color: isDark ? '#18181b' : '#ffffff',
                fontWeight: 700,
                padding: '0 24px',
                height: 40
              }}
            >
              {aiLoading ? 'Đang phân tích...' : 'Hỏi AI tư vấn'}
            </Button>
          </div>
        </div>

        {/* Preset Need Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: aiResult || aiLoading ? 20 : 0 }}>
          <span style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#71717a', fontWeight: 500 }}>Gợi ý nhu cầu nhanh:</span>
          {PRESET_NEEDS.map((preset, idx) => (
            <Tag
              key={idx}
              onClick={() => {
                setUserNeeds(preset.value);
                handleGetAiAdvice(preset.value);
              }}
              style={{
                cursor: 'pointer',
                borderRadius: 14,
                padding: '4px 12px',
                fontSize: 12,
                border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
                background: isDark ? '#27272a' : '#f4f4f5',
                color: isDark ? '#e4e4e7' : '#18181b',
                transition: 'all 0.2s ease'
              }}
            >
              {preset.label}
            </Tag>
          ))}
        </div>

        {/* AI Loading State */}
        {aiLoading && (
          <div style={{
            textAlign: 'center',
            padding: '32px 16px',
            background: isDark ? '#202024' : '#fafafa',
            border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
            borderRadius: 16,
            marginTop: 16
          }}>
            <Spin size="large" />
            <div style={{ marginTop: 12, fontWeight: 600, color: isDark ? '#e4e4e7' : '#18181b' }}>
              AI đang đối chiếu thông số kỹ thuật và tạo phân tích cho bạn...
            </div>
          </div>
        )}

        {/* AI Error Alert */}
        {aiError && !aiLoading && (
          <div style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 10,
            background: isDark ? '#2a1215' : '#fef2f2',
            border: `1px solid ${isDark ? '#5c1d24' : '#fecaca'}`,
            color: isDark ? '#fca5a5' : '#b91c1c',
            fontSize: 13
          }}>
            {aiError}
          </div>
        )}

        {/* AI Result Presentation */}
        {aiResult && !aiLoading && (
          <div style={{ marginTop: 20 }}>
            {/* Quick Verdict Banner */}
            <div style={{
              padding: '16px 20px',
              borderRadius: 14,
              background: isDark ? '#202024' : '#fafafa',
              border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
              marginBottom: 16
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: isDark ? '#a1a1aa' : '#71717a', marginBottom: 6 }}>
                Nhận định tổng quan từ AI:
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: isDark ? '#ffffff' : '#18181b', lineHeight: 1.6 }}>
                {aiResult.summary}
              </div>
            </div>

            {/* Side-by-side Suitability Analysis */}
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <div style={{
                  padding: 18,
                  borderRadius: 14,
                  background: isDark ? '#1c1c20' : '#fafafa',
                  border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
                  height: '100%'
                }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: isDark ? '#ffffff' : '#18181b', marginBottom: 4 }}>
                    {device1?.name}
                  </div>
                  <div style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#71717a', fontWeight: 600, marginBottom: 10 }}>
                    Đặc điểm: {aiResult.advice?.device1?.specsHighlight || 'Thông số tiêu chuẩn'}
                  </div>
                  <div style={{ fontSize: 13, color: isDark ? '#d4d4d8' : '#3f3f46', lineHeight: 1.6 }}>
                    <strong>Sản phẩm này phù hợp với:</strong> {aiResult.advice?.device1?.suitableFor}
                  </div>
                </div>
              </Col>

              <Col xs={24} md={12}>
                <div style={{
                  padding: 18,
                  borderRadius: 14,
                  background: isDark ? '#1c1c20' : '#fafafa',
                  border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
                  height: '100%'
                }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: isDark ? '#ffffff' : '#18181b', marginBottom: 4 }}>
                    {device2?.name}
                  </div>
                  <div style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#71717a', fontWeight: 600, marginBottom: 10 }}>
                    Đặc điểm: {aiResult.advice?.device2?.specsHighlight || 'Thông số tiêu chuẩn'}
                  </div>
                  <div style={{ fontSize: 13, color: isDark ? '#d4d4d8' : '#3f3f46', lineHeight: 1.6 }}>
                    <strong>Sản phẩm này phù hợp với:</strong> {aiResult.advice?.device2?.suitableFor}
                  </div>
                </div>
              </Col>
            </Row>

            {/* Final Verdict Callout */}
            {aiResult.verdict && (
              <div style={{
                marginTop: 16,
                padding: '14px 18px',
                borderRadius: 12,
                background: isDark ? '#27272a' : '#f4f4f5',
                border: `1px dashed ${isDark ? '#3f3f46' : '#d4d4d8'}`,
                fontSize: 13,
                color: isDark ? '#e4e4e7' : '#18181b',
                lineHeight: 1.6
              }}>
                <strong>Lời khuyên chọn mua:</strong> {aiResult.verdict}
              </div>
            )}
          </div>
        )}

        {/* Empty state prompt if 2 devices chosen but user hasn't clicked AI yet */}
        {!aiResult && !aiLoading && device1 && device2 && (
          <div style={{
            marginTop: 14,
            padding: '12px 16px',
            borderRadius: 10,
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            border: `1px dashed ${isDark ? '#3f3f46' : '#e4e4e7'}`,
            fontSize: 13,
            color: isDark ? '#a1a1aa' : '#71717a',
            textAlign: 'center'
          }}>
            Bạn đã chọn <strong>{device1.name}</strong> và <strong>{device2.name}</strong>. Hãy bấm <strong>"Hỏi AI tư vấn"</strong> hoặc chọn nhanh một gợi ý bên trên để nhận câu nhận định và phân tích chuyên sâu!
          </div>
        )}
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
                          src={getProductImage(device1)} 
                          alt={device1.name} 
                          referrerPolicy="no-referrer"
                          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} 
                          onError={(e) => handleImageError(e, device1)}
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
                          src={getProductImage(device2)} 
                          alt={device2.name} 
                          referrerPolicy="no-referrer"
                          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} 
                          onError={(e) => handleImageError(e, device2)}
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
