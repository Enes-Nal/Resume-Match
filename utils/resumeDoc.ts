import { Bullet, ResumeDoc, ResumeEntry, ResumeSection, SectionKind, Suggestion } from '../types';

const KINDS: SectionKind[] = ['experience', 'education', 'skills', 'projects', 'other'];
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

let counter = 0;
export const newBulletId = () => `n${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Normalize raw model output into a ResumeDoc with stable short ids (s1, e1, b1…). */
export function normalizeDoc(raw: any, keepIds = false): ResumeDoc {
  let s = 0, e = 0, b = 0;
  const seen = new Set<string>();
  const pick = (given: unknown, prefix: string, next: () => number) => {
    const g = str(given);
    if (keepIds && g && g !== 'new' && !seen.has(g)) {
      seen.add(g);
      return g;
    }
    let id = `${prefix}${next()}`;
    while (seen.has(id)) id = `${prefix}${next()}`;
    seen.add(id);
    return id;
  };

  const sections: ResumeSection[] = (Array.isArray(raw?.sections) ? raw.sections : [])
    .filter((sec: any) => sec && (sec.title || sec.entries?.length))
    .map((sec: any) => ({
      id: pick(sec.id, 's', () => ++s),
      title: str(sec.title) || 'Section',
      kind: KINDS.includes(sec.kind) ? sec.kind : 'other',
      entries: (Array.isArray(sec.entries) ? sec.entries : []).map(
        (en: any): ResumeEntry => ({
          id: pick(en?.id, 'e', () => ++e),
          heading: str(en?.heading),
          subheading: str(en?.subheading) || undefined,
          dates: str(en?.dates) || undefined,
          location: str(en?.location) || undefined,
          bullets: (Array.isArray(en?.bullets) ? en.bullets : [])
            .map((bu: any) => (typeof bu === 'string' ? { text: bu } : bu))
            .filter((bu: any) => str(bu?.text))
            .map((bu: any): Bullet => ({ id: pick(bu.id, 'b', () => ++b), text: str(bu.text).replace(/^[-•*▪◦●–]\s*/, '') })),
        })
      ),
    }));

  return {
    name: str(raw?.name),
    headline: str(raw?.headline) || undefined,
    contact: (Array.isArray(raw?.contact) ? raw.contact : []).map(str).filter(Boolean),
    summary: str(raw?.summary),
    sections,
  };
}

export const allBullets = (doc: ResumeDoc) =>
  doc.sections.flatMap(sec => sec.entries.flatMap(en => en.bullets.map(bu => ({ section: sec, entry: en, bullet: bu }))));

export const findBullet = (doc: ResumeDoc, id: string) => allBullets(doc).find(x => x.bullet.id === id);
export const findEntry = (doc: ResumeDoc, id: string) => doc.sections.flatMap(s => s.entries).find(e => e.id === id);

/** Compact, id-tagged view of the resume for prompts. */
export function docForPrompt(doc: ResumeDoc) {
  const lines = [`NAME: ${doc.name}`, doc.headline ? `HEADLINE: ${doc.headline}` : '', `SUMMARY: ${doc.summary || '(none)'}`];
  for (const sec of doc.sections) {
    lines.push(`\n## ${sec.title} (${sec.kind}) [${sec.id}]`);
    for (const en of sec.entries) {
      const head = [en.heading, en.subheading, en.dates].filter(Boolean).join(' | ');
      if (head) lines.push(`### ${head} [${en.id}]`);
      for (const bu of en.bullets) lines.push(`- [${bu.id}] ${bu.text}`);
    }
  }
  return lines.filter(l => l !== '').join('\n');
}

const clone = (doc: ResumeDoc): ResumeDoc => JSON.parse(JSON.stringify(doc));

const skillsEntry = (doc: ResumeDoc) => {
  let sec = doc.sections.find(s => s.kind === 'skills');
  if (!sec) {
    sec = { id: `s-skills`, title: 'Skills', kind: 'skills', entries: [] };
    doc.sections.push(sec);
  }
  if (!sec.entries.length) sec.entries.push({ id: 'e-skills', heading: '', bullets: [] });
  return sec.entries[0];
};

