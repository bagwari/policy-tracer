/**
 * HTTP client for the deployed policy-service Lambda.
 * Used by the agent when POLICY_LAMBDA_URL is set in .env.
 * The Lambda generates real CloudWatch logs that the CW tools can then query.
 */
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { ToolResult } from '../types/index.js';
import type { GetPolicyStatusParams, GetPolicyEventsParams } from './policyTool.js';

async function callLambda(
  path: '/policy-status' | '/policy-events',
  body: unknown,
  toolName: string,
): Promise<ToolResult> {
  const url = `${config.POLICY_LAMBDA_URL}${path}`;
  const t0  = Date.now();

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Lambda HTTP ${res.status}: ${text}`);
    }

    return await res.json() as ToolResult;
  } catch (e) {
    const error = (e as Error).message;
    logger.error('[LambdaClient] call failed', { url, error });
    return {
      toolName:    toolName as ToolResult['toolName'],
      success:     false,
      error:       `Lambda call failed: ${error}`,
      executionMs: Date.now() - t0,
    };
  }
}

export function getPolicyStatusViaLambda(params: GetPolicyStatusParams): Promise<ToolResult> {
  logger.info('[LambdaClient] get_policy_status →', { url: config.POLICY_LAMBDA_URL, policyNumber: params.policyNumber });
  return callLambda('/policy-status', params, 'get_policy_status');
}

export function getPolicyEventsViaLambda(params: GetPolicyEventsParams): Promise<ToolResult> {
  logger.info('[LambdaClient] get_policy_events →', { url: config.POLICY_LAMBDA_URL, ...params });
  return callLambda('/policy-events', params, 'get_policy_events');
}
