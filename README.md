# Resume Match

Live Demo: https://resume-match-ruddy.vercel.app

## Project Overview

Resume Match is a web application created to help job seekers better understand how well their resume aligns with a specific job description. Many strong candidates never reach the interview stage simply because their resumes are filtered out by automated systems. This project was built to address that problem by giving users clearer insight into how their resume content compares to what employers are actually looking for.

The idea was to keep the experience simple and focused. Instead of overwhelming users with complex metrics, Resume Match aims to provide practical feedback that can be immediately applied when tailoring a resume for a role.

## Why This Project Was Built

The motivation behind Resume Match comes from real job search frustration. Applicant Tracking Systems often scan resumes for relevance before a human ever sees them. Small differences in wording or missing keywords can significantly impact a candidate's chances, even when they are qualified.

This project exists to help bridge that gap. By comparing a resume directly with a job description, users can better understand where their resume is strong and where it may be lacking. The goal is to make resume optimization more transparent and less guess-based.

## What the Application Does

Resume Match analyzes the relationship between a resume and a job description and provides insight into how closely they align. It helps identify important skills and terms found in the job description and highlights areas where the resume could be improved or expanded.

This allows users to refine their resume with intention rather than guesswork, increasing the likelihood that it performs well with both automated systems and human reviewers.

## Features

**Analysis (multi-step, grounded)**
1. The resume is parsed into sections, entries and bullets, each with a stable id.
2. The job description is turned into 8–16 weighted requirements (must-have vs nice-to-have).
3. Every requirement is judged met / partial / missing, citing the exact bullets as evidence. A "met" without a valid citation is automatically downgraded.
4. The AI proposes 8–14 concrete edits tied to specific bullets: rewrites, new bullets, removals, a targeted summary and skills lines.

The match score comes from weighted requirement coverage (70%) blended with a holistic recruiter read (30%), so it is explainable and moves when you edit. Any edit that adds a number not in your original resume, contains an `[X]` placeholder or adds a new claim is flagged for you to confirm.

Also included: section scores, seniority (you vs. the role), red flags, experience relevance, an offline ATS keyword scan and a resume health check.

**Resume editor**
- Accept, skip or tweak each AI edit and watch it apply to your resume live. Undo any of them.
- "Accept safe edits" applies every edit that adds no unverified claims.
- Click any line to edit it yourself, add or delete bullets.
- Tell the AI what to change in plain language ("tighten to one page", "emphasize leadership"), with undo.
- Re-score the edited resume against the same requirements to see before → after.
- Export to PDF (print), Word (.docx), Markdown or plain text.

**Writing, interview and coaching**
- Cover letters by tone and length; LinkedIn profile, recruiter outreach, thank-you note, elevator pitch
- Bullet rewriter with four styles
- Eight predicted interview questions with answer outlines; practice by typing or speaking and get graded
- Career coach chat that has read your resume, the job and the analysis
- Action plan board with "Draft this fix"; full history saved in the browser; Markdown report export

## AI setup

### Built-in AI (default, no setup for visitors)

The site calls its own `/api/ai` endpoint, which forwards to OpenRouter using a key stored **only on the server**. Visitors never see the key.

1. Create a key at https://openrouter.ai/keys. Set a credit limit on it.
2. Local: put `OPENROUTER_API_KEY=...` in `.env` and restart `npm run dev`.
3. Vercel: Project → Settings → Environment Variables → add `OPENROUTER_API_KEY`, then redeploy.

By default it uses free models (`qwen/qwen3.8-27b:free`, then `google/gemma-4-31b-it:free`, then `openrouter/free`). Free models on OpenRouter are limited to about 50 requests per day per account, or about 1000 per day once the account has bought at least $10 of credits. One analysis uses 4 requests. For more headroom, set `OPENROUTER_MODELS` to a paid model; see `.env.example`.

The proxy only accepts requests from the site's own origin, rate limits each visitor IP, caps output tokens and ignores any model the browser asks for.

### Bring your own key

Visitors can also pick Google Gemini, Groq, OpenRouter or Pollinations in **Settings** and paste their own free key. Those keys stay in the visitor's browser. With fallback on, a failing provider hands off to the next configured one.

## Technologies

React 19, TypeScript, Vite 6 and Tailwind CSS v4. The visual design follows `DESIGN.md`-style tokens: a white gallery canvas, `#f5f5f7` bands, 28px shadowless cards and compact blue pill controls. PDF and DOCX parsing (pdf.js, mammoth) is lazy-loaded on first upload.

```
api/ai.ts             Vercel function for the built-in AI
server/proxy.ts       proxy logic shared by Vercel and the dev server (key stays server-side)
services/ai.ts        provider-agnostic client: retries, streaming, fallback, JSON repair
services/analysis.ts  multi-step analysis pipeline, re-scoring and AI resume edits
services/features.ts  cover letters, interview prep, coach and other writers
utils/resumeDoc.ts    structured resume: apply/undo edits, PDF/DOCX/Markdown export
utils/ats.ts          offline keyword scan, health checks, offline analysis
views/                one file per workspace tab (Editor.tsx is the resume editor)
```

## Setup

```bash
npm install
npm run dev
```

Add `OPENROUTER_API_KEY` to `.env` (see `.env.example`), then open http://localhost:3000.

## Troubleshooting

- **"built-in AI is not configured"**: set `OPENROUTER_API_KEY` on the server (`.env` locally, Environment Variables on Vercel) and restart or redeploy.
- **"needs an API key"**: open Settings and paste a key for the selected provider.
- **401 / 403**: the key is wrong or revoked. Use **Test connection** in Settings.
- **402 / 429**: you hit a free-tier limit. Wait a minute, or add a second provider and enable fallback.
- **Model not found**: providers rename models. Set a current model name in Settings.
- **Scanned PDFs** have no text layer. Paste the text instead.
