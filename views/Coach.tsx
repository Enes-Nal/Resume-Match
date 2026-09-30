import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Square, Trash2 } from 'lucide-react';
import { ChatMessage } from '../types';
import { Card, ErrorNote, Markdown, Spinner } from '../components/ui';
import { streamCoachReply } from '../services/features';
import { useStream } from '../hooks/useStream';
import { ViewProps } from './Overview';

const SUGGESTIONS = [
  'What is the single biggest change that would raise my match score?',
  'Write a summary section for this role.',
  'How should I explain my biggest gap in an interview?',
  'Which of my projects should I lead with, and why?',
  'What salary questions should I prepare for, and how should I answer?',
  'Draft 5 questions I should ask the interviewer.',
];

export const Coach: React.FC<ViewProps> = ({ session, update }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(session.chat || []);
  const [input, setInput] = useState('');
  const reply = useStream();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, reply.text]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || reply.running) return;
    const history: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(history);
    setInput('');
    const out = await reply.run((onToken, signal) =>
      streamCoachReply(history, session.resumeText, session.jdText, session.analysis, onToken, signal)
    );
    const next = out ? [...history, { role: 'assistant' as const, content: out }] : history;
    setMessages(next);
    update({ chat: next });
    reply.setText('');
  };

  const clear = () => {
    setMessages([]);
    update({ chat: [] });
  };

  return (
    <Card pad="p-0" className="flex flex-col h-[calc(100vh-240px)] min-h-[520px] animate-fade-up">
      <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-8 space-y-6">
        {messages.length === 0 && !reply.running && (
          <div className="max-w-2xl mx-auto text-center pt-6">
            <p className="t-title">Ask your coach anything.</p>
            <p className="t-small text-slate mt-2">It has read your resume, the job description and the analysis.</p>
            <div className="grid sm:grid-cols-2 gap-3 mt-8 text-left">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} className="rounded-[20px] bg-mist hover:bg-control/70 px-5 py-4 t-small transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <Bubble key={i} m={m} />
        ))}
        {reply.running && (
          reply.text ? <Bubble m={{ role: 'assistant', content: reply.text }} streaming /> : (
            <div className="flex items-center gap-3 text-slate t-small"><Spinner /> Thinking…</div>
          )
        )}
        {reply.error && <ErrorNote message={reply.error} />}
        <div ref={end} />
      </div>

      <div className="border-t border-control px-4 sm:px-6 py-4 flex items-end gap-3">
        {messages.length > 0 && (
          <button onClick={clear} aria-label="Clear conversation" className="w-10 h-10 rounded-full hover:bg-mist flex items-center justify-center text-slate flex-shrink-0">
            <Trash2 size={16} />
          </button>
        )}
        <textarea
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Message your coach…"
          className="field !rounded-[22px] resize-none max-h-40 py-2.5"
        />
        {reply.running ? (
          <button onClick={reply.stop} aria-label="Stop" className="w-10 h-10 rounded-full bg-ink text-white flex items-center justify-center flex-shrink-0">
            <Square size={13} />
          </button>
        ) : (
          <button
            onClick={() => send(input)}
            disabled={!input.trim()}
            aria-label="Send"
            className="w-10 h-10 rounded-full bg-cta disabled:bg-control text-white flex items-center justify-center flex-shrink-0"
          >
            <ArrowUp size={17} />
          </button>
        )}
      </div>
    </Card>
  );
};

const Bubble: React.FC<{ m: ChatMessage; streaming?: boolean }> = ({ m, streaming }) =>
  m.role === 'user' ? (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-[22px] bg-cta text-white px-5 py-3 t-body whitespace-pre-wrap">{m.content}</div>
    </div>
  ) : (
    <div className="max-w-3xl">
      <Markdown text={m.content} streaming={streaming} />
    </div>
  );
