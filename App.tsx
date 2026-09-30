import React, { useCallback, useEffect, useState } from 'react';
import { Clock, Download, FileText, Settings2, Trash2 } from 'lucide-react';
import { AnalysisTab, Session } from './types';
import { AISettings, PROVIDERS, checkBuiltin, isProviderReady, loadSettings, saveSettings, setActiveSettings } from './services/ai';
import { analyzeResume } from './services/analysis';
import { localAnalysis } from './utils/ats';
import { SAMPLE_JD, SAMPLE_RESUME } from './utils/sample';
import { deleteSession, loadDraft, loadSessions, saveDraft, upsertSession } from './utils/storage';
import { analysisToMarkdown, downloadText, slug } from './utils/export';
import { AnalyzingSteps, Home, Landing } from './components/Landing';
import { SettingsSheet } from './components/SettingsSheet';
import { Sheet } from './components/Sheet';
import { Button, scoreColor } from './components/ui';
import { Overview } from './views/Overview';
import { Keywords } from './views/Keywords';
import { Insights } from './views/Insights';
import { Editor } from './views/Editor';
import { CoverLetter } from './views/CoverLetter';
import { Interview } from './views/Interview';
import { Coach } from './views/Coach';
import { Plan } from './views/Plan';

const VIEWS: Record<AnalysisTab, React.FC<any>> = {
  [AnalysisTab.Overview]: Overview,
  [AnalysisTab.Keywords]: Keywords,
  [AnalysisTab.Insights]: Insights,
  [AnalysisTab.Editor]: Editor,
  [AnalysisTab.CoverLetter]: CoverLetter,
  [AnalysisTab.Interview]: Interview,
  [AnalysisTab.Coach]: Coach,
  [AnalysisTab.Plan]: Plan,
};

type Route = 'home' | 'analyze';
const routeFromPath = (): Route => (window.location.pathname.startsWith('/analyze') ? 'analyze' : 'home');

