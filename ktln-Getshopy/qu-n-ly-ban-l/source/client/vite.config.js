import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.glb', '**/*.gltf'],

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

          // ── 3D rendering ─────────────────────────────────────────────────
          'vendor-three':   ['three'],
          'vendor-r3f':     ['@react-three/fiber', '@react-three/drei'],

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
