import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { api } from '../services/api';

/**
 * useVoiceInput — ghi âm bằng MediaRecorder rồi gửi lên ai-bot để chuyển thành chữ.
 *
 * Chữ nhận được chỉ được trả qua onText để điền vào ô nhập; hook KHÔNG tự gửi.
 * Người dùng kiểm tra, sửa, rồi tự nhấn Enter.
 *
 * Tham khảo:
 *   MediaRecorder: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
 *   getUserMedia (chỉ chạy ở HTTPS hoặc localhost):
 *     https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
 */

/** Tối đa 15 giây: server dùng express.json() mặc định (100 KB), xem ghi chú ở ai-bot/routes/speech.js. */
export const MAX_RECORD_MS = 15_000;
/** 24 kbps -> 15 giây ~ 45 KB (base64 ~ 60 KB). */
const AUDIO_BITS_PER_SECOND = 24_000;
/** Không gửi nếu ghi quá ngắn (bấm nhầm). */
const MIN_RECORD_MS = 500;
const NOTICE_KEY = 'voice_notice_seen';

const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return CANDIDATE_MIME_TYPES.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Không đọc được âm thanh'));
    reader.readAsDataURL(blob);
  });
}

/** Thông báo lỗi thân thiện theo loại lỗi. */
function explainError(err) {
  const name = err?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Chưa có quyền dùng micro. Vui lòng cho phép micro trong trình duyệt.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'Không tìm thấy micro trên thiết bị.';
  }
  if (name === 'AbortError') return null;
  return err?.message || 'Không nhận được giọng nói, vui lòng thử lại.';
}

/**
 * @param {{ onText: (text: string) => void }} opts
 * @returns {{ supported: boolean, status: 'idle'|'recording'|'processing', toggle: () => void, stop: () => void }}
 */
export default function useVoiceInput({ onText }) {
  const [status, setStatus] = useState('idle');
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const onTextRef = useRef(onText);
  const cancelledRef = useRef(false);

  useEffect(() => { onTextRef.current = onText; }, [onText]);

  // Cần HTTPS hoặc localhost; thiếu thì ẩn nút thay vì để người dùng bấm rồi lỗi.
  const supported =
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  const releaseStream = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, []);

  const start = useCallback(async () => {
    cancelledRef.current = false;

    if (!localStorage.getItem(NOTICE_KEY)) {
      localStorage.setItem(NOTICE_KEY, '1');
      message.info('Giọng nói được gửi tới Google Gemini để chuyển thành chữ và không được lưu lại.', 5);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      });
      recorderRef.current = rec;
      chunksRef.current = [];
      const startedAt = Date.now();

      rec.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };

      rec.onstop = async () => {
        releaseStream();
        const heldMs = Date.now() - startedAt;
        const type = rec.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];

        if (cancelledRef.current) { setStatus('idle'); return; }
        if (heldMs < MIN_RECORD_MS || blob.size === 0) {
          setStatus('idle');
          message.warning('Ghi âm quá ngắn, vui lòng giữ micro và nói lại.');
          return;
        }

        setStatus('processing');
        const controller = new AbortController();
        abortRef.current = controller;
        // Server cắt ở 30 giây; client chờ lâu hơn một chút để nhận thông báo lỗi.
        const timeoutId = setTimeout(() => controller.abort(), 32_000);
        try {
          const base64 = await blobToBase64(blob);
          const result = await api.ai.transcribe(base64, type, controller.signal);
          if (cancelledRef.current) return;
          const text = (result?.text || '').trim();
          if (!text) {
            message.warning('Không nghe rõ, vui lòng nói lại.');
          } else {
            onTextRef.current?.(text);
          }
        } catch (err) {
          if (!cancelledRef.current) {
            message.error(err?.name === 'AbortError'
              ? 'Xử lý giọng nói quá lâu, vui lòng thử lại.'
              : (explainError(err) || 'Không nhận được giọng nói, vui lòng thử lại.'));
          }
        } finally {
          clearTimeout(timeoutId);
          abortRef.current = null;
          setStatus('idle');
        }
      };

      rec.start();
      setStatus('recording');
      timerRef.current = setTimeout(stop, MAX_RECORD_MS);
    } catch (err) {
      releaseStream();
      setStatus('idle');
      const text = explainError(err);
      if (text) message.error(text);
    }
  }, [releaseStream, stop]);

  const toggle = useCallback(() => {
    if (status === 'recording') stop();
    else if (status === 'idle') start();
  }, [status, start, stop]);

  // Dọn dẹp khi component bị gỡ (đóng chat, rời trang): tắt micro, hủy request.
  useEffect(() => () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    releaseStream();
  }, [releaseStream]);

  return { supported, status, toggle, stop };
}
