import { Typography, Row, Col, Button, Divider } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

const { Title, Paragraph } = Typography;

export default function About() {
  const { isDark } = useApp();
  const navigate = useNavigate();

  const metrics = [
    { value: '100.000+', label: 'Khách hàng toàn quốc tin cậy' },
    { value: '50+', label: 'Thương hiệu công nghệ hàng đầu' },
    { value: '99.8%', label: 'Tỷ lệ khách hàng hài lòng' },
    { value: '24/7', label: 'Hỗ trợ tư vấn kỹ thuật tận tâm' },
  ];

  const coreValues = [
    {
      num: '01',
      title: 'Chính Hãng & Minh Bạch',
      desc: '100% thiết bị tại GetShopy đều có nguồn gốc xuất xứ rõ ràng, nguyên seal nhà sản xuất, bảo hành chính hãng và hóa đơn VAT điện tử đầy đủ.'
    },
    {
      num: '02',
      title: 'Khách Hàng Là Trọng Tâm',
      desc: 'Mọi chính sách từ giá bán, khuyến mãi cho đến chế độ hậu mãi đều được xây dựng nhằm mang lại quyền lợi tối đa và sự an tâm trọn vẹn cho khách hàng.'
    },
    {
      num: '03',
      title: 'Trải Nghiệm Công Nghệ Vượt Trội',
      desc: 'Hệ thống website tối ưu tốc độ, công cụ so sánh thiết bị trực quan song song và quản trị đơn hàng hiện đại giúp bạn dễ dàng đưa ra quyết định đúng đắn.'
    },
    {
      num: '04',
      title: 'Đồng Hành Trọn Vòng Đời',
      desc: 'Không chỉ dừng lại ở giao dịch bán hàng, GetShopy hỗ trợ kỹ thuật trọn đời máy, chính sách 1 đổi 1 trong 30 ngày và dịch vụ bảo hành nhanh chóng.'
    }
  ];

  const commitments = [
    {
      title: 'Cam kết hàng chính hãng 100%',
      desc: 'Bồi hoàn 200% giá trị đơn hàng nếu phát hiện sản phẩm không chính hãng hoặc không rõ nguồn gốc.'
    },
    {
      title: 'Giao hàng hỏa tốc & Kiểm tra trước',
      desc: 'Giao hàng nhanh chóng trong 2-4 giờ tại các thành phố lớn. Khách hàng được đồng kiểm trước khi thanh toán.'
    },
    {
      title: 'Bảo hành chính hãng toàn quốc',
      desc: 'Sản phẩm được tiếp nhận bảo hành tại tất cả các trung tâm bảo hành ủy quyền của hãng trên toàn lãnh thổ Việt Nam.'
    },
    {
      title: 'Đổi mới miễn phí 30 ngày',
      desc: 'Áp dụng chính sách 1 đổi 1 ngay lập tức trong vòng 30 ngày đầu tiên nếu phát sinh lỗi kỹ thuật từ nhà sản xuất.'
    }
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 24px 60px' }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', padding: '40px 0 60px' }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 16px',
          borderRadius: 20,
          background: isDark ? '#27272a' : '#f4f4f5',
          color: isDark ? '#e4e4e7' : '#18181b',
          border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 1.5,
          marginBottom: 20
        }}>
          VỀ CHÚNG TÔI • GETSHOPY
        </div>

        <Title 
          level={1} 
          style={{ 
            color: isDark ? '#ffffff' : '#18181b', 
            fontSize: 'clamp(28px, 4.5vw, 44px)', 
            fontWeight: 800, 
            letterSpacing: -1,
            lineHeight: 1.25,
            maxWidth: 860,
            margin: '0 auto 20px'
          }}
        >
          Định Nghĩa Lại Trải Nghiệm Mua Sắm Thiết Bị Công Nghệ
        </Title>

        <Paragraph 
          style={{ 
            color: isDark ? '#a1a1aa' : '#71717a', 
            fontSize: 17, 
            maxWidth: 760, 
            margin: '0 auto 36px', 
            lineHeight: 1.7 
          }}
        >
          GetShopy là hệ sinh thái bán lẻ thiết bị công nghệ hiện đại, kết nối người tiêu dùng với những sản phẩm công nghệ tiên tiến nhất từ các thương hiệu hàng đầu thế giới với tiêu chuẩn dịch vụ khắt khe và tận tâm.
        </Paragraph>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button 
            type="primary"
            size="large"
            onClick={() => navigate('/shop')}
            style={{ 
              background: '#18181b', 
              borderColor: '#18181b', 
              borderRadius: 12, 
              height: 48, 
              padding: '0 32px', 
              fontWeight: 700,
              color: '#ffffff'
            }}
          >
            Khám phá sản phẩm
          </Button>
          <Button 
            size="large"
            onClick={() => navigate('/compare')}
            style={{ 
              borderRadius: 12, 
              height: 48, 
              padding: '0 32px', 
              fontWeight: 600,
              borderColor: isDark ? '#3f3f46' : '#d4d4d8',
              background: isDark ? '#27272a' : '#ffffff',
              color: isDark ? '#ffffff' : '#18181b'
            }}
          >
            So sánh thiết bị
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div 
        style={{ 
          background: isDark ? '#18181b' : '#ffffff',
          border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
          borderRadius: 20,
          padding: '36px 24px',
          marginBottom: 60,
          boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)'
        }}
      >
        <Row gutter={[24, 24]}>
          {metrics.map((m, idx) => (
            <Col xs={12} md={6} key={idx} style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: 'clamp(26px, 3.5vw, 38px)', 
                fontWeight: 800, 
                color: isDark ? '#ffffff' : '#18181b',
                letterSpacing: -1,
                marginBottom: 6
              }}>
                {m.value}
              </div>
              <div style={{ fontSize: 14, color: isDark ? '#a1a1aa' : '#71717a', fontWeight: 500 }}>
                {m.label}
              </div>
            </Col>
          ))}
        </Row>
      </div>

      {/* Story Section */}
      <div 
        style={{ 
          background: isDark ? '#18181b' : '#ffffff',
          border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
          borderRadius: 20,
          padding: '48px 40px',
          marginBottom: 60,
          boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)'
        }}
      >
        <Row gutter={[48, 36]} align="middle">
          <Col xs={24} md={12}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, color: isDark ? '#a1a1aa' : '#71717a', textTransform: 'uppercase', marginBottom: 12 }}>
              CÂU CHUYỆN CỦA CHÚNG TÔI
            </div>
            <Title level={2} style={{ color: isDark ? '#ffffff' : '#18181b', fontWeight: 800, margin: '0 0 20px', lineHeight: 1.3 }}>
              Khởi Nguồn Từ Niềm Đam Mê Công Nghệ
            </Title>
            <Paragraph style={{ color: isDark ? '#d4d4d8' : '#52525b', fontSize: 15, lineHeight: 1.8, marginBottom: 16 }}>
              GetShopy ra đời từ một câu hỏi giản dị: <em>Tại sao việc tìm kiếm và sở hữu một thiết bị công nghệ chính hãng đáng tin cậy lại luôn đi kèm với nỗi lo về hàng dựng, giá ảo và chính sách bảo hành phức tạp?</em>
            </Paragraph>
            <Paragraph style={{ color: isDark ? '#d4d4d8' : '#52525b', fontSize: 15, lineHeight: 1.8, margin: 0 }}>
              Chúng tôi quyết định tạo ra GetShopy như một câu trả lời dứt khoát: một nền tảng bán lẻ nơi mọi thông số kỹ thuật được minh bạch hóa, giá niêm yết rõ ràng, nguồn gốc thiết bị được kiểm định nghiêm ngặt và trải nghiệm của khách hàng được đặt lên hàng đầu trong từng điểm chạm.
            </Paragraph>
          </Col>

          <Col xs={24} md={12}>
            <div style={{
              background: isDark ? '#202024' : '#fafafa',
              border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
              borderRadius: 16,
              padding: 32
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#ffffff' : '#18181b', marginBottom: 12 }}>
                SỨ MỆNH CỦA CHÚNG TÔI
              </div>
              <Paragraph style={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 15, lineHeight: 1.8, marginBottom: 24 }}>
                Phổ cập các thiết bị công nghệ chất lượng cao, phục vụ công việc, học tập và giải trí cho hàng triệu người dùng Việt Nam với chi phí tối ưu và dịch vụ hậu mãi chuẩn mực.
              </Paragraph>
              <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#ffffff' : '#18181b', marginBottom: 12 }}>
                TẦM NHÌN
              </div>
              <Paragraph style={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 15, lineHeight: 1.8, margin: 0 }}>
                Trở thành thương hiệu bán lẻ điện tử tiêu dùng được tin yêu hàng đầu, dẫn đầu về công nghệ số hóa trải nghiệm mua sắm và sự hài lòng của khách hàng.
              </Paragraph>
            </div>
          </Col>
        </Row>
      </div>

      {/* Core Values Section */}
      <div style={{ marginBottom: 60 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, color: isDark ? '#a1a1aa' : '#71717a', textTransform: 'uppercase', marginBottom: 10 }}>
            GIÁ TRỊ NỀN TẢNG
          </div>
          <Title level={2} style={{ color: isDark ? '#ffffff' : '#18181b', fontWeight: 800, margin: 0 }}>
            4 Trụ Cột Cốt Lõi Tại GetShopy
          </Title>
        </div>

        <Row gutter={[24, 24]}>
          {coreValues.map(v => (
            <Col xs={24} sm={12} md={6} key={v.num}>
              <div 
                style={{ 
                  background: isDark ? '#18181b' : '#ffffff',
                  border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
                  borderRadius: 18,
                  padding: 28,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{ 
                  fontSize: 22, 
                  fontWeight: 900, 
                  color: isDark ? '#ffffff' : '#18181b',
                  letterSpacing: -1,
                  marginBottom: 16
                }}>
                  {v.num}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: isDark ? '#ffffff' : '#18181b', marginBottom: 10 }}>
                  {v.title}
                </div>
                <div style={{ fontSize: 14, color: isDark ? '#a1a1aa' : '#71717a', lineHeight: 1.7, flex: 1 }}>
                  {v.desc}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </div>

      {/* Commitments Section */}
      <div 
        style={{ 
          background: isDark ? '#18181b' : '#ffffff',
          border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
          borderRadius: 20,
          padding: '44px 36px',
          marginBottom: 60,
          boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, color: isDark ? '#a1a1aa' : '#71717a', textTransform: 'uppercase', marginBottom: 10 }}>
            CAM KẾT CHẤT LƯỢNG
          </div>
          <Title level={3} style={{ color: isDark ? '#ffffff' : '#18181b', fontWeight: 800, margin: 0 }}>
            Lời Hứa Danh Dự Với Khách Hàng
          </Title>
        </div>

        <Row gutter={[28, 28]}>
          {commitments.map((c, idx) => (
            <Col xs={24} md={12} key={idx}>
              <div style={{
                padding: 24,
                background: isDark ? '#202024' : '#fafafa',
                border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
                borderRadius: 14,
                height: '100%'
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: isDark ? '#ffffff' : '#18181b', marginBottom: 8 }}>
                  {c.title}
                </div>
                <div style={{ fontSize: 14, color: isDark ? '#a1a1aa' : '#71717a', lineHeight: 1.7 }}>
                  {c.desc}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </div>

      {/* Bottom CTA Banner */}
      <div 
        style={{ 
          background: isDark ? '#27272a' : '#18181b',
          borderRadius: 20,
          padding: '50px 36px',
          textAlign: 'center',
          color: '#ffffff',
          boxShadow: '0 8px 30px -4px rgba(0,0,0,0.2)'
        }}
      >
        <Title level={2} style={{ color: '#ffffff', fontWeight: 800, margin: '0 0 14px' }}>
          Sẵn Sàng Nâng Cấp Trải Nghiệm Công Nghệ?
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16, maxWidth: 640, margin: '0 auto 30px', lineHeight: 1.7 }}>
          Hàng ngàn sản phẩm chính hãng với mức giá cạnh tranh và ưu đãi hấp dẫn đang chờ đón bạn tại GetShopy.
        </Paragraph>
        <Button 
          size="large"
          onClick={() => navigate('/shop')}
          style={{ 
            background: '#ffffff', 
            borderColor: '#ffffff', 
            borderRadius: 12, 
            height: 48, 
            padding: '0 36px', 
            fontWeight: 700,
            color: '#18181b'
          }}
        >
          Mua sắm ngay
        </Button>
      </div>
    </div>
  );
}
