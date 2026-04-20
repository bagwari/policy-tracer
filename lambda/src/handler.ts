import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { connectDB } from './db';
import { getPolicyStatus, getPolicyEvents, GetPolicyEventsParams } from './tools';

// ─── Structured logger (stdout → CloudWatch Logs automatically) ───────────────

function log(
  level: 'INFO' | 'WARN' | 'ERROR',
  message: string,
  data: Record<string, unknown> = {},
): void {
  console.log(JSON.stringify({ level, message, ts: new Date().toISOString(), service: 'policy-service', ...data }));
}

// ─── CORS headers ─────────────────────────────────────────────────────────────

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function ok(body: unknown): APIGatewayProxyResultV2 {
  return { statusCode: 200, headers: CORS, body: JSON.stringify(body) };
}

function err(statusCode: number, message: string): APIGatewayProxyResultV2 {
  return { statusCode, headers: CORS, body: JSON.stringify({ error: message }) };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const handler = async (
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyResultV2> => {
  const method    = event.requestContext.http.method.toUpperCase();
  const path      = event.requestContext.http.path;
  const requestId = context.awsRequestId;

  log('INFO', 'request', { method, path, requestId });

  // ── CORS preflight ──────────────────────────────────────────────────────────
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  if (method !== 'POST') {
    return err(405, 'Method Not Allowed');
  }

  let body: Record<string, unknown> = {};
  try {
    if (event.body) body = JSON.parse(event.body);
  } catch {
    return err(400, 'Invalid JSON body');
  }

  // ── Connect to MongoDB (cached between warm invocations) ────────────────────
  try {
    await connectDB();
  } catch (e) {
    log('ERROR', 'db_connect_failed', { error: (e as Error).message, requestId });
    return err(503, 'Database connection failed');
  }

  // ── Route dispatch ──────────────────────────────────────────────────────────

  if (path === '/policy-status' || path.endsWith('/policy-status')) {
    const { policyNumber } = body as { policyNumber?: string };

    if (!policyNumber) return err(400, 'policyNumber is required');

    log('INFO', 'get_policy_status', { policyNumber, requestId });

    const result = await getPolicyStatus({ policyNumber });

    // Emit correlation trace so CloudWatch search can find it
    if (result.success && result.data) {
      const d = result.data as { latestEvent?: { correlationId?: string }; policy?: { status?: string; type?: string } };
      log('INFO', 'policy_status_result', {
        policyNumber,
        requestId,
        correlationId:  d.latestEvent?.correlationId,
        status:         d.policy?.status,
        policyType:     d.policy?.type,
        executionMs:    result.executionMs,
      });
    } else {
      log('WARN', 'policy_not_found', { policyNumber, requestId, error: result.error });
    }

    return ok(result);
  }

  if (path === '/policy-events' || path.endsWith('/policy-events')) {
    const params = body as GetPolicyEventsParams;

    if (!params.policyNumber && !params.correlationId) {
      return err(400, 'Provide either policyNumber or correlationId');
    }

    log('INFO', 'get_policy_events', {
      policyNumber:  params.policyNumber,
      correlationId: params.correlationId,
      eventType:     params.eventType,
      severity:      params.severity,
      limit:         params.limit,
      requestId,
    });

    const result = await getPolicyEvents(params);

    if (result.success && result.data) {
      const d = result.data as { events?: Array<{ correlationId?: string; eventType?: string; severity?: string; policyNumber?: string; performedBy?: string; createdAt?: unknown }>, total?: number };

      log('INFO', 'policy_events_result', {
        policyNumber:  params.policyNumber,
        correlationId: params.correlationId,
        requestId,
        total:         d.total,
        executionMs:   result.executionMs,
      });

      // Log each event individually so correlationId searches hit specific lines
      for (const evt of d.events ?? []) {
        log(evt.severity === 'ERROR' ? 'ERROR' : evt.severity === 'WARN' ? 'WARN' : 'INFO', 'policy_event', {
          policyNumber:  evt.policyNumber,
          correlationId: evt.correlationId,
          eventType:     evt.eventType,
          severity:      evt.severity,
          performedBy:   evt.performedBy,
          createdAt:     evt.createdAt,
          requestId,
        });
      }
    } else {
      log('WARN', 'policy_events_empty', {
        policyNumber:  params.policyNumber,
        correlationId: params.correlationId,
        requestId,
        error: result.error,
      });
    }

    return ok(result);
  }

  return err(404, `Unknown path: ${path}`);
};
