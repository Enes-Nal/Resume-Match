import React, { useMemo } from 'react';
import { AlertCircle, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { Bar, Card, Label, scoreColor } from '../components/ui';
import { resumeHealth, CheckStatus } from '../utils/ats';
import { ViewProps } from './Overview';

const statusIcon: Record<CheckStatus, React.ReactNode> = {
  pass: <CheckCircle2 size={18} className="text-good" />,
  warn: <MinusCircle size={18} className="text-warn" />,
  fail: <XCircle size={18} className="text-bad" />,
};

export const Insights: React.FC<ViewProps> = ({ session }) => {
  const a = session.analysis;
  const health = useMemo(() => resumeHealth(session.resumeText), [session.resumeText]);
  const passed = health.checks.filter(c => c.status === 'pass').length;

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <Label className="mb-3">Identity coherence</Label>
          <p className="t-body">{a.resumeInsights.coherence}</p>
          <div className="mt-7 pt-6 border-t border-control">
            <div className="flex items-baseline justify-between mb-3">
              <Label>Focus score</Label>
              <span className="t-kicker" style={{ color: scoreColor(a.resumeInsights.focusScore) }}>
                {a.resumeInsights.focusScore}
              </span>
            </div>
            <Bar value={a.resumeInsights.focusScore} />
            <p className="t-caption text-slate mt-2">How consistently the resume tells one story.</p>
          </div>
        </Card>

        <Card>
          <Label className="mb-5">Red flags</Label>
          {a.resumeInsights.redFlags.length ? (
            <ul className="space-y-4">
              {a.resumeInsights.redFlags.map((f, i) => (
                <li key={i} className="flex gap-3 t-small">
                  <AlertCircle size={17} className="text-bad flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          ) : (
            <p className="t-small text-slate">No major red flags detected.</p>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-end justify-between mb-6 gap-4">
          <div>
            <Label className="mb-1">Resume health check</Label>
            <p className="t-small text-slate">Rule-based checks run locally on your resume text.</p>
          </div>
          <p className="t-kicker">
            {passed}/{health.checks.length}
          </p>
        </div>
        <div className="divide-y divide-control">
          {health.checks.map(c => (
            <div key={c.label} className="flex gap-4 py-4 items-start">
              {statusIcon[c.status]}
              <div>
                <p className="t-small font-medium">{c.label}</p>
                <p className="t-caption text-slate mt-0.5">{c.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Label className="mb-6">Experience relevance</Label>
        <div className="space-y-6">
          {a.experienceRelevance.map((e, i) => (
            <div key={i} className="grid md:grid-cols-[1fr_160px] gap-3 md:gap-8">
              <div>
                <p className="t-small font-medium">{e.item}</p>
                <p className="t-small text-slate mt-1">{e.feedback}</p>
              </div>
              <div className="flex items-center gap-3">
                <Bar value={e.relevance} />
                <span className="t-caption w-8 text-right" style={{ color: scoreColor(e.relevance) }}>
                  {e.relevance}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
