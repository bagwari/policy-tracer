import Ollama from 'ollama';
import type { Message, Tool } from 'ollama';
import { v4 as uuid } from 'uuid';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getPolicyStatus, getPolicyEvents } from '../tools/policyTool.js';
import { getPolicyStatusViaLambda, getPolicyEventsViaLambda } from '../tools/policyToolLambdaClient.js';
import { searchCloudWatchLogs, cloudwatchInsightsQuery } from '../tools/cloudwatchTool.js';
import type { AgentSSEEvent, ToolName, ToolResult, QueryRequest } from '../types/index.js';

// ─── Tool Definitions (Ollama format) ────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'get_policy_status',
      description: `Retrieve the full status, details, coverage, premium, and summary of an
insurance policy from MongoDB using its policy number. Always call this first when
the user mentions a policy number (e.g. POL-2024-AUTO-001).`,
      parameters: {
        type: 'object',
        required: ['policyNumber'],
        properties: {
          policyNumber: {
            type: 'string',
            description: 'The policy number, e.g. POL-2024-AUTO-001 or POL-2024-HOME-001',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_policy_events',
      description: `Retrieve the audit trail, lifecycle events, and operational history
for a policy from MongoDB. Can search by policy number OR by correlationId.
NOTE: requestId is NOT a MongoDB field — use search_cloudwatch_logs for requestId lookups.
Returns event types, descriptions, timestamps, severity, and performer.`,
      parameters: {
        type: 'object',
        required: [],
        properties: {
          policyNumber: {
            type: 'string',
            description: 'Policy number — optional if correlationId is provided',
          },
          correlationId: {
            type: 'string',
            description: 'A UUID correlation ID / uniqueIdentifier to trace a specific operation',
          },
          eventType: {
            type: 'string',
            description: 'Filter by event type: POLICY_CREATED | POLICY_ACTIVATED | PAYMENT_RECEIVED | PAYMENT_OVERDUE | CLAIM_SUBMITTED | CLAIM_APPROVED | CLAIM_REJECTED | RENEWAL_INITIATED | POLICY_CANCELLED | DOCUMENT_UPLOADED | UNDERWRITING_STARTED | UNDERWRITING_COMPLETED | BENEFICIARY_UPDATED | FRAUD_FLAGGED | SYSTEM_SYNC',
          },
          severity: {
            type: 'string',
            description: 'Filter by severity: INFO | WARN | ERROR',
            enum: ['INFO', 'WARN', 'ERROR'],
          },
          limit: {
            type: 'number',
            description: 'Max events to return (default: 25)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_cloudwatch_logs',
      description: `Search AWS CloudWatch log groups for entries matching a uniqueIdentifier.
Searches BOTH as a raw string match AND as a structured JSON field match across
requestId, correlationId, and traceId fields — so it will find logs like
{"requestId":"<id>"} even if the id only appears in that field.
Use this when the user provides a UUID, trace ID, requestId, or correlationId.
Also use this for queries like "search trace of trace id <id>" or "find logs for trace <id>".`,
      parameters: {
        type: 'object',
        required: ['uniqueIdentifier'],
        properties: {
          uniqueIdentifier: {
            type: 'string',
            description: 'The UUID, correlationId, requestId, or trace ID to find in logs',
          },
          logGroups: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific CloudWatch log group names (optional — defaults to all configured groups)',
          },
          startTimeHours: {
            type: 'number',
            description: 'How many hours back to search (default: 72 = last 3 days)',
          },
          limit: {
            type: 'number',
            description: 'Max log events per group (default: 50)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cloudwatch_insights_query',
      description: `Run a CloudWatch Logs Insights query for DEEPER analysis ONLY after
search_cloudwatch_logs has already been called. Never use this as the first tool.
Use for aggregation or when the user explicitly asks for detailed analytics.`,
      parameters: {
        type: 'object',
        required: ['uniqueIdentifier'],
        properties: {
          uniqueIdentifier: {
            type: 'string',
            description: 'The identifier to analyze via CloudWatch Insights',
          },
          logGroups: {
            type: 'array',
            items: { type: 'string' },
            description: 'CloudWatch log group names (optional)',
          },
          startTimeHours: {
            type: 'number',
            description: 'Hours back to analyze (default: 72 = last 3 days)',
          },
        },
      },
    },
  },
];

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are PolicyTrace-AI, an expert enterprise agent for an insurance operations platform.
You have two data sources to investigate:

1. **MongoDB (Policy Database)** — Policy records, statuses, coverage, premiums, and full event audit trails
2. **AWS CloudWatch** — Real-time application logs, Lambda traces, ECS task logs

## Decision Logic
- **Policy number given** (e.g. POL-2024-AUTO-001) → call get_policy_status, then get_policy_events
- **requestId / request ID / request_id / trace ID / traceId / correlationId given** → call ONLY search_cloudwatch_logs with that value as uniqueIdentifier. Do NOT call get_policy_events for requestId queries. Do NOT call cloudwatch_insights_query as the first step.
- **Phrases like "search trace using id <id>", "search trace of trace id <id>", "find logs for <id>", "request id <id>", "get error trace of id <id>"** → call search_cloudwatch_logs with that ID as uniqueIdentifier. Do NOT use cloudwatch_insights_query for these.
- **Policy number given** (e.g. POL-2024-AUTO-001) → call get_policy_status, then get_policy_events
- **correlationId given AND policy context needed** → call search_cloudwatch_logs AND get_policy_events
- **Need deeper log analysis AFTER search_cloudwatch_logs returned results** → follow with cloudwatch_insights_query. Never call cloudwatch_insights_query as the first tool.
- **Ambiguous UUID** → try search_cloudwatch_logs first

## Response Format
Structure your final answer with these sections when applicable:

###  Policy Overview
Key policy details (number, holder, type, status, coverage, premium)

###  Status Analysis
Interpretation of the current status, what it means operationally, expiry, risk flags

###  Event Audit Trail
Chronological summary of key events — highlight ERRORs and WARNings

###  CloudWatch Trace  
Raw log trace from AWS — timestamps, log groups, messages

###  Flags & Recommendations
Any anomalies, risks, or recommended actions

Always cite the data source (MongoDB / CloudWatch) and timestamp for each piece of information.
Be precise, cite exact values from tool results. End with a confidence rating (HIGH/MEDIUM/LOW).`;

// ─── Tool Dispatcher ──────────────────────────────────────────────────────────

async function dispatchTool(
  name: string,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  switch (name as ToolName) {
    case 'get_policy_status':
      return config.POLICY_LAMBDA_URL
        ? getPolicyStatusViaLambda(params as { policyNumber: string })
        : getPolicyStatus(params as { policyNumber: string });
    case 'get_policy_events':
      return config.POLICY_LAMBDA_URL
        ? getPolicyEventsViaLambda(params as Parameters<typeof getPolicyEvents>[0])
        : getPolicyEvents(params as Parameters<typeof getPolicyEvents>[0]);
    case 'search_cloudwatch_logs':
      return searchCloudWatchLogs(params as unknown as Parameters<typeof searchCloudWatchLogs>[0]);
    case 'cloudwatch_insights_query':
      return cloudwatchInsightsQuery(params as unknown as Parameters<typeof cloudwatchInsightsQuery>[0]);
    default:
      return {
        toolName: name as ToolName,
        success:  false,
        error:    `Unknown tool: ${name}`,
        executionMs: 0,
      };
  }
}

// ─── Agent Runner ─────────────────────────────────────────────────────────────

export interface AgentOptions {
  request: QueryRequest;
  onEvent: (event: AgentSSEEvent) => void;
}

export async function runAgent(options: AgentOptions): Promise<void> {
  const { request, onEvent } = options;
  const sessionId = request.sessionId ?? uuid();
  const t0        = Date.now();

  logger.info('Agent session started', { sessionId, query: request.query.slice(0, 80) });

  const emit = (type: AgentSSEEvent['type'], data: unknown): void => {
    onEvent({ type, sessionId, ts: new Date().toISOString(), data });
  };

  const history: Message[] = [{ role: 'user', content: request.query }];
  const MAX_STEPS = 8;
  let step = 0;

  try {
    while (step < MAX_STEPS) {
      step++;

      const response = await Ollama.chat({
        model:   config.OLLAMA_MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
        tools:   TOOLS,
        options: {
          temperature:  0.1,  // low for factual consistency
          num_predict:  3000,
        },
      });

      const msg = response.message;
      history.push(msg);

      // ── Tool call(s) requested ─────────────────────────────────────────────
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        emit('agent:thinking', {
          thought: `I'll use ${msg.tool_calls.map(tc => tc.function.name).join(' + ')} to gather the required data.`,
          step,
        });

        for (const tc of msg.tool_calls) {
          const toolName = tc.function.name;
          const toolArgs = tc.function.arguments as Record<string, unknown>;

          emit('agent:tool_call', { toolName, parameters: toolArgs, step });

          logger.debug(`[Agent] Calling tool: ${toolName}`, { sessionId, args: toolArgs });

          const result = await dispatchTool(toolName, toolArgs);

          emit('agent:tool_result', { ...result, step });

          history.push({
            role: 'tool',
            content: JSON.stringify({
              tool:        toolName,
              success:     result.success,
              executionMs: result.executionMs,
              ...(result.success ? { data: result.data } : { error: result.error }),
            }),
          });
        }

        continue; // next iteration with tool results in context
      }

      // ── Final response ─────────────────────────────────────────────────────
      emit('agent:response', {
        content:    msg.content ?? '',
        totalSteps: step,
        totalMs:    Date.now() - t0,
      });

      emit('agent:done', { sessionId, totalSteps: step, totalMs: Date.now() - t0 });

      logger.info('Agent session complete', {
        sessionId, steps: step, totalMs: Date.now() - t0,
      });
      return;
    }

    // Max steps guard
    emit('agent:response', {
      content:    'Reached maximum reasoning steps. Please refine your query for a more targeted investigation.',
      totalSteps: step,
      totalMs:    Date.now() - t0,
    });
    emit('agent:done', { sessionId, totalSteps: step, totalMs: Date.now() - t0 });

  } catch (err) {
    const msg = (err as Error).message ?? 'Unknown error';
    logger.error('Agent session failed', { sessionId, error: msg });

    const userMsg = msg.includes('ECONNREFUSED')
      ? `Cannot reach Ollama at ${config.OLLAMA_BASE_URL}. Run: ollama serve && ollama pull ${config.OLLAMA_MODEL}`
      : msg.includes('model') && msg.includes('not found')
      ? `Model "${config.OLLAMA_MODEL}" not installed. Run: ollama pull ${config.OLLAMA_MODEL}`
      : `Agent error: ${msg}`;

    emit('agent:error', { message: userMsg, code: 'AGENT_RUNTIME_ERROR' });
    emit('agent:done',  { sessionId, error: true });
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkOllamaHealth(): Promise<'ok' | 'error' | 'unavailable'> {
  try {
    const { models } = await Ollama.list();
    return models.some(m => m.name.startsWith(config.OLLAMA_MODEL)) ? 'ok' : 'unavailable';
  } catch {
    return 'error';
  }
}