/** Apply a suggestion. Returns the new doc and the (possibly updated) suggestion. */
export function applySuggestion(doc: ResumeDoc, sug: Suggestion): { doc: ResumeDoc; sug: Suggestion } {
  const next = clone(doc);
  const s: Suggestion = { ...sug, status: 'accepted' };
  switch (sug.kind) {
    case 'rewrite': {
      const hit = findBullet(next, sug.target || '');
      if (hit) hit.bullet.text = sug.after;
      break;
    }
    case 'remove-bullet': {
      for (const sec of next.sections) for (const en of sec.entries) en.bullets = en.bullets.filter(b => b.id !== sug.target);
      break;
    }
    case 'add-bullet': {
      const entry = findEntry(next, sug.target || '');
      if (entry) {
        const id = newBulletId();
        entry.bullets.push({ id, text: sug.after });
        s.appliedId = id;
      }
      break;
    }
    case 'summary':
      next.summary = sug.after;
      break;
    case 'skills': {
      const id = newBulletId();
      skillsEntry(next).bullets.push({ id, text: sug.after });
      s.appliedId = id;
      break;
    }
  }
  return { doc: next, sug: s };
}

/** Revert a previously accepted suggestion as far as the current doc allows. */
export function undoSuggestion(doc: ResumeDoc, original: ResumeDoc, sug: Suggestion): { doc: ResumeDoc; sug: Suggestion } {
  const next = clone(doc);
  const s: Suggestion = { ...sug, status: 'pending', appliedId: undefined };
  switch (sug.kind) {
    case 'rewrite': {
      const hit = findBullet(next, sug.target || '');
      if (hit && sug.before) hit.bullet.text = sug.before;
      break;
    }
    case 'remove-bullet': {
      const orig = findBullet(original, sug.target || '');
      if (orig) {
        const entry = findEntry(next, orig.entry.id);
        if (entry && !entry.bullets.some(b => b.id === orig.bullet.id)) {
          const pos = orig.entry.bullets.findIndex(b => b.id === orig.bullet.id);
          entry.bullets.splice(Math.min(pos, entry.bullets.length), 0, { ...orig.bullet });
        }
      }
      break;
    }
    case 'add-bullet':
    case 'skills':
      for (const sec of next.sections) for (const en of sec.entries) en.bullets = en.bullets.filter(b => b.id !== sug.appliedId);
      break;
    case 'summary':
      next.summary = sug.before ?? original.summary;
      break;
  }
  return { doc: next, sug: s };
}

/* ---------- Export ---------- */

export function docToMarkdown(doc: ResumeDoc) {
  const out = [`# ${doc.name || 'Resume'}`];
  if (doc.headline) out.push(`**${doc.headline}**`);
  if (doc.contact.length) out.push(doc.contact.join(' · '));
  if (doc.summary) out.push('', '## Summary', doc.summary);
  for (const sec of doc.sections) {
    out.push('', `## ${sec.title}`);
    for (const en of sec.entries) {
      const head = [en.heading, en.subheading].filter(Boolean).join(' — ');
      const meta = [en.dates, en.location].filter(Boolean).join(', ');
      if (head || meta) out.push('', `### ${head}${meta ? ` (${meta})` : ''}`);
      for (const b of en.bullets) out.push(sec.kind === 'skills' ? b.text : `- ${b.text}`);
    }
  }
  return out.join('\n');
}

