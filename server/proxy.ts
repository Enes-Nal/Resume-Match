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

// Specific capable models only: the openrouter/free router can land on tiny or safety-classifier models that return no usable JSON.
// Free models are often rate-limited or overloaded, so there are several, tried in groups (OpenRouter allows 3 per request).
const DEFAULT_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'dots-studio/dots-3-note-preview:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'qwen/qwen3.8-27b:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
];
const MODELS_PER_REQUEST = 3;
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
  const all = models.length ? models : DEFAULT_MODELS;
  const groups: string[][] = [];
  for (let i = 0; i < all.length; i += MODELS_PER_REQUEST) groups.push(all.slice(i, i + MODELS_PER_REQUEST));

  const upstreamBody: Record<string, unknown> = {
    messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    temperature: typeof body.temperature === 'number' ? Math.max(0, Math.min(1.5, body.temperature)) : 0.5,
    max_tokens: Math.min(Number(body.max_tokens) || MAX_TOKENS, MAX_TOKENS),
    stream: !!body.stream,
    // Hidden reasoning made free models take minutes per step (e.g. 150s vs 7s) without better JSON.
    reasoning: { enabled: false },
  };
  if (body.response_format?.type === 'json_object') upstreamBody.response_format = { type: 'json_object' };

  // Try each group of models until one answers. The last group's result is returned as-is.
  let last: Response = fail(503, 'All AI models are busy. Please try again in a minute.');
  for (const [i, group] of groups.entries()) {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': origin || 'https://resume-match.app',
        'X-Title': 'Resume Match',
      },
      body: JSON.stringify({ ...upstreamBody, models: group }),
    }).catch(() => null);
    if (!upstream) continue;
    const result = await checkUpstream(upstream);
    last = result.response;
    // Bad requests and auth errors will not improve with another model.
    if (result.ok || i === groups.length - 1 || [400, 401, 403, 413].includes(upstream.status)) return result.response;
  }
  return last;
}

const passthrough = (body: BodyInit | null, status: number, contentType: string) =>
  new Response(body, { status, headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' } });

/**
 * Free models often fail softly: HTTP 200 with an error body, or a stream that carries only an error.
 * Read enough of the response to tell, then hand back an equivalent Response.
 */
async function checkUpstream(upstream: Response): Promise<{ ok: boolean; response: Response }> {
  const type = upstream.headers.get('content-type') || 'application/json';
  if (!upstream.ok || !type.includes('event-stream')) {
    const text = await upstream.text();
    let ok = upstream.ok;
    try {
      const j = JSON.parse(text);
      ok = ok && !j.error && !!j.choices?.[0]?.message?.content;
    } catch {
      ok = false;
    }
    return { ok, response: passthrough(text, ok || !upstream.ok ? upstream.status : 502, type) };
  }

  // Stream: buffer until the first content delta (success) or an error chunk, then pass the rest through.
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  const seen: Uint8Array[] = [];
  let text = '';
  let ok = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    seen.push(value);
    text += decoder.decode(value, { stream: true });
    if (/"error"\s*:/.test(text)) break;
    if (/"(content|reasoning)"\s*:\s*"[^"]/.test(text)) {
      ok = true;
      break;
    }
  }
  if (!ok) {
    reader.cancel().catch(() => undefined);
    return { ok, response: passthrough(text, 200, type) };
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      seen.forEach(c => controller.enqueue(c));
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel() {
      reader.cancel().catch(() => undefined);
    },
  });
  return { ok, response: passthrough(stream, 200, type) };
}
