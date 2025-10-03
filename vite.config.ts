import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'pdf-lib': 'pdf-lib/dist/pdf-lib.esm.js',
    },
  },
});
