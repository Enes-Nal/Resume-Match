import { complete, completeJson, ChatTurn } from './ai';
import { AnalysisResult, AnswerFeedback, ChatMessage, InterviewQuestion, Todo } from '../types';

const MAX_INPUT = 14000;
const clip = (s: string) => (s.length > MAX_INPUT ? s.slice(0, MAX_INPUT) + '\n[truncated]' : s);

const VOICE = `You are a senior technical recruiter and career coach for knowledge workers.
Tone: calm, precise, direct. Short neutral sentences. No hype, no emojis, no filler.
Never invent employers, degrees, dates or metrics the candidate did not provide. When a metric would help, use a clear placeholder like [X%].`;

const context = (resume: string, jd: string) => `RESUME:
"""
${clip(resume)}
"""

JOB DESCRIPTION:
"""
${clip(jd)}
"""`;

const clamp = (n: unknown, lo = 0, hi = 100) => {
  const v = typeof n === 'string' ? parseFloat(n) : typeof n === 'number' ? n : NaN;
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : 0;
};
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(String) : []);

/* ---------- Streaming writers ---------- */

type Stream = (delta: string, full: string) => void;

export interface CoverLetterOptions {
  tone: 'professional' | 'warm' | 'confident' | 'concise';
  length: 'short' | 'medium' | 'long';
  notes: string;
}

export function streamCoverLetter(resume: string, jd: string, opts: CoverLetterOptions, onToken: Stream, signal?: AbortSignal) {
  const words = { short: '150-200', medium: '250-320', long: '380-450' }[opts.length];
  return complete(
    [
      {
        role: 'system',
        content: `${VOICE}

Write a cover letter for this candidate and role. Tone: ${opts.tone}. Length: ${words} words.
Open with a specific hook tied to the company or role, not "I am writing to apply".
Connect 2-3 concrete achievements from the resume to the JD's top needs. Close with a clear, low-key call to action.
Use plain paragraphs. No subject line, no address block. Sign off with the candidate's name if it is in the resume.`,
      },
      {
        role: 'user',
        content: `${context(resume, jd)}${opts.notes.trim() ? `\n\nEXTRA NOTES FROM CANDIDATE:\n${opts.notes}` : ''}`,
      },
    ],
    { onToken, signal }
  );
}

export type ExtraKind = 'linkedin' | 'outreach' | 'thankyou' | 'elevator';

export const EXTRA_KINDS: Record<ExtraKind, { label: string; hint: string; prompt: string }> = {
  linkedin: {
    label: 'LinkedIn profile',
    hint: 'Headline and About section aimed at this role.',
    prompt:
      'Write a LinkedIn headline (under 220 characters) and an About section (about 180 words) that position the candidate for roles like this one. Format: "**Headline**" line, then "**About**" and the text.',
  },
  outreach: {
    label: 'Recruiter message',
    hint: 'A short cold message to the hiring manager.',
    prompt:
      'Write a cold outreach message to the hiring manager for this role, under 110 words, suitable for LinkedIn or email. Include a subject line as the first line in the form "Subject: ...".',
  },
  thankyou: {
    label: 'Thank-you note',
    hint: 'Post-interview follow-up.',
    prompt:
      'Write a post-interview thank-you email for this role, under 150 words. Reference one specific way the candidate can help with the JD\'s priorities. Include a "Subject: ..." first line.',
  },
  elevator: {
    label: 'Elevator pitch',
    hint: 'A 30-second spoken introduction.',
    prompt:
      'Write a 30-second spoken elevator pitch (70-90 words) the candidate can use in a screening call for this role. First person, natural spoken rhythm.',
  },
};

export function streamExtra(kind: ExtraKind, resume: string, jd: string, onToken: Stream, signal?: AbortSignal) {
  return complete(
    [
      { role: 'system', content: `${VOICE}\n\n${EXTRA_KINDS[kind].prompt}` },
      { role: 'user', content: context(resume, jd) },
    ],
    { onToken, signal }
  );
}

export function streamTodoHelp(todo: Todo, resume: string, jd: string, onToken: Stream, signal?: AbortSignal) {
  return complete(
    [
      {
        role: 'system',
        content: `${VOICE}

The candidate has this improvement task for their resume: "${todo.title}"${todo.detail ? ` (${todo.detail})` : ''}.
Do the work for them: show the exact text to add or replace, using the resume's real content. Keep it under 180 words. Use Markdown with "Before" / "After" where it applies.`,
      },
      { role: 'user', content: context(resume, jd) },
    ],
    { onToken, signal, temperature: 0.4 }
  );
}

