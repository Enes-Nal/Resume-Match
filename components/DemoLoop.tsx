import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, FileText, Sparkles, Upload } from 'lucide-react';
import { ANALYSIS_STEPS } from '../services/analysis';
import { scoreColor } from './ui';

/** Looping, non-interactive demo of the flow: upload a resume, add a job, analyze, get results. */

const JOB = 'Senior Product Designer. You will own end-to-end flows, run user research, ship in Figma with engineers, and mentor two designers…';
const SCORE = 86;
const MATCHED = ['Figma', 'User research', 'Design systems', 'Prototyping'];
const MISSING = ['Mentoring', 'A/B testing'];

// Phase start times in ms. The last entry is the loop length.
const TIMELINE = [
  0, //    0 empty dropzone
  700, //  1 file drags in
  1700, // 2 resume loaded
  2300, // 3 job typing
  4300, // 4 button pressed
  4800, // 5 analyzing
  7400, // 6 results
  14000, // loop
];

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const DemoLoop: React.FC = () => {
  const reduced = prefersReducedMotion();
  const [phase, setPhase] = useState(reduced ? 6 : 0);
  const [typed, setTyped] = useState(reduced ? JOB.length : 0);
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(reduced ? SCORE : 0);
  const [cycle, setCycle] = useState(0);

  // Drive phases, restarting the loop each cycle.
  useEffect(() => {
    if (reduced) return;
    setPhase(0);
    setTyped(0);
    setStep(0);
    setScore(0);
    const timers = TIMELINE.slice(1, -1).map((t, i) => setTimeout(() => setPhase(i + 1), t));
    timers.push(setTimeout(() => setCycle(c => c + 1), TIMELINE[TIMELINE.length - 1]));
    return () => timers.forEach(clearTimeout);
  }, [cycle, reduced]);

  // Typewriter for the job description.
  useEffect(() => {
    if (phase !== 3) return;
    const t = setInterval(() => setTyped(n => Math.min(JOB.length, n + 3)), 28);
    return () => clearInterval(t);
  }, [phase]);

  // Walk through the analysis steps.
  useEffect(() => {
    if (phase !== 5) return;
    const t = setInterval(() => setStep(n => Math.min(ANALYSIS_STEPS.length, n + 1)), 600);
    return () => clearInterval(t);
  }, [phase]);

  // Count the score up.
  useEffect(() => {
    if (phase !== 6 || reduced) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1200);
      setScore(Math.round(SCORE * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, reduced]);

  const showResults = phase >= 6;
  const loaded = phase >= 2;

  return (
    <div className="max-w-4xl mx-auto" aria-label="Example: a resume is uploaded and analyzed" role="img">
      <div className="rounded-[28px] bg-white ring-1 ring-hairline/70 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.25)] overflow-hidden">
        {/* Window chrome */}
        <div className="h-10 border-b border-hairline/70 flex items-center gap-1.5 px-4 bg-frost">
          <span className="w-2.5 h-2.5 rounded-full bg-control" />
          <span className="w-2.5 h-2.5 rounded-full bg-control" />
          <span className="w-2.5 h-2.5 rounded-full bg-control" />
          <span className="t-caption text-steel mx-auto pr-10">resume-match / analyze</span>
        </div>

        <div className="relative h-[520px] sm:h-[400px] bg-mist">
          {/* Input stage */}
          <div
            className={`absolute inset-0 p-4 sm:p-6 flex flex-col gap-4 transition-all duration-500 ${
              showResults ? 'opacity-0 -translate-y-3 pointer-events-none' : 'opacity-100'
            }`}
          >
            <div className="grid sm:grid-cols-2 gap-4 flex-1 min-h-0">
              {/* Resume card */}
              <div className="bg-white rounded-[20px] p-5 flex flex-col relative overflow-hidden">
                <p className="t-label">Step 1</p>
                <p className="text-[17px] font-semibold mt-0.5">Your resume</p>
                <div
                  className={`mt-3 flex-1 rounded-[16px] border border-dashed flex items-center justify-center transition-colors duration-300 ${
                    phase === 1 ? 'border-cta bg-[#f0f6fe]' : loaded ? 'border-transparent' : 'border-steel/50'
                  }`}
                >
                  {loaded ? (
                    <div className="w-full flex items-center gap-3 rounded-[14px] bg-mist px-4 py-3 animate-fade-up">
                      <FileText size={20} strokeWidth={1.6} className="text-ink flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium truncate">maya-chen-resume.pdf</p>
                        <p className="t-caption text-slate">412 words extracted</p>
                      </div>
                      <Check size={16} className="text-good" />
                    </div>
                  ) : (
                    <div className="text-center text-slate">
                      <Upload size={18} strokeWidth={1.6} className="mx-auto text-ink" />
                      <p className="t-caption mt-2">Drop a file or click to browse</p>
                    </div>
                  )}
                </div>
                {/* The file being dragged in */}
                {phase <= 1 && (
                  <div
                    className="absolute left-1/2 top-1/2 flex items-center gap-2 rounded-[12px] bg-white ring-1 ring-hairline shadow-lg px-3 py-2 transition-all duration-[900ms] ease-[cubic-bezier(.2,.7,.2,1)]"
                    style={{
                      transform: phase === 0 ? 'translate(60%, 120%) rotate(8deg)' : 'translate(-50%, -10%) rotate(-2deg)',
                      opacity: phase === 0 ? 0 : 1,
                    }}
                  >
                    <FileText size={16} className="text-cta" />
                    <span className="text-[12px] font-medium whitespace-nowrap">maya-chen-resume.pdf</span>
                  </div>
                )}
              </div>

              {/* Job card */}
              <div className="bg-white rounded-[20px] p-5 flex flex-col">
                <p className="t-label">Step 2</p>
                <p className="text-[17px] font-semibold mt-0.5">The job</p>
                <div
                  className={`mt-3 flex-1 rounded-[16px] border px-4 py-3 text-[13px] leading-relaxed text-ink text-left overflow-hidden transition-colors ${
                    phase === 3 ? 'border-cta' : 'border-hairline'
                  }`}
                >
                  {phase >= 3 ? (
                    <span className={phase === 3 ? 'caret' : ''}>{JOB.slice(0, typed)}</span>
                  ) : (
                    <span className="text-steel">Paste the full job posting here…</span>
                  )}
                </div>
              </div>
            </div>

            {/* Action / progress */}
            <div className="h-[92px] flex items-center justify-center">
              {phase < 5 ? (
                <span
                  className={`inline-flex items-center gap-2 h-11 px-6 rounded-full text-white text-[15px] font-medium transition-all duration-200 ${
                    phase >= 3 ? 'bg-cta' : 'bg-cta/40'
                  } ${phase === 4 ? 'scale-95 ring-4 ring-cta/20' : ''}`}
                >
                  <Sparkles size={15} /> Analyze fit
                </span>
              ) : (
                <ul className="bg-white rounded-[20px] px-5 py-3 space-y-1.5 w-full max-w-sm animate-fade-up">
                  {ANALYSIS_STEPS.map((s, i) => (
                    <li key={s} className={`flex items-center gap-2.5 text-[12px] ${i <= step ? 'text-ink' : 'text-steel'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${i < step ? 'bg-good' : i === step ? 'bg-cta animate-pulse' : 'bg-control'}`} />
                      <span className="truncate">{s}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Results stage */}
          <div
            className={`absolute inset-0 p-4 sm:p-6 grid sm:grid-cols-[200px_1fr] gap-4 transition-all duration-500 ${
              showResults ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
            }`}
          >
            <div className="bg-white rounded-[20px] p-5 flex sm:flex-col items-center justify-center gap-4 text-center">
              <MiniRing score={score} />
              <div className="text-left sm:text-center">
                <p className="text-[17px] font-semibold">Strong match</p>
                <p className="t-caption text-slate mt-0.5">Senior Product Designer</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 min-h-0">
              <div className="bg-white rounded-[20px] p-5">
                <p className="t-label">Requirements</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {MATCHED.map((k, i) => (
                    <Chip key={k} show={showResults} delay={500 + i * 150} tone="good">{k}</Chip>
                  ))}
                  {MISSING.map((k, i) => (
                    <Chip key={k} show={showResults} delay={500 + (MATCHED.length + i) * 150} tone="warn">{k}</Chip>
                  ))}
                </div>
              </div>

              <div
                className="bg-white rounded-[20px] p-5 flex-1 transition-all duration-500"
                style={{ opacity: showResults ? 1 : 0, transform: showResults ? 'none' : 'translateY(8px)', transitionDelay: showResults ? '1600ms' : '0ms' }}
              >
                <p className="t-label">Suggested edit</p>
                <p className="t-small text-steel line-through mt-3">Worked on redesigning the checkout page.</p>
                <div className="flex items-start gap-2 mt-2">
                  <ArrowRight size={15} className="text-cta mt-0.5 flex-shrink-0" />
                  <p className="t-small text-ink">
                    Led the checkout redesign from research to launch, lifting conversion <span className="bg-[#e8f1fc] rounded px-1">18%</span> across 2M monthly visits.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Chip: React.FC<{ show: boolean; delay: number; tone: 'good' | 'warn'; children: React.ReactNode }> = ({ show, delay, tone, children }) => (
  <span
    className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-medium transition-all duration-300 ${
      tone === 'good' ? 'bg-[#e9f5ee] text-good' : 'bg-[#fbf0e3] text-warn'
    }`}
    style={{ opacity: show ? 1 : 0, transform: show ? 'none' : 'scale(.9)', transitionDelay: show ? `${delay}ms` : '0ms' }}
  >
    {tone === 'good' ? <Check size={12} /> : <span className="w-1.5 h-1.5 rounded-full bg-warn" />}
    {children}
  </span>
);

const MiniRing: React.FC<{ score: number }> = ({ score }) => {
  const size = 112;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle r={r} cx={size / 2} cy={size / 2} fill="none" stroke="var(--color-control)" strokeWidth={stroke} />
        <circle
          r={r}
          cx={size / 2}
          cy={size / 2}
          fill="none"
          // Use the final color throughout so the ring doesn't flash through every threshold color while counting.
          stroke={scoreColor(SCORE)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (score / 100) * c}
        />
      </svg>
      <div className="absolute text-center">
        {/* Tabular digits in a fixed box so the number doesn't change width while counting. */}
        <div className="font-[family-name:var(--font-display)] font-semibold text-ink leading-none text-[30px] tabular-nums w-[2.2ch] mx-auto">
          {score}
        </div>
        <div className="t-caption text-slate">match</div>
      </div>
    </div>
  );
};
