import { useState, useRef, useEffect } from 'react';
import { Button, Input, Card, Avatar, Typography, Space, Spin } from 'antd';
import { RobotOutlined, UserOutlined, SendOutlined, CloseOutlined, MessageOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

export default function AIChatbot() {
  const { isDark } = useApp();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'ai', text: 'Xin chào! Tôi là Trợ lý ảo Getshopy. Bạn cần tư vấn mua điện thoại, laptop hay phụ kiện nào không?' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    const userMsg = inputValue.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInputValue('');
    setIsTyping(true);

    // MOCK AI RESPONSE
    setTimeout(() => {
      let aiResponse = 'Xin lỗi, tôi chưa hiểu rõ ý bạn. Bạn có thể nói rõ hơn được không?';
      let suggestedLink = null;
      
      const lowerMsg = userMsg.toLowerCase();
      if (lowerMsg.includes('iphone') || lowerMsg.includes('apple')) {
        aiResponse = 'Hiện tại Getshopy đang có dòng iPhone 15 Pro Max Titanium giảm giá cực sâu kèm nhiều ưu đãi. Bạn có muốn xem qua danh sách iPhone không?';
        suggestedLink = '/shop?search=iphone';
      } else if (lowerMsg.includes('laptop') || lowerMsg.includes('macbook')) {
        aiResponse = 'Về mảng Laptop, MacBook Air M3 và các dòng Asus ROG đang là Best-Seller. Hãy click vào link bên dưới để xem chi tiết nhé!';
        suggestedLink = '/shop?search=macbook';
      } else if (lowerMsg.includes('giá rẻ') || lowerMsg.includes('khuyến mãi') || lowerMsg.includes('giảm giá')) {
        aiResponse = 'Bạn đang tìm đồ giá hời? Mời bạn ghé ngay khu vực Flash Sale trên Trang chủ để săn deal giá sốc nhé!';
        suggestedLink = '/';
      } else if (lowerMsg.includes('chào') || lowerMsg.includes('hello')) {
        aiResponse = 'Dạ vâng xin chào bạn! Chúc bạn một ngày mua sắm vui vẻ. Mình giúp gì được cho bạn ạ?';
      }

      setMessages(prev => [...prev, { sender: 'ai', text: aiResponse, link: suggestedLink }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <Button 
          type="primary" 
          shape="circle" 
          size="large" 
          icon={<MessageOutlined style={{ fontSize: 24 }} />} 
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 32,
            right: 32,
            width: 64,
            height: 64,
            zIndex: 9999,
            background: 'linear-gradient(135deg, #10b981, #047857)',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'bounce 2s infinite'
          }}
        />
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card
          style={{
            position: 'fixed',
            bottom: 32,
            right: 32,
            width: 380,
            height: 560,
            zIndex: 9999,
            borderRadius: 20,
            boxShadow: '0 12px 48px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee',
            background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)'
          }}
          styles={{ body: {} }}
        >
          {/* Header */}
          <div style={{ 
            padding: '16px 20px', 
            background: 'linear-gradient(135deg, #10b981, #047857)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            color: '#fff'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar icon={<RobotOutlined />} style={{ background: '#fff', color: '#10b981' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>AI Shopping Assistant</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Online - Sẵn sàng hỗ trợ</div>
              </div>
            </div>
            <Button type="text" icon={<CloseOutlined style={{ color: '#fff' }} />} onClick={() => setIsOpen(false)} />
          </div>

          {/* Messages Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ 
                display: 'flex', 
                flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
                gap: 12,
                alignItems: 'flex-start'
              }}>
                <Avatar 
                  icon={msg.sender === 'user' ? <UserOutlined /> : <RobotOutlined />} 
                  style={{ 
                    background: msg.sender === 'user' ? '#1890ff' : '#10b981',
                    flexShrink: 0
                  }} 
                />
                <div style={{ 
                  background: msg.sender === 'user' ? '#1890ff' : (isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5'),
                  color: msg.sender === 'user' ? '#fff' : (isDark ? '#fff' : '#000'),
                  padding: '10px 16px',
                  borderRadius: msg.sender === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                  maxWidth: '80%',
                  fontSize: 14,
                  lineHeight: 1.5
                }}>
                  {msg.text}
                  {msg.link && (
                    <Button 
                      type="primary" 
                      size="small" 
                      onClick={() => {
                        navigate(msg.link);
                        setIsOpen(false);
                      }}
                      style={{ marginTop: 8, background: '#10b981', borderColor: '#10b981', display: 'block' }}
                    >
                      Xem ngay
                    </Button>
                  )}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Avatar icon={<RobotOutlined />} style={{ background: '#10b981' }} />
                <div style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5', padding: '10px 16px', borderRadius: '4px 16px 16px 16px' }}>
                  <Spin size="small" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{ padding: 16, borderTop: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee' }}>
            <Input 
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onPressEnter={handleSend}
              placeholder="Nhập câu hỏi của bạn..." 
              size="large"
              style={{ borderRadius: 24, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', color: isDark ? '#fff' : '#000' }}
              suffix={
                <Button 
                  type="text" 
                  icon={<SendOutlined style={{ color: '#10b981' }} />} 
                  onClick={handleSend} 
                />
              }
            />
          </div>
        </Card>
      )}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </>
  );
}
