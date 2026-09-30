import { handleAiRequest, ProxyEnv } from '../server/proxy';

// Vercel serverless function: POST /api/ai (chat completions), GET /api/ai (status).
const handle = (request: Request) =>
  handleAiRequest(request, process.env as ProxyEnv, (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown');

export const GET = handle;
export const POST = handle;
