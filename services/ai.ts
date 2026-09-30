/**
 * Provider-agnostic AI client. Every supported provider exposes an
 * OpenAI-compatible /chat/completions endpoint, so one code path handles all of them.
 * "builtin" goes through this site's own /api/ai proxy, which holds the key server-side.
 */

export type ProviderId = 'builtin' | 'pollinations' | 'gemini' | 'groq' | 'openrouter';

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  endpoint: string;
  defaultModel: string;
  needsKey: boolean;
  keyUrl?: string;
  blurb: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  builtin: {
    id: 'builtin',
    name: 'Built-in AI',
    endpoint: '/api/ai',
    defaultModel: 'server default',
    needsKey: false,
    blurb: 'Included with the site. No setup needed.',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    defaultModel: 'gemini-2.5-flash',
    needsKey: true,
    keyUrl: 'https://aistudio.google.com/apikey',
    blurb: 'Generous free tier. Best quality for long resumes.',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    needsKey: true,
    keyUrl: 'https://console.groq.com/keys',
    blurb: 'Free tier with very fast responses.',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'openrouter/free',
    needsKey: true,
    keyUrl: 'https://openrouter.ai/keys',
    blurb: 'Free ":free" models from many labs.',
  },
  pollinations: {
    id: 'pollinations',
    name: 'Pollinations',
    endpoint: 'https://gen.pollinations.ai/v1/chat/completions',
    defaultModel: 'openai',
    needsKey: true,
    keyUrl: 'https://enter.pollinations.ai',
    blurb: 'Free daily credits for GPT-class models.',
  },
};

export interface AISettings {
  provider: ProviderId;
  keys: Partial<Record<ProviderId, string>>;
  models: Partial<Record<ProviderId, string>>;
  /** Retry with the other configured providers if the chosen one fails. */
  fallback: boolean;
}

const SETTINGS_KEY = 'resume_match_ai_settings';

export const loadSettings = (): AISettings => {
  const defaults: AISettings = { provider: 'builtin', keys: {}, models: {}, fallback: true };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const saved = { ...defaults, ...JSON.parse(raw) } as AISettings & { v?: number };
    // Settings saved before the built-in provider existed: switch to it unless the user added a key.
    if (!saved.v && !saved.keys[saved.provider]) saved.provider = 'builtin';
    if (!PROVIDERS[saved.provider]) saved.provider = 'builtin';
    return saved;
  } catch {
    return defaults;
  }
};

export const saveSettings = (s: AISettings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, v: 2 }));
  } catch {
    /* storage unavailable */
  }
};

const keyFor = (s: AISettings, id: ProviderId) => (s.keys[id] || '').trim();

/** null until checked; false when the server has no key configured. */
let builtinAvailable: boolean | null = null;

export async function checkBuiltin(): Promise<boolean> {
  try {
    const res = await fetch('/api/ai', { method: 'GET' });
    builtinAvailable = res.ok && !!(await res.json())?.configured;
  } catch {
    builtinAvailable = false;
  }
  return builtinAvailable;
}

export const isProviderReady = (s: AISettings, id: ProviderId = s.provider) =>
  id === 'builtin' ? builtinAvailable !== false : !PROVIDERS[id].needsKey || keyFor(s, id).length > 0;

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompleteOptions {
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** When given, the response is streamed and each text delta is passed here. */
  onToken?: (delta: string, full: string) => void;
}

let settingsRef: AISettings = loadSettings();
export const setActiveSettings = (s: AISettings) => {
  settingsRef = s;
};
export const getActiveSettings = () => settingsRef;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function callProvider(id: ProviderId, messages: ChatTurn[], opts: CompleteOptions): Promise<string> {
  const p = PROVIDERS[id];
  const key = keyFor(settingsRef, id);
  if (p.needsKey && !key) throw new Error(`${p.name} needs an API key. Add one in Settings.`);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;
  if (id === 'openrouter') headers['X-Title'] = 'Resume Match';

  const body: Record<string, unknown> = {
    model: settingsRef.models[id]?.trim() || p.defaultModel,
    messages,
    temperature: opts.temperature ?? (opts.json ? 0.3 : 0.7),
    stream: !!opts.onToken,
  };
  if (opts.json) body.response_format = { type: 'json_object' };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;

  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(p.endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: opts.signal });
    if (res.status !== 429 && res.status < 500) break;
    if (attempt < 2) await sleep(1500 * (attempt + 1));
  }
  if (!res!.ok) {
    let detail = '';
    const body = await res!.text().catch(() => '');
    try {
      const j = JSON.parse(body);
      detail = j?.error?.message || j?.error || j?.message || '';
    } catch {
      detail = body.slice(0, 160);
    }
    if (res!.status === 401 || res!.status === 403) detail = `check your API key. ${detail}`;
    if (res!.status === 402 || res!.status === 429) detail = `free-tier limit reached, try again shortly or switch provider. ${detail}`;
    throw new Error(`${p.name} error ${res!.status}${detail ? `: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
  }

  if (!opts.onToken) {
    const data = await res!.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    if (!text) throw new Error(`${p.name} returned an empty response.`);
    return text;
  }

  // Server-sent events stream
  const reader = res!.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const delta: string = JSON.parse(payload)?.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          full += delta;
          opts.onToken(delta, full);
        }
      } catch {
        /* partial / keepalive line */
      }
    }
  }
  if (!full) throw new Error(`${p.name} returned an empty response.`);
  return full;
}

export const anyProviderReady = (s: AISettings) => (Object.keys(PROVIDERS) as ProviderId[]).some(id => isProviderReady(s, id));

/** Send a chat completion using the active provider, then any other configured provider if fallback is on. */
export async function complete(messages: ChatTurn[], opts: CompleteOptions = {}): Promise<string> {
  const primary = settingsRef.provider;
  const order = [primary];
  if (settingsRef.fallback) {
    for (const id of Object.keys(PROVIDERS) as ProviderId[]) if (id !== primary && isProviderReady(settingsRef, id)) order.push(id);
  }
  let lastErr: unknown;
  for (const id of order) {
    try {
      return await callProvider(id, messages, opts);
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      console.warn(`[ai] ${id} failed`, err);
      lastErr = err;
    }
  }
  throw lastErr;
}

/** Pull the first JSON object out of a model response, tolerating code fences and chatter. */
export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('The AI response was not valid JSON. Try again or switch provider in Settings.');
  }
}

export async function completeJson<T>(messages: ChatTurn[], opts: Omit<CompleteOptions, 'json' | 'onToken'> = {}): Promise<T> {
  const text = await complete(messages, { ...opts, json: true });
  try {
    return parseJson<T>(text);
  } catch {
    // One repair attempt: ask the model to fix its own output.
    const repaired = await complete(
      [
        { role: 'system', content: 'You fix malformed JSON. Output only the corrected JSON object.' },
        { role: 'user', content: text.slice(0, 12000) },
      ],
      { ...opts, json: true, temperature: 0 }
    );
    return parseJson<T>(repaired);
  }
}
