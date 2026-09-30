/**
 * Server-side proxy to OpenRouter so the site can offer AI with no user setup.
 * The API key lives only in the server environment (OPENROUTER_API_KEY) and is never sent to the browser.
 * Used by the Vercel function in /api/ai.ts and by the Vite dev server.
 */

export interface ProxyEnv {
  OPENROUTER_API_KEY?: string;
  /** Comma-separated model ids, tried in order by OpenRouter. */
  OPENROUTER_MODELS?: string;
  /** Comma-separated extra origins allowed to call the proxy (the site's own origin is always allowed). */
  ALLOWED_ORIGINS?: string;
  /** Requests per IP per 10 minutes. */
  RATE_LIMIT?: string;
}

const DEFAULT_MODELS = ['qwen/qwen3.8-27b:free', 'google/gemma-4-31b-it:free', 'openrouter/free'];
const MAX_INPUT_CHARS = 120_000;
const MAX_TOKENS = 8000;
const WINDOW_MS = 10 * 60 * 1000;

// Best-effort, per-instance limiter. Pair it with a credit limit on the key in OpenRouter.
const hits = new Map<string, number[]>();
const limited = (ip: string, limit: number) => {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > limit;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const fail = (status: number, message: string) => json(status, { error: { message } });

export async function handleAiRequest(req: Request, env: ProxyEnv, clientIp = 'unknown'): Promise<Response> {
  const key = env.OPENROUTER_API_KEY?.trim();

  if (req.method === 'GET') return json(200, { configured: !!key });
  if (req.method !== 'POST') return fail(405, 'Method not allowed');
  if (!key) return fail(503, 'The built-in AI is not configured on this server. Add your own key in Settings.');

  // Only accept browser calls from this site (or explicitly allowed origins).
  const origin = req.headers.get('origin');
  if (origin) {
    const self = new URL(req.url).host;
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    let originHost = '';
    try {
      originHost = new URL(origin).host;
    } catch {
      /* invalid origin */
    }
    if (originHost !== self && !allowed.includes(origin)) return fail(403, 'Origin not allowed');
  }

  if (limited(clientIp, parseInt(env.RATE_LIMIT || '', 10) || 60)) {
    return fail(429, 'Too many requests. Please wait a few minutes.');
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON body');
  }
  const messages = body?.messages;
  if (!Array.isArray(messages) || !messages.length) return fail(400, 'messages is required');
  const valid = messages.every(
    (m: any) => m && ['system', 'user', 'assistant'].includes(m.role) && typeof m.content === 'string'
  );
  if (!valid) return fail(400, 'Invalid messages');
  const size = messages.reduce((n: number, m: any) => n + m.content.length, 0);
  if (size > MAX_INPUT_CHARS) return fail(413, 'Input too long');

  const models = (env.OPENROUTER_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
  const upstreamBody: Record<string, unknown> = {
    models: models.length ? models : DEFAULT_MODELS,
    messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    temperature: typeof body.temperature === 'number' ? Math.max(0, Math.min(1.5, body.temperature)) : 0.5,
    max_tokens: Math.min(Number(body.max_tokens) || MAX_TOKENS, MAX_TOKENS),
    stream: !!body.stream,
  };
  if (body.response_format?.type === 'json_object') upstreamBody.response_format = { type: 'json_object' };

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': origin || 'https://resume-match.app',
      'X-Title': 'Resume Match',
    },
    body: JSON.stringify(upstreamBody),
  });

  // Pass the response (including SSE streams) straight through.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
