import { Session } from '../types';

const SESSIONS_KEY = 'resume_match_sessions_v2';
const DRAFT_KEY = 'resume_match_draft';
const MAX_SESSIONS = 25;

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode */
  }
};

export const loadSessions = (): Session[] => read<Session[]>(SESSIONS_KEY, []);

export const upsertSession = (session: Session): Session[] => {
  const rest = loadSessions().filter(s => s.id !== session.id);
  const next = [session, ...rest].slice(0, MAX_SESSIONS);
  write(SESSIONS_KEY, next);
  return next;
};

export const deleteSession = (id: string): Session[] => {
  const next = loadSessions().filter(s => s.id !== id);
  write(SESSIONS_KEY, next);
  return next;
};

export interface Draft {
  resumeText: string;
  jdText: string;
  resumeFileName: string | null;
  jdFileName: string | null;
}

export const loadDraft = (): Draft | null => read<Draft | null>(DRAFT_KEY, null);
export const saveDraft = (d: Draft) => write(DRAFT_KEY, d);
