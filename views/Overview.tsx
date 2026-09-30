import React from 'react';
import { ArrowRight } from 'lucide-react';
import { AnalysisTab, Session } from '../types';
import { Bar, Card, Label, ScoreRing, scoreColor } from '../components/ui';
import { keywordReport } from '../utils/ats';

export interface ViewProps {
  session: Session;
  update: (patch: Partial<Session>) => void;
  goTo: (tab: AnalysisTab) => void;
  /** Re-run the full AI analysis on this session's documents. */
  reanalyze?: () => void;
}

const SCORE_LABELS: Record<string, string> = {
  impact: 'Impact',
  keywords: 'Keywords',
  clarity: 'Clarity',
  formatting: 'Formatting',
  experience: 'Experience fit',
};

export const Overview: React.FC<ViewProps> = ({ session, goTo }) => {
  const a = session.analysis;
  const kw = keywordReport(session.resumeText, session.jdText);

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="grid lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-5 flex flex-col items-center justify-center text-center py-12">
          <ScoreRing score={a.matchScore} label="Match score" />
          <p className="t-title mt-6">{a.verdict || 'Match result'}</p>
          <p className="t-small text-slate mt-2 max-w-sm">{a.summary}</p>
        </Card>

        <Card className="lg:col-span-7">
          <Label className="mb-6">Score breakdown</Label>
          <div className="space-y-5">
            {(Object.entries(a.sectionScores) as [string, number][]).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[120px_1fr_36px] items-center gap-4">
                <span className="t-small text-ink">{SCORE_LABELS[k] || k}</span>
                <Bar value={v} />
                <span className="t-small text-right font-medium" style={{ color: scoreColor(v) }}>
                  {v}
                </span>
              </div>
            ))}
            <div className="grid grid-cols-[120px_1fr_36px] items-center gap-4 pt-5 border-t border-control">
              <span className="t-small text-ink">ATS coverage</span>
              <Bar value={kw.coverage} />
              <span className="t-small text-right font-medium" style={{ color: scoreColor(kw.coverage) }}>
                {kw.coverage}
              </span>
            </div>
            <p className="t-caption text-slate -mt-2">Offline keyword scan: share of the job's most frequent terms found in your resume.</p>
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <Card>
          <Label className="mb-3">You present as</Label>
          <p className="t-kicker">{a.identity.role}</p>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-24">
              <Bar value={a.identity.confidence} color="var(--color-ink)" height={4} />
            </div>
            <span className="t-caption text-slate">{a.identity.confidence}% clarity</span>
          </div>
        </Card>
        <Card>
          <Label className="mb-3">Seniority</Label>
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className="t-kicker">{a.resumeInsights.seniority || '—'}</p>
            {a.resumeInsights.jdSeniority && (
              <p className="t-small text-slate">vs. role: {a.resumeInsights.jdSeniority}</p>
            )}
          </div>
          <p className="t-caption text-slate mt-4">Estimated from scope, titles and tenure.</p>
        </Card>
        <Card>
          <Label className="mb-3">Missing keywords</Label>
          <p className="t-kicker">{a.missingSignals.length}</p>
          <p className="t-caption text-slate mt-1 line-clamp-2">{a.missingSignals.slice(0, 5).join(', ') || 'None — nice.'}</p>
          <button onClick={() => goTo(AnalysisTab.Keywords)} className="t-small text-link hover:underline mt-3">
            See keyword map ›
          </button>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Card>
          <Label className="mb-5">Strengths</Label>
          <ul className="space-y-3">
            {a.signals.strengths.map((s, i) => (
              <li key={i} className="flex gap-3 t-small">
                <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-good flex-shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <Label className="mb-5">Concerns</Label>
          <ul className="space-y-3">
            {a.signals.concerns.map((s, i) => (
              <li key={i} className="flex gap-3 t-small">
                <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-warn flex-shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid sm:grid-cols-3 gap-5">
        {[
          { tab: AnalysisTab.Editor, t: 'Edit my resume', d: `${session.analysis.suggestions?.length || 'AI'} edits ready to apply` },
          { tab: AnalysisTab.CoverLetter, t: 'Write a cover letter', d: 'In your voice, in seconds' },
          { tab: AnalysisTab.Interview, t: 'Practice the interview', d: 'Likely questions, graded' },
        ].map(x => (
          <button key={x.t} onClick={() => goTo(x.tab)} className="group text-left bg-white rounded-[28px] p-7 hover:ring-1 hover:ring-hairline transition-shadow">
            <p className="t-kicker">{x.t}</p>
            <p className="t-small text-slate mt-1">{x.d}</p>
            <ArrowRight size={18} className="mt-5 text-cta group-hover:translate-x-1 transition-transform" />
          </button>
        ))}
      </div>
    </div>
  );
};