/* ---------- Bullet rewriter ---------- */

export type BulletStyle = 'impact' | 'concise' | 'technical' | 'leadership';

export async function rewriteBullet(bullet: string, jd: string, style: BulletStyle): Promise<string[]> {
  const guide: Record<BulletStyle, string> = {
    impact: 'Lead with the outcome and a metric. Action verb + what + measurable result.',
    concise: 'Under 18 words. Remove filler. Keep the strongest fact.',
    technical: 'Name the specific technologies, scale and architecture decisions.',
    leadership: 'Emphasize ownership, influence, cross-team coordination and mentoring.',
  };
  const raw = await completeJson<{ options: string[] }>([
    {
      role: 'system',
      content: `${VOICE}

Rewrite one resume bullet point three different ways for the target job. Style: ${guide[style]}
Do not invent facts; use [X] for numbers the candidate must supply.
Return ONLY JSON: { "options": [string, string, string] }`,
    },
    { role: 'user', content: `BULLET:\n${bullet}\n\nTARGET JOB (for context):\n${clip(jd).slice(0, 4000)}` },
  ]);
  return strArr(raw.options).slice(0, 3);
}

/* ---------- Interview ---------- */

export async function generateInterviewQuestions(resume: string, jd: string): Promise<InterviewQuestion[]> {
  const raw = await completeJson<{ questions: any[] }>([
    {
      role: 'system',
      content: `${VOICE}

Predict the 8 interview questions this candidate is most likely to face for this role.
Mix: 2 behavioral, 3 technical or craft, 2 role-specific, 1 that probes the candidate's biggest gap.
For each, give why the interviewer asks it and a 3-4 point answer outline built from the candidate's real resume.
Return ONLY JSON: { "questions": [{ "question": string, "type": "behavioral"|"technical"|"role-specific"|"gap", "why": string, "answerOutline": string[] }] }`,
    },
    { role: 'user', content: context(resume, jd) },
  ]);
  const types = ['behavioral', 'technical', 'role-specific', 'gap'];
  return (raw.questions || [])
    .filter(q => q?.question)
    .map(q => ({
      question: String(q.question),
      type: types.includes(q.type) ? q.type : 'role-specific',
      why: String(q.why || ''),
      answerOutline: strArr(q.answerOutline),
    }));
}

export async function gradeAnswer(question: string, answer: string, resume: string, jd: string): Promise<AnswerFeedback> {
  const raw = await completeJson<any>([
    {
      role: 'system',
      content: `${VOICE}

You are the interviewer for this role. Grade the candidate's answer to the question.
Judge structure (STAR for behavioral), specificity, relevance to the JD and evidence.
Return ONLY JSON: { "score": number (0-100), "strengths": string[], "improvements": string[], "betterAnswer": string (a stronger version of their answer, first person, under 170 words, using only facts from their answer and resume) }`,
    },
    { role: 'user', content: `${context(resume, jd)}\n\nQUESTION:\n${question}\n\nCANDIDATE ANSWER:\n${answer}` },
  ]);
  return {
    score: clamp(raw.score),
    strengths: strArr(raw.strengths),
    improvements: strArr(raw.improvements),
    betterAnswer: String(raw.betterAnswer || ''),
  };
}

/* ---------- Coach chat ---------- */

export function streamCoachReply(
  history: ChatMessage[],
  resume: string,
  jd: string,
  analysis: AnalysisResult,
  onToken: Stream,
  signal?: AbortSignal
) {
  const system: ChatTurn = {
    role: 'system',
    content: `${VOICE}

You are coaching this candidate on one specific application. You have their resume, the job description and a prior analysis.
Answer in concise Markdown. When suggesting resume text, give the exact wording.

${context(resume, jd)}

PRIOR ANALYSIS:
Match ${analysis.matchScore}/100 — ${analysis.verdict}
Strengths: ${analysis.signals.strengths.join('; ')}
Concerns: ${analysis.signals.concerns.join('; ')}
Missing keywords: ${analysis.missingSignals.join(', ')}`,
  };
  const turns: ChatTurn[] = [system, ...history.slice(-12).map(m => ({ role: m.role, content: m.content }))];
  return complete(turns, { onToken, signal });
}
