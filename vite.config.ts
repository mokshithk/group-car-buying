import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { smtpEmailPlugin } from './src/server/smtpPlugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), smtpEmailPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
});
