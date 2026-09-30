import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, Download, FileDown, Plus, Printer, RotateCcw, Sparkles, Undo2, Wand2, X } from 'lucide-react';
import { ResumeDoc, Suggestion } from '../types';
import { Button, Card, CopyButton, ErrorNote, Label, ScoreRing, Segmented, Spinner } from '../components/ui';
import { aiEditDoc, coverageScore, rescoreDoc } from '../services/analysis';
import { BulletStyle, rewriteBullet } from '../services/features';
import {
  allBullets,
  applySuggestion,
  docToDocxBlob,
  docToMarkdown,
  docToText,
  newBulletId,
  printDoc,
  undoSuggestion,
} from '../utils/resumeDoc';
import { downloadText, slug } from '../utils/export';
import { ViewProps } from './Overview';

const KIND_LABEL: Record<Suggestion['kind'], string> = {
  rewrite: 'Rewrite bullet',
  'add-bullet': 'New bullet',
  'remove-bullet': 'Remove bullet',
  summary: 'Summary',
  skills: 'Skills line',
};

const QUICK_EDITS = [
  'Mirror the job description’s language where my experience supports it',
  'Start every bullet with a strong action verb',
  'Add [X] metric placeholders where impact is unquantified',
  'Tighten the whole resume to fit one page',
  'Emphasize leadership and ownership',
];

const docKey = (d: ResumeDoc) => JSON.stringify(d);

export const Editor: React.FC<ViewProps> = ({ session, update, reanalyze }) => {
  const a = session.analysis;
  const original = a.resumeDoc;

  if (!original) {
    return (
      <Card className="py-16 text-center animate-fade-up">
        <p className="t-title">The editor needs a full AI analysis.</p>
        <p className="t-body text-slate mt-3 max-w-lg mx-auto">
          {a.offline ? 'This is an offline scan.' : 'This analysis was made with an older version.'} Run the AI analysis to get a structured resume
          with edits you can accept one by one.
        </p>
        {reanalyze && (
          <div className="mt-8 flex justify-center">
            <Button size="lg" icon={<Sparkles size={16} />} onClick={reanalyze}>
              Run AI analysis
            </Button>
          </div>
        )}
      </Card>
    );
  }

  return <EditorInner {...{ session, update }} original={original} />;
};