export function docToText(doc: ResumeDoc) {
  return docToMarkdown(doc)
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/^- /gm, '• ');
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Standalone, print-ready HTML (single column, ATS-friendly). */
export function docToHtml(doc: ResumeDoc) {
  const sections = doc.sections
    .map(sec => {
      const entries = sec.entries
        .map(en => {
          const head = [en.heading, en.subheading].filter(Boolean).map(esc).join(' — ');
          const meta = [en.dates, en.location].filter(Boolean).map(esc).join(', ');
          const bullets =
            sec.kind === 'skills'
              ? en.bullets.map(b => `<p>${esc(b.text)}</p>`).join('')
              : en.bullets.length
                ? `<ul>${en.bullets.map(b => `<li>${esc(b.text)}</li>`).join('')}</ul>`
                : '';
          return `<div class="entry">${head || meta ? `<div class="row"><strong>${head}</strong><span>${meta}</span></div>` : ''}${bullets}</div>`;
        })
        .join('');
      return `<section><h2>${esc(sec.title)}</h2>${entries}</section>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.name || 'Resume')}</title><style>
    @page { margin: 0.6in; }
    body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1d1d1f; font-size: 10.5pt; line-height: 1.4; max-width: 7.5in; margin: 0 auto; }
    h1 { font-size: 20pt; margin: 0; font-weight: 600; letter-spacing: -0.3px; }
    .headline { margin: 2px 0 0; font-weight: 500; }
    .contact { color: #555; margin: 4px 0 0; font-size: 9.5pt; }
    h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #d6d6d6; padding-bottom: 3px; margin: 16px 0 6px; }
    .row { display: flex; justify-content: space-between; gap: 12px; }
    .row span { color: #555; white-space: nowrap; }
    .entry { margin-bottom: 8px; }
    ul { margin: 3px 0 0; padding-left: 16px; } li { margin: 2px 0; } p { margin: 2px 0; }
  </style></head><body>
    <h1>${esc(doc.name || 'Resume')}</h1>
    ${doc.headline ? `<p class="headline">${esc(doc.headline)}</p>` : ''}
    ${doc.contact.length ? `<p class="contact">${doc.contact.map(esc).join(' · ')}</p>` : ''}
    ${doc.summary ? `<section><h2>Summary</h2><p>${esc(doc.summary)}</p></section>` : ''}
    ${sections}
  </body></html>`;
}

/** Opens the resume in a new window and triggers the print dialog (Save as PDF). */
export function printDoc(doc: ResumeDoc) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(docToHtml(doc));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}

export async function docToDocxBlob(doc: ResumeDoc): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, TabStopType, BorderStyle } = await import('docx');
  const children: any[] = [
    new Paragraph({ children: [new TextRun({ text: doc.name || 'Resume', bold: true, size: 36 })] }),
  ];
  if (doc.headline) children.push(new Paragraph({ children: [new TextRun({ text: doc.headline, size: 22 })] }));
  if (doc.contact.length) children.push(new Paragraph({ children: [new TextRun({ text: doc.contact.join(' · '), size: 18, color: '555555' })] }));

  const heading = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D6D6D6', space: 2 } },
      children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 20, color: '1D1D1F' })],
    });

  if (doc.summary) children.push(heading('Summary'), new Paragraph({ children: [new TextRun({ text: doc.summary, size: 20 })] }));
  for (const sec of doc.sections) {
    children.push(heading(sec.title));
    for (const en of sec.entries) {
      const head = [en.heading, en.subheading].filter(Boolean).join(' — ');
      const meta = [en.dates, en.location].filter(Boolean).join(', ');
      if (head || meta) {
        children.push(
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
            spacing: { before: 120 },
            children: [new TextRun({ text: head, bold: true, size: 20 }), new TextRun({ text: meta ? `\t${meta}` : '', size: 20, color: '555555' })],
          })
        );
      }
      for (const b of en.bullets) {
        children.push(
          new Paragraph(
            sec.kind === 'skills'
              ? { children: [new TextRun({ text: b.text, size: 20 })] }
              : { bullet: { level: 0 }, children: [new TextRun({ text: b.text, size: 20 })] }
          )
        );
      }
    }
  }

  const document = new Document({
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [{ properties: { page: { margin: { top: 864, bottom: 864, left: 864, right: 864 } } }, children }],
  });
  return Packer.toBlob(document);
}
