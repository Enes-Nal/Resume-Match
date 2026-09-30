/**
 * Deterministic, offline ATS checks. These run instantly and complement the AI analysis.
 */

const STOP = new Set(
  `a about above after again against all am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves
  able across also among etc via within without including include includes using use used work working works job role roles position team teams company candidate candidates ideal looking seeking join us we'll you'll we're you're strong excellent good great plus bonus preferred required requirements responsibilities qualifications experience experiences years year minimum least ability skills skill knowledge understanding familiarity proven demonstrated new help make build building ensure support supporting across drive driving based well highly etc e.g i.e day days time level levels opportunity opportunities environment benefits salary equal employer applicants status race color religion gender sexual orientation national origin disability veteran`.split(/\s+/)
);

// Short terms that are meaningful despite length or case.
const SHORT_OK = new Set(['go', 'r', 'c', 'c#', 'c++', 'ai', 'ml', 'ui', 'ux', 'qa', 'ci', 'cd', 'bi', 'hr', 'pm', 'sql', 'aws', 'gcp', 'api', 'etl', 'seo', 'b2b', 'saas', 'ios', 'nlp', 'llm']);

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .split(/\s+/)
    .map(t => t.replace(/^[./-]+|[./-]+$/g, ''))
    .filter(Boolean);

const isKeywordToken = (t: string) =>
  (t.length > 2 || SHORT_OK.has(t)) && !STOP.has(t) && !/^\d+$/.test(t);

// Known skills get priority; other words must repeat to count as a keyword.
const SKILLS = new Set(
  `javascript typescript python java go golang rust ruby php scala kotlin swift c++ c# r sql nosql bash
  react vue angular svelte next.js node.js node express django flask fastapi spring rails .net graphql rest grpc
  html css tailwind redux webpack vite jest cypress playwright
  aws gcp azure lambda s3 ec2 ecs eks kubernetes docker terraform ansible helm serverless linux
  postgresql postgres mysql mongodb redis elasticsearch dynamodb cassandra snowflake bigquery kafka rabbitmq spark airflow dbt hadoop
  ci/cd jenkins github gitlab git datadog prometheus grafana opentelemetry observability monitoring alerting tracing sre on-call
  microservices distributed scalability reliability latency throughput caching idempotency reconciliation ledger payments fintech pci compliance security oauth encryption
  ml ai llm nlp pytorch tensorflow scikit-learn pandas numpy statistics analytics experimentation
  figma sketch prototyping usability accessibility wireframing
  product roadmap strategy stakeholder stakeholders okrs agile scrum kanban jira roadmapping discovery metrics kpis
  leadership mentor coaching hiring cross-functional communication collaboration ownership
  seo marketing sales crm salesforce hubspot b2b saas budgeting forecasting excel tableau looker powerbi
  architecture api apis backend frontend full-stack mobile ios android devops infrastructure transactions`.split(/\s+/)
);

const PHRASES = new Set([
  'distributed systems', 'data modeling', 'design documents', 'design docs', 'design systems', 'machine learning', 'deep learning',
  'a/b testing', 'infrastructure as code', 'product strategy', 'user research', 'system design', 'data pipelines', 'event driven',
  'event-driven systems', 'test automation', 'unit testing', 'code review', 'technical design', 'project management', 'product management',
  'data analysis', 'data science', 'computer vision', 'cloud infrastructure', 'incident response', 'go-to-market',
]);
const isSkill = (term: string) => SKILLS.has(term) || PHRASES.has(term);

const STOP_EXTRA = new Set(
  `end move moves billions millions dollars small large businesses business raise bar operate critical flows docs doc own owning owns partner partners clear lead leading high low fast world class best every per like want get take keep way part plus bonus track record fit culture mission values impact impactful passionate love`.split(/\s+/)
);

const stem = (t: string) => t.replace(/(ies)$/, 'y').replace(/([^s])s$/, '$1');
const variants = (t: string) => {
  const b = stem(t);
  return new Set([t, b, `${b}s`, `${b}ed`, `${b}ing`, `${b.replace(/e$/, '')}ed`, `${b.replace(/e$/, '')}ing`]);
};

export interface KeywordHit {
  term: string;
  jdCount: number;
  resumeCount: number;
  found: boolean;
}

export interface KeywordReport {
  keywords: KeywordHit[];
  coverage: number; // 0-100
}

const countOccurrences = (haystack: string, term: string) => {
  const forms = term.includes(' ') ? new Set([term, stem(term)]) : variants(term);
  let n = 0;
  for (const f of forms) {
    const escaped = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^a-z0-9+#])${escaped}(?=$|[^a-z0-9+#])`, 'g');
    n = Math.max(n, (haystack.match(re) || []).length);
  }
  return n;
};

