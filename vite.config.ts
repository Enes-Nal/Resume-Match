import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { handleAiRequest, ProxyEnv } from './server/proxy';

/** Serves /api/ai locally, mirroring the Vercel function. Keys stay server-side. */
const aiProxy = (env: ProxyEnv): Plugin => ({
  name: 'ai-proxy',
  configureServer(server) {
    server.middlewares.use('/api/ai', async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const host = req.headers.host || 'localhost:3000';
      const request = new Request(`http://${host}/api/ai`, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
      });
      const response = await handleAiRequest(request, env, req.socket.remoteAddress || 'local');
      res.statusCode = response.status;
      response.headers.forEach((v, k) => res.setHeader(k, v));
      if (!response.body) return res.end();
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    });
  },
});

export default defineConfig(({ mode }) => {
  // Load all vars (not just VITE_*) for the server-side proxy only. Nothing here is exposed to the client.
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), tailwindcss(), aiProxy(env)],
    build: {
      // pdfjs-dist uses top-level await
      target: 'esnext',
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext',
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
