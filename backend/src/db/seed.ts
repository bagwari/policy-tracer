import 'dotenv/config';
import { v4 as uuid } from 'uuid';
import { connectMongo, disconnectMongo } from './mongoose.js';
import { PolicyModel, PolicyEventModel } from './models.js';
import { logger } from '../utils/logger.js';
import type { PolicyStatus, PolicyType, EventCategory } from '../types/index.js';

// ─── Seed Data ──────────────────────────────────────────────────────────────────

const SAMPLE_HOLDERS = [
  { name: 'Alice Johnson',    email: 'alice.johnson@email.com',   phone: '+1-555-0101' },
  { name: 'Bob Martinez',     email: 'bob.martinez@email.com',    phone: '+1-555-0102' },
  { name: 'Carol Williams',   email: 'carol.w@email.com',         phone: '+1-555-0103' },
  { name: 'David Chen',       email: 'd.chen@corp.com',           phone: '+1-555-0104' },
  { name: 'Eva Rodriguez',    email: 'eva.r@email.com',           phone: '+1-555-0105' },
  { name: 'Frank Wilson',     email: 'fwilson@business.com',      phone: '+1-555-0106' },
  { name: 'Grace Kim',        email: 'grace.kim@enterprise.com',  phone: '+1-555-0107' },
  { name: 'Henry Brown',      email: 'hbrown@email.com',          phone: '+1-555-0108' },
  { name: 'Iris Patel',       email: 'iris.patel@tech.io',        phone: '+1-555-0109' },
  { name: 'James Lee',        email: 'jlee@consulting.com',       phone: '+1-555-0110' },
  { name: 'Karen Davis',      email: 'kdavis@startup.co',         phone: '+1-555-0111' },
  { name: 'Luis Garcia',      email: 'luis.g@firm.com',           phone: '+1-555-0112' },
];

interface PolicySeed {
  number:   string;
  type:     PolicyType;
  status:   PolicyStatus;
  premium:  number;
  coverage: number;
  holder:   typeof SAMPLE_HOLDERS[0];
}

const POLICIES: PolicySeed[] = [
  { number: 'POL-2024-AUTO-001', type: 'AUTO',       status: 'ACTIVE',       premium:  1_250, coverage:  50_000, holder: SAMPLE_HOLDERS[0]  },
  { number: 'POL-2024-HOME-001', type: 'HOME',       status: 'ACTIVE',       premium:  2_100, coverage: 350_000, holder: SAMPLE_HOLDERS[1]  },
  { number: 'POL-2024-LIFE-001', type: 'LIFE',       status: 'PENDING',      premium:    500, coverage: 500_000, holder: SAMPLE_HOLDERS[2]  },
  { number: 'POL-2024-HLTH-001', type: 'HEALTH',     status: 'ACTIVE',       premium:  3_600, coverage: 100_000, holder: SAMPLE_HOLDERS[3]  },
  { number: 'POL-2024-TRVL-001', type: 'TRAVEL',     status: 'EXPIRED',      premium:    199, coverage:  10_000, holder: SAMPLE_HOLDERS[4]  },
  { number: 'POL-2024-AUTO-002', type: 'AUTO',       status: 'CANCELLED',    premium:    980, coverage:  35_000, holder: SAMPLE_HOLDERS[5]  },
  { number: 'POL-2024-COMM-001', type: 'COMMERCIAL', status: 'UNDER_REVIEW', premium: 12_500, coverage: 2_000_000, holder: SAMPLE_HOLDERS[6] },
  { number: 'POL-2024-HOME-002', type: 'HOME',       status: 'CLAIMED',      premium:  1_800, coverage: 280_000, holder: SAMPLE_HOLDERS[7]  },
  { number: 'POL-2024-LIFE-002', type: 'LIFE',       status: 'ACTIVE',       premium:    750, coverage: 300_000, holder: SAMPLE_HOLDERS[8]  },
  { number: 'POL-2024-HLTH-002', type: 'HEALTH',     status: 'ACTIVE',       premium:  2_400, coverage:  75_000, holder: SAMPLE_HOLDERS[9]  },
  { number: 'POL-2025-AUTO-001', type: 'AUTO',       status: 'PENDING',      premium:  1_100, coverage:  45_000, holder: SAMPLE_HOLDERS[10] },
  { number: 'POL-2025-CYBR-001', type: 'CYBER',      status: 'ACTIVE',       premium:  8_700, coverage: 500_000, holder: SAMPLE_HOLDERS[11] },
];

// ─── Event Templates ────────────────────────────────────────────────────────────

interface EventTemplate {
  eventType:   string;
  category:    EventCategory;
  severity:    'INFO' | 'WARN' | 'ERROR';
  description: (policyNumber: string, holderName: string) => string;
}

