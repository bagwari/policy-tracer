// ─── SSE / Agent ─────────────────────────────────────────────────────────────

export type AgentEventType =
  | 'agent:thinking'
  | 'agent:tool_call'
  | 'agent:tool_result'
  | 'agent:response'
  | 'agent:error'
  | 'agent:done';

export interface AgentSSEEvent {
  type:      AgentEventType;
  sessionId: string;
  ts:        string;
  data:      unknown;
}

export interface ThinkingData    { thought: string; step: number }
export interface ToolCallData    { toolName: string; parameters: Record<string, unknown>; step: number }
export interface ToolResultData  { toolName: string; success: boolean; data?: unknown; error?: string; executionMs: number; step: number }
export interface ResponseData    { content: string; totalSteps: number; totalMs: number }
export interface ErrorData       { message: string; code: string }

// ─── Session State ────────────────────────────────────────────────────────────

export type SessionStatus = 'idle' | 'running' | 'done' | 'error';

export interface TraceStep {
  id:        string;
  type:      AgentEventType;
  ts:        string;
  data:      unknown;
}

export interface AgentSession {
  id:         string;
  query:      string;
  status:     SessionStatus;
  steps:      TraceStep[];
  response?:  string;
  error?:     string;
  startTime:  number;
  endTime?:   number;
  totalSteps?: number;
}

// ─── Domain ───────────────────────────────────────────────────────────────────

export interface Policy {
  _id:            string;
  policyNumber:   string;
  holderName:     string;
  holderEmail:    string;
  holderPhone?:   string;
  type:           string;
  status:         string;
  premium:        number;
  coverageAmount: number;
  startDate:      string;
  endDate:        string;
  createdAt:      string;
  updatedAt:      string;
  eventCount?:    number;
}

export interface PolicyEvent {
  _id:           string;
  policyNumber:  string;
  eventType:     string;
  category:      string;
  severity:      string;
  description:   string;
  performedBy:   string;
  correlationId: string;
  createdAt:     string;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status:   'ok' | 'degraded' | 'error';
  ts:       string;
  version:  string;
  services: Record<string, string>;
}

export interface ExampleQuery {
  category: string;
  label:    string;
  query:    string;
}
