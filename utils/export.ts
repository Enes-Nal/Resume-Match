import { AnalysisResult } from '../types';

export const downloadText = (filename: string, text: string, type = 'text/plain') => {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'resume';

export const analysisToMarkdown = (a: AnalysisResult) => {
  const list = (xs: string[]) => xs.map(x => `- ${x}`).join('\n');
  return `# ${a.jobTitle}${a.company ? ` — ${a.company}` : ''}

**Match score:** ${a.matchScore}/100 — ${a.verdict}

${a.summary}

## Scores
${Object.entries(a.sectionScores).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## Strengths
${list(a.signals.strengths)}

## Concerns
${list(a.signals.concerns)}

## Skill alignment
${a.skillAlignment.map(s => `- ${s.skill}: ${s.match}%${s.evidence ? ` — ${s.evidence}` : ''}`).join('\n')}

## Missing keywords
${a.missingSignals.join(', ')}

## Suggested bullet rewrites
${a.bulletRewrites.map(b => `- ~~${b.original}~~\n  → ${b.improved}\n  _${b.why}_`).join('\n')}

## Action plan
${a.todos.map(t => `- [${t.status === 'done' ? 'x' : ' '}] (${t.priority}) ${t.title}`).join('\n')}
`;
};
