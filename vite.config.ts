import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.local\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 horas
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Security Rounds Control System',
        short_name: 'SecRounds',
        description: 'System for managing security rounds and checkpoints',
        theme_color: '#1E3A8A',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: '0.0.0.0',     // aceita conexões LAN
    port: 8443,          // mesma porta HTTPS do backend
    https: {
      key: fs.readFileSync('./server/key.pem'),
      cert: fs.readFileSync('./server/cert.pem'),
    },
    proxy: {
      '/api': {
        target: 'https://10.0.0.146:8443', // backend também HTTPS
        changeOrigin: true,
        secure: false, // necessário se for certificado self-signed
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
});
