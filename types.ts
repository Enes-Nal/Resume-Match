export enum AnalysisTab {
  Overview = 'Overview',
  Keywords = 'Keywords',
  Insights = 'Insights',
  Editor = 'Editor',
  CoverLetter = 'Cover Letter',
  Interview = 'Interview',
  Coach = 'Coach',
  Plan = 'Plan',
}

export type TodoStatus = 'to-fix' | 'in-progress' | 'done';
export type Priority = 'high' | 'medium' | 'low';

export interface Todo {
  id: string;
  title: string;
  detail?: string;
  priority: Priority;
  status: TodoStatus;
}

export interface SkillAlignment {
  skill: string;
  match: number; // 0-100
  evidence?: string;
}

export interface ExperienceRelevance {
  item: string;
  relevance: number; // 0-100
  feedback: string;
}

export interface BulletRewrite {
  original: string;
  improved: string;
  why: string;
}

export interface SectionScores {
  impact: number;
  keywords: number;
  clarity: number;
  formatting: number;
  experience: number;
}

export interface AnalysisResult {
  id: string;
  timestamp: number;
  jobTitle: string;
  company: string;
  matchScore: number;
  verdict: string;
  summary: string;
  identity: {
    role: string;
    confidence: number;
  };
  sectionScores: SectionScores;
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
    jdSeniority: string;
    focusScore: number;
    redFlags: string[];
  };
  bulletRewrites: BulletRewrite[];
  todos: Todo[];
  /** True when produced by the local scanner instead of an AI model. */
  offline?: boolean;
  /** Present for analyses made by the multi-step pipeline. */
  requirements?: Requirement[];
  holisticScore?: number;
  jobSummary?: string;
  resumeDoc?: ResumeDoc;
  suggestions?: Suggestion[];
}

/* ---------- Structured resume ---------- */

export interface Bullet {
  id: string;
  text: string;
}

export interface ResumeEntry {
  id: string;
  heading: string; // e.g. job title, degree, project name
  subheading?: string; // e.g. company, school
  dates?: string;
  location?: string;
  bullets: Bullet[];
}

export type SectionKind = 'experience' | 'education' | 'skills' | 'projects' | 'other';

export interface ResumeSection {
  id: string;
  title: string;
  kind: SectionKind;
  entries: ResumeEntry[];
}

export interface ResumeDoc {
  name: string;
  headline?: string;
  contact: string[];
  summary: string;
  sections: ResumeSection[];
}

/* ---------- Requirements & suggestions ---------- */

export type RequirementCategory = 'hard-skill' | 'soft-skill' | 'experience' | 'domain' | 'education' | 'other';
export type RequirementStatus = 'met' | 'partial' | 'missing';

export interface Requirement {
  id: string;
  text: string;
  label: string; // 1-4 word tag
  category: RequirementCategory;
  importance: 'must' | 'nice';
  status: RequirementStatus;
  evidence: string[]; // bullet ids
  note: string;
}

export type SuggestionKind = 'rewrite' | 'add-bullet' | 'remove-bullet' | 'summary' | 'skills';
export type SuggestionStatus = 'pending' | 'accepted' | 'rejected';

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  /** Bullet id (rewrite/remove), entry id (add-bullet). Unused for summary/skills. */
  target?: string;
  before?: string;
  after: string;
  reason: string;
  requirementIds: string[];
  impact: Priority;
  /** The edit adds a claim the candidate must confirm is true, or has [X] placeholders. */
  needsConfirmation: boolean;
  status: SuggestionStatus;
  /** Id of the bullet created when an add-bullet or skills suggestion was applied. */
  appliedId?: string;
}

export interface Rescore {
  matchScore: number;
  coverage: number;
  requirements: Requirement[];
  at: number;
  /** Snapshot key of the doc that was scored, to detect stale scores. */
  docKey?: string;
}

export interface InterviewQuestion {
  question: string;
  type: 'behavioral' | 'technical' | 'role-specific' | 'gap';
  why: string;
  answerOutline: string[];
}

export interface AnswerFeedback {
  score: number;
  strengths: string[];
  improvements: string[];
  betterAnswer: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Everything saved for one resume/JD pair. */
export interface Session {
  id: string;
  createdAt: number;
  resumeText: string;
  jdText: string;
  analysis: AnalysisResult;
  coverLetter?: string;
  tailoredResume?: string;
  interviewQuestions?: InterviewQuestion[];
  chat?: ChatMessage[];
  /** The working copy the user edits in the Editor tab. */
  editedDoc?: ResumeDoc;
  rescore?: Rescore;
}