const EditorInner: React.FC<Pick<ViewProps, 'session' | 'update'> & { original: ResumeDoc }> = ({ session, update, original }) => {
  const a = session.analysis;
  const doc = session.editedDoc || original;
  const suggestions = a.suggestions || [];
  const [hover, setHover] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [rescoring, setRescoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [undoStack, setUndoStack] = useState<ResumeDoc[]>([]);
  const [exporting, setExporting] = useState(false);
  const preview = useRef<HTMLDivElement>(null);

  const save = (nextDoc: ResumeDoc, nextSuggestions: Suggestion[] = suggestions) =>
    update({ editedDoc: nextDoc, analysis: { ...a, suggestions: nextSuggestions } });

  const setSug = (list: Suggestion[], s: Suggestion) => list.map(x => (x.id === s.id ? s : x));

  const accept = (sug: Suggestion) => {
    const r = applySuggestion(doc, sug);
    save(r.doc, setSug(suggestions, r.sug));
  };
  const undo = (sug: Suggestion) => {
    const r = undoSuggestion(doc, original, sug);
    save(r.doc, setSug(suggestions, r.sug));
  };
  const skip = (sug: Suggestion) => save(doc, setSug(suggestions, { ...sug, status: sug.status === 'rejected' ? 'pending' : 'rejected' }));
  const editAfter = (sug: Suggestion, after: string) => save(doc, setSug(suggestions, { ...sug, after }));

  const acceptAllSafe = () => {
    let d = doc;
    let list = suggestions;
    for (const s of suggestions) {
      if (s.status !== 'pending' || s.needsConfirmation) continue;
      const r = applySuggestion(d, s);
      d = r.doc;
      list = setSug(list, r.sug);
    }
    save(d, list);
  };

  const resetAll = () => {
    if (!confirm('Discard all edits and go back to your original resume?')) return;
    save(original, suggestions.map(s => ({ ...s, status: 'pending', appliedId: undefined })));
    update({ rescore: undefined });
  };

  const rescore = async () => {
    setRescoring(true);
    setError(null);
    try {
      const r = await rescoreDoc(doc, a);
      update({ rescore: { ...r, docKey: docKey(doc) } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRescoring(false);
    }
  };

  const runAiEdit = async (text: string) => {
    const instr = text.trim();
    if (!instr) return;
    setAiBusy(true);
    setError(null);
    try {
      const next = await aiEditDoc(doc, instr, a);
      setUndoStack(s => [...s.slice(-9), doc]);
      save(next);
      setInstruction('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const exportDocx = async () => {
    setExporting(true);
    try {
      const blob = await docToDocxBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slug(doc.name || 'resume')}-${slug(a.company || a.jobTitle)}.docx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(`Word export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const pending = suggestions.filter(s => s.status === 'pending');
  const accepted = suggestions.filter(s => s.status === 'accepted');
  const safeCount = pending.filter(s => !s.needsConfirmation).length;
  const shown = filter === 'pending' ? pending : suggestions;
  const edited = docKey(doc) !== docKey(original);
  const rs = session.rescore;
  const stale = !!rs && rs.docKey !== docKey(doc);
  const baseCoverage = coverageScore(a.requirements || []);
  const labelFor = (id: string) => a.requirements?.find(r => r.id === id)?.label || id;

  const focusTarget = (s: Suggestion) => {
    const id = s.kind === 'summary' ? 'summary' : s.appliedId || s.target;
    const el = id && preview.current?.querySelector(`[data-id="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Score & actions */}
      <Card className="flex flex-col lg:flex-row lg:items-center gap-8">
        <div className="flex items-center gap-5">
          <ScoreRing score={a.matchScore} size={96} stroke={7} label="Before" />
          <ArrowRight size={18} className="text-steel" />
          {rs ? (
            <div className={stale ? 'opacity-50' : ''}>
              <ScoreRing score={rs.matchScore} size={96} stroke={7} label={stale ? 'Outdated' : 'After'} />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full border border-dashed border-steel/60 flex items-center justify-center text-center t-caption text-slate px-3">
              Re-score to see
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="t-kicker">
            {accepted.length} of {suggestions.length} edits applied
          </p>
          <p className="t-small text-slate mt-1">
            Requirement coverage {baseCoverage}%{rs ? ` → ${rs.coverage}%` : ''}. Accept edits, change anything by hand, then re-score.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <Button onClick={rescore} loading={rescoring} disabled={!edited && !rs} icon={<RotateCcw size={13} />}>
              Re-score
            </Button>
            {safeCount > 0 && (
              <Button variant="outline" onClick={acceptAllSafe} icon={<Check size={13} />}>
                Accept {safeCount} safe edit{safeCount === 1 ? '' : 's'}
              </Button>
            )}
            {edited && (
              <Button variant="ghost" onClick={resetAll}>
                Reset to original
              </Button>
            )}
          </div>
        </div>
      </Card>

      {error && <ErrorNote message={error} />}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-5 items-start">
        {/* Suggestions */}
        <div className="min-w-0 space-y-3 lg:sticky lg:top-32 lg:max-h-[calc(100vh-150px)] lg:overflow-y-auto no-scrollbar lg:pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
            <Label>AI edits</Label>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'pending', label: `To review (${pending.length})` },
                { value: 'all', label: 'All' },
              ]}
            />
          </div>
          {shown.length === 0 && (
            <Card className="text-center">
              <p className="t-small text-slate">{suggestions.length ? 'All edits reviewed. Re-score to see where you landed.' : 'No edits were suggested.'}</p>
            </Card>
          )}
          {shown.map(s => (
            <SuggestionCard
              key={s.id}
              s={s}
              labelFor={labelFor}
              onAccept={() => accept(s)}
              onUndo={() => undo(s)}
              onSkip={() => skip(s)}
              onEdit={t => editAfter(s, t)}
              onHover={on => setHover(on ? (s.kind === 'summary' ? 'summary' : s.appliedId || s.target || null) : null)}
              onFocus={() => focusTarget(s)}
            />
          ))}
        </div>

        {/* Resume */}
        <div className="min-w-0 space-y-4">
          <Card pad="p-5">
            <div className="flex gap-3">
              <input
                className="field !rounded-full !py-2.5"
                placeholder="Tell the AI what to change…"
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runAiEdit(instruction)}
                disabled={aiBusy}
              />
              <Button onClick={() => runAiEdit(instruction)} loading={aiBusy} disabled={!instruction.trim()} icon={<Wand2 size={14} />}>
                Edit
              </Button>
            </div>
            <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
              {QUICK_EDITS.map(q => (
                <button
                  key={q}
                  disabled={aiBusy}
                  onClick={() => runAiEdit(q)}
                  className="flex-shrink-0 h-8 px-4 rounded-full ring-1 ring-inset ring-hairline t-caption text-ink hover:bg-mist disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
            {undoStack.length > 0 && !aiBusy && (
              <button
                className="t-caption text-link hover:underline mt-3 inline-flex items-center gap-1"
                onClick={() => {
                  save(undoStack[undoStack.length - 1]);
                  setUndoStack(s => s.slice(0, -1));
                }}
              >
                <Undo2 size={12} /> Undo last AI edit
              </button>
            )}
          </Card>

          <div ref={preview} className={`relative bg-white rounded-[28px] p-6 sm:p-10 ${aiBusy ? 'opacity-60 pointer-events-none' : ''}`}>
            {aiBusy && (
              <div className="absolute inset-0 flex items-start justify-center pt-24 z-10">
                <div className="bg-white rounded-full ring-1 ring-hairline px-5 h-10 inline-flex items-center gap-3 t-small">
                  <Spinner /> Editing your resume…
                </div>
              </div>
            )}
            <ResumePaper doc={doc} original={original} hover={hover} onChange={d => save(d)} />
          </div>

          <Card pad="p-5" className="flex flex-wrap items-center gap-3">
            <Label className="mr-2">Export</Label>
            <Button size="sm" icon={<Printer size={13} />} onClick={() => printDoc(doc) || setError('Allow pop-ups to export a PDF.')}>
              PDF
            </Button>
            <Button size="sm" variant="outline" icon={<FileDown size={13} />} loading={exporting} onClick={exportDocx}>
              Word
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<Download size={13} />}
              onClick={() => downloadText(`${slug(doc.name || 'resume')}.md`, docToMarkdown(doc), 'text/markdown')}
            >
              Markdown
            </Button>
            <CopyButton text={docToText(doc)} label="Copy text" />
          </Card>
        </div>
      </div>

      <BulletLab jd={session.jdText} />
    </div>
  );
};

/* ---------- Suggestion card ---------- */

const SuggestionCard: React.FC<{
  s: Suggestion;
  labelFor: (id: string) => string;
  onAccept: () => void;
  onUndo: () => void;
  onSkip: () => void;
  onEdit: (t: string) => void;
  onHover: (on: boolean) => void;
  onFocus: () => void;
}> = ({ s, labelFor, onAccept, onUndo, onSkip, onEdit, onHover, onFocus }) => {
  const [editing, setEditing] = useState(false);
  const done = s.status !== 'pending';

  return (
    <div
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`bg-white rounded-[20px] p-5 transition-opacity ${s.status === 'rejected' ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <button onClick={onFocus} className="t-caption font-semibold text-ink hover:text-link">
          {KIND_LABEL[s.kind]}
        </button>
        {s.impact === 'high' && <span className="t-label">High impact</span>}
      </div>

      {s.before && <p className="t-small text-slate line-through decoration-steel/60 mt-2">{s.before}</p>}
      {s.kind === 'remove-bullet' ? (
        <p className="t-small mt-2">Remove this bullet.</p>
      ) : editing ? (
        <textarea
          autoFocus
          className="field mt-2 !text-[14px] min-h-[80px] resize-y"
          value={s.after}
          onChange={e => onEdit(e.target.value)}
          onBlur={() => setEditing(false)}
        />
      ) : (
        <p
          className={`t-small mt-2 ${!done ? 'cursor-text hover:bg-mist rounded-lg -mx-1 px-1' : ''}`}
          onClick={() => !done && setEditing(true)}
          title={!done ? 'Click to edit before accepting' : undefined}
        >
          {s.after}
        </p>
      )}

      <p className="t-caption text-slate mt-2">{s.reason}</p>

      {s.requirementIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {s.requirementIds.map(id => (
            <span key={id} className="t-caption px-2.5 h-6 inline-flex items-center rounded-full bg-mist text-slate">
              {labelFor(id)}
            </span>
          ))}
        </div>
      )}

      {s.needsConfirmation && s.status === 'pending' && (
        <p className="flex gap-2 t-caption text-warn mt-3">
          <AlertTriangle size={13} className="flex-shrink-0 mt-px" />
          Adds a claim or placeholder. Make sure it is true and fill in any [X].
        </p>
      )}

      <div className="flex items-center gap-2 mt-4">
        {s.status === 'pending' && (
          <>
            <Button size="sm" onClick={onAccept} icon={<Check size={12} />}>
              Accept
            </Button>
            <Button size="sm" variant="outline" onClick={onSkip}>
              Skip
            </Button>
          </>
        )}
        {s.status === 'accepted' && (
          <>
            <span className="t-caption text-good inline-flex items-center gap-1">
              <Check size={13} /> Applied
            </span>
            <button onClick={onUndo} className="t-caption text-link hover:underline ml-auto">
              Undo
            </button>
          </>
        )}
        {s.status === 'rejected' && (
          <button onClick={onSkip} className="t-caption text-link hover:underline">
            Skipped · Restore
          </button>
        )}
      </div>
    </div>
  );
};

/* ---------- Editable resume ---------- */

const ResumePaper: React.FC<{ doc: ResumeDoc; original: ResumeDoc; hover: string | null; onChange: (d: ResumeDoc) => void }> = ({
  doc,
  original,
  hover,
  onChange,
}) => {
  const originalText = useMemo(() => new Map(allBullets(original).map(x => [x.bullet.id, x.bullet.text])), [original]);
  const mut = (fn: (d: ResumeDoc) => void) => {
    const next: ResumeDoc = JSON.parse(JSON.stringify(doc));
    fn(next);
    onChange(next);
  };

  const mark = (id: string, text: string) => {
    const was = originalText.get(id);
    return was === undefined ? 'new' : was !== text ? 'changed' : null;
  };

  return (
    <div className="text-ink">
      <p className="t-title">{doc.name || 'Your name'}</p>
      {doc.headline && <p className="t-small font-medium mt-1">{doc.headline}</p>}
      {doc.contact.length > 0 && <p className="t-caption text-slate mt-1">{doc.contact.join(' · ')}</p>}

      <PaperSection title="Summary">
        <EditableLine
          id="summary"
          text={doc.summary}
          placeholder="Add a short summary…"
          status={doc.summary !== original.summary ? 'changed' : null}
          highlighted={hover === 'summary'}
          onSave={t => mut(d => (d.summary = t))}
        />
      </PaperSection>

      {doc.sections.map((sec, si) => (
        <PaperSection key={sec.id} title={sec.title}>
          {sec.entries.map((en, ei) => (
            <div key={en.id} className="mb-4 last:mb-0">
              {(en.heading || en.subheading || en.dates) && (
                <div className="flex flex-col sm:flex-row sm:justify-between sm:gap-4 mb-1">
                  <p className="t-small font-semibold">{[en.heading, en.subheading].filter(Boolean).join(' — ')}</p>
                  <p className="t-caption text-slate whitespace-nowrap">{[en.dates, en.location].filter(Boolean).join(', ')}</p>
                </div>
              )}
              <ul className={sec.kind === 'skills' ? '' : 'space-y-0.5'}>
                {en.bullets.map((b, bi) => (
                  <li key={b.id} className="group flex items-start gap-2">
                    {sec.kind !== 'skills' && <span className="mt-[9px] w-1 h-1 rounded-full bg-ink flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <EditableLine
                        id={b.id}
                        text={b.text}
                        status={mark(b.id, b.text)}
                        highlighted={hover === b.id}
                        onSave={t =>
                          mut(d => {
                            if (t.trim()) d.sections[si].entries[ei].bullets[bi].text = t;
                            else d.sections[si].entries[ei].bullets.splice(bi, 1);
                          })
                        }
                      />
                    </div>
                    <button
                      aria-label="Delete bullet"
                      onClick={() => mut(d => d.sections[si].entries[ei].bullets.splice(bi, 1))}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 mt-1 text-steel hover:text-bad transition-opacity"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => mut(d => d.sections[si].entries[ei].bullets.push({ id: newBulletId(), text: 'New bullet — click to edit' }))}
                className="t-caption text-link hover:underline mt-1 inline-flex items-center gap-1 opacity-60 hover:opacity-100"
              >
                <Plus size={11} /> Add {sec.kind === 'skills' ? 'line' : 'bullet'}
              </button>
            </div>
          ))}
        </PaperSection>
      ))}
    </div>
  );
};

const PaperSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mt-6">
    <p className="t-caption font-semibold uppercase tracking-[0.06em] pb-1.5 mb-3 border-b border-hairline">{title}</p>
    {children}
  </div>
);

const EditableLine: React.FC<{
  id: string;
  text: string;
  status: 'new' | 'changed' | null;
  highlighted: boolean;
  placeholder?: string;
  onSave: (t: string) => void;
}> = ({ id, text, status, highlighted, placeholder, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  if (editing) {
    return (
      <textarea
        autoFocus
        onFocus={e => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
        className="w-full t-small bg-mist rounded-lg px-2 py-1 -mx-2 outline-none ring-1 ring-cta resize-none"
        rows={Math.max(1, Math.ceil(draft.length / 80))}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== text) onSave(draft);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) (e.target as HTMLTextAreaElement).blur();
          if (e.key === 'Escape') {
            setDraft(text);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <p
      data-id={id}
      onClick={() => {
        setDraft(text);
        setEditing(true);
      }}
      className={`t-small cursor-text rounded-lg px-2 -mx-2 py-0.5 transition-colors hover:bg-mist ${
        highlighted ? 'bg-[#e8f1fc]' : status === 'new' ? 'bg-[#eef7f1]' : status === 'changed' ? 'bg-[#f0f6fe]' : ''
      } ${!text ? 'text-steel' : ''}`}
      title={status === 'new' ? 'Added' : status === 'changed' ? 'Edited' : 'Click to edit'}
    >
      {text || placeholder}
    </p>
  );
};

/* ---------- Bullet rewriter ---------- */

const BulletLab: React.FC<{ jd: string }> = ({ jd }) => {
  const [bullet, setBullet] = useState('');
  const [style, setStyle] = useState<BulletStyle>('impact');
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setLoading(true);
    setError(null);
    try {
      setOptions(await rewriteBullet(bullet, jd, style));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Label className="mb-1">Bullet rewriter</Label>
      <p className="t-small text-slate mb-6">Paste any line and get three stronger versions in the style you pick.</p>
      <textarea
        className="field min-h-[88px] resize-y"
        placeholder="e.g. Responsible for the patient scheduling API used by 40 clinics"
        value={bullet}
        onChange={e => setBullet(e.target.value)}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
        <Segmented
          value={style}
          onChange={setStyle}
          options={[
            { value: 'impact', label: 'Impact' },
            { value: 'concise', label: 'Concise' },
            { value: 'technical', label: 'Technical' },
            { value: 'leadership', label: 'Leadership' },
          ]}
        />
        <Button onClick={go} loading={loading} disabled={bullet.trim().length < 8}>
          Rewrite
        </Button>
      </div>
      {error && <div className="mt-5"><ErrorNote message={error} onRetry={go} /></div>}
      {options.length > 0 && (
        <div className="mt-6 space-y-3">
          {options.map((o, i) => (
            <div key={i} className="flex items-start gap-4 rounded-[20px] bg-mist px-5 py-4">
              <span className="t-caption text-steel mt-1 w-3">{i + 1}</span>
              <p className="t-body flex-1">{o}</p>
              <CopyButton text={o} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
