import { useCallback, useRef, useState } from 'react';
import { streamQuery } from '../services/api.js';
import type { AgentSession, AgentSSEEvent, ResponseData, ErrorData, TraceStep } from '../types/index.js';

function nid(): string {
  return crypto.randomUUID();
}

export function useAgent() {
  const [session, setSession]     = useState<AgentSession | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const submit = useCallback((query: string) => {
    if (isRunning) return;

    const sessionId = nid();
    setSession({ id: sessionId, query, status: 'running', steps: [], startTime: Date.now() });
    setIsRunning(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const addStep = (evt: AgentSSEEvent) => {
      const step: TraceStep = { id: nid(), type: evt.type, ts: evt.ts, data: evt.data };

      setSession(prev => {
        if (!prev) return prev;

        if (evt.type === 'agent:response') {
          return {
            ...prev,
            steps:      [...prev.steps, step],
            response:   (evt.data as ResponseData).content,
            totalSteps: (evt.data as ResponseData).totalSteps,
            endTime:    Date.now(),
          };
        }
        if (evt.type === 'agent:error') {
          return {
            ...prev,
            steps:   [...prev.steps, step],
            error:   (evt.data as ErrorData).message,
            status:  'error',
            endTime: Date.now(),
          };
        }
        return { ...prev, steps: [...prev.steps, step] };
      });
    };

    streamQuery({
      query,
      sessionId,
      onEvent: addStep,
      onDone:  () => {
        setSession(p => p ? { ...p, status: 'done', endTime: Date.now() } : p);
        setIsRunning(false);
        abortRef.current = null;
      },
      onError: (err) => {
        setSession(p => p ? { ...p, status: 'error', error: err.message, endTime: Date.now() } : p);
        setIsRunning(false);
        abortRef.current = null;
      },
      signal: ctrl.signal,
    });
  }, [isRunning]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setSession(p => p ? { ...p, status: 'error', error: 'Cancelled', endTime: Date.now() } : p);
    setIsRunning(false);
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setSession(null);
    setIsRunning(false);
  }, []);

  return { session, isRunning, submit, cancel, clear };
}
