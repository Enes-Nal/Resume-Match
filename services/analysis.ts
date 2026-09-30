/**
 * Multi-step analysis pipeline:
 *   1. Parse the resume into sections/entries/bullets with stable ids   ┐ in parallel
 *   2. Extract weighted requirements from the job description           ┘
 *   3. Assess each requirement against specific bullets (grounded evidence)
 *   4. Generate concrete edits tied to bullet ids, then validate them
 * The match score is computed from weighted requirement coverage, blended with a holistic read,
 * so it is explainable and moves when the resume is edited.
 */
import { completeJson } from './ai';
import {
  AnalysisResult,
  Priority,
  Requirement,
  RequirementCategory,
  RequirementStatus,
  Rescore,
  ResumeDoc,
  Suggestion,
  SuggestionKind,
  Todo,
} from '../types';
import { allBullets, docForPrompt, findBullet, findEntry, normalizeDoc } from '../utils/resumeDoc';

const VOICE = `You are a senior technical recruiter and resume writer who has screened thousands of candidates.
Be precise, specific and honest. Short neutral sentences. No hype, no emojis.`;

const clip = (s: string, n = 16000) => (s.length > n ? s.slice(0, n) + '\n[truncated]' : s);
const clamp = (n: unknown, lo = 0, hi = 100) => {
  const v = typeof n === 'string' ? parseFloat(n) : typeof n === 'number' ? n : NaN;
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : 0;
};
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()) : []);
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const oneOf = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (opts.includes(v as T) ? (v as T) : d);
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/* ---------- 1. Parse resume ---------- */

export async function parseResume(resumeText: string): Promise<ResumeDoc> {
  const raw = await completeJson<any>(
    [
      {
        role: 'system',
        content: `Convert the resume text into structured JSON. This is a lossless transcription, not an edit:
- Copy every bullet and line verbatim. Do not rewrite, merge, summarize or drop anything.
- Put each job, degree or project in its own entry. Put skills lines in a "skills" section, one line per bullet (e.g. "Languages: Go, Python").
- Text before the first section that describes the candidate goes in "summary".
Return ONLY JSON:
{ "name": string, "headline": string, "contact": string[], "summary": string,
  "sections": [{ "title": string, "kind": "experience"|"education"|"skills"|"projects"|"other",
    "entries": [{ "heading": string (role, degree or project), "subheading": string (company or school), "dates": string, "location": string, "bullets": string[] }] }] }`,
      },
      { role: 'user', content: clip(resumeText, 20000) },
    ],
    { temperature: 0 }
  );
  const doc = normalizeDoc(raw);
  if (!allBullets(doc).length && !doc.summary) throw new Error('Could not read the resume structure. Check the extracted text and try again.');
  return doc;
}

/* ---------- 2. Parse job ---------- */

export interface JobProfile {
  title: string;
  company: string;
  seniority: string;
  summary: string;
  requirements: Omit<Requirement, 'status' | 'evidence' | 'note'>[];
}

export async function parseJob(jdText: string): Promise<JobProfile> {
  const raw = await completeJson<any>(
    [
      {
        role: 'system',
        content: `${VOICE}

Read the job description the way a hiring manager would. Extract what they will actually screen for.
- 8 to 16 requirements. Split compound lines ("Go, Java or TypeScript" is one requirement; "Kafka and PostgreSQL" is two).
- importance "must" for stated requirements and core responsibilities; "nice" for "plus", "bonus", "preferred".
- Include implicit requirements that the responsibilities make obvious (e.g. "owns services end to end" → production ownership).
- "summary": 2 sentences on what this team most needs from this hire.
Return ONLY JSON:
{ "title": string, "company": string, "seniority": string (e.g. "Senior, 5+ years"), "summary": string,
  "requirements": [{ "text": string (specific, one line), "label": string (1-4 words), "category": "hard-skill"|"soft-skill"|"experience"|"domain"|"education"|"other", "importance": "must"|"nice" }] }`,
      },
      { role: 'user', content: clip(jdText) },
    ],
    { temperature: 0.1 }
  );
  const cats: RequirementCategory[] = ['hard-skill', 'soft-skill', 'experience', 'domain', 'education', 'other'];
  const requirements = (Array.isArray(raw.requirements) ? raw.requirements : [])
    .filter((r: any) => s(r?.text))
    .slice(0, 18)
    .map((r: any, i: number) => ({
      id: `R${i + 1}`,
      text: s(r.text),
      label: s(r.label) || s(r.text).split(/\s+/).slice(0, 3).join(' '),
      category: oneOf(r.category, cats, 'other'),
      importance: oneOf(r.importance, ['must', 'nice'] as const, 'must'),
    }));
  if (!requirements.length) throw new Error('Could not find requirements in the job description.');
  return { title: s(raw.title) || 'Untitled role', company: s(raw.company), seniority: s(raw.seniority), summary: s(raw.summary), requirements };
}

