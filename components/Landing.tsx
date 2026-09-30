import React, { useEffect, useRef, useState } from 'react';
import { FileText, Upload, X, Sparkles, MessageSquare, PenLine, Mic, ListChecks, ScanSearch } from 'lucide-react';
import { Button, Card, ErrorNote, Label } from './ui';
// Parsers (pdf.js, mammoth) are loaded on first upload to keep the initial bundle small.
const extractTextFromFile = async (f: File) => (await import('../utils/fileUtils')).extractTextFromFile(f);
import { SAMPLE_JD, SAMPLE_RESUME } from '../utils/sample';
import { ANALYSIS_STEPS } from '../services/analysis';
import { DemoLoop } from './DemoLoop';

interface Props {
  resumeText: string;
  jdText: string;
  resumeFileName: string | null;
  jdFileName: string | null;
  setResume: (text: string, fileName: string | null) => void;
  setJd: (text: string, fileName: string | null) => void;
  onAnalyze: () => void;
  onQuickScan: () => void;
  aiReady: boolean;
  analyzing: boolean;
  step: number;
  error: string | null;
  providerName: string;
  onOpenSettings: () => void;
}


const HIGHLIGHTS = [
  { icon: ScanSearch, t: 'Match & ATS scan', d: 'A calibrated fit score, section scores, and an offline keyword scan like the ones recruiters run.' },
  { icon: PenLine, t: 'Tailored rewrite', d: 'A full resume rewritten for this job, plus a bullet rewriter with four styles.' },
  { icon: FileText, t: 'Cover letter & more', d: 'Cover letters by tone and length, LinkedIn profile, recruiter outreach and thank-you notes.' },
  { icon: Mic, t: 'Interview prep', d: 'The questions you are most likely to get, with answer outlines. Practice and get graded.' },
  { icon: MessageSquare, t: 'Career coach', d: 'Chat with an AI that has read your resume, the job, and the analysis.' },
  { icon: ListChecks, t: 'Action plan', d: 'Prioritized fixes on a board. One tap has the AI draft each fix for you.' },
];

/** Marketing home page: hero, looping demo, highlights. Uploading happens on the separate /analyze page. */
export const Home: React.FC<{ onStart: () => void; onSample: () => void }> = ({ onStart, onSample }) => (
  <>
    {/* Hero */}
    <section className="bg-white pt-14 sm:pt-20 pb-12 px-4 text-center">
      <p className="t-small font-semibold text-launch animate-fade-up">Resume Match</p>
      <h1 className="t-hero text-ink mt-3 max-w-3xl text-balance mx-auto animate-fade-up" style={{ animationDelay: '60ms' }}>
        Your resume, matched to the job.
      </h1>
      <p className="t-body text-slate mt-4 max-w-xl mx-auto animate-fade-up" style={{ animationDelay: '120ms' }}>
        An AI recruiter reads both, scores the fit, rewrites your weakest lines, and prepares you for the interview.
      </p>
      <div className="flex items-center justify-center gap-6 mt-7 animate-fade-up" style={{ animationDelay: '180ms' }}>
        <Button size="lg" onClick={onStart}>
          Start now
        </Button>
        <button className="t-body text-link hover:underline" onClick={onSample}>
          Try a sample ›
        </button>
      </div>
    </section>

    {/* Looping demo */}
    <section className="bg-white px-4 pb-20 animate-fade-up" style={{ animationDelay: '240ms' }}>
      <DemoLoop />
    </section>

    {/* Highlights */}
    <section className="bg-mist py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className="t-heading mb-12">Everything after the upload.</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {HIGHLIGHTS.map(({ icon: Icon, t, d }) => (
            <div key={t} className="bg-white rounded-[28px] p-7">
              <Icon size={22} strokeWidth={1.6} className="text-ink" />
              <p className="text-[19px] font-semibold tracking-[0.2px] font-[family-name:var(--font-display)] mt-5">{t}</p>
              <p className="t-small text-slate mt-2">{d}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-14">
          <Button size="lg" onClick={onStart}>
            Start now
          </Button>
        </div>
      </div>
    </section>
  </>
);