export function keywordReport(resume: string, jd: string, limit = 30): KeywordReport {
  // Skip the first line: it is usually "Title — Company" and would reward the company name.
  const body = jd.split('\n').slice(1).join('\n') || jd;
  const jdTokens = tokenize(body);
  const counts = new Map<string, number>();
  const usable = (t: string) => isKeywordToken(t) && !STOP_EXTRA.has(t);

  for (const raw of jdTokens) {
    if (!usable(raw)) continue;
    const t = SKILLS.has(raw) ? raw : stem(raw);
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  for (let i = 0; i < jdTokens.length - 1; i++) {
    const a = jdTokens[i], b = jdTokens[i + 1];
    if (usable(a) && usable(b)) {
      const bg = `${a} ${b}`;
      counts.set(bg, (counts.get(bg) || 0) + 1);
    }
  }

  const weight = (term: string, c: number) => (isSkill(term) ? c * 3 : c);
  const ranked = [...counts.entries()]
    .filter(([term, c]) => isSkill(term) || (term.includes(' ') ? c >= 2 : c >= 3))
    .map(([term, c]) => [term, weight(term, c)] as const)
    .sort((a, b) => b[1] - a[1]);

  const chosen: string[] = [];
  for (const [term] of ranked) {
    if (chosen.length >= limit) break;
    // Drop a single word already covered by a chosen phrase, and vice versa for weak phrases.
    if (!term.includes(' ') && chosen.some(c => c.includes(' ') && c.split(' ').includes(term)) && !isSkill(term)) continue;
    chosen.push(term);
  }

  const resumeLower = resume.toLowerCase();
  const keywords = chosen.map(term => {
    const resumeCount = countOccurrences(resumeLower, term);
    return { term, jdCount: counts.get(term) || 0, resumeCount, found: resumeCount > 0 };
  });

  const w = (k: KeywordHit) => weight(k.term, k.jdCount);
  const weightTotal = keywords.reduce((s, k) => s + w(k), 0) || 1;
  const weightFound = keywords.reduce((s, k) => s + (k.found ? w(k) : 0), 0);
  return { keywords, coverage: Math.round((weightFound / weightTotal) * 100) };
}

export type CheckStatus = 'pass' | 'warn' | 'fail';
export interface HealthCheck {
  label: string;
  status: CheckStatus;
  detail: string;
}

const ACTION_VERBS = /^(led|built|designed|developed|launched|shipped|created|drove|owned|managed|improved|increased|reduced|delivered|implemented|architected|scaled|automated|optimized|mentored|founded|established|spearheaded|negotiated|streamlined|migrated|analyzed|grew|cut|saved|won|authored|redesigned|introduced|partnered|coordinated|directed|resolved|accelerated|generated)\b/i;
const WEAK = /\b(responsible for|duties included|helped with|worked on|assisted (with|in)|tasked with|involved in)\b/i;

export function resumeHealth(resume: string): { checks: HealthCheck[]; stats: Record<string, number> } {
  const text = resume.trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const bullets = lines.filter(l => /^([-•*▪◦●–]|\d+\.)\s*/.test(l) || (l.length > 40 && l.length < 260 && ACTION_VERBS.test(l)));
  const bulletText = bullets.map(b => b.replace(/^([-•*▪◦●–]|\d+\.)\s*/, ''));
  const quantified = bulletText.filter(b => /\d|%|\$/.test(b)).length;
  const actionLed = bulletText.filter(b => ACTION_VERBS.test(b)).length;
  const weakCount = (text.match(new RegExp(WEAK.source, 'gi')) || []).length;
  const pronouns = (text.match(/\b(I|me|my)\b/g) || []).length;

  const hasEmail = /[\w.+-]+@[\w-]+\.[\w.]+/.test(text);
  const hasPhone = /(\+?\d[\d\s().-]{8,}\d)/.test(text);
  const hasLink = /(linkedin\.com|github\.com|portfolio|https?:\/\/)/i.test(text);
  const sections = ['experience', 'education', 'skills', 'summary|profile|about', 'projects'].filter(s =>
    new RegExp(`\\b(${s})\\b`, 'i').test(text)
  ).length;

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const qPct = pct(quantified, bulletText.length);
  const aPct = pct(actionLed, bulletText.length);

  const checks: HealthCheck[] = [
    {
      label: 'Length',
      status: words >= 350 && words <= 1000 ? 'pass' : words < 200 || words > 1400 ? 'fail' : 'warn',
      detail: `${words} words. Aim for 400–900 for one or two pages.`,
    },
    {
      label: 'Contact details',
      status: hasEmail && hasPhone ? (hasLink ? 'pass' : 'warn') : 'fail',
      detail: [hasEmail ? 'Email' : 'No email', hasPhone ? 'phone' : 'no phone', hasLink ? 'profile link' : 'no LinkedIn/portfolio link'].join(', ') + '.',
    },
    {
      label: 'Standard sections',
      status: sections >= 3 ? 'pass' : sections === 2 ? 'warn' : 'fail',
      detail: `${sections} of 5 common headings found (Summary, Experience, Skills, Education, Projects).`,
    },
    {
      label: 'Quantified impact',
      status: qPct >= 40 ? 'pass' : qPct >= 20 ? 'warn' : 'fail',
      detail: `${quantified} of ${bulletText.length} bullets include a number (${qPct}%). Target 40%+.`,
    },
    {
      label: 'Action verbs',
      status: aPct >= 60 ? 'pass' : aPct >= 35 ? 'warn' : 'fail',
      detail: `${aPct}% of bullets open with a strong verb.`,
    },
    {
      label: 'Weak phrasing',
      status: weakCount === 0 ? 'pass' : weakCount <= 2 ? 'warn' : 'fail',
      detail: weakCount ? `${weakCount} uses of phrases like "responsible for" or "worked on".` : 'No passive filler phrases found.',
    },
    {
      label: 'First-person pronouns',
      status: pronouns <= 2 ? 'pass' : pronouns <= 6 ? 'warn' : 'fail',
      detail: pronouns ? `${pronouns} uses of I / me / my. Resumes usually omit them.` : 'None found.',
    },
  ];

  return { checks, stats: { words, bullets: bulletText.length, quantified, actionLed } };
}

/** Build a best-effort analysis with no AI, from the keyword scan and health checks. */
export function localAnalysis(resume: string, jd: string): import('../types').AnalysisResult {
  const kw = keywordReport(resume, jd);
  const health = resumeHealth(resume);
  const score = (s: CheckStatus) => (s === 'pass' ? 90 : s === 'warn' ? 60 : 25);
  const check = (label: string) => health.checks.find(c => c.label === label)!;
  const firstLine = jd.split('\n').map(l => l.trim()).find(l => l.length > 3) || 'Untitled role';
  const [title, company] = firstLine.split(/\s+[—–-]\s+|\s+at\s+/);
  const found = kw.keywords.filter(k => k.found);
  const missing = kw.keywords.filter(k => !k.found);
  const formatting = Math.round((score(check('Length').status) + score(check('Standard sections').status) + score(check('Contact details').status)) / 3);
  const impact = Math.round((score(check('Quantified impact').status) + score(check('Action verbs').status)) / 2);
  const clarity = Math.round((score(check('Weak phrasing').status) + score(check('First-person pronouns').status)) / 2);
  const match = Math.round(kw.coverage * 0.7 + impact * 0.15 + formatting * 0.15);

  return {
    id: `analysis-${Date.now().toString(36)}`,
    timestamp: Date.now(),
    jobTitle: (title || firstLine).slice(0, 80),
    company: (company || '').slice(0, 60),
    matchScore: match,
    verdict: match >= 70 ? 'Strong keyword overlap' : match >= 50 ? 'Partial keyword overlap' : 'Low keyword overlap',
    summary: `Offline scan: ${found.length} of ${kw.keywords.length} top job terms appear in your resume, and ${health.checks.filter(c => c.status === 'pass').length} of ${health.checks.length} format checks pass. Add an AI key for a recruiter-grade read.`,
    identity: { role: 'Run AI analysis to detect', confidence: 0 },
    sectionScores: { impact, keywords: kw.coverage, clarity, formatting, experience: 0 },
    signals: {
      strengths: [
        ...found.slice(0, 4).map(k => `Mentions "${k.term}" (${k.resumeCount}×), which the job emphasizes.`),
        ...health.checks.filter(c => c.status === 'pass').slice(0, 2).map(c => `${c.label}: ${c.detail}`),
      ],
      concerns: [
        ...missing.slice(0, 4).map(k => `"${k.term}" appears ${k.jdCount}× in the job but not in your resume.`),
        ...health.checks.filter(c => c.status === 'fail').slice(0, 2).map(c => `${c.label}: ${c.detail}`),
      ],
    },
    skillAlignment: kw.keywords.slice(0, 10).map(k => ({
      skill: k.term,
      match: k.found ? Math.min(100, 60 + k.resumeCount * 15) : 0,
      evidence: k.found ? `Found ${k.resumeCount}× in resume` : 'Not found',
    })),
    experienceRelevance: [],
    missingSignals: missing.map(k => k.term),
    resumeInsights: {
      coherence: 'Available with AI analysis.',
      seniority: '',
      jdSeniority: '',
      focusScore: kw.coverage,
      redFlags: health.checks.filter(c => c.status === 'fail').map(c => `${c.label}: ${c.detail}`),
    },
    bulletRewrites: [],
    todos: [
      ...health.checks
        .filter(c => c.status !== 'pass')
        .map((c, i) => ({ id: `todo-l${i}`, title: `Improve: ${c.label.toLowerCase()}`, detail: c.detail, priority: (c.status === 'fail' ? 'high' : 'medium') as 'high' | 'medium', status: 'to-fix' as const })),
      ...missing.slice(0, 5).map((k, i) => ({ id: `todo-k${i}`, title: `Add "${k.term}" if you have that experience`, priority: 'medium' as const, status: 'to-fix' as const })),
    ],
    offline: true,
  };
}
