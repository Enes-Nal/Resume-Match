// Explicit .js extension: package.json is "type": "module", so Node needs it at runtime on Vercel.
import { handleAiRequest } from '../server/proxy.js';
import type { ProxyEnv } from '../server/proxy.js';

// Vercel serverless function: POST /api/ai (chat completions), GET /api/ai (status).
const handle = (request: Request) =>
  handleAiRequest(request, process.env as ProxyEnv, (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown');

export const GET = handle;
export const POST = handle;
