import React, { useState } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { Sheet } from './Sheet';
import { Button, Label } from './ui';
import { AISettings, PROVIDERS, ProviderId, complete, isProviderReady, setActiveSettings, getActiveSettings } from '../services/ai';

interface Props {
  open: boolean;
  onClose: () => void;
  settings: AISettings;
  onChange: (s: AISettings) => void;
}

export const SettingsSheet: React.FC<Props> = ({ open, onClose, settings, onChange }) => {
  const [test, setTest] = useState<{ state: 'idle' | 'running' | 'ok' | 'fail'; msg?: string }>({ state: 'idle' });
  const p = PROVIDERS[settings.provider];

  const runTest = async () => {
    setTest({ state: 'running' });
    const prev = getActiveSettings();
    setActiveSettings({ ...settings, fallback: false });
    const started = performance.now();
    try {
      await complete([{ role: 'user', content: 'Reply with the single word: ready' }], { temperature: 0 });
      setTest({ state: 'ok', msg: `Connected in ${((performance.now() - started) / 1000).toFixed(1)}s` });
    } catch (e) {
      setTest({ state: 'fail', msg: (e as Error).message });
    } finally {
      setActiveSettings(prev);
    }
  };

  const set = (patch: Partial<AISettings>) => {
    setTest({ state: 'idle' });
    onChange({ ...settings, ...patch });
  };

  return (
    <Sheet open={open} onClose={onClose} title="AI provider">
      <p className="t-small text-slate mb-6">
        Built-in AI works with no setup. If it is busy or you want a different model, use your own free key from any provider below.
        Your keys stay in this browser and are sent only to that provider.
      </p>

      <div className="grid gap-3">
        {(Object.keys(PROVIDERS) as ProviderId[]).map(id => {
          const info = PROVIDERS[id];
          const active = settings.provider === id;
          return (
            <button
              key={id}
              onClick={() => set({ provider: id })}
              className={`text-left rounded-[20px] px-5 py-4 bg-white transition-shadow ${
                active ? 'ring-2 ring-cta' : 'ring-1 ring-control hover:ring-steel'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold tracking-[-0.24px]">{info.name}</span>
                    {id === 'builtin' && <span className="t-label">{isProviderReady(settings, 'builtin') ? 'Default' : 'Not configured on this server'}</span>}
                    {id !== settings.provider && isProviderReady(settings, id) && <span className="t-caption text-good">Key added</span>}
                  </div>
                  <p className="t-caption text-slate mt-0.5">{info.blurb}</p>
                </div>
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    active ? 'bg-cta text-white' : 'ring-1 ring-steel'
                  }`}
                >
                  {active && <Check size={12} strokeWidth={3} />}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-7 space-y-5">
        {p.needsKey && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>{p.name} API key</Label>
              {p.keyUrl && (
                <a href={p.keyUrl} target="_blank" rel="noreferrer" className="t-caption text-link hover:underline inline-flex items-center gap-1">
                  Get a free key <ExternalLink size={11} />
                </a>
              )}
            </div>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="field"
              placeholder={isProviderReady(settings) && !settings.keys[p.id] ? 'Using key from .env' : 'Paste your key'}
              value={settings.keys[p.id] || ''}
              onChange={e => set({ keys: { ...settings.keys, [p.id]: e.target.value } })}
            />
          </div>
        )}

        {p.id !== 'builtin' && <div>
          <Label className="mb-2">Model</Label>
          <input
            className="field"
            spellCheck={false}
            placeholder={p.defaultModel}
            value={settings.models[p.id] || ''}
            onChange={e => set({ models: { ...settings.models, [p.id]: e.target.value } })}
          />
          <p className="t-caption text-slate mt-2">Leave blank for the default ({p.defaultModel}).</p>
        </div>}

        {p.needsKey && (
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.fallback}
              onChange={e => set({ fallback: e.target.checked })}
              className="mt-1 w-4 h-4 accent-[#0071e3]"
            />
            <span className="t-small text-ink">
              If {p.name} fails, try my other providers
              <span className="block t-caption text-slate">Add keys for two providers to ride out free-tier rate limits.</span>
            </span>
          </label>
        )}

        <div className="flex items-center gap-4 pt-2">
          <Button variant="outline" onClick={runTest} loading={test.state === 'running'} disabled={!isProviderReady(settings)}>
            Test connection
          </Button>
          {test.state === 'ok' && <span className="t-small text-good">{test.msg}</span>}
          {test.state === 'fail' && <span className="t-small text-bad break-words min-w-0">{test.msg}</span>}
        </div>
      </div>
    </Sheet>
  );
};
