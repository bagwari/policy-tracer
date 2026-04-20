import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { connectMongo, disconnectMongo, checkMongoHealth } from './db/mongoose.js';
import { seed } from './db/seed.js';
import { runAgent, checkOllamaHealth } from './agent/index.js';
import { checkCWHealth } from './tools/cloudwatchTool.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import policyRoutes from './routes/policies.js';
import type { AgentSSEEvent, HealthResponse } from './types/index.js';

// ─── App Bootstrap ─────────────────────────────────────────────────────────────

const app = express();

// Security & middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin:        config.CORS_ORIGIN,
  methods:       ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Session-ID'],
  credentials:   false,
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(config.isDev ? 'dev' : 'combined', {
  stream: { write: msg => logger.info(msg.trim()) },
}));

// Rate limiting on AI endpoint
const agentLimiter = rateLimit({
  windowMs:         config.RATE_LIMIT_WINDOW_MS,
  max:              config.RATE_LIMIT_MAX_REQUESTS,
  message:          { error: { code: 'RATE_LIMITED', message: 'Too many agent requests' }, ts: new Date().toISOString() },
  standardHeaders:  true,
  legacyHeaders:    false,
});

// ─── Routes ────────────────────────────────────────────────────────────────────

// Health
app.get('/api/health', async (_req, res) => {
  const [mongoStatus, ollamaStatus, cwStatus] = await Promise.all([
    checkMongoHealth(),
    checkOllamaHealth(),
    checkCWHealth(),
  ]);

  const overall: HealthResponse['status'] =
    mongoStatus === 'error'  ? 'error' :
    ollamaStatus === 'error' ? 'degraded' : 'ok';

  const body: HealthResponse = {
    status: overall,
    ts:     new Date().toISOString(),
    version: '1.0.0',
    services: {
      mongodb:    mongoStatus,
      ollama:     ollamaStatus,
      cloudwatch: cwStatus,
    },
  };

  res.status(overall === 'error' ? 503 : 200).json(body);
});

// Policies REST
app.use('/api/policies', policyRoutes);

// Sample queries for UI discovery
app.get('/api/agent/examples', (_req, res) => {
  res.json({
    data: [
      { category: 'Policy Lookup',  label: 'Active auto policy',        query: 'What is the current status of policy POL-2024-AUTO-001?' },
      { category: 'Policy Lookup',  label: 'Policy under review',       query: 'Get full details for POL-2024-COMM-001 — it seems to be under review' },
      { category: 'Policy Lookup',  label: 'Claimed home policy',       query: 'Investigate policy POL-2024-HOME-002 — show all claim events' },
      { category: 'Event Trace',    label: 'Error events only',         query: 'Show all ERROR severity events for POL-2024-AUTO-001' },
      { category: 'Event Trace',    label: 'Claim history',             query: 'What claim events have occurred on policy POL-2024-HOME-002?' },
      { category: 'Correlation ID', label: 'Trace by UUID',             query: 'Trace correlationId — get one from POL-2024-AUTO-001 events first' },
      { category: 'CloudWatch',     label: 'CloudWatch log search',     query: 'Search CloudWatch logs for uniqueIdentifier abc-1234-xyz' },
      { category: 'Multi-source',   label: 'Full investigation',        query: 'Full investigation on POL-2024-COMM-001: DB status, all events, and any CloudWatch traces' },
    ],
    ts: new Date().toISOString(),
  });
});

// ─── SSE Agent Endpoint ────────────────────────────────────────────────────────

const querySchema = z.object({
  query:     z.string().min(3, 'Query too short').max(1000, 'Query too long').trim(),
  sessionId: z.string().uuid().optional(),
});

app.post('/api/agent/query', agentLimiter, async (req, res) => {
  const parsed = querySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.errors.map(e => e.message).join('; ') },
      ts: new Date().toISOString(),
    });
    return;
  }

  const sessionId = parsed.data.sessionId ?? uuid();

  // Set up SSE
  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache, no-transform');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');   // disable Nginx buffering
  res.flushHeaders();

  // Keep-alive heartbeat every 20s
  const heartbeat = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 20_000);

  const send = (event: AgentSSEEvent): void => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };

  req.on('close', () => {
    clearInterval(heartbeat);
    logger.info('SSE client disconnected', { sessionId });
  });

  try {
    await runAgent({
      request: { query: parsed.data.query, sessionId },
      onEvent: send,
    });
  } catch (err) {
    logger.error('SSE stream error', { err, sessionId });
    send({
      type: 'agent:error',
      sessionId,
      ts:   new Date().toISOString(),
      data: { message: 'Unexpected stream error', code: 'STREAM_ERROR' },
    });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

// ─── Error handlers ────────────────────────────────────────────────────────────

app.use(notFound);
app.use(errorHandler);

// ─── Start ─────────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  try {
    await connectMongo();
    await seed();

    const server = app.listen(config.PORT, () => {
      logger.info('🚀 PolicyTracer API ready', {
        port:    config.PORT,
        env:     config.NODE_ENV,
        model:   config.OLLAMA_MODEL,
        mongodb: config.MONGO_URI.replace(/\/\/.*@/, '//***@'),
      });
    });

    const shutdown = async (sig: string): Promise<void> => {
      logger.info(`${sig} received — shutting down…`);
      server.close(async () => {
        await disconnectMongo();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Bootstrap failed', { err });
    process.exit(1);
  }
}

bootstrap();
