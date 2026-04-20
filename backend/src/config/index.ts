import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT:               z.coerce.number().default(4000),
  NODE_ENV:           z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL:          z.enum(['error', 'warn', 'info', 'debug', 'silly']).default('info'),
  CORS_ORIGIN:        z.string().default('http://localhost:5173'),

  OLLAMA_BASE_URL:    z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL:       z.string().default('llama3.2'),
  OLLAMA_TIMEOUT_MS:  z.coerce.number().default(120_000),

  MONGO_URI:          z.string().default('mongodb://localhost:27017/policy_tracer'),

  AWS_REGION:         z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID:      z.string().optional(),
  AWS_SECRET_ACCESS_KEY:  z.string().optional(),
  AWS_SESSION_TOKEN:      z.string().optional(),
  AWS_ENDPOINT_OVERRIDE:  z.string().url().optional(),
  CW_LOG_GROUPS:          z.string().default('/app/policy-api'),

  // When set, policy tool calls are forwarded to the deployed Lambda instead
  // of hitting MongoDB directly — Lambda writes real CloudWatch logs.
  POLICY_LAMBDA_URL: z.string().url().optional(),

  RATE_LIMIT_WINDOW_MS:      z.coerce.number().default(60_000),
  RATE_LIMIT_MAX_REQUESTS:   z.coerce.number().default(30),
});

const result = schema.safeParse(process.env);
if (!result.success) {
  console.error('❌  Invalid environment:\n', result.error.format());
  process.exit(1);
}

export const config = {
  ...result.data,
  isDev:       result.data.NODE_ENV === 'development',
  isProd:      result.data.NODE_ENV === 'production',
  cwLogGroups: result.data.CW_LOG_GROUPS.split(',').map(g => g.trim()).filter(Boolean),
} as const;

export type Config = typeof config;