const App: React.FC = () => {
  const [route, setRoute] = useState<Route>(routeFromPath);
  const navigate = useCallback((to: Route) => {
    const path = to === 'home' ? '/' : '/analyze';
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    setRoute(to);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(routeFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const [settings, setSettings] = useState<AISettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const draft = loadDraft();
  const [resumeText, setResumeText] = useState(draft?.resumeText || '');
  const [jdText, setJdText] = useState(draft?.jdText || '');
  const [resumeFileName, setResumeFileName] = useState<string | null>(draft?.resumeFileName || null);
  const [jdFileName, setJdFileName] = useState<string | null>(draft?.jdFileName || null);

  const [sessions, setSessions] = useState<Session[]>(loadSessions);
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<AnalysisTab>(AnalysisTab.Overview);
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState(0);
  const [, setBuiltinChecked] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Learn whether the server has the built-in AI key configured; re-render so readiness updates.
    checkBuiltin().then(() => setBuiltinChecked(n => n + 1));
  }, []);

  useEffect(() => {
    setActiveSettings(settings);
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveDraft({ resumeText, jdText, resumeFileName, jdFileName });
  }, [resumeText, jdText, resumeFileName, jdFileName]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab, session?.id]);

  const update = useCallback((patch: Partial<Session>) => {
    setSession(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      setSessions(upsertSession(next));
      return next;
    });
  }, []);

  const analyze = async (offline = false, docs = { resumeText, jdText }) => {
    if (!offline && !isProviderReady(settings)) {
      setSettingsOpen(true);
      return;
    }
    setAnalyzing(!offline);
    setStep(0);
    setError(null);
    try {
      const analysis = offline ? localAnalysis(docs.resumeText, docs.jdText) : await analyzeResume(docs.resumeText, docs.jdText, setStep);
      const s: Session = { id: analysis.id, createdAt: analysis.timestamp, resumeText: docs.resumeText, jdText: docs.jdText, analysis };
      setSessions(upsertSession(s));
      setSession(s);
      setTab(AnalysisTab.Overview);
    } catch (e) {
      console.error(e);
      setError((e as Error).message || 'Analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const openSession = (s: Session) => {
    navigate('analyze');
    setSession(s);
    setResumeText(s.resumeText);
    setJdText(s.jdText);
    setTab(AnalysisTab.Overview);
    setHistoryOpen(false);
  };

  const View = session ? VIEWS[tab] : null;
  const a = session?.analysis;

  return (
    <div className="min-h-screen bg-white">
      {/* Global navigation */}
      <header className="sticky top-0 z-40 h-11 bg-white/80 backdrop-blur-xl no-print">
        <div className="max-w-[1024px] mx-auto h-full px-4 flex items-center justify-between">
          <button
            onClick={() => {
              setSession(null);
              navigate('home');
            }}
            className="flex items-center gap-2 text-ink/80 hover:text-ink"
            aria-label="Resume Match home"
          >
            <FileText size={16} strokeWidth={2} />
            <span className="t-caption font-semibold tracking-[-0.12px]">Resume Match</span>
          </button>
          <nav className="flex items-center gap-6">
            <button onClick={() => setHistoryOpen(true)} className="t-caption text-ink/80 hover:text-ink inline-flex items-center gap-1.5">
              <Clock size={13} /> History{sessions.length ? ` (${sessions.length})` : ''}
            </button>
            <button onClick={() => setSettingsOpen(true)} className="t-caption text-ink/80 hover:text-ink inline-flex items-center gap-1.5">
              <Settings2 size={13} /> {PROVIDERS[settings.provider].name}
              {!isProviderReady(settings) && <span className="w-1.5 h-1.5 rounded-full bg-launch" />}
            </button>
          </nav>
        </div>
      </header>

      {route === 'home' ? (
        <Home
          onStart={() => navigate('analyze')}
          onSample={() => {
            setSession(null);
            setResumeText(SAMPLE_RESUME);
            setResumeFileName('sample-resume.txt');
            setJdText(SAMPLE_JD);
            setJdFileName('sample-job.txt');
            navigate('analyze');
          }}
        />
      ) : session && a && View ? (
        <>
          {/* Product local navigation */}
          <div className="sticky top-11 z-30 bg-white/90 backdrop-blur-xl border-b border-hairline no-print">
            <div className="max-w-[1024px] mx-auto px-4">
              <div className="flex items-center justify-between h-[52px] gap-4">
                <div className="flex items-baseline gap-3 min-w-0">
                  <p className="t-nav-title truncate">{a.jobTitle}</p>
                  {a.company && <p className="t-caption text-slate truncate hidden sm:block">{a.company}</p>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="t-caption font-semibold hidden sm:inline" style={{ color: scoreColor(a.matchScore) }}>
                    {session.rescore ? `${a.matchScore} → ${session.rescore.matchScore}` : `${a.matchScore}%`} match
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Download size={12} />}
                    onClick={() => downloadText(`${slug(a.jobTitle)}-report.md`, analysisToMarkdown(a), 'text/markdown')}
                  >
                    <span className="hidden sm:inline">Report</span>
                  </Button>
                  <Button size="sm" onClick={() => setSession(null)}>
                    New
                  </Button>
                </div>
              </div>
              <nav className="flex gap-7 overflow-x-auto no-scrollbar -mb-px" aria-label="Sections">
                {Object.values(AnalysisTab).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    aria-current={tab === t ? 'page' : undefined}
                    className={`py-3 text-[14px] font-medium tracking-[-0.224px] whitespace-nowrap border-b-2 transition-colors ${
                      tab === t ? 'text-ink border-ink' : 'text-slate border-transparent hover:text-ink'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          <main className="bg-mist min-h-[calc(100vh-140px)] py-10 sm:py-14 px-4">
            <div className="max-w-[1024px] mx-auto">
              {a.offline && (
                <div className="mb-8 rounded-[28px] bg-white px-7 py-6 flex flex-col md:flex-row md:items-center gap-5 justify-between no-print">
                  <div>
                    <p className="t-label">Offline scan</p>
                    <p className="t-body mt-1">Keyword and format checks only. Add a free AI key for the full recruiter read, rewrites, cover letters and interview prep.</p>
                    {error && <p className="t-small text-bad mt-2">{error}</p>}
                  </div>
                  <div className="flex gap-3 flex-shrink-0">
                    {isProviderReady(settings) ? (
                      <Button loading={analyzing} onClick={() => analyze(false, session)}>Run AI analysis</Button>
                    ) : (
                      <Button onClick={() => setSettingsOpen(true)}>Set up free AI</Button>
                    )}
                  </div>
                </div>
              )}
              {analyzing ? (
                <div className="flex justify-center py-10"><AnalyzingSteps step={step} /></div>
              ) : (
                <View
                  key={`${session.id}-${tab}`}
                  session={session}
                  update={update}
                  goTo={setTab}
                  reanalyze={isProviderReady(settings) ? () => analyze(false, session) : () => setSettingsOpen(true)}
                />
              )}
            </div>
          </main>
        </>
      ) : (
        <Landing
          resumeText={resumeText}
          jdText={jdText}
          resumeFileName={resumeFileName}
          jdFileName={jdFileName}
          setResume={(t, f) => {
            setResumeText(t);
            setResumeFileName(f);
          }}
          setJd={(t, f) => {
            setJdText(t);
            setJdFileName(f);
          }}
          onAnalyze={() => analyze()}
          onQuickScan={() => analyze(true)}
          aiReady={isProviderReady(settings)}
          analyzing={analyzing}
          step={step}
          error={error}
          providerName={PROVIDERS[settings.provider].name}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      <footer className="bg-mist border-t border-hairline no-print">
        <div className="max-w-[1024px] mx-auto px-4 py-6 t-caption text-slate flex flex-col sm:flex-row gap-2 justify-between">
          <span>Your documents are stored only in this browser and sent only to the AI provider you choose.</span>
          <span>AI output can be wrong. Review before you send.</span>
        </div>
      </footer>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onChange={setSettings} />

      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="History">
        {sessions.length === 0 ? (
          <p className="t-small text-slate py-8 text-center">No analyses yet.</p>
        ) : (
          <div className="bg-white rounded-[20px] divide-y divide-control">
            {sessions.map(s => (
              <div key={s.id} className="flex items-center gap-4 px-5 py-4 group">
                <button className="flex-1 text-left min-w-0" onClick={() => openSession(s)}>
                  <p className="t-small font-medium truncate">{s.analysis.jobTitle}</p>
                  <p className="t-caption text-slate truncate">
                    {[s.analysis.company, new Date(s.createdAt).toLocaleDateString()].filter(Boolean).join(' · ')}
                  </p>
                </button>
                <span className="t-small font-semibold" style={{ color: scoreColor(s.analysis.matchScore) }}>
                  {s.analysis.matchScore}
                </span>
                <button
                  aria-label="Delete"
                  onClick={() => {
                    setSessions(deleteSession(s.id));
                    if (session?.id === s.id) setSession(null);
                  }}
                  className="text-steel hover:text-bad opacity-60 group-hover:opacity-100"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
};

export default App;
