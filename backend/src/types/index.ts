import type { Document, Types } from 'mongoose';

// ─── Policy Domain ─────────────────────────────────────────────────────────────

export type PolicyStatus =
  | 'ACTIVE'
  | 'PENDING'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'UNDER_REVIEW'
  | 'CLAIMED';

export type PolicyType =
  | 'AUTO'
  | 'HOME'
  | 'LIFE'
  | 'HEALTH'
  | 'TRAVEL'
  | 'COMMERCIAL'
  | 'CYBER';

export interface IPolicy {
  policyNumber:   string;
  holderName:     string;
  holderEmail:    string;
  holderPhone?:   string;
  type:           PolicyType;
  status:         PolicyStatus;
  premium:        number;
  coverageAmount: number;
  startDate:      Date;
  endDate:        Date;
  metadata:       Record<string, unknown>;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface IPolicyDocument extends IPolicy, Document {
  _id: Types.ObjectId;
}

export type EventCategory =
  | 'LIFECYCLE'
  | 'PAYMENT'
  | 'CLAIM'
  | 'REVIEW'
  | 'DOCUMENT'
  | 'SYSTEM';

export interface IPolicyEvent {
  policyId:       Types.ObjectId;
  policyNumber:   string;
  eventType:      string;
  category:       EventCategory;
  description:    string;
  performedBy:    string;
  correlationId:  string;   // ← uniqueIdentifier used for tracing
  requestId:      string;
  severity:       'INFO' | 'WARN' | 'ERROR';
  metadata:       Record<string, unknown>;
  createdAt:      Date;
}

export interface IPolicyEventDocument extends IPolicyEvent, Document {
  _id: Types.ObjectId;
}

// ─── CloudWatch ────────────────────────────────────────────────────────────────

export interface CWLogEntry {
  timestamp:     number;
  message:       string;
  logStream:     string;
  logGroup:      string;
  ingestionTime?: number;
}

export interface CWQueryResult {
  logGroup:    string;
  eventCount:  number;
  events:      CWLogEntry[];
  queryTimeMs: number;
}

// ─── Agent / Tool Calling ──────────────────────────────────────────────────────

export type ToolName =
  | 'get_policy_status'
  | 'get_policy_events'
  | 'search_cloudwatch_logs'
  | 'cloudwatch_insights_query';

export interface ToolResult {
  toolName:    ToolName;
  success:     boolean;
  data?:       unknown;
  error?:      string;
  executionMs: number;
}

// ─── SSE Event Types ───────────────────────────────────────────────────────────

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

// ─── API Shapes ────────────────────────────────────────────────────────────────

export interface QueryRequest {
  query:      string;
  sessionId?: string;
}

export interface ApiResponse<T> {
  data:      T;
  total?:    number;
  ts:        string;
}

export interface ErrorResponse {
  error: { code: string; message: string };
  ts:    string;
}

export interface HealthResponse {
  status:   'ok' | 'degraded' | 'error';
  ts:       string;
  version:  string;
  services: {
    mongodb:    'ok' | 'error';
    ollama:     'ok' | 'error' | 'unavailable';
    cloudwatch: 'ok' | 'error' | 'unavailable';
  };
}