const EVENT_TEMPLATES: EventTemplate[] = [
  {
    eventType: 'POLICY_CREATED', category: 'LIFECYCLE', severity: 'INFO',
    description: (p, h) => `Policy ${p} created for policyholder ${h}`,
  },
  {
    eventType: 'POLICY_ACTIVATED', category: 'LIFECYCLE', severity: 'INFO',
    description: (p) => `Policy ${p} activated and coverage commenced`,
  },
  {
    eventType: 'PAYMENT_RECEIVED', category: 'PAYMENT', severity: 'INFO',
    description: (p) => `Annual premium payment received and applied to policy ${p}`,
  },
  {
    eventType: 'PAYMENT_OVERDUE', category: 'PAYMENT', severity: 'WARN',
    description: (p) => `Premium payment for ${p} is 15 days overdue — grace period active`,
  },
  {
    eventType: 'CLAIM_SUBMITTED', category: 'CLAIM', severity: 'WARN',
    description: (p, h) => `New claim submitted by ${h} against policy ${p}`,
  },
  {
    eventType: 'CLAIM_APPROVED', category: 'CLAIM', severity: 'INFO',
    description: (p) => `Claim for policy ${p} approved by adjuster`,
  },
  {
    eventType: 'CLAIM_REJECTED', category: 'CLAIM', severity: 'ERROR',
    description: (p) => `Claim for policy ${p} rejected — insufficient documentation`,
  },
  {
    eventType: 'RENEWAL_INITIATED', category: 'LIFECYCLE', severity: 'INFO',
    description: (p) => `60-day renewal process initiated for policy ${p}`,
  },
  {
    eventType: 'POLICY_CANCELLED', category: 'LIFECYCLE', severity: 'WARN',
    description: (p, h) => `Policy ${p} cancelled at request of ${h}`,
  },
  {
    eventType: 'DOCUMENT_UPLOADED', category: 'DOCUMENT', severity: 'INFO',
    description: (p) => `Supporting documents uploaded for policy ${p}`,
  },
  {
    eventType: 'UNDERWRITING_STARTED', category: 'REVIEW', severity: 'INFO',
    description: (p) => `Underwriting review initiated for policy ${p}`,
  },
  {
    eventType: 'UNDERWRITING_COMPLETED', category: 'REVIEW', severity: 'INFO',
    description: (p) => `Underwriting review completed — policy ${p} approved`,
  },
  {
    eventType: 'BENEFICIARY_UPDATED', category: 'LIFECYCLE', severity: 'INFO',
    description: (p, h) => `Beneficiary information updated by ${h} for policy ${p}`,
  },
  {
    eventType: 'FRAUD_FLAGGED', category: 'REVIEW', severity: 'ERROR',
    description: (p) => `Automated fraud detection flagged an anomaly on policy ${p}`,
  },
  {
    eventType: 'SYSTEM_SYNC', category: 'SYSTEM', severity: 'INFO',
    description: (p) => `Policy ${p} synchronized with downstream core banking system`,
  },
];

const PERFORMERS = [
  'system:automation',
  'agent:underwriter-v2',
  'agent:claims-processor',
  'agent:fraud-detection',
  'agent:renewal-engine',
  'user:supervisor@insure.com',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomBetween(a: Date, b: Date): Date {
  return new Date(a.getTime() + Math.random() * (b.getTime() - a.getTime()));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Seed Function ────────────────────────────────────────────────────────────

export async function seed(): Promise<void> {
  await connectMongo();

  const existing = await PolicyModel.countDocuments();
  if (existing > 0) {
    logger.info('MongoDB already seeded — skipping', { existingPolicies: existing });
    return;
  }

  logger.info('🌱 Seeding MongoDB with test data…');

  const policyDocs = [];
  const eventDocs  = [];

  for (const p of POLICIES) {
    const startDate = randomBetween(new Date('2023-06-01'), new Date('2024-06-01'));
    const endDate   = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);

    const policyId = new (await import('mongoose')).default.Types.ObjectId();

    policyDocs.push({
      _id:            policyId,
      policyNumber:   p.number,
      holderName:     p.holder.name,
      holderEmail:    p.holder.email,
      holderPhone:    p.holder.phone,
      type:           p.type,
      status:         p.status,
      premium:        p.premium,
      coverageAmount: p.coverage,
      startDate,
      endDate,
      metadata: {
        source:      'seed-v1',
        agentBuild:  '2.1.0',
        region:      'us-east-1',
        tags:        [p.type.toLowerCase(), p.status.toLowerCase()],
      },
    });

    // 4-10 events per policy
    const eventCount = 4 + Math.floor(Math.random() * 7);
    let eventTime = new Date(startDate);

    for (let i = 0; i < eventCount; i++) {
      eventTime = randomBetween(eventTime, new Date(Math.min(eventTime.getTime() + 30 * 86_400_000, Date.now())));
      const tpl = pick(EVENT_TEMPLATES);
      const correlationId = uuid(); // ← uniqueIdentifier for trace

      eventDocs.push({
        policyId,
        policyNumber:  p.number,
        eventType:     tpl.eventType,
        category:      tpl.category,
        severity:      tpl.severity,
        description:   tpl.description(p.number, p.holder.name),
        performedBy:   pick(PERFORMERS),
        correlationId,
        requestId:     uuid(),
        createdAt:     new Date(eventTime),
        metadata: {
          correlationId,
          requestId:     uuid(),
          traceId:       uuid(),
          sourceIp:      `10.${randInt(0, 254)}.${randInt(0, 254)}.${randInt(1, 254)}`,
          userAgent:     'PolicyEngine/2.1.0 Node/22',
          environment:   'production',
          lambdaArn:     `arn:aws:lambda:us-east-1:123456789:function:policy-service`,
        },
      });
    }
  }

  await PolicyModel.insertMany(policyDocs);
  await PolicyEventModel.insertMany(eventDocs);

  logger.info('✅ MongoDB seed complete', {
    policies: policyDocs.length,
    events:   eventDocs.length,
  });
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Run as script (only when executed directly, not when imported)
const isMain = process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');
if (isMain) {
  seed()
    .then(() => disconnectMongo())
    .catch(err => { logger.error('Seed failed', { err }); process.exit(1); });
}
