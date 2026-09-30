import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyText } from '../utils/export';

/* ---------- Buttons ---------- */

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'dark';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-cta text-white hover:bg-cta-hover disabled:bg-control disabled:text-steel',
  dark: 'bg-ink text-white hover:bg-black disabled:bg-control disabled:text-steel',
  outline: 'bg-transparent text-ink ring-1 ring-inset ring-steel hover:bg-mist disabled:text-steel disabled:ring-control',
  ghost: 'bg-transparent text-link hover:underline disabled:text-steel',
};

const sizeClass = {
  sm: 'h-8 px-4 text-[12px] tracking-[-0.12px]',
  md: 'h-10 px-5 text-[14px] tracking-[-0.224px]',
  lg: 'h-12 px-7 text-[17px] tracking-[-0.374px]',
};

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', loading, icon, children, className = '', disabled, ...rest }) => (
  <button
    {...rest}
    disabled={disabled || loading}
    className={`inline-flex items-center justify-center gap-2 rounded-full font-normal whitespace-nowrap transition-colors ${
      variant === 'ghost' ? 'px-0 h-auto' : sizeClass[size]
    } ${variantClass[variant]} ${className}`}
  >
    {loading ? <Spinner light={variant === 'primary' || variant === 'dark'} /> : icon}
    {children}
  </button>
);

export const Spinner: React.FC<{ light?: boolean; size?: number }> = ({ light, size = 14 }) => (
  <span
    className={`inline-block rounded-full border-2 animate-spin ${light ? 'border-white/30 border-t-white' : 'border-control border-t-ink'}`}
    style={{ width: size, height: size }}
  />
);

export const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label = 'Copy' }) => {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      icon={done ? <Check size={13} /> : <Copy size={13} />}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }
      }}
      disabled={!text}
    >
      {done ? 'Copied' : label}
    </Button>
  );
};

/* ---------- Surfaces ---------- */

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { pad?: string }> = ({ pad = 'p-7', className = '', children, ...rest }) => (
  <div {...rest} className={`bg-white rounded-[28px] ${pad} ${className}`}>
    {children}
  </div>
);

export const SectionHeader: React.FC<{ kicker?: string; title: string; sub?: string; action?: React.ReactNode }> = ({ kicker, title, sub, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
    <div className="max-w-2xl">
      {kicker && <p className="t-label mb-2">{kicker}</p>}
      <h2 className="t-heading text-ink">{title}</h2>
      {sub && <p className="t-body text-slate mt-3">{sub}</p>}
    </div>
    {action && <div className="flex-shrink-0 flex gap-3 items-center">{action}</div>}
  </div>
);

export const Label: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`t-caption font-semibold text-slate uppercase tracking-[0.04em] ${className}`}>{children}</p>
);

/* ---------- Data marks ---------- */

export const scoreColor = (n: number) => (n >= 75 ? 'var(--color-good)' : n >= 50 ? 'var(--color-cta)' : n >= 30 ? 'var(--color-warn)' : 'var(--color-bad)');

export const ScoreRing: React.FC<{ score: number; size?: number; stroke?: number; label?: string }> = ({ score, size = 168, stroke = 10, label }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle r={r} cx={size / 2} cy={size / 2} fill="none" stroke="var(--color-control)" strokeWidth={stroke} />
        <circle
          r={r}
          cx={size / 2}
          cy={size / 2}
          fill="none"
          stroke={scoreColor(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (score / 100) * c}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.7,.2,1)' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-[family-name:var(--font-display)] font-semibold text-ink leading-none" style={{ fontSize: size * 0.28 }}>
          {Math.round(score)}
        </div>
        {label && <div className="t-caption text-slate mt-1">{label}</div>}
      </div>
    </div>
  );
};

export const Bar: React.FC<{ value: number; color?: string; height?: number }> = ({ value, color, height = 6 }) => (
  <div className="w-full bg-control rounded-full overflow-hidden" style={{ height }}>
    <div
      className="h-full rounded-full"
      style={{ width: `${Math.max(2, value)}%`, background: color || scoreColor(value), transition: 'width 1s cubic-bezier(.2,.7,.2,1)' }}
    />
  </div>
);

/* ---------- Segmented control ---------- */

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex p-1 rounded-full bg-control/70 gap-1 flex-wrap">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`h-8 px-4 rounded-full text-[12px] tracking-[-0.12px] transition-colors ${
            value === o.value ? 'bg-white text-ink ring-1 ring-hairline' : 'text-slate hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Minimal, safe Markdown renderer (no innerHTML) ---------- */

const inline = (text: string, keyBase: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith('**')) parts.push(<strong key={k} className="font-semibold">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('~~')) parts.push(<del key={k} className="text-steel">{tok.slice(2, -2)}</del>);
    else if (tok.startsWith('`')) parts.push(<code key={k} className="px-1.5 py-0.5 rounded-md bg-mist text-[0.9em]">{tok.slice(1, -1)}</code>);
    else parts.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

export const Markdown: React.FC<{ text: string; className?: string; streaming?: boolean }> = ({ text, className = '', streaming }) => {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={`l${blocks.length}`} className={`${list.ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1.5 my-3 marker:text-steel`}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it, `li${blocks.length}-${i}`)}</li>
        ))}
      </Tag>
    );
    list = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || ordered) {
      const isOrdered = !!ordered;
      if (list && list.ordered !== isOrdered) flush();
      if (!list) list = { ordered: isOrdered, items: [] };
      list.items.push((bullet || ordered)![1]);
      return;
    }
    flush();
    if (!line.trim()) return;
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls = level === 1 ? 't-title mt-2 mb-3' : level === 2 ? 't-kicker mt-6 mb-2' : 'font-semibold mt-4 mb-1';
      blocks.push(<p key={idx} className={cls}>{inline(h[2], `h${idx}`)}</p>);
    } else if (/^-{3,}$/.test(line.trim())) {
      blocks.push(<hr key={idx} className="border-hairline my-5" />);
    } else if (line.startsWith('>')) {
      blocks.push(<blockquote key={idx} className="pl-4 border-l-2 border-hairline text-slate my-3">{inline(line.replace(/^>\s?/, ''), `q${idx}`)}</blockquote>);
    } else {
      blocks.push(<p key={idx} className="my-3">{inline(line, `p${idx}`)}</p>);
    }
  });
  flush();

  return <div className={`t-body text-ink [&>*:first-child]:mt-0 ${streaming ? 'caret' : ''} ${className}`}>{blocks}</div>;
};

/* ---------- Misc ---------- */

export const ErrorNote: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="rounded-[20px] bg-[#fff4f2] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
    <p className="t-small text-bad">{message}</p>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);

export const Thinking: React.FC<{ label?: string }> = ({ label = 'Thinking' }) => (
  <div className="flex items-center gap-3 text-slate t-small">
    <Spinner />
    <span>{label}…</span>
  </div>
);
