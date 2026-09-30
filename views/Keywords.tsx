import React, { useMemo, useState } from 'react';
import { Card, Label, Segmented, Bar, scoreColor } from '../components/ui';
import { keywordReport } from '../utils/ats';
import { ViewProps } from './Overview';
import { Requirement, Session } from '../types';
import { coverageScore } from '../services/analysis';
import { findBullet } from '../utils/resumeDoc';

const STATUS: Record<Requirement['status'], { label: string; color: string }> = {
  met: { label: 'Met', color: 'var(--color-good)' },
  partial: { label: 'Partial', color: 'var(--color-warn)' },
  missing: { label: 'Missing', color: 'var(--color-bad)' },
};

const RequirementsCard: React.FC<{ session: Session }> = ({ session }) => {
  const a = session.analysis;
  const reqs = session.rescore?.requirements || a.requirements || [];
  const doc = session.editedDoc || a.resumeDoc;
  const [show, setShow] = useState<'all' | 'gaps'>('all');
  const list = [...reqs]
    .sort((x, y) => (x.importance === y.importance ? 0 : x.importance === 'must' ? -1 : 1))
    .filter(r => show === 'all' || r.status !== 'met');
  const count = (st: Requirement['status']) => reqs.filter(r => r.status === st).length;

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <Label className="mb-1">Requirements</Label>
          <p className="t-small text-slate">
            {count('met')} met · {count('partial')} partial · {count('missing')} missing · {coverageScore(reqs)}% weighted coverage
            {session.rescore ? ' (after your edits)' : ''}
          </p>
        </div>
        <Segmented value={show} onChange={setShow} options={[{ value: 'all', label: 'All' }, { value: 'gaps', label: 'Gaps only' }]} />
      </div>
      <div className="divide-y divide-control">
        {list.map(r => {
          const quotes = r.evidence
            .map(id => (id === 'summary' ? doc?.summary : doc && findBullet(doc, id)?.bullet.text))
            .filter(Boolean) as string[];
          return (
            <div key={r.id} className="py-4 grid md:grid-cols-[88px_1fr] gap-2 md:gap-6">
              <div className="flex md:flex-col gap-2 md:gap-1">
                <span className="t-caption font-semibold" style={{ color: STATUS[r.status].color }}>{STATUS[r.status].label}</span>
                <span className="t-caption text-slate">{r.importance === 'must' ? 'Must-have' : 'Nice-to-have'}</span>
              </div>
              <div>
                <p className="t-small font-medium">{r.text}</p>
                {r.note && <p className="t-caption text-slate mt-1">{r.note}</p>}
                {quotes.slice(0, 2).map((q, i) => (
                  <p key={i} className="t-caption text-ink mt-2 pl-3 border-l-2 border-hairline line-clamp-2">{q}</p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export const Keywords: React.FC<ViewProps> = ({ session }) => {
  const a = session.analysis;
  const kw = useMemo(() => keywordReport(session.resumeText, session.jdText, 36), [session.resumeText, session.jdText]);
  const [filter, setFilter] = useState<'all' | 'missing' | 'found'>('all');
  const shown = kw.keywords.filter(k => (filter === 'all' ? true : filter === 'found' ? k.found : !k.found));
  const maxJd = Math.max(...kw.keywords.map(k => k.jdCount), 1);

  return (
    <div className="space-y-5 animate-fade-up">
      {a.requirements ? <RequirementsCard session={session} /> : (
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
          <div>
            <Label className="mb-1">Skill alignment</Label>
            <p className="t-small text-slate">
              {a.offline ? 'Top job terms and whether your resume mentions them.' : 'How well your resume evidences each requirement, as judged by the AI.'}
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-x-12 gap-y-6">
          {a.skillAlignment.map((s, i) => (
            <div key={i}>
              <div className="flex justify-between items-baseline mb-2 gap-3">
                <span className="t-small font-medium">{s.skill}</span>
                <span className="t-caption font-medium" style={{ color: scoreColor(s.match) }}>
                  {s.match}%
                </span>
              </div>
              <Bar value={s.match} />
              {s.evidence && <p className="t-caption text-slate mt-2 line-clamp-2">{s.evidence}</p>}
            </div>
          ))}
        </div>
      </Card>
      )}

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
          <div>
            <Label className="mb-1">ATS keyword map</Label>
            <p className="t-small text-slate">
              {kw.keywords.filter(k => k.found).length} of {kw.keywords.length} top terms found · {kw.coverage}% weighted coverage
            </p>
          </div>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'missing', label: 'Missing' },
              { value: 'found', label: 'Found' },
            ]}
          />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
          {shown.map(k => (
            <div key={k.term} className="flex items-center gap-3 py-1.5 border-b border-control">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${k.found ? 'bg-good' : 'bg-bad'}`} />
              <span className={`t-small flex-1 truncate ${k.found ? 'text-ink' : 'text-ink'}`}>{k.term}</span>
              <span className="w-14 h-1 bg-control rounded-full overflow-hidden flex-shrink-0" title={`${k.jdCount}× in job description`}>
                <span className="block h-full bg-steel" style={{ width: `${(k.jdCount / maxJd) * 100}%` }} />
              </span>
              <span className="t-caption text-slate w-12 text-right">{k.found ? `${k.resumeCount}×` : 'absent'}</span>
            </div>
          ))}
        </div>
        <p className="t-caption text-slate mt-5">Bars show how often each term appears in the job description. Computed locally — nothing is sent anywhere.</p>
      </Card>

      {!a.requirements && a.missingSignals.length > 0 && (
        <Card>
          <Label className="mb-2">Missing signals</Label>
          <p className="t-small text-slate mb-5">{a.offline ? 'Job terms not found in your resume.' : 'Requirements the AI could not find evidence for.'} Add them only if they are true.</p>
          <div className="flex flex-wrap gap-2">
            {a.missingSignals.map(s => (
              <span key={s} className="px-4 h-8 inline-flex items-center rounded-full ring-1 ring-inset ring-steel t-caption">
                {s}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
