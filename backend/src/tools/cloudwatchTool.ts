import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
  StartQueryCommand,
  GetQueryResultsCommand,
  DescribeLogGroupsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { CWLogEntry, CWQueryResult, ToolResult } from '../types/index.js';

// ─── Singleton Client ─────────────────────────────────────────────────────────

let _client: CloudWatchLogsClient | null = null;

function getClient(): CloudWatchLogsClient {
  if (_client) return _client;

  const cfg: ConstructorParameters<typeof CloudWatchLogsClient>[0] = {
    region: config.AWS_REGION,
  };

  if (config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY) {
    cfg.credentials = {
      accessKeyId:     config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      ...(config.AWS_SESSION_TOKEN ? { sessionToken: config.AWS_SESSION_TOKEN } : {}),
    };
  }

  if (config.AWS_ENDPOINT_OVERRIDE) {
    cfg.endpoint = config.AWS_ENDPOINT_OVERRIDE;
    logger.info('[CloudWatch] Using custom endpoint (LocalStack)', { endpoint: config.AWS_ENDPOINT_OVERRIDE });
  }

  _client = new CloudWatchLogsClient(cfg);
  return _client;
}

// ─── Tool: search_cloudwatch_logs ─────────────────────────────────────────────

export interface SearchCWParams {
  uniqueIdentifier: string;
  logGroups?:       string[];
  startTimeHours?:  number;
  limit?:           number;
}

export async function searchCloudWatchLogs(params: SearchCWParams): Promise<ToolResult> {
  const t0 = Date.now();
  const {
    uniqueIdentifier,
    startTimeHours = 72,
    limit          = 50,
  } = params;
  // Guard: LLM sometimes passes logGroups as a JSON string or non-array — fall back to config
  const logGroups = Array.isArray(params.logGroups) && params.logGroups.length > 0
    ? params.logGroups
    : config.cwLogGroups;

  logger.info('[Tool] search_cloudwatch_logs', { uniqueIdentifier, logGroupCount: logGroups.length });

  try {
    const client    = getClient();
    const endTimeMs = Date.now();
    const startTimeMs = endTimeMs - startTimeHours * 3_600_000;

    const results:    CWQueryResult[] = [];
    const allEvents:  CWLogEntry[]    = [];
    const groupErrors: Record<string, string> = {};

    // ── Phase 1: FilterLogEvents (fast, two patterns per group) ────────────────
    //   Pattern A: quoted string — matches the identifier anywhere in the raw log
    //   Pattern B: JSON field filter — matches structured logs where the id is in
    //              requestId, correlationId, or traceId fields
    const stringFilter = `"${uniqueIdentifier}"`;
    const jsonFilter   = `{ $.requestId = "${uniqueIdentifier}" || $.correlationId = "${uniqueIdentifier}" || $.traceId = "${uniqueIdentifier}" }`;

    const filterSearches = logGroups.map(async logGroup => {
      try {
        const [r1, r2] = await Promise.allSettled([
          client.send(new FilterLogEventsCommand({
            logGroupName:  logGroup,
            filterPattern: stringFilter,
            startTime:     startTimeMs,
            endTime:       endTimeMs,
            limit,
          })),
          client.send(new FilterLogEventsCommand({
            logGroupName:  logGroup,
            filterPattern: jsonFilter,
            startTime:     startTimeMs,
            endTime:       endTimeMs,
            limit,
          })),
        ]);

        // Merge and deduplicate by eventId (fall back to timestamp+message)
        const seen   = new Set<string>();
        const events: CWLogEntry[] = [];

        for (const result of [r1, r2]) {
          if (result.status !== 'fulfilled') continue;
          for (const e of result.value.events ?? []) {
            const key = e.eventId ?? `${e.timestamp}-${e.message}`;
            if (seen.has(key)) continue;
            seen.add(key);
            events.push({
              timestamp:     e.timestamp     ?? 0,
              message:       e.message       ?? '',
              logStream:     e.logStreamName ?? 'unknown',
              logGroup,
              ingestionTime: e.ingestionTime,
            });
          }
        }

        if (events.length > 0) {
          results.push({ logGroup, eventCount: events.length, events, queryTimeMs: 0 });
          allEvents.push(...events);
        }
      } catch (err) {
        const msg = (err as Error).message;
        groupErrors[logGroup] = msg;
        logger.warn('[CloudWatch] FilterLogEvents failed', { logGroup, error: msg });
      }
    });

    await Promise.allSettled(filterSearches);

    // ── Phase 2: Insights fallback (reliable regex for Lambda log format) ──────
    // FilterLogEvents can miss Lambda logs where the UUID is only in the
    // tab-prefixed header (TIMESTAMP\tREQUEST_ID\tLEVEL\t{json}).
    // Insights @message like /uuid/ regex catches all occurrences.
    let searchMethod   = 'FilterLogEvents';
    let insightsError: string | undefined;
    if (allEvents.length === 0 && logGroups.length > 0) {
      logger.info('[CloudWatch] FilterLogEvents found nothing — falling back to Insights regex', { uniqueIdentifier });
      const { events: insightEvents, errors: insightErrs } = await searchViaInsightsFallback(
        client, uniqueIdentifier, logGroups,
        Math.floor(startTimeMs / 1000), Math.floor(endTimeMs / 1000),
      );
      if (Object.keys(insightErrs).length > 0) {
        insightsError = Object.entries(insightErrs).map(([g, e]) => `${g}: ${e}`).join('; ');
      }
      if (insightEvents.length > 0) {
        searchMethod = 'CloudWatchInsights';
        allEvents.push(...insightEvents);
        // group by logGroup for breakdown
        const byGroup = new Map<string, CWLogEntry[]>();
        for (const e of insightEvents) {
          if (!byGroup.has(e.logGroup)) byGroup.set(e.logGroup, []);
          byGroup.get(e.logGroup)!.push(e);
        }
        for (const [lg, evts] of byGroup) {
          results.push({ logGroup: lg, eventCount: evts.length, events: evts, queryTimeMs: 0 });
        }
      }
    }

    // Sort by timestamp ascending
    allEvents.sort((a, b) => a.timestamp - b.timestamp);

    if (allEvents.length === 0) {
      return {
        toolName: 'search_cloudwatch_logs',
        success:  true,
        data: {
          found:             false,
          uniqueIdentifier,
          totalEvents:       0,
          logGroupsSearched: logGroups,
          message:           `No CloudWatch logs found for "${uniqueIdentifier}" in the last ${startTimeHours}h (${startTimeHours / 24} day(s))`,
          timeRange:         { start: new Date(startTimeMs), end: new Date(endTimeMs) },
          diagnostics: {
            filterLogEventsGroupErrors: Object.keys(groupErrors).length > 0 ? groupErrors : undefined,
            insightsError,
            hint: Object.keys(groupErrors).length > 0
              ? 'Some log groups could not be searched — verify CW_LOG_GROUPS names and IAM permissions'
              : insightsError
              ? 'Insights fallback failed — verify log group names and CloudWatch Logs Insights IAM permissions'
              : 'Log groups were reachable but no matching events found — verify the ID exists in the configured log groups and time window',
          },
        },
        executionMs: Date.now() - t0,
      };
    }

    return {
      toolName: 'search_cloudwatch_logs',
      success:  true,
      data: {
        found:             true,
        uniqueIdentifier,
        searchMethod,
        totalEvents:       allEvents.length,
        logGroupsFound:    results.map(r => r.logGroup),
        logGroupsSearched: logGroups,
        events:            allEvents,
        groupBreakdown:    results.map(r => ({ logGroup: r.logGroup, count: r.eventCount })),
        timeRange:         { start: new Date(startTimeMs), end: new Date(endTimeMs) },
        summary:           buildCWSummary(uniqueIdentifier, allEvents, results),
      },
      executionMs: Date.now() - t0,
    };
  } catch (err) {
    logger.error('[Tool] search_cloudwatch_logs error', { err, params });
    return {
      toolName:    'search_cloudwatch_logs',
      success:     false,
      error:       `CloudWatch error: ${(err as Error).message}`,
      executionMs: Date.now() - t0,
    };
  }
}