/* ---------- 3. Assess ---------- */

const requirementsForPrompt = (reqs: JobProfile['requirements']) =>
  reqs.map(r => `[${r.id}] (${r.importance}, ${r.category}) ${r.text}`).join('\n');

interface Assessment {
  requirements: Requirement[];
  holistic: number;
  raw: any;
}

async function assess(doc: ResumeDoc, job: JobProfile, full: boolean): Promise<Assessment> {
  const extra = full
    ? `,
  "holisticScore": number (0-100, your overall read as a recruiter; most real candidates land 40-80),
  "verdict": string (3-6 words),
  "summary": string (2-3 sentences: would you advance this candidate, and why),
  "identity": { "role": string (how the resume reads at a glance), "confidence": number (0-100, how clearly it reads that way) },
  "sectionScores": { "impact": number, "keywords": number, "clarity": number, "formatting": number, "experience": number },
  "strengths": string[] (3-5, each citing something specific),
  "concerns": string[] (3-5, each specific and fixable where possible),
  "seniority": string (the candidate's level as the resume reads), "jdSeniority": string,
  "coherence": string (1-2 sentences: does the resume tell one clear story for this role),
  "focusScore": number,
  "redFlags": string[] (gaps, job-hopping, vague claims, missing dates, typos; [] if none),
  "experienceRelevance": [{ "entryId": string, "relevance": number, "feedback": string }] (one per experience/project entry),
  "todos": [{ "title": string, "detail": string, "priority": "high"|"medium"|"low" }] (3-6 actions OUTSIDE the resume text: portfolio, certification, preparing a story, researching the domain)`
    : '';

  const raw = await completeJson<any>(
    [
      {
        role: 'system',
        content: `${VOICE}

Assess the candidate against each requirement, strictly and only from what the resume says.
- "met": a specific bullet clearly demonstrates it. "partial": related or transferable evidence, or the skill is only listed without use. "missing": no evidence.
- "evidence": ids of the bullets (e.g. "b7") that support it. Use "summary" for the summary line. Never cite ids that do not exist.
- "note": one sentence explaining the call, naming the evidence or what is missing.
Return ONLY JSON:
{ "requirements": [{ "id": string, "status": "met"|"partial"|"missing", "evidence": string[], "note": string }]${extra} }`,
      },
      {
        role: 'user',
        content: `JOB: ${job.title}${job.company ? ` at ${job.company}` : ''} (${job.seniority || 'level unstated'})
WHAT THEY NEED: ${job.summary}

REQUIREMENTS:
${requirementsForPrompt(job.requirements)}

RESUME (bullets tagged with ids):
${clip(docForPrompt(doc), 18000)}`,
      },
    ],
    { temperature: 0.2 }
  );

  const bulletIds = new Set([...allBullets(doc).map(x => x.bullet.id), 'summary']);
  const byId = new Map<string, any>((Array.isArray(raw.requirements) ? raw.requirements : []).map((r: any) => [s(r?.id), r]));
  const requirements: Requirement[] = job.requirements.map(r => {
    const a = byId.get(r.id) || {};
    const evidence = strArr(a.evidence).filter(id => bulletIds.has(id));
    let status = oneOf<RequirementStatus>(a.status, ['met', 'partial', 'missing'], 'missing');
    // Grounding check: a "met" claim needs at least one real citation.
    if (status === 'met' && !evidence.length) status = 'partial';
    return { ...r, status, evidence, note: s(a.note) };
  });
  return { requirements, holistic: clamp(raw.holisticScore), raw };
}

