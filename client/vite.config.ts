import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Login is uwidget's, never a copy (uwidget/docs/LOGIN.md).
const login = fileURLToPath(new URL('../../uwidget/client/src/login', import.meta.url));

// webappmonitor — frontend dev server.
// Proxies /api/* to the backend so the client never hardcodes a base URL.
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom', 'styled-components', 'firebase'],
    alias: { '@login': login },
  },
  server: {
    fs: { allow: ['.', login] },
    port: 3170,
    strictPort: true,
    host: 'localhost',
    allowedHosts: ['webapp-monitor.uskiano.com'],
    proxy: {
      '/api': 'http://localhost:8170',
    },
  },
});
