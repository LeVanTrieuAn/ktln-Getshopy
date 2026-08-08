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

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    const userMsg = inputValue.trim();
    const newMessages = [...messages, { sender: 'user', text: userMsg }];
    setMessages(newMessages);
    setInputValue('');
    setIsTyping(true);

    try {
      // Giả lập thời gian AI "suy nghĩ" để hiện hiệu ứng gõ phím chân thật (1.5s)
      await new Promise(resolve => setTimeout(resolve, 1500));

      const response = await fetch('http://localhost:8080/api/b2c/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: messages.slice(-5)
        })
      });
      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      
      setMessages(prev => [...prev, { sender: 'ai', text: data.text, link: data.link }]);
    } catch (error) {
      setMessages(prev => [...prev, { sender: 'ai', text: 'Xin lỗi, hiện tại đường truyền đến Trợ lý AI đang bận. Vui lòng thử lại sau giây lát.' }]);
    } finally {
      setIsTyping(false);
    }
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
          styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' } }}
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
                <div style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5', padding: '12px 16px', borderRadius: '4px 16px 16px 16px' }}>
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
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
        .typing-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .typing-indicator span {
          display: inline-block;
          width: 6px;
          height: 6px;
          background-color: #10b981;
          border-radius: 50%;
          animation: typing 1.4s infinite ease-in-out both;
        }
        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
        @keyframes typing {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </>
  );
}