export function coverageScore(reqs: Requirement[]) {
  const w = (r: Requirement) => (r.importance === 'must' ? 3 : 1);
  const v = (r: Requirement) => (r.status === 'met' ? 1 : r.status === 'partial' ? 0.5 : 0);
  const total = reqs.reduce((n, r) => n + w(r), 0) || 1;
  return Math.round((reqs.reduce((n, r) => n + w(r) * v(r), 0) / total) * 100);
}

const blend = (coverage: number, holistic: number) => (holistic ? Math.round(coverage * 0.7 + holistic * 0.3) : coverage);

/* ---------- 4. Suggest ---------- */

async function suggest(doc: ResumeDoc, job: JobProfile, reqs: Requirement[], resumeText: string): Promise<Suggestion[]> {
  const gaps = reqs
    .filter(r => r.status !== 'met')
    .map(r => `[${r.id}] ${r.status.toUpperCase()} (${r.importance}): ${r.text} — ${r.note}`)
    .join('\n');

  const raw = await completeJson<any>(
    [
      {
        role: 'system',
        content: `${VOICE}

You are editing this resume to win an interview for the job. Propose 8 to 14 concrete edits, highest impact first.

Edit types:
- "rewrite": replace one bullet (target = bullet id). Lead with a strong verb, show scope and outcome, surface the JD's language where the facts support it. Replace weak phrasing like "responsible for", "worked on", "helped with".
- "add-bullet": add a new bullet to an entry (target = entry id, e.g. "e2"). Only when the resume elsewhere implies the experience (e.g. a listed skill with no bullet showing it).
- "remove-bullet": drop a bullet that is irrelevant to this job or dilutes it (target = bullet id). "after" = "".
- "summary": rewrite the summary to position the candidate for this exact role (2-3 sentences). No target.
- "skills": add one skills line (e.g. "Observability: Datadog, OpenTelemetry"). Only skills the resume evidences. No target.

Rules — these are strict:
- Never invent employers, titles, dates, tools, numbers or outcomes. Keep every fact from the original.
- If a metric would strengthen a bullet but is unknown, use a placeholder like [X%] or [N users] and set "needsConfirmation": true.
- Set "needsConfirmation": true whenever the edit adds any claim the resume does not already state.
- Prioritize the gaps below, especially "must" requirements. Also fix the weakest bullets even if they are relevant.
- Keep bullets under 30 words. Match the resume's tense and voice.
- "reason": one sentence on what the edit achieves for this job. "requirementIds": the requirement ids it helps.
Return ONLY JSON:
{ "suggestions": [{ "kind": "rewrite"|"add-bullet"|"remove-bullet"|"summary"|"skills", "target": string, "after": string, "reason": string, "requirementIds": string[], "impact": "high"|"medium"|"low", "needsConfirmation": boolean }] }`,
      },
      {
        role: 'user',
        content: `JOB: ${job.title}${job.company ? ` at ${job.company}` : ''}
WHAT THEY NEED: ${job.summary}

REQUIREMENT GAPS:
${gaps || '(none — focus on sharpening impact and language)'}

RESUME (bullets tagged with ids, entries tagged e#):
${clip(docForPrompt(doc), 18000)}`,
      },
    ],
    { temperature: 0.45 }
  );

  const kinds: SuggestionKind[] = ['rewrite', 'add-bullet', 'remove-bullet', 'summary', 'skills'];
  const reqIds = new Set(reqs.map(r => r.id));
  const sourceNumbers = new Set((resumeText.match(/\d[\d,.]*/g) || []).map(n => n.replace(/,/g, '')));
  const usedTargets = new Set<string>();
  const out: Suggestion[] = [];

  for (const r of Array.isArray(raw.suggestions) ? raw.suggestions : []) {
    const kind = oneOf(r?.kind, kinds, 'rewrite');
    const target = s(r?.target);
    const after = s(r?.after);
    let before: string | undefined;

    if (kind === 'rewrite' || kind === 'remove-bullet') {
      const hit = findBullet(doc, target);
      if (!hit || usedTargets.has(target)) continue;
      before = hit.bullet.text;
      if (kind === 'rewrite' && (!after || after === before)) continue;
    } else if (kind === 'add-bullet') {
      if (!findEntry(doc, target) || !after) continue;
    } else if (kind === 'summary') {
      if (!after || usedTargets.has('summary')) continue;
      before = doc.summary;
    } else if (!after) continue;
    usedTargets.add(kind === 'summary' ? 'summary' : target);

    // Grounding check: any number not present in the original resume must be confirmed by the user.
    const newNumbers = (after.match(/\d[\d,.]*/g) || []).map(n => n.replace(/,/g, '')).filter(n => !sourceNumbers.has(n));
    const needsConfirmation = !!r?.needsConfirmation || /\[[^\]]+\]/.test(after) || newNumbers.length > 0 || kind === 'add-bullet';

    out.push({
      id: uid('sug'),
      kind,
      target: kind === 'summary' || kind === 'skills' ? undefined : target,
      before,
      after,
      reason: s(r?.reason),
      requirementIds: strArr(r?.requirementIds).filter(id => reqIds.has(id)),
      impact: oneOf<Priority>(r?.impact, ['high', 'medium', 'low'], 'medium'),
      needsConfirmation,
      status: 'pending',
    });
  }

  const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.impact] - rank[b.impact]).slice(0, 16);
}

