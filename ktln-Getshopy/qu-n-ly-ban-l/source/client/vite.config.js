import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.fbx'],

  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: { usePolling: true },
    // ── Proxy /api → backend Express (port 8080) ──────────────────────────────────
    // Giải quyết vấn đề: request vào localhost:5173/api thì Vite
    // không biết xử lý → proxy sang backend 8080 để tránh CORS + 500
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,  // báo lỗi nếu port bận, không fallback sang port khác
  },

  build: {
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        manualChunks: {
          // ── Core React ──────────────────────────────────────────────────
          'vendor-react':   ['react', 'react-dom', 'react-router-dom'],

          // ── Animation ───────────────────────────────────────────────────
          'vendor-gsap':    ['gsap', '@gsap/react'],

          // ── 3D rendering: CỐ Ý không tách chunk riêng ──────────────────
          // Từng có 'vendor-three' / 'vendor-r3f' ở đây. Dạng object của manualChunks
          // kéo cả thư viện phụ thuộc của r3f (zustand, use-sync-external-store...) vào
          // chunk đó; bundle chính cũng dùng các thư viện ấy nên index.html phải
          // modulepreload luôn vendor-three + vendor-r3f (~918 KB JS) ở MỌI trang — kể
          // cả trang admin và điện thoại, nơi không có khung 3D nào (đo 11/11/2026).
          // Để Rollup tự xếp: three + r3f chỉ được import từ Category3DModel (lazy) nên
          // nằm trong chunk lazy của nó, chỉ tải khi trang chủ thật sự dựng mô hình 3D.

          // ── UI (Ant Design) ───────────────────────────────────────────────
          // antd alone is ~1.8MB — must be its own chunk
          'vendor-antd':    ['antd', '@ant-design/icons', '@ant-design/v5-patch-for-react-19'],

          // ── Charts (ECharts) ─────────────────────────────────────────────
          'vendor-charts':  ['echarts', 'echarts-for-react'],

          // ── Maps (Leaflet) ────────────────────────────────────────────────
          'vendor-map':     ['leaflet', 'react-leaflet'],

          // ── PDF export ────────────────────────────────────────────────────
          'vendor-pdf':     ['html2pdf.js'],

          // ── Data fetching & virtualisation ────────────────────────────────
          'vendor-query':   ['@tanstack/react-query', '@tanstack/react-virtual'],

          // ── Date utilities ────────────────────────────────────────────────
          'vendor-utils':   ['dayjs'],
        },
      },
    },
  },
})
