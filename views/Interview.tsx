import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Mic, MicOff, Sparkles } from 'lucide-react';
import { AnswerFeedback, InterviewQuestion } from '../types';
import { Button, Card, CopyButton, ErrorNote, Label, ScoreRing, Thinking } from '../components/ui';
import { generateInterviewQuestions, gradeAnswer } from '../services/features';
import { ViewProps } from './Overview';

const TYPE_LABEL: Record<InterviewQuestion['type'], string> = {
  behavioral: 'Behavioral',
  technical: 'Technical',
  'role-specific': 'Role-specific',
  gap: 'Probes a gap',
};

export const Interview: React.FC<ViewProps> = ({ session, update }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(0);
  const questions = session.interviewQuestions || [];

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = await generateInterviewQuestions(session.resumeText, session.jdText);
      update({ interviewQuestions: qs });
      setOpen(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!questions.length) {
    return (
      <Card className="py-16 text-center animate-fade-up">
        <p className="t-title">Know the questions before they are asked.</p>
        <p className="t-body text-slate mt-3 max-w-lg mx-auto">
          The AI predicts eight likely questions for this role, explains why each is asked, and outlines an answer from your own experience.
        </p>
        <div className="mt-8 flex justify-center">
          {loading ? <Thinking label="Predicting questions" /> : (
            <Button size="lg" icon={<Sparkles size={16} />} onClick={generate}>
              Prepare my interview
            </Button>
          )}
        </div>
        {error && <div className="mt-6 max-w-xl mx-auto"><ErrorNote message={error} onRetry={generate} /></div>}
      </Card>
    );
  }

  return (
    <div className="space-y-3 animate-fade-up">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="t-small text-slate">{questions.length} likely questions. Open one to see the outline and practice.</p>
        <Button variant="ghost" onClick={generate} disabled={loading}>
          {loading ? 'Regenerating…' : 'Regenerate'}
        </Button>
      </div>
      {error && <ErrorNote message={error} onRetry={generate} />}
      {questions.map((q, i) => (
        <Card key={i} pad="p-0">
          <button className="w-full text-left px-7 py-6 flex items-start gap-5" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
            <span className="t-kicker text-steel w-6 flex-shrink-0">{i + 1}</span>
            <div className="flex-1">
              <p className="t-label mb-1">{TYPE_LABEL[q.type]}</p>
              <p className="t-body font-medium">{q.question}</p>
            </div>
            <ChevronDown size={18} className={`text-slate mt-1 transition-transform ${open === i ? 'rotate-180' : ''}`} />
          </button>
          {open === i && <QuestionDetail q={q} resume={session.resumeText} jd={session.jdText} />}
        </Card>
      ))}
    </div>
  );
};

const QuestionDetail: React.FC<{ q: InterviewQuestion; resume: string; jd: string }> = ({ q, resume, jd }) => {
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dictation = useDictation(t => setAnswer(a => (a ? a + ' ' : '') + t));

  const grade = async () => {
    setLoading(true);
    setError(null);
    try {
      setFeedback(await gradeAnswer(q.question, answer, resume, jd));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-7 pb-7 sm:pl-[76px] space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <Label className="mb-2">Why they ask</Label>
          <p className="t-small text-slate">{q.why}</p>
        </div>
        <div>
          <Label className="mb-2">Answer outline</Label>
          <ul className="space-y-2">
            {q.answerOutline.map((p, i) => (
              <li key={i} className="flex gap-3 t-small">
                <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-ink flex-shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-[20px] bg-mist p-5">
        <div className="flex items-center justify-between mb-3">
          <Label>Practice</Label>
          {dictation.supported && (
            <button
              onClick={dictation.toggle}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full t-caption ${dictation.listening ? 'bg-bad text-white' : 'bg-white ring-1 ring-hairline text-ink'}`}
            >
              {dictation.listening ? <MicOff size={13} /> : <Mic size={13} />}
              {dictation.listening ? 'Stop dictation' : 'Answer out loud'}
            </button>
          )}
        </div>
        <textarea
          className="field min-h-[130px] resize-y"
          placeholder="Type or dictate your answer as you would say it…"
          value={answer}
          onChange={e => setAnswer(e.target.value)}
        />
        <div className="flex justify-end mt-3">
          <Button onClick={grade} loading={loading} disabled={answer.trim().split(/\s+/).length < 12}>
            Grade my answer
          </Button>
        </div>
      </div>

      {error && <ErrorNote message={error} onRetry={grade} />}
      {feedback && (
        <div className="grid md:grid-cols-[auto_1fr] gap-8 items-start animate-fade-up">
          <ScoreRing score={feedback.score} size={120} stroke={8} label="Answer" />
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <Label className="mb-2">Worked well</Label>
                <ul className="space-y-2">
                  {feedback.strengths.map((s, i) => (
                    <li key={i} className="flex gap-3 t-small">
                      <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-good flex-shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <Label className="mb-2">Improve</Label>
                <ul className="space-y-2">
                  {feedback.improvements.map((s, i) => (
                    <li key={i} className="flex gap-3 t-small">
                      <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-warn flex-shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {feedback.betterAnswer && (
              <div className="rounded-[20px] ring-1 ring-control p-5">
                <div className="flex items-center justify-between mb-2">
                  <Label>A stronger version</Label>
                  <CopyButton text={feedback.betterAnswer} />
                </div>
                <p className="t-small">{feedback.betterAnswer}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/** Browser speech-to-text, where available (Chrome, Edge, Safari). */
function useDictation(onText: (t: string) => void) {
  const Ctor: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
  const [listening, setListening] = useState(false);
  const rec = useRef<any>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => () => rec.current?.stop(), []);

  const toggle = () => {
    if (!Ctor) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = false;
    r.lang = navigator.language || 'en-US';
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) cb.current(e.results[i][0].transcript.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  };

  return { supported: !!Ctor, listening, toggle };
}