/* ---------- Orchestration ---------- */

export const ANALYSIS_STEPS = ['Reading your resume', 'Mapping the job requirements', 'Checking each requirement against your experience', 'Writing targeted edits'] as const;

export async function analyzeResume(resumeText: string, jdText: string, onStep?: (i: number) => void): Promise<AnalysisResult> {
  onStep?.(0);
  const jobPromise = parseJob(jdText).then(j => {
    onStep?.(1);
    return j;
  });
  const [doc, job] = await Promise.all([parseResume(resumeText), jobPromise]);

  onStep?.(2);
  const a = await assess(doc, job, true);

  onStep?.(3);
  const suggestions = await suggest(doc, job, a.requirements, resumeText).catch(err => {
    console.warn('[analysis] suggestions failed', err);
    return [] as Suggestion[];
  });

  const coverage = coverageScore(a.requirements);
  const raw = a.raw;
  const ss = raw.sectionScores || {};
  const bulletText = (id: string) => (id === 'summary' ? doc.summary : findBullet(doc, id)?.bullet.text || '');

  const todos: Todo[] = (Array.isArray(raw.todos) ? raw.todos : [])
    .filter((t: any) => s(t?.title))
    .map((t: any) => ({
      id: uid('todo'),
      title: s(t.title),
      detail: s(t.detail) || undefined,
      priority: oneOf<Priority>(t.priority, ['high', 'medium', 'low'], 'medium'),
      status: 'to-fix' as const,
    }));
  // Must-have gaps that no edit can close become prep tasks.
  const addressed = new Set(suggestions.flatMap(x => x.requirementIds));
  for (const r of a.requirements.filter(r => r.status === 'missing' && r.importance === 'must' && !addressed.has(r.id))) {
    todos.push({ id: uid('todo'), title: `Close the gap: ${r.label}`, detail: r.note || r.text, priority: 'high', status: 'to-fix' });
  }

  return {
    id: uid('analysis'),
    timestamp: Date.now(),
    jobTitle: job.title,
    company: job.company,
    matchScore: blend(coverage, a.holistic),
    verdict: s(raw.verdict),
    summary: s(raw.summary),
    identity: { role: s(raw.identity?.role) || 'Unclear', confidence: clamp(raw.identity?.confidence) },
    sectionScores: {
      impact: clamp(ss.impact),
      keywords: clamp(ss.keywords),
      clarity: clamp(ss.clarity),
      formatting: clamp(ss.formatting),
      experience: clamp(ss.experience),
    },
    signals: { strengths: strArr(raw.strengths), concerns: strArr(raw.concerns) },
    skillAlignment: a.requirements.map(r => ({
      skill: r.label,
      match: r.status === 'met' ? 100 : r.status === 'partial' ? 50 : 0,
      evidence: r.evidence.map(bulletText).filter(Boolean).join(' · ') || r.note,
    })),
    experienceRelevance: (Array.isArray(raw.experienceRelevance) ? raw.experienceRelevance : [])
      .map((e: any) => {
        const entry = findEntry(doc, s(e?.entryId));
        const item = entry ? [entry.heading, entry.subheading].filter(Boolean).join(' — ') : s(e?.entryId);
        return { item, relevance: clamp(e?.relevance), feedback: s(e?.feedback) };
      })
      .filter((e: any) => e.item),
    missingSignals: a.requirements.filter(r => r.status === 'missing').map(r => r.label),
    resumeInsights: {
      coherence: s(raw.coherence),
      seniority: s(raw.seniority),
      jdSeniority: s(raw.jdSeniority) || job.seniority,
      focusScore: clamp(raw.focusScore),
      redFlags: strArr(raw.redFlags),
    },
    bulletRewrites: suggestions
      .filter(x => x.kind === 'rewrite')
      .map(x => ({ original: x.before || '', improved: x.after, why: x.reason })),
    todos,
    requirements: a.requirements,
    holisticScore: a.holistic,
    jobSummary: job.summary,
    resumeDoc: doc,
    suggestions,
  };
}

