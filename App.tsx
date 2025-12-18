
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnalysisTab, AnalysisResult, Todo, TodoStatus, HistoryItem } from './types';
import { analyzeResume } from './services/geminiService';
import { GlassCard } from './components/GlassCard';
import { MatchScoreArc } from './components/MatchScoreArc';
import { extractTextFromFile } from './utils/fileUtils';
import { 
  Briefcase, 
  Target, 
  AlertCircle, 
  ChevronRight,
  ArrowRight,
  Upload,
  FileText,
  X,
  GripVertical
} from 'lucide-react';

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AnalysisTab>(AnalysisTab.Overview);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Extraction States
  const [isExtractingResume, setIsExtractingResume] = useState(false);
  const [isExtractingJd, setIsExtractingJd] = useState(false);
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Form State
  const [resumeText, setResumeText] = useState('');
  const [jdText, setJdText] = useState('');
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [jdFileName, setJdFileName] = useState<string | null>(null);
  
  const [isDraggingResume, setIsDraggingResume] = useState(false);
  const [isDraggingJd, setIsDraggingJd] = useState(false);
  
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jdInputRef = useRef<HTMLInputElement>(null);

  // Kanban Drag State
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('resume_match_history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const saveToHistory = useCallback((res: AnalysisResult) => {
    const newItem: HistoryItem = {
      id: res.id,
      jobTitle: res.jobTitle,
      date: new Date(res.timestamp).toLocaleDateString(),
      score: res.matchScore
    };
    const updated = [newItem, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem('resume_match_history', JSON.stringify(updated));
  }, [history]);

  const handleStartAnalysis = async () => {
    if (!resumeText || !jdText) return;
    setIsLoading(true);
    try {
      const result = await analyzeResume(resumeText, jdText);
      setAnalysis(result);
      saveToHistory(result);
      setCurrentTab(AnalysisTab.Overview);
    } catch (error) {
      console.error(error);
      alert("Analysis failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFile = async (file: File, type: 'resume' | 'jd') => {
    if (type === 'resume') {
      setIsExtractingResume(true);
      setResumeFileName(file.name);
    } else {
      setIsExtractingJd(true);
      setJdFileName(file.name);
    }

    try {
      const text = await extractTextFromFile(file);
      if (type === 'resume') {
        setResumeText(text);
      } else {
        setJdText(text);
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Failed to extract text from file.");
      if (type === 'resume') setResumeFileName(null);
      else setJdFileName(null);
    } finally {
      if (type === 'resume') setIsExtractingResume(false);
      else setIsExtractingJd(false);
    }
  };

  const handleTodoMove = (todoId: string, newStatus: TodoStatus) => {
    if (!analysis) return;
    const updatedTodos = analysis.todos.map(t => t.id === todoId ? { ...t, status: newStatus } : t);
    setAnalysis({ ...analysis, todos: updatedTodos });
  };

  // Kanban DnD Handlers
  const onDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTodoId(id);
    e.dataTransfer.setData('todoId', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDropTodo = (e: React.DragEvent, targetStatus: TodoStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('todoId');
    if (id) {
      handleTodoMove(id, targetStatus);
    }
    setDraggedTodoId(null);
  };

  const renderUploadZone = (
    type: 'resume' | 'jd',
    fileName: string | null,
    isExtracting: boolean,
    isDragging: boolean,
    setIsDragging: (val: boolean) => void,
    inputRef: React.RefObject<HTMLInputElement>,
    textValue: string,
    setTextValue: (val: string) => void,
    placeholder: string
  ) => (
    <div className="space-y-2">
      <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
        Step {type === 'resume' ? '1: Resume' : '2: Job Description'}
      </label>
      
      <div 
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file, type);
        }}
        className={`relative group cursor-pointer border-2 border-dashed rounded-xl transition-all duration-300 min-h-[140px] flex flex-col items-center justify-center p-6 bg-white/30 hover:bg-white/50 ${
          isDragging ? 'border-sky-400 bg-sky-50/30' : 'border-black/5 hover:border-black/10'
        }`}
      >
        <input 
          type="file" 
          ref={inputRef} 
          className="hidden" 
          accept=".pdf,.docx,.txt" 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file, type);
          }} 
        />
        
        {isExtracting ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-sky-500 rounded-full animate-spin" />
            <span className="text-[12px] text-slate-500 font-medium">Extracting text...</span>
          </div>
        ) : fileName && fileName !== 'manual' ? (
          <div className="flex items-center gap-3 bg-white/60 px-4 py-2 rounded-lg border border-black/5 animate-in zoom-in-95 duration-200">
            <FileText size={16} className="text-sky-500" />
            <div className="flex flex-col">
              <span className="text-[12px] font-medium text-slate-700 max-w-[200px] truncate">{fileName}</span>
              <span className="text-[10px] text-slate-400">Content loaded</span>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (type === 'resume') { setResumeFileName(null); setResumeText(''); }
                else { setJdFileName(null); setJdText(''); }
              }}
              className="ml-2 p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-sky-500 group-hover:bg-sky-50 transition-colors">
              <Upload size={18} />
            </div>
            <div className="space-y-0.5">
              <p className="text-[13px] font-medium text-slate-600">Drop file here or click to upload</p>
              <p className="text-[11px] text-slate-400">Supports PDF, DOCX, and TXT</p>
            </div>
          </div>
        )}
      </div>

      {(!fileName || fileName === 'manual') && !isExtracting && (
        <div className="pt-2">
          {fileName !== 'manual' ? (
            <button 
              onClick={() => type === 'resume' ? setResumeFileName('manual') : setJdFileName('manual')}
              className="text-[11px] text-sky-500 hover:text-sky-600 font-medium transition-colors"
            >
              Or paste text manually
            </button>
          ) : (
            <div className="space-y-2 animate-in fade-in duration-300">
              <textarea 
                className="w-full h-40 bg-white/40 border border-black/5 rounded-xl p-4 text-[13px] focus:ring-1 focus:ring-sky-500 outline-none transition-all resize-none placeholder:text-slate-300 mt-2"
                placeholder={placeholder}
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                autoFocus
              />
              <button 
                onClick={() => type === 'resume' ? setResumeFileName(null) : setJdFileName(null)}
                className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
              >
                Switch back to file upload
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderLanding = () => (
    <div className="max-w-xl mx-auto mt-12 mb-20 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Resume Match</h1>
        <p className="text-slate-500 text-[13px]">Clarity over noise. High-precision alignment for your next role.</p>
      </div>

      <GlassCard className="space-y-6">
        {renderUploadZone(
          'resume',
          resumeFileName,
          isExtractingResume,
          isDraggingResume,
          setIsDraggingResume,
          resumeInputRef,
          resumeText,
          setResumeText,
          "Paste your resume contents here..."
        )}

        {renderUploadZone(
          'jd',
          jdFileName,
          isExtractingJd,
          isDraggingJd,
          setIsDraggingJd,
          jdInputRef,
          jdText,
          setJdText,
          "Paste the job description here..."
        )}

        <button 
          onClick={handleStartAnalysis}
          disabled={!resumeText || !jdText || isLoading || isExtractingResume || isExtractingJd}
          className="w-full py-3 bg-slate-900 text-white rounded-xl text-[13px] font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Analyze Fit 
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </GlassCard>
    </div>
  );

  const renderTabs = () => (
    <div className="flex items-center justify-center gap-8 border-b border-black/5 mb-8 overflow-x-auto no-scrollbar py-2">
      {Object.values(AnalysisTab).map((tab) => (
        <button
          key={tab}
          onClick={() => setCurrentTab(tab)}
          className={`text-[12px] font-medium px-2 py-2 whitespace-nowrap transition-all relative ${
            currentTab === tab ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {tab}
          {currentTab === tab && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-sky-500 animate-in fade-in slide-in-from-bottom-1" />
          )}
        </button>
      ))}
    </div>
  );

  const renderOverview = () => {
    if (!analysis) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-in fade-in duration-500">
        <GlassCard className="md:col-span-4 flex flex-col items-center justify-center text-center space-y-4">
          <MatchScoreArc score={analysis.matchScore} />
          <div className="space-y-1">
            <h3 className="text-[14px] font-semibold text-slate-900">Role match</h3>
            <p className="text-[12px] text-slate-500">Based on your profile alignment</p>
          </div>
        </GlassCard>

        <GlassCard className="md:col-span-8 flex flex-col justify-center space-y-4">
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Identity Summary</p>
            <h2 className="text-[16px] font-medium text-slate-900">
              You present as <span className="text-sky-600 font-semibold">{analysis.identity.role}</span>
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-sky-500 transition-all duration-1000" 
                  style={{ width: analysis.identity.confidence }} 
                />
              </div>
              <span className="text-[11px] text-slate-400">{analysis.identity.confidence} confidence</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-black/5">
            <div className="space-y-3">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Strengths</p>
              <ul className="space-y-2">
                {analysis.signals.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-slate-600">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Concerns</p>
              <ul className="space-y-2">
                {analysis.signals.concerns.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-slate-600">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  };

  const renderMatchAnalysis = () => {
    if (!analysis) return null;
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <GlassCard className="space-y-6">
          <div>
            <h3 className="text-[14px] font-semibold text-slate-900 mb-4">Skill Alignment</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6">
              {analysis.skillAlignment.map((skill, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-[12px] font-medium text-slate-700">{skill.skill}</span>
                    <span className="text-[11px] text-slate-400">{skill.match}%</span>
                  </div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-sky-500 transition-all duration-1000" 
                      style={{ width: `${skill.match}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-black/5">
            <h3 className="text-[14px] font-semibold text-slate-900 mb-4">Experience Relevance</h3>
            <div className="space-y-4">
              {analysis.experienceRelevance.map((exp, i) => (
                <div key={i} className="flex gap-4 p-3 rounded-xl bg-black/[0.02] border border-black/[0.02]">
                  <div className="mt-1">
                    <Target size={14} className="text-slate-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[13px] font-medium text-slate-800">{exp.item}</p>
                    <p className="text-[12px] text-slate-500 leading-relaxed">{exp.feedback}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-black/5">
            <h3 className="text-[14px] font-semibold text-slate-900 mb-4">Missing Signals</h3>
            <div className="flex flex-wrap gap-2">
              {analysis.missingSignals.map((sig, i) => (
                <span key={i} className="px-3 py-1 rounded-full bg-slate-100 text-[11px] text-slate-500 border border-slate-200">
                  {sig}
                </span>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>
    );
  };

  const renderResumeInsights = () => {
    if (!analysis) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
        <GlassCard className="space-y-6">
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Identity Coherence</p>
            <p className="text-[13px] text-slate-600 leading-relaxed">{analysis.resumeInsights.coherence}</p>
          </div>
          <div className="space-y-1 pt-4 border-t border-black/5">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Seniority Signal</p>
            <p className="text-[13px] text-slate-800 font-medium">{analysis.resumeInsights.seniority}</p>
          </div>
          <div className="space-y-1 pt-4 border-t border-black/5">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Focus Score</p>
            <div className="flex items-center gap-3">
              <span className="text-[20px] font-semibold text-slate-900">{analysis.resumeInsights.focusScore}</span>
              <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-sky-500" 
                  style={{ width: `${analysis.resumeInsights.focusScore}%` }} 
                />
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="space-y-4">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Red Flags</p>
          {analysis.resumeInsights.redFlags.length > 0 ? (
            <div className="space-y-3">
              {analysis.resumeInsights.redFlags.map((flag, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-red-50/30 border border-red-100/50">
                  <AlertCircle size={14} className="text-red-400 mt-0.5" />
                  <p className="text-[12px] text-red-700 leading-relaxed">{flag}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-slate-400 italic">No major red flags detected.</p>
          )}
        </GlassCard>
      </div>
    );
  };

  const renderTodos = () => {
    if (!analysis) return null;
    const columns: { id: TodoStatus; label: string }[] = [
      { id: 'to-fix', label: 'To Fix' },
      { id: 'in-progress', label: 'In Progress' },
      { id: 'done', label: 'Done' }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-500">
        {columns.map(col => (
          <div 
            key={col.id} 
            className="space-y-4 rounded-2xl p-2 transition-colors"
            onDragOver={onDragOver}
            onDrop={(e) => onDropTodo(e, col.id)}
          >
            <div className="flex items-center justify-between px-2">
              <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{col.label}</h4>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                {analysis.todos.filter(t => t.status === col.id).length}
              </span>
            </div>
            <div className="space-y-3 min-h-[400px]">
              {analysis.todos.filter(t => t.status === col.id).map(todo => (
                <GlassCard 
                  key={todo.id} 
                  padding="p-4" 
                  className={`relative cursor-grab active:cursor-grabbing hover:border-sky-200 transition-all ${
                    draggedTodoId === todo.id ? 'opacity-40 grayscale scale-95' : 'opacity-100'
                  }`}
                  draggable
                  onDragStart={(e) => onDragStart(e, todo.id)}
                  onDragEnd={() => setDraggedTodoId(null)}
                >
                  <div className="flex gap-3">
                    <GripVertical size={12} className="text-slate-300 mt-1 flex-shrink-0" />
                    <div className="flex flex-col gap-3 flex-1">
                      <p className="text-[12px] text-slate-700 leading-snug">{todo.title}</p>
                      <div className="flex gap-2 justify-end">
                        {col.id !== 'to-fix' && (
                          <button 
                            onClick={() => handleTodoMove(todo.id, col.id === 'done' ? 'in-progress' : 'to-fix')}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <ChevronRight className="rotate-180" size={12} />
                          </button>
                        )}
                        {col.id !== 'done' && (
                          <button 
                            onClick={() => handleTodoMove(todo.id, col.id === 'to-fix' ? 'in-progress' : 'done')}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <ChevronRight size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
              {analysis.todos.filter(t => t.status === col.id).length === 0 && (
                <div className="h-20 border border-dashed border-black/[0.05] rounded-2xl flex items-center justify-center">
                  <span className="text-[11px] text-slate-300">Drop tasks here</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderHistory = () => (
    <div className="max-w-2xl mx-auto animate-in fade-in duration-500">
      <GlassCard className="space-y-0 p-0 overflow-hidden">
        {history.length > 0 ? (
          history.map((item, idx) => (
            <div 
              key={item.id} 
              className={`flex items-center justify-between p-5 hover:bg-black/[0.01] transition-colors cursor-pointer ${
                idx !== history.length - 1 ? 'border-b border-black/5' : ''
              }`}
            >
              <div className="space-y-1">
                <h4 className="text-[13px] font-medium text-slate-900">{item.jobTitle}</h4>
                <p className="text-[11px] text-slate-400">{item.date}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className={`text-[13px] font-semibold ${item.score > 70 ? 'text-emerald-600' : 'text-slate-600'}`}>
                    {item.score}%
                  </span>
                  <p className="text-[10px] text-slate-400">Match</p>
                </div>
                <ChevronRight size={14} className="text-slate-300" />
              </div>
            </div>
          ))
        ) : (
          <div className="p-12 text-center text-slate-400 text-[12px]">No analysis history found.</div>
        )}
      </GlassCard>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 px-4 md:px-8 max-w-6xl mx-auto">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between py-6 mb-12">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setAnalysis(null); setCurrentTab(AnalysisTab.Overview); }}>
          <div className="w-6 h-6 bg-sky-600 rounded-lg flex items-center justify-center text-white shadow-sm shadow-sky-200">
            <FileText size={14} strokeWidth={2.5} />
          </div>
          <span className="text-[14px] font-semibold text-slate-900 tracking-tight">Resume Match</span>
        </div>
        
        {analysis && (
          <button 
            onClick={() => {
              setAnalysis(null);
              setResumeText('');
              setResumeFileName(null);
              setJdText('');
              setJdFileName(null);
            }}
            className="text-[11px] text-slate-400 hover:text-slate-600 font-medium transition-colors"
          >
            New Analysis
          </button>
        )}
      </nav>

      {analysis ? (
        <>
          {renderTabs()}
          <div className="mt-8">
            {currentTab === AnalysisTab.Overview && renderOverview()}
            {currentTab === AnalysisTab.MatchAnalysis && renderMatchAnalysis()}
            {currentTab === AnalysisTab.ResumeInsights && renderResumeInsights()}
            {currentTab === AnalysisTab.Todos && renderTodos()}
            {currentTab === AnalysisTab.History && renderHistory()}
          </div>
        </>
      ) : (
        renderLanding()
      )}
    </div>
  );
};

export default App;
