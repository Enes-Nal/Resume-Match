
export enum AnalysisTab {
  Overview = 'Overview',
  MatchAnalysis = 'Match Analysis',
  ResumeInsights = 'Resume Insights',
  Todos = 'Todos',
  History = 'History'
}

export type TodoStatus = 'to-fix' | 'in-progress' | 'done';

export interface Todo {
  id: string;
  title: string;
  status: TodoStatus;
}

export interface SkillAlignment {
  skill: string;
  match: number; // 0 to 100
}

export interface ExperienceRelevance {
  item: string;
  feedback: string;
}

export interface AnalysisResult {
  id: string;
  timestamp: number;
  jobTitle: string;
  matchScore: number;
  identity: {
    role: string;
    confidence: string;
  };
  signals: {
    strengths: string[];
    concerns: string[];
  };
  skillAlignment: SkillAlignment[];
  experienceRelevance: ExperienceRelevance[];
  missingSignals: string[];
  resumeInsights: {
    coherence: string;
    seniority: string;
    focusScore: number;
    redFlags: string[];
  };
  todos: Todo[];
}

export interface HistoryItem {
  id: string;
  jobTitle: string;
  date: string;
  score: number;
}