/** The upload page: resume + job inputs and the analyze button. */
export const Landing: React.FC<Props> = props => {
  const { resumeText, jdText, onAnalyze, analyzing, error } = props;
  const ready = resumeText.trim().length > 50 && jdText.trim().length > 50;

  return (
    <section className="bg-mist min-h-[calc(100vh-44px)] pt-12 sm:pt-16 pb-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="t-heading">Two documents. One clear answer.</h1>
          <p className="t-body text-slate mt-3">
            Upload a PDF, DOCX or TXT, or paste text.{' '}
            {props.aiReady ? (
              <>
                Analysis runs on{' '}
                <button className="text-link hover:underline" onClick={props.onOpenSettings}>
                  {props.providerName}
                </button>
                .
              </>
            ) : (
              <button className="text-link hover:underline" onClick={props.onOpenSettings}>
                Connect a free AI provider ›
              </button>
            )}
          </p>
          {!resumeText && !jdText && (
            <button
              className="t-small text-link hover:underline mt-2"
              onClick={() => {
                props.setResume(SAMPLE_RESUME, 'sample-resume.txt');
                props.setJd(SAMPLE_JD, 'sample-job.txt');
              }}
            >
              Fill in a sample ›
            </button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <DocInput
            step="1"
            title="Your resume"
            text={resumeText}
            fileName={props.resumeFileName}
            onChange={props.setResume}
            placeholder="Paste your resume here…"
          />
          <DocInput
            step="2"
            title="The job"
            text={jdText}
            fileName={props.jdFileName}
            onChange={props.setJd}
            placeholder="Paste the full job posting here…"
          />
        </div>

        <div className="mt-10 flex flex-col items-center gap-5">
          {analyzing ? <AnalyzingSteps step={props.step} /> : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Button size="lg" onClick={onAnalyze} disabled={!ready} icon={<Sparkles size={16} />}>
                {props.aiReady ? 'Analyze fit' : 'Set up AI & analyze'}
              </Button>
              <Button size="lg" variant="outline" onClick={props.onQuickScan} disabled={!ready}>
                Quick scan, no AI
              </Button>
            </div>
          )}
          {!ready && !analyzing && <p className="t-caption text-slate">Add both documents to continue.</p>}
          {ready && !analyzing && !props.aiReady && (
            <p className="t-caption text-slate text-center max-w-md">
              AI features need a free key from Google Gemini, Groq, OpenRouter or Pollinations. It takes about a minute.
            </p>
          )}
          {error && <div className="w-full max-w-2xl"><ErrorNote message={error} onRetry={onAnalyze} /></div>}
        </div>
      </div>
    </section>
  );
};

const DocInput: React.FC<{
  step: string;
  title: string;
  text: string;
  fileName: string | null;
  onChange: (text: string, fileName: string | null) => void;
  placeholder: string;
}> = ({ step, title, text, fileName, onChange, placeholder }) => {
  const [mode, setMode] = useState<'file' | 'paste'>(text && !fileName ? 'paste' : 'file');
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (text && !fileName) setMode('paste');
  }, [text, fileName]);

  const handle = async (file: File) => {
    setErr(null);
    setExtracting(true);
    try {
      onChange(await extractTextFromFile(file), file.name);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <Card className="flex flex-col min-h-[340px]">
      <div className="flex items-end justify-between gap-3 mb-5">
        <div className="min-w-0">
          <p className="t-label">Step {step}</p>
          <p className="t-title mt-1 truncate">{title}</p>
        </div>
        <div className="flex gap-1 p-1 rounded-full bg-mist flex-shrink-0">
          {(['file', 'paste'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`h-7 px-3 rounded-full text-[12px] ${mode === m ? 'bg-white ring-1 ring-hairline text-ink' : 'text-slate'}`}
            >
              {m === 'file' ? 'Upload' : 'Paste'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'paste' ? (
        <textarea
          className="field flex-1 min-h-[220px] resize-none"
          placeholder={placeholder}
          value={text}
          onChange={e => onChange(e.target.value, null)}
        />
      ) : fileName && text ? (
        <div className="flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-4 rounded-[20px] bg-mist px-5 py-4">
            <FileText size={22} strokeWidth={1.6} className="text-ink flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium truncate">{fileName}</p>
              <p className="t-caption text-slate">{words.toLocaleString()} words extracted</p>
            </div>
            <button
              aria-label="Remove file"
              onClick={() => onChange('', null)}
              className="w-8 h-8 rounded-full hover:bg-control flex items-center justify-center text-slate"
            >
              <X size={15} />
            </button>
          </div>
          <button className="t-caption text-link hover:underline mt-4 self-start" onClick={() => setMode('paste')}>
            Review or edit extracted text ›
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          onDragOver={e => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) handle(f);
          }}
          className={`flex-1 rounded-[20px] border border-dashed flex flex-col items-center justify-center text-center p-6 transition-colors cursor-pointer ${
            dragging ? 'border-cta bg-[#f0f6fe]' : 'border-steel/60 hover:bg-frost'
          }`}
        >
          <input
            ref={input}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.txt,.md"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handle(f);
              e.target.value = '';
            }}
          />
          {extracting ? (
            <p className="t-small text-slate">Extracting text…</p>
          ) : (
            <>
              <Upload size={22} strokeWidth={1.6} className="text-ink" />
              <p className="t-body mt-3">Drop a file or click to browse</p>
              <p className="t-caption text-slate mt-1">PDF, DOCX, TXT or MD</p>
            </>
          )}
        </div>
      )}
      {err && <p className="t-caption text-bad mt-3">{err}</p>}
    </Card>
  );
};

export const AnalyzingSteps: React.FC<{ step: number }> = ({ step: i }) => {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="w-full max-w-md bg-white rounded-[28px] p-7">
      <div className="flex justify-between mb-4">
        <Label>Analyzing</Label>
        <span className="t-caption text-slate">{secs}s</span>
      </div>
      <ul className="space-y-3">
        {ANALYSIS_STEPS.map((s, idx) => (
          <li key={s} className={`flex items-center gap-3 t-small transition-colors ${idx <= i ? 'text-ink' : 'text-steel'}`}>
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${idx < i ? 'bg-good' : idx === i ? 'bg-cta animate-pulse' : 'bg-control'}`}
            />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
};
