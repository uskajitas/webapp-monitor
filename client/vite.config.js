import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// webappmonitor — frontend dev server.
// Proxies /api/* to the backend so the client never hardcodes a base URL.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 3170,
        strictPort: true,
        host: 'localhost',
        allowedHosts: ['webapp-monitor.uskiano.com'],
        proxy: {
            '/api': 'http://localhost:8170',
        },
    },
});