/** Re-assess an edited resume against the same requirements. */
export async function rescoreDoc(doc: ResumeDoc, analysis: AnalysisResult): Promise<Rescore> {
  const reqs = analysis.requirements || [];
  const job: JobProfile = {
    title: analysis.jobTitle,
    company: analysis.company,
    seniority: analysis.resumeInsights.jdSeniority,
    summary: analysis.jobSummary || '',
    requirements: reqs.map(({ status, evidence, note, ...r }) => r),
  };
  const a = await assess(doc, job, false);
  const coverage = coverageScore(a.requirements);
  // Keep the holistic component from the original analysis so before/after scores are comparable.
  return { matchScore: blend(coverage, analysis.holisticScore || 0), coverage, requirements: a.requirements, at: Date.now() };
}

/** Apply a free-form instruction to the resume, keeping ids so changes can be diffed. */
export async function aiEditDoc(doc: ResumeDoc, instruction: string, analysis: AnalysisResult): Promise<ResumeDoc> {
  const raw = await completeJson<any>(
    [
      {
        role: 'system',
        content: `${VOICE}

You edit resumes. Apply the user's instruction to the resume JSON and return the full updated resume JSON in the same shape.
- Keep the "id" of every section, entry and bullet you keep. New bullets get "id": "new".
- Never invent employers, titles, dates, tools, numbers or outcomes. Use [X] placeholders for unknown metrics.
- Change only what the instruction asks for.
Target job: ${analysis.jobTitle}${analysis.company ? ` at ${analysis.company}` : ''}. ${analysis.jobSummary || ''}
Return ONLY the JSON object.`,
      },
      { role: 'user', content: `INSTRUCTION: ${instruction}\n\nRESUME JSON:\n${JSON.stringify(doc)}` },
    ],
    { temperature: 0.35 }
  );
  const next = normalizeDoc(raw.resume || raw, true);
  if (!allBullets(next).length) throw new Error('The AI returned an empty resume. Try rephrasing the instruction.');
  return next;
}
