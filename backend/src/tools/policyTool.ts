import { PolicyModel, PolicyEventModel } from '../db/models.js';
import { logger } from '../utils/logger.js';
import type { ToolResult } from '../types/index.js';

// ─── Tool: get_policy_status ──────────────────────────────────────────────────

export interface GetPolicyStatusParams {
  policyNumber: string;
}

export async function getPolicyStatus(
  params: GetPolicyStatusParams,
): Promise<ToolResult> {
  const t0 = Date.now();
  const { policyNumber } = params;

  logger.info('[Tool] get_policy_status', { policyNumber });

  try {
    const policy = await PolicyModel
      .findOne({ policyNumber: policyNumber.toUpperCase() })
      .lean()
      .exec();

    if (!policy) {
      return {
        toolName: 'get_policy_status',
        success:  false,
        error:    `No policy found with number "${policyNumber}". Tip: try POL-2024-AUTO-001`,
        executionMs: Date.now() - t0,
      };
    }

    // Aggregate event stats
    const [eventStats] = await PolicyEventModel.aggregate([
      { $match: { policyId: policy._id } },
      {
        $group: {
          _id:         null,
          total:       { $sum: 1 },
          lastEvent:   { $max: '$createdAt' },
          errorCount:  { $sum: { $cond: [{ $eq: ['$severity', 'ERROR'] }, 1, 0] } },
          categories:  { $addToSet: '$category' },
        },
      },
    ]);

    // Latest event
    const latestEvent = await PolicyEventModel
      .findOne({ policyId: policy._id })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const now         = new Date();
    const endDate     = new Date(policy.endDate);
    const daysToExpiry = Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000);
    const isExpired   = daysToExpiry < 0;

    return {
      toolName: 'get_policy_status',
      success:  true,
      data: {
        policy: {
          id:             policy._id.toString(),
          policyNumber:   policy.policyNumber,
          holderName:     policy.holderName,
          holderEmail:    policy.holderEmail,
          holderPhone:    policy.holderPhone,
          type:           policy.type,
          status:         policy.status,
          premium:        policy.premium,
          coverageAmount: policy.coverageAmount,
          startDate:      policy.startDate,
          endDate:        policy.endDate,
          metadata:       policy.metadata,
          createdAt:      policy.createdAt,
          updatedAt:      policy.updatedAt,
        },
        analytics: {
          totalEvents:  eventStats?.total ?? 0,
          lastActivity: eventStats?.lastEvent ?? null,
          errorCount:   eventStats?.errorCount ?? 0,
          categories:   eventStats?.categories ?? [],
        },
        summary: {
          daysToExpiry,
          isExpired,
          coverageFormatted: `$${policy.coverageAmount.toLocaleString()}`,
          premiumFormatted:  `$${policy.premium.toLocaleString()}/yr`,
        },
        latestEvent: latestEvent
          ? {
              eventType:     latestEvent.eventType,
              description:   latestEvent.description,
              performedBy:   latestEvent.performedBy,
              correlationId: latestEvent.correlationId,
              createdAt:     latestEvent.createdAt,
            }
          : null,
      },
      executionMs: Date.now() - t0,
    };
  } catch (err) {
    logger.error('[Tool] get_policy_status error', { err, policyNumber });
    return {
      toolName:    'get_policy_status',
      success:     false,
      error:       `MongoDB error: ${(err as Error).message}`,
      executionMs: Date.now() - t0,
    };
  }
}

// ─── Tool: get_policy_events ──────────────────────────────────────────────────

export interface GetPolicyEventsParams {
  policyNumber?:   string;
  correlationId?:  string;
  eventType?:      string;
  severity?:       string;
  limit?:          number;
}

export async function getPolicyEvents(
  params: GetPolicyEventsParams,
): Promise<ToolResult> {
  const t0 = Date.now();
  const { policyNumber, correlationId, eventType, severity, limit = 25 } = params;

  logger.info('[Tool] get_policy_events', params);

  try {
    if (!policyNumber && !correlationId) {
      return {
        toolName:    'get_policy_events',
        success:     false,
        error:       'Provide either policyNumber or correlationId',
        executionMs: Date.now() - t0,
      };
    }

    // Build query filter
    const filter: Record<string, unknown> = {};

    if (correlationId) {
      filter.correlationId = correlationId;
    } else if (policyNumber) {
      filter.policyNumber = policyNumber.toUpperCase();
    }

    if (eventType) filter.eventType = eventType;
    if (severity)  filter.severity  = severity;

    const events = await PolicyEventModel
      .find(filter)
      .sort({ createdAt: correlationId ? 1 : -1 })
      .limit(limit)
      .lean()
      .exec();

    if (events.length === 0) {
      return {
        toolName: 'get_policy_events',
        success:  true,
        data: {
          events:  [],
          total:   0,
          message: correlationId
            ? `No events found for correlationId "${correlationId}"`
            : `No events found for policy "${policyNumber}"`,
        },
        executionMs: Date.now() - t0,
      };
    }

    // Build summary analytics
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const e of events) {
      byType[e.eventType]      = (byType[e.eventType] ?? 0) + 1;
      bySeverity[e.severity]   = (bySeverity[e.severity] ?? 0) + 1;
      byCategory[e.category]   = (byCategory[e.category] ?? 0) + 1;
    }

    return {
      toolName: 'get_policy_events',
      success:  true,
      data: {
        events: events.map(e => ({
          id:            e._id.toString(),
          policyNumber:  e.policyNumber,
          eventType:     e.eventType,
          category:      e.category,
          severity:      e.severity,
          description:   e.description,
          performedBy:   e.performedBy,
          correlationId: e.correlationId,
          requestId:     e.requestId,
          createdAt:     e.createdAt,
          metadata:      e.metadata,
        })),
        total:     events.length,
        analytics: { byType, bySeverity, byCategory },
        timeRange: {
          earliest: events.at(-1)?.createdAt,
          latest:   events.at(0)?.createdAt,
        },
      },
      executionMs: Date.now() - t0,
    };
  } catch (err) {
    logger.error('[Tool] get_policy_events error', { err, params });
    return {
      toolName:    'get_policy_events',
      success:     false,
      error:       `MongoDB error: ${(err as Error).message}`,
      executionMs: Date.now() - t0,
    };
  }
}
