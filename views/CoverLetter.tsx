import React, { useState } from 'react';
import { Download, Sparkles, Square } from 'lucide-react';
import { Button, Card, CopyButton, ErrorNote, Label, Markdown, Segmented, Thinking } from '../components/ui';
import { CoverLetterOptions, EXTRA_KINDS, ExtraKind, streamCoverLetter, streamExtra } from '../services/features';
import { useStream } from '../hooks/useStream';
import { downloadText, slug } from '../utils/export';
import { ViewProps } from './Overview';

export const CoverLetter: React.FC<ViewProps> = ({ session, update }) => {
  const letter = useStream(session.coverLetter || '');
  const [opts, setOpts] = useState<CoverLetterOptions>({ tone: 'professional', length: 'medium', notes: '' });

  const generate = async () => {
    const out = await letter.run((onToken, signal) => streamCoverLetter(session.resumeText, session.jdText, opts, onToken, signal));
    if (out) update({ coverLetter: out });
  };

  const words = letter.text.trim() ? letter.text.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="grid lg:grid-cols-[340px_1fr] gap-5 items-start">
        <Card className="space-y-6 lg:sticky lg:top-32">
          <div>
            <Label className="mb-3">Tone</Label>
            <Segmented
              value={opts.tone}
              onChange={tone => setOpts({ ...opts, tone })}
              options={[
                { value: 'professional', label: 'Professional' },
                { value: 'warm', label: 'Warm' },
                { value: 'confident', label: 'Confident' },
                { value: 'concise', label: 'Concise' },
              ]}
            />
          </div>
          <div>
            <Label className="mb-3">Length</Label>
            <Segmented
              value={opts.length}
              onChange={length => setOpts({ ...opts, length })}
              options={[
                { value: 'short', label: 'Short' },
                { value: 'medium', label: 'Medium' },
                { value: 'long', label: 'Long' },
              ]}
            />
          </div>
          <div>
            <Label className="mb-3">Anything to mention?</Label>
            <textarea
              className="field min-h-[96px] resize-y"
              placeholder="e.g. I use their product daily; relocating to Austin in June"
              value={opts.notes}
              onChange={e => setOpts({ ...opts, notes: e.target.value })}
            />
          </div>
          {letter.running ? (
            <Button variant="outline" className="w-full" icon={<Square size={12} />} onClick={letter.stop}>
              Stop
            </Button>
          ) : (
            <Button className="w-full" icon={<Sparkles size={14} />} onClick={generate}>
              {letter.text ? 'Rewrite letter' : 'Write cover letter'}
            </Button>
          )}
        </Card>

        <Card className="min-h-[420px]">
          {letter.error && <ErrorNote message={letter.error} onRetry={generate} />}
          {!letter.text && !letter.running && !letter.error && (
            <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center">
              <p className="t-kicker">Your letter appears here.</p>
              <p className="t-small text-slate mt-2 max-w-sm">Pick a tone and length, then write. You can edit the result directly.</p>
            </div>
          )}
          {letter.running && !letter.text && <Thinking label="Writing" />}
          {letter.text && (
            <>
              {letter.running ? (
                <Markdown text={letter.text} streaming />
              ) : (
                <textarea
                  className="w-full min-h-[440px] t-body bg-transparent outline-none resize-y"
                  value={letter.text}
                  onChange={e => {
                    letter.setText(e.target.value);
                    update({ coverLetter: e.target.value });
                  }}
                />
              )}
              {!letter.running && (
                <div className="flex items-center gap-3 mt-5 pt-5 border-t border-control flex-wrap">
                  <CopyButton text={letter.text} />
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Download size={13} />}
                    onClick={() => downloadText(`${slug(session.analysis.company || session.analysis.jobTitle)}-cover-letter.txt`, letter.text)}
                  >
                    Download
                  </Button>
                  <span className="t-caption text-slate ml-auto">{words} words</span>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <ExtrasCard resume={session.resumeText} jd={session.jdText} />
    </div>
  );
};

const ExtrasCard: React.FC<{ resume: string; jd: string }> = ({ resume, jd }) => {
  const [kind, setKind] = useState<ExtraKind>('linkedin');
  const s = useStream();

  const go = () => s.run((onToken, signal) => streamExtra(kind, resume, jd, onToken, signal));

  return (
    <Card>
      <Label className="mb-1">More writing</Label>
      <p className="t-small text-slate mb-6">Everything else an application needs.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {(Object.keys(EXTRA_KINDS) as ExtraKind[]).map(k => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`text-left rounded-[20px] px-5 py-4 transition-shadow ${kind === k ? 'bg-white ring-2 ring-cta' : 'bg-mist hover:ring-1 hover:ring-hairline'}`}
          >
            <p className="t-small font-semibold">{EXTRA_KINDS[k].label}</p>
            <p className="t-caption text-slate mt-1">{EXTRA_KINDS[k].hint}</p>
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        {s.running ? (
          <Button variant="outline" icon={<Square size={12} />} onClick={s.stop}>
            Stop
          </Button>
        ) : (
          <Button icon={<Sparkles size={14} />} onClick={go}>
            Generate {EXTRA_KINDS[kind].label.toLowerCase()}
          </Button>
        )}
        {s.text && !s.running && <CopyButton text={s.text} />}
      </div>
      {s.error && <div className="mt-5"><ErrorNote message={s.error} onRetry={go} /></div>}
      {s.running && !s.text && <div className="mt-6"><Thinking /></div>}
      {s.text && (
        <div className="mt-6 rounded-[20px] bg-mist p-6">
          <Markdown text={s.text} streaming={s.running} />
        </div>
      )}
    </Card>
  );
};
