import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiKey = env.GEMINI_API_KEY || env.API_KEY || '';

    // Log in dev mode to help with debugging
    if (mode === 'development') {
      console.log('Environment variables loaded:');
      console.log('  GEMINI_API_KEY:', apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'NOT FOUND');
      if (!apiKey) {
        console.warn('⚠️  WARNING: GEMINI_API_KEY not found in .env file');
        console.warn('   Please create a .env file with: GEMINI_API_KEY=your_api_key_here');
      }
    }

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey)
      },
      build: {
        // Allow dependencies like pdfjs-dist (which use top‑level await) to build correctly
        target: 'esnext'
      },
      optimizeDeps: {
        esbuildOptions: {
          target: 'esnext'
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
