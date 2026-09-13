import { useState, useRef, useEffect } from 'react';
import { Rate, Spin } from 'antd';
import {
  RobotOutlined, UserOutlined, SendOutlined, CloseOutlined,
  MessageOutlined, CameraOutlined, PictureOutlined,
} from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ─────────────────────────────────────────────────────────────────────────────
// Render markdown **bold** và *italic* thành JSX
// ─────────────────────────────────────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const parts = [];
    const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
      if (match[1] !== undefined) parts.push(<strong key={match.index}>{match[1]}</strong>);
      else if (match[2] !== undefined) parts.push(<em key={match.index}>{match[2]}</em>);
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < line.length) parts.push(line.slice(lastIndex));
    return (
      <span key={lineIdx}>
        {parts.length > 0 ? parts : line}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Resize ảnh phía client bằng Canvas API trước khi encode Base64
// ─────────────────────────────────────────────────────────────────────────────
function resizeAndEncode(file, maxPx = 800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được file ảnh')); };
    img.src = url;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Cards — Hiển thị kết quả visual search trong chat bubble
// ─────────────────────────────────────────────────────────────────────────────
function ProductCards({ products, isDark, onNavigate }) {
  if (!products || products.length === 0) return null;
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {products.map(p => (
        <div
          key={p.id}
          onClick={() => onNavigate(`/product/${p.id}`)}
          style={{
            display: 'flex', gap: 10, padding: '8px 10px',
            borderRadius: 10,
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            cursor: 'pointer', transition: 'all 0.18s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
            e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
            e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
          }}
        >
          <img
            src={p.image || 'https://placehold.co/56x56/f5f5f5/333?text=?'}
            alt={p.name}
            style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8, background: isDark ? '#111' : '#f5f5f5', flexShrink: 0 }}
            onError={e => { e.target.src = 'https://placehold.co/56x56/f5f5f5/333?text=?'; }}
          />
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: isDark ? '#e2e8f0' : '#1e293b',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{p.name}</div>
            {p.rating && <Rate disabled defaultValue={p.rating} style={{ fontSize: 9, color: isDark ? '#ffffff' : '#000000', marginTop: 2 }} />}
            <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)', marginTop: 1 }}>
              {Number(p.price).toLocaleString('vi-VN')} ₫
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)'}`,
              borderRadius: 12, padding: '2px 8px',
              whiteSpace: 'nowrap',
            }}>Xem ngay</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CHATBOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function AIChatbot() {
  const { isDark } = useApp();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'ai', text: 'Xin chào! Tôi là Trợ lý ảo Getshopy\nBạn có thể **nhắn tin** hoặc **gửi ảnh sản phẩm** để tôi tìm sản phẩm tương tự trong cửa hàng nhé!' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages, isTyping, isAnalyzing]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsVisible(true), 10);
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // ─── Gửi tin nhắn văn bản ───────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputValue.trim()) return;
    const userMsg = inputValue.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInputValue('');
    setIsTyping(true);
    try {
      const response = await fetch(`${API_BASE}/b2c/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: messages.slice(-5) }),
      });
      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: data.text,
        link: data.link,
        products: data.products || [],
      }]);
    } catch {
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: 'Xin lỗi, Trợ lý AI đang bận. Vui lòng thử lại sau giây lát.',
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!e.target.files) return;
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessages(prev => [...prev, { sender: 'ai', text: 'Dạ ảnh quá lớn (tối đa 5MB) ạ!' }]);
      return;
    }
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setMessages(prev => [...prev, { sender: 'ai', text: 'Dạ chỉ hỗ trợ định dạng JPG, PNG, WEBP, GIF ạ!' }]);
      return;
    }

    // Dùng base64 làm preview — không bị mất khi revokeObjectURL
    const imageBase64 = await resizeAndEncode(file, 800);
    setMessages(prev => [...prev, { sender: 'user', text: 'Tìm sản phẩm tương tự ảnh này', imagePreview: imageBase64 }]);
    setIsAnalyzing(true);
    try {
      const response = await fetch(`${API_BASE}/b2c/visual-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: data.text,
        products: data.products || [],
        visualCaption: data.caption,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: 'Dạ em đang gặp sự cố khi phân tích ảnh. Vui lòng thử lại sau ạ!',
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // colours
  const bg = isDark ? '#0f172a' : '#ffffff';
  const msgAreaBg = isDark ? '#0f172a' : '#f8fafc';
  const aiBubble = isDark ? '#1e293b' : '#f1f5f9';
  const aiText = isDark ? '#e2e8f0' : '#1e293b';
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  return (
    <>
      {/* ── Floating Action Button ── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Mở trợ lý AI"
          style={{
            position: 'fixed', bottom: 28, right: 28,
            width: 56, height: 56, zIndex: 9999,
            borderRadius: '50%', border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`,
            cursor: 'pointer',
            background: isDark ? '#ffffff' : '#000000',
            boxShadow: isDark
              ? '0 8px 32px rgba(255,255,255,0.12), 0 2px 8px rgba(0,0,0,0.3)'
              : '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, color: isDark ? '#000000' : '#ffffff',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <MessageOutlined />
        </button>
      )}

      {/* ── Chat Window ── */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: 28, right: 28,
          width: 400, height: 600, zIndex: 9999,
          borderRadius: 20,
          boxShadow: isDark
            ? '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)'
            : '0 24px 64px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: bg,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
        }}>

          {/* ── Header ── */}
          <div style={{
            padding: '16px 20px',
            background: isDark ? '#ffffff' : '#000000',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 19, color: isDark ? '#000000' : '#ffffff',
                  border: `2px solid ${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)'}`,
                }}>
                  <RobotOutlined />
                </div>
                <span style={{
                  position: 'absolute', bottom: 1, right: 1,
                  width: 9, height: 9, borderRadius: '50%',
                  background: isDark ? '#000000' : '#ffffff',
                  border: `2px solid ${isDark ? '#ffffff' : '#000000'}`,
                }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: isDark ? '#000000' : '#ffffff', lineHeight: 1.3 }}>
                  AI Shopping Assistant
                </div>
                <div style={{ fontSize: 11, color: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)', marginTop: 1 }}>
                  ● Online · Phản hồi ngay
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: isDark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)',
                color: isDark ? '#000000' : '#ffffff', fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.28)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)'; }}
            >
              <CloseOutlined />
            </button>
          </div>


          {/* ── Messages Area ── */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 12,
            background: msgAreaBg,
            scrollbarWidth: 'thin',
            scrollbarColor: isDark ? '#334155 transparent' : '#cbd5e1 transparent',
          }}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
                  gap: 8, alignItems: 'flex-end',
                  animation: 'msg-in 0.22s ease both',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: '#fff',
                  background: msg.sender === 'user'
                    ? (isDark ? '#ffffff' : '#000000')
                    : (isDark ? '#2a2a2a' : '#f0f0f0'),
                  boxShadow: 'none',
                }}>
                  {msg.sender === 'user' ? <UserOutlined style={{ color: isDark ? '#000000' : '#ffffff' }} /> : <RobotOutlined style={{ color: isDark ? '#ffffff' : '#000000' }} />}
                </div>

                {/* Bubble */}
                <div style={{
                  maxWidth: '78%',
                  background: msg.sender === 'user'
                    ? (isDark ? '#ffffff' : '#000000')
                    : (isDark ? '#1e1e1e' : '#f4f4f4'),
                  color: msg.sender === 'user'
                    ? (isDark ? '#000000' : '#ffffff')
                    : (isDark ? '#e2e8f0' : '#1e293b'),
                  padding: '12px 15px',
                  borderRadius: msg.sender === 'user'
                    ? '18px 4px 18px 18px'
                    : '4px 18px 18px 18px',
                  fontSize: 14, lineHeight: 1.65,
                  boxShadow: `0 1px 4px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'}`,
                  border: msg.sender === 'ai' ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` : 'none',
                }}>
                  {/* Image preview */}
                  {msg.imagePreview && (
                    <img
                      src={msg.imagePreview}
                      alt="Ảnh tìm kiếm"
                      style={{
                        width: '100%', maxWidth: 180, borderRadius: 10,
                        marginBottom: 8, display: 'block', objectFit: 'cover',
                        border: '2px solid rgba(255,255,255,0.3)',
                      }}
                    />
                  )}

                  {/* Text */}
                  <div>{msg.sender === 'ai' ? renderMarkdown(msg.text) : msg.text}</div>

                  {/* BLIP caption */}
                  {msg.visualCaption && (
                    <div style={{
                      marginTop: 8, fontSize: 10, opacity: 0.5,
                      fontStyle: 'italic',
                      borderTop: '1px solid rgba(128,128,128,0.2)', paddingTop: 6,
                    }}>
                      BLIP: "{msg.visualCaption}"
                    </div>
                  )}

                  {/* Link button */}
                  {msg.link && (
                    <button
                      onClick={() => { navigate(msg.link); setIsOpen(false); }}
                      style={{
                        marginTop: 10, padding: '6px 16px',
                        borderRadius: 20,
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'}`,
                        cursor: 'pointer',
                        background: 'transparent',
                        color: msg.sender === 'user' ? (isDark ? '#000000' : '#ffffff') : (isDark ? '#ffffff' : '#000000'),
                        fontSize: 12, fontWeight: 600,
                        transition: 'all 0.15s',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                    >
                      Xem ngay
                    </button>
                  )}

                  {/* Product cards */}
                  {msg.products && msg.products.length > 0 && (
                    <ProductCards
                      products={msg.products}
                      isDark={isDark}
                      onNavigate={(path) => { navigate(path); setIsOpen(false); }}
                    />
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', animation: 'msg-in 0.22s ease both' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, color: isDark ? '#000000' : '#ffffff',
                  background: isDark ? '#ffffff' : '#000000',
                }}>
                  <RobotOutlined />
                </div>
                <div style={{
                  background: aiBubble, padding: '12px 16px',
                  borderRadius: '4px 18px 18px 18px',
                  boxShadow: `0 2px 8px ${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)'}`,
                }}>
                  <div className="chatbot-typing">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}

            {/* Analyzing indicator */}
            {isAnalyzing && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', animation: 'msg-in 0.22s ease both' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, color: isDark ? '#000000' : '#ffffff',
                  background: isDark ? '#ffffff' : '#000000',
                }}>
                  <RobotOutlined />
                </div>
                <div style={{
                  background: aiBubble, padding: '10px 14px',
                  borderRadius: '4px 18px 18px 18px', fontSize: 12,
                  color: isDark ? '#94a3b8' : '#64748b',
                  boxShadow: `0 2px 8px ${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Spin size="small" />
                    <span style={{ fontWeight: 500 }}>Đang phân tích ảnh bằng AI...</span>
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.55, marginTop: 4 }}>
                    BLIP Captioning → Qwen2.5 Analysis
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input Area ── */}
          <div style={{
            padding: '10px 12px 14px',
            background: bg,
            borderTop: `1px solid ${border}`,
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
              borderRadius: 28,
              border: `1.5px solid ${border}`,
              padding: '4px 4px 4px 6px',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
              onFocus={() => { }}
            >
              {/* Camera upload button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handleImageSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isTyping || isAnalyzing}
                title="Gửi ảnh để tìm sản phẩm tương tự"
                style={{
                  width: 34, height: 34, borderRadius: '50%', border: 'none', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)', fontSize: 15, cursor: 'pointer',
                  transition: 'all 0.2s',
                  opacity: (isTyping || isAnalyzing) ? 0.4 : 1,
                }}
                onMouseEnter={e => {
                  if (!isTyping && !isAnalyzing) {
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
                }}
              >
                <PictureOutlined />
              </button>

              {/* Text input */}
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSend(); }}
                placeholder="Nhắn tin cho Trợ lý AI..."
                disabled={isTyping || isAnalyzing}
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  background: 'transparent',
                  fontSize: 13, color: isDark ? '#e2e8f0' : '#1e293b',
                  padding: '6px 4px',
                  caretColor: isDark ? '#ffffff' : '#000000',
                }}
              />

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isTyping || isAnalyzing}
                style={{
                  width: 36, height: 36, borderRadius: '50%', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: inputValue.trim()
                    ? (isDark ? '#ffffff' : '#000000')
                    : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                  color: inputValue.trim()
                    ? (isDark ? '#000000' : '#ffffff')
                    : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'),
                  fontSize: 15, cursor: inputValue.trim() ? 'pointer' : 'default',
                  transition: 'all 0.2s', flexShrink: 0,
                  boxShadow: 'none',
                }}
                onMouseEnter={e => { if (inputValue.trim()) e.currentTarget.style.transform = 'scale(1.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <SendOutlined style={{ transform: 'rotate(-45deg)', marginTop: -2 }} />
              </button>
            </div>

          </div>
        </div>
      )}

      <style>{`
        @keyframes msg-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .chatbot-typing {
          display: flex; align-items: center; gap: 4px;
        }
        .chatbot-typing span {
          display: inline-block; width: 6px; height: 6px;
          background: currentColor; border-radius: 50%;
          animation: chatbot-dot 1.4s infinite ease-in-out both;
        }
        .chatbot-typing span:nth-child(1) { animation-delay: -0.32s; }
        .chatbot-typing span:nth-child(2) { animation-delay: -0.16s; }
        @keyframes chatbot-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
