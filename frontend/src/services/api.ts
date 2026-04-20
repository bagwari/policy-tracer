import type { AgentSSEEvent, HealthResponse, Policy, PolicyEvent, ExampleQuery } from '../types/index.js';

const BASE = '/api';

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(b.error?.message ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

// ─── REST ─────────────────────────────────────────────────────────────────────

export const api = {
  health: () =>
    req<HealthResponse>(`${BASE}/health`),

  policies: (params?: { status?: string; type?: string; search?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.type)   qs.set('type',   params.type);
    if (params?.search) qs.set('search', params.search);
    if (params?.page)   qs.set('page',   String(params.page));
    return req<{ data: Policy[]; total: number }>(`${BASE}/policies?${qs}`);
  },

  policyEvents: (policyNumber: string) =>
    req<{ data: PolicyEvent[] }>(`${BASE}/policies/${policyNumber}/events`),

  examples: () =>
    req<{ data: ExampleQuery[] }>(`${BASE}/agent/examples`),
};

// ─── SSE Agent Stream ─────────────────────────────────────────────────────────

export interface StreamOptions {
  query:     string;
  sessionId: string;
  onEvent:   (e: AgentSSEEvent) => void;
  onDone:    () => void;
  onError:   (err: Error) => void;
  signal?:   AbortSignal;
}

export async function streamQuery(opts: StreamOptions): Promise<void> {
  const { query, sessionId, onEvent, onDone, onError, signal } = opts;

  let res: Response;
  try {
    res = await fetch(`${BASE}/agent/query`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query, sessionId }),
      signal,
    });
  } catch (err) {
    onError(err as Error);
    return;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
    onError(new Error(body.error?.message ?? `Request failed: ${res.status}`));
    return;
  }
  if (!res.body) {
    onError(new Error('No response body'));
    return;
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let evtType = '';
      let evtData = '';

      for (const line of lines) {
        if (line.startsWith('event: '))     evtType = line.slice(7).trim();
        else if (line.startsWith('data: ')) evtData = line.slice(6).trim();
        else if (line === '' && evtData) {
          try {
            const parsed = JSON.parse(evtData) as AgentSSEEvent;
            onEvent(parsed);
            if (evtType === 'agent:done') onDone();
          } catch { /* ignore malformed */ }
          evtType = '';
          evtData = '';
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') onError(err as Error);
  } finally {
    reader.releaseLock();
  }
}