// ─── Tool: cloudwatch_insights_query ─────────────────────────────────────────

export interface CWInsightsParams {
  uniqueIdentifier: string;
  logGroups?:       string[];
  startTimeHours?:  number;
}

export async function cloudwatchInsightsQuery(params: CWInsightsParams): Promise<ToolResult> {
  const t0 = Date.now();
  const {
    uniqueIdentifier,
    startTimeHours = 72,
  } = params;
  // Guard: LLM sometimes passes logGroups as a JSON string or non-array — fall back to config
  const logGroups = Array.isArray(params.logGroups) && params.logGroups.length > 0
    ? params.logGroups
    : config.cwLogGroups;

  logger.info('[Tool] cloudwatch_insights_query', { uniqueIdentifier });

  try {
    const client   = getClient();
    const endTime  = Math.floor(Date.now() / 1000);
    const startTime = endTime - startTimeHours * 3600;

    // CloudWatch Insights query — structured log analysis
    const query = `
      fields @timestamp, @message, @logStream, @log
      | filter @message like /${uniqueIdentifier}/
      | sort @timestamp asc
      | limit 100
    `.trim();

    const { queryId } = await client.send(new StartQueryCommand({
      logGroupNames: logGroups,
      startTime,
      endTime,
      queryString:   query,
    }));

    if (!queryId) throw new Error('StartQuery returned no queryId');

    // Poll until complete (max 30s)
    const rawResults = await pollInsights(client, queryId, 30_000);

    if (rawResults.length === 0) {
      return {
        toolName: 'cloudwatch_insights_query',
        success:  true,
        data: {
          found:            false,
          uniqueIdentifier,
          queryId,
          message:          `No Insights results for "${uniqueIdentifier}"`,
        },
        executionMs: Date.now() - t0,
      };
    }

    // Flatten field arrays into objects
    const rows = rawResults.map(fields => {
      const row: Record<string, string> = {};
      for (const f of fields) {
        if (f.field && f.value !== undefined) row[f.field] = f.value;
      }
      return row;
    });

    return {
      toolName: 'cloudwatch_insights_query',
      success:  true,
      data: {
        found:            true,
        uniqueIdentifier,
        queryId,
        totalResults:     rows.length,
        rows,
        summary:          `Found ${rows.length} log rows for "${uniqueIdentifier}" via CloudWatch Insights`,
      },
      executionMs: Date.now() - t0,
    };
  } catch (err) {
    logger.error('[Tool] cloudwatch_insights_query error', { err });
    return {
      toolName:    'cloudwatch_insights_query',
      success:     false,
      error:       `CloudWatch Insights error: ${(err as Error).message}`,
      executionMs: Date.now() - t0,
    };
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkCWHealth(): Promise<'ok' | 'error' | 'unavailable'> {
  try {
    if (!config.AWS_ACCESS_KEY_ID && !config.AWS_ENDPOINT_OVERRIDE) return 'unavailable';
    await getClient().send(new DescribeLogGroupsCommand({ limit: 1 }));
    return 'ok';
  } catch {
    return 'error';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Insights fallback: used by searchCloudWatchLogs when FilterLogEvents misses
// Lambda-format logs (TIMESTAMP\tREQUEST_ID\tLEVEL\t{json}).
// Uses regex @message like /uuid/ which reliably matches any occurrence.
// Queries each log group individually so a non-existent group never blocks
// valid ones. StartQueryCommand with logGroupNames[] throws ResourceNotFoundException
// if ANY group is missing, killing results from all groups.
async function searchViaInsightsFallback(
  client:    CloudWatchLogsClient,
  id:        string,
  logGroups: string[],
  startSec:  number,
  endSec:    number,
): Promise<{ events: CWLogEntry[]; errors: Record<string, string> }> {
  const query = [
    'fields @timestamp, @message, @logStream, @log',
    `| filter @message like /${id}/`,
    '| sort @timestamp asc',
    '| limit 100',
  ].join(' ');

  const allEvents: CWLogEntry[]         = [];
  const errors: Record<string, string>  = {};

  await Promise.allSettled(logGroups.map(async logGroup => {
    try {
      const { queryId } = await client.send(new StartQueryCommand({
        logGroupName: logGroup,   // single group — avoids all-or-nothing failure
        startTime:    startSec,
        endTime:      endSec,
        queryString:  query,
      }));

      if (!queryId) return;

      const rawResults = await pollInsights(client, queryId, 30_000);

      for (const fields of rawResults) {
        const row: Record<string, string> = {};
        for (const f of fields) if (f.field && f.value !== undefined) row[f.field] = f.value;

        const ts      = row['@timestamp'] ? new Date(row['@timestamp']).getTime() : 0;
        const rawLog  = row['@log'] ?? logGroup;
        const group   = rawLog.includes(':') ? rawLog.split(':').pop()! : rawLog;

        allEvents.push({
          timestamp: ts,
          message:   row['@message'] ?? '',
          logStream: row['@logStream'] ?? 'unknown',
          logGroup:  group || logGroup,
        });
      }
    } catch (err) {
      const msg = (err as Error).message;
      errors[logGroup] = msg;
      logger.warn('[CloudWatch] Insights query failed for group', { logGroup, error: msg });
    }
  }));

  return { events: allEvents, errors };
}

async function pollInsights(
  client: CloudWatchLogsClient,
  queryId: string,
  timeoutMs: number,
): Promise<Array<Array<{ field?: string; value?: string }>>> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(1000);
    const resp = await client.send(new GetQueryResultsCommand({ queryId }));

    if (resp.status === 'Complete') {
      return (resp.results ?? []) as Array<Array<{ field?: string; value?: string }>>;
    }
    if (resp.status === 'Failed' || resp.status === 'Cancelled') {
      throw new Error(`Insights query ${resp.status}: ${queryId}`);
    }
  }
  throw new Error(`Insights query timed out after ${timeoutMs}ms`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildCWSummary(
  id: string,
  events: CWLogEntry[],
  groups: CWQueryResult[],
): string {
  const groupNames = groups.map(g => g.logGroup).join(', ');
  const first = new Date(events[0].timestamp).toISOString();
  const last  = new Date(events.at(-1)!.timestamp).toISOString();
  return (
    `Found ${events.length} log event(s) for "${id}" across ${groups.length} log group(s): ${groupNames}. ` +
    `Timestamp range: ${first} → ${last}.`
  );
}
