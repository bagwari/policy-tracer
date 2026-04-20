import {
  useState, useEffect, useRef, useCallback, type FC,
} from 'react';
import {
  Terminal, Activity, Loader2, RotateCcw, AlertTriangle,
  Zap, Clock,
} from 'lucide-react';
import { api, streamQuery } from '../../services/api.js';
import { nid, fmtMs } from '../../utils/format.js';
import ExampleQueries from './ExampleQueries.js';
import InputBar from './InputBar.js';
import { ThinkingCard, ToolCallCard, ToolResultCard } from './TraceCards.js';
import Markdown from '../ui/Markdown.js';
import CopyBtn from '../ui/CopyBtn.js';
import type {
  AgentSession, AgentSSEEvent, TraceStep,
  ExampleQuery, ResponseData, ErrorData,
  ThinkingData, ToolCallData, ToolResultData,
} from '../../types/index.js';

const AgentPanel: FC = () => {
  const [input, setInput]       = useState('');
  const [session, setSession]   = useState<AgentSession | null>(null);
  const [running, setRunning]   = useState(false);
  const [examples, setExamples] = useState<ExampleQuery[]>([]);

  const abortRef  = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textRef   = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.examples().then(r => setExamples(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (session?.steps.length) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.steps.length]);

  const submit = useCallback((q: string) => {
    if (running || !q.trim()) return;
    const sessionId = crypto.randomUUID();
    setSession({ id: sessionId, query: q.trim(), status: 'running', steps: [], startTime: Date.now() });
    setRunning(true);
    setInput('');

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const addStep = (evt: AgentSSEEvent) => {
      const step: TraceStep = { id: nid(), type: evt.type, ts: evt.ts, data: evt.data };
      setSession(prev => {
        if (!prev) return prev;
        if (evt.type === 'agent:response') {
          return {
            ...prev,
            steps: [...prev.steps, step],
            response: (evt.data as ResponseData).content,
            totalSteps: (evt.data as ResponseData).totalSteps,
            endTime: Date.now(),
          };
        }
        if (evt.type === 'agent:error') {
          return {
            ...prev,
            steps: [...prev.steps, step],
            error: (evt.data as ErrorData).message,
            status: 'error',
            endTime: Date.now(),
          };
        }
        return { ...prev, steps: [...prev.steps, step] };
      });
    };

    streamQuery({
      query: q.trim(),
      sessionId,
      onEvent: addStep,
      onDone: () => {
        setSession(p => p ? { ...p, status: 'done', endTime: Date.now() } : p);
        setRunning(false);
      },
      onError: (err) => {
        setSession(p => p ? { ...p, status: 'error', error: err.message, endTime: Date.now() } : p);
        setRunning(false);
      },
      signal: ctrl.signal,
    });
  }, [running]);

  const cancel = () => {
    abortRef.current?.abort();
    setRunning(false);
    setSession(p => p ? { ...p, status: 'error', error: 'Cancelled by user' } : p);
  };

  const reset = () => {
    abortRef.current?.abort();
    setSession(null);
    setRunning(false);
    setInput('');
  };

  const traceSteps   = session?.steps.filter(s =>
    ['agent:thinking', 'agent:tool_call', 'agent:tool_result'].includes(s.type)
  ) ?? [];
  const responseStep = session?.steps.find(s => s.type === 'agent:response');
  const errorStep    = session?.steps.find(s => s.type === 'agent:error');
  const elapsedMs    = session ? (session.endTime ?? Date.now()) - session.startTime : 0;

  return (
    <div className="flex flex-col h-full bg-slate-900">

      {/* ── Panel Header */}
      <div className="flex-shrink-0 px-6 py-3.5 border-b border-slate-700/60 flex items-center gap-3 bg-slate-900/90">
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
            {/* <Terminal size={15} className="text-white" /> */}
          </div>
          {/* {running && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
          )} */}
        </div>
        <div>
          {/* <h2 className="text-sm font-semibold text-white">PolicyTrace AI</h2> */}
          {/* <p className="text-xs text-slate-400">llama3.2 · Ollama · Agentic</p> */}
        </div>

        {session && (
          <div className="ml-auto flex items-center gap-3">
            {session.endTime && (
              <span className="text-xs text-slate-400 font-mono">
                {session.totalSteps} steps · {fmtMs(elapsedMs)}
              </span>
            )}
            <button
              onClick={reset}
              title="New conversation"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-5">

          {/* Empty state */}
          {!session && (
            <div className="flex flex-col items-center justify-center min-h-[55vh] gap-8 text-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-500/15 to-indigo-600/15 border border-indigo-500/30 flex items-center justify-center">
                  <Zap size={34} className="text-indigo-400" />
                </div>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-500/5 to-indigo-600/5 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">Agentic AI Policy Investigator</h3>
                <p className="text-sm text-slate-400 max-w-lg leading-relaxed">
                  Enter a policy number, correlation UUID, or ask a natural language question.
                  The AI will reason, call tools, and trace across MongoDB and AWS CloudWatch.
                </p>
              </div>
              <ExampleQueries examples={examples} onSelect={q => { setInput(q); textRef.current?.focus(); }} />
            </div>
          )}

          {/* Active session */}
          {session && (
            <>
              {/* User query bubble */}
              <div className="flex justify-end">
                <div className="max-w-xl bg-gradient-to-br from-indigo-600/20 to-sky-600/20 border border-indigo-500/30 rounded-2xl rounded-tr-sm px-5 py-3.5 shadow-lg">
                  <p className="text-sm text-slate-100 leading-relaxed">{session.query}</p>
                </div>
              </div>

              {/* Agent reasoning trace */}
              {traceSteps.length > 0 && (
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity size={13} className="text-slate-400" />
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Agent Reasoning Trace
                    </p>
                    {running && (
                      <Loader2 size={12} className="text-indigo-400 animate-spin ml-auto" />
                    )}
                  </div>
                  <div className="space-y-2">
                    {traceSteps.map(step => {
                      if (step.type === 'agent:thinking')
                        return <ThinkingCard key={step.id} data={step.data as ThinkingData} />;
                      if (step.type === 'agent:tool_call')
                        return <ToolCallCard key={step.id} data={step.data as ToolCallData} />;
                      if (step.type === 'agent:tool_result')
                        return <ToolResultCard key={step.id} data={step.data as ToolResultData} />;
                      return null;
                    })}
                  </div>
                </div>
              )}

              {/* Running indicator */}
              {running && !responseStep && !errorStep && (
                <div className="flex items-center gap-3 px-1">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                        style={{ animationDelay: `${i * 140}ms` }}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-slate-400">Synthesizing response…</span>
                </div>
              )}

              {/* Error */}
              {errorStep && (
                <div className="bg-red-950/30 border border-red-700/40 rounded-2xl px-5 py-4 flex gap-3">
                  <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-300 mb-1">Agent Error</p>
                    <p className="text-sm text-slate-300">
                      {errorStep.data ? (errorStep.data as ErrorData).message : session.error}
                    </p>
                  </div>
                </div>
              )}

              {/* Final response */}
              {responseStep && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-700/50 flex items-center gap-3 bg-slate-800/60">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Terminal size={11} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-slate-300">PolicyTrace AI</span>
                    <div className="ml-auto flex items-center gap-3 text-xs text-slate-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Zap size={11} className="text-indigo-400" />
                        {(responseStep.data as ResponseData).totalSteps} steps
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} className="text-slate-500" />
                        {fmtMs((responseStep.data as ResponseData).totalMs)}
                      </span>
                      <CopyBtn text={(responseStep.data as ResponseData).content} />
                    </div>
                  </div>
                  <div className="px-5 py-5">
                    <Markdown content={(responseStep.data as ResponseData).content} />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </>
          )}
        </div>
      </div>

      {/* ── Input */}
      <InputBar
        value={input}
        onChange={setInput}
        onSubmit={() => submit(input)}
        onCancel={cancel}
        running={running}
        textRef={textRef}
      />
    </div>
  );
};

export default AgentPanel;
