import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Sparkles, X } from 'lucide-react';
import { Priority, Todo, TodoStatus } from '../types';
import { Bar, Button, Card, CopyButton, ErrorNote, Label, Markdown, Thinking } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { streamTodoHelp } from '../services/features';
import { useStream } from '../hooks/useStream';
import { ViewProps } from './Overview';

const COLUMNS: { id: TodoStatus; label: string }[] = [
  { id: 'to-fix', label: 'To fix' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
];
const ORDER: TodoStatus[] = ['to-fix', 'in-progress', 'done'];
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export const Plan: React.FC<ViewProps> = ({ session, update }) => {
  const todos = session.analysis.todos;
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TodoStatus | null>(null);
  const [helpFor, setHelpFor] = useState<Todo | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const setTodos = (next: Todo[]) => update({ analysis: { ...session.analysis, todos: next } });
  const move = (id: string, status: TodoStatus) => setTodos(todos.map(t => (t.id === id ? { ...t, status } : t)));
  const remove = (id: string) => setTodos(todos.filter(t => t.id !== id));
  const add = () => {
    if (!newTitle.trim()) return;
    setTodos([...todos, { id: `todo-${Date.now()}`, title: newTitle.trim(), priority: 'medium', status: 'to-fix' }]);
    setNewTitle('');
  };

  const done = todos.filter(t => t.status === 'done').length;
  const pct = todos.length ? Math.round((done / todos.length) * 100) : 0;

  return (
    <div className="space-y-5 animate-fade-up">
      <Card className="flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex-1">
          <Label className="mb-2">Progress</Label>
          <div className="flex items-center gap-4">
            <Bar value={pct} color="var(--color-good)" />
            <span className="t-small font-medium whitespace-nowrap">
              {done} of {todos.length}
            </span>
          </div>
        </div>
        <div className="flex gap-3 md:w-[420px]">
          <input
            className="field !rounded-full !py-2.5"
            placeholder="Add your own task…"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
          />
          <Button variant="outline" onClick={add} disabled={!newTitle.trim()} icon={<Plus size={14} />}>
            Add
          </Button>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-5">
        {COLUMNS.map(col => {
          const items = todos.filter(t => t.status === col.id).sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
          return (
            <div
              key={col.id}
              onDragOver={e => {
                e.preventDefault();
                setOverCol(col.id);
              }}
              onDragLeave={() => setOverCol(null)}
              onDrop={e => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                if (id) move(id, col.id);
                setDragId(null);
                setOverCol(null);
              }}
              className={`rounded-[28px] p-3 transition-colors ${overCol === col.id ? 'bg-control/60' : ''}`}
            >
              <div className="flex items-center justify-between px-3 pb-3">
                <p className="t-small font-semibold">{col.label}</p>
                <span className="t-caption text-slate">{items.length}</span>
              </div>
              <div className="space-y-3 min-h-[240px]">
                {items.map(t => {
                  const idx = ORDER.indexOf(t.status);
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={e => {
                        setDragId(t.id);
                        e.dataTransfer.setData('text/plain', t.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => setDragId(null)}
                      className={`group bg-white rounded-[20px] p-5 cursor-grab active:cursor-grabbing transition-opacity ${dragId === t.id ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className={`t-caption font-semibold ${t.priority === 'high' ? 'text-launch' : 'text-slate'}`}>
                          {t.priority === 'high' ? 'High priority' : t.priority === 'medium' ? 'Medium' : 'Low'}
                        </p>
                        <button
                          onClick={() => remove(t.id)}
                          aria-label="Delete task"
                          className="opacity-0 group-hover:opacity-100 text-steel hover:text-ink transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <p className={`t-small mt-1.5 ${t.status === 'done' ? 'line-through text-slate' : ''}`}>{t.title}</p>
                      {t.detail && <p className="t-caption text-slate mt-1.5">{t.detail}</p>}
                      <div className="flex items-center justify-between mt-4">
                        {t.status !== 'done' ? (
                          <button onClick={() => setHelpFor(t)} className="inline-flex items-center gap-1.5 t-caption text-link hover:underline">
                            <Sparkles size={12} /> Draft this fix
                          </button>
                        ) : (
                          <span />
                        )}
                        <div className="flex gap-1">
                          {idx > 0 && (
                            <button aria-label="Move back" onClick={() => move(t.id, ORDER[idx - 1])} className="w-7 h-7 rounded-full hover:bg-mist flex items-center justify-center text-slate">
                              <ChevronLeft size={14} />
                            </button>
                          )}
                          {idx < 2 && (
                            <button aria-label="Move forward" onClick={() => move(t.id, ORDER[idx + 1])} className="w-7 h-7 rounded-full hover:bg-mist flex items-center justify-center text-slate">
                              <ChevronRight size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className="h-24 rounded-[20px] border border-dashed border-hairline flex items-center justify-center t-caption text-steel">
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {helpFor && (
        <TodoHelp
          todo={helpFor}
          resume={session.resumeText}
          jd={session.jdText}
          onClose={() => setHelpFor(null)}
          onStart={() => move(helpFor.id, 'in-progress')}
        />
      )}
    </div>
  );
};

const TodoHelp: React.FC<{ todo: Todo; resume: string; jd: string; onClose: () => void; onStart: () => void }> = ({ todo, resume, jd, onClose, onStart }) => {
  const s = useStream();
  const go = () => s.run((onToken, signal) => streamTodoHelp(todo, resume, jd, onToken, signal));

  React.useEffect(() => {
    go();
    if (todo.status === 'to-fix') onStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Sheet open onClose={onClose} title="Draft fix">
      <p className="t-body font-medium mb-6">{todo.title}</p>
      {s.error && <ErrorNote message={s.error} onRetry={go} />}
      {s.running && !s.text && <Thinking label="Drafting" />}
      {s.text && (
        <div className="bg-white rounded-[20px] p-6">
          <Markdown text={s.text} streaming={s.running} />
        </div>
      )}
      {!s.running && s.text && (
        <div className="flex gap-3 mt-5">
          <CopyButton text={s.text} />
          <Button variant="outline" size="sm" onClick={go}>
            Try another version
          </Button>
        </div>
      )}
    </Sheet>
  );
};
