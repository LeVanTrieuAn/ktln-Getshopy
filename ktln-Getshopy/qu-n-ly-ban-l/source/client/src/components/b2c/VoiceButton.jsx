import { AudioOutlined, LoadingOutlined } from '@ant-design/icons';
import useVoiceInput from '../../hooks/useVoiceInput';

/**
 * Nút micro dùng chung cho chatbot và ô tìm kiếm.
 * Bấm để bắt đầu ghi, bấm lần nữa để dừng (hoặc tự dừng sau 15 giây).
 * Chữ nhận được đi vào onText; nút KHÔNG tự gửi.
 *
 * Ẩn hoàn toàn nếu trình duyệt không hỗ trợ hoặc không ở HTTPS/localhost.
 */
export default function VoiceButton({ onText, disabled = false, isDark = false, size = 34, fontSize = 15, id }) {
  const { supported, status, toggle } = useVoiceInput({ onText });
  if (!supported) return null;

  const recording = status === 'recording';
  const processing = status === 'processing';
  const blocked = disabled || processing;

  const title = recording
    ? 'Nhấn để dừng ghi âm'
    : processing
      ? 'Đang chuyển giọng nói thành chữ...'
      : 'Nói để nhập bằng giọng nói';

  const idleBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const idleColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={toggle}
        disabled={blocked}
        title={title}
        aria-label={title}
        aria-pressed={recording}
        className={recording ? 'voice-btn voice-btn-recording' : 'voice-btn'}
        style={{
          width: size, height: size, borderRadius: '50%', border: 'none', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: recording ? '#dc2626' : idleBg,
          color: recording ? '#ffffff' : idleColor,
          fontSize, cursor: blocked ? 'default' : 'pointer',
          transition: 'background 0.2s, color 0.2s',
          opacity: blocked && !processing ? 0.4 : 1,
          padding: 0,
        }}
      >
        {processing ? <LoadingOutlined spin /> : <AudioOutlined />}
      </button>
      <style>{`
        .voice-btn-recording { animation: voice-pulse 1.2s ease-in-out infinite; }
        @keyframes voice-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.55); }
          70%  { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); }
          100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
        }
      `}</style>
    </>
  );
}
