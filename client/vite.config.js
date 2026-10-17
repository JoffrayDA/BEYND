import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Client is mobile-first PWA. Design-system lives one level up, so allow fs
// access to the repo root and let esbuild treat its .jsx as JSX.
export default defineConfig({
  plugins: [
    react({ include: /\.(jsx|js)$/ }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Elo de vie',
        short_name: 'Elo de vie',
        description: 'Tes objectifs de vie, un Elo par catégorie',
        theme_color: '#1C1B19',
        background_color: '#1C1B19',
        display: 'standalone',
        start_url: '/',
        icons: [],
      },
    }),
  ],
  esbuild: { loader: 'jsx', include: /\.(jsx|js)$/ },
  optimizeDeps: { esbuildOptions: { loader: { '.js': 'jsx' } } },
  server: {
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://localhost:8787' },
  },
});
