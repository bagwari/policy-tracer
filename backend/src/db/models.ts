import mongoose, { Schema } from 'mongoose';
import type { IPolicyDocument, IPolicyEventDocument } from '../types/index.js';

// ─── Policy Schema ──────────────────────────────────────────────────────────────

const PolicySchema = new Schema<IPolicyDocument>(
  {
    policyNumber: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
      uppercase: true,
      trim:     true,
    },
    holderName:   { type: String, required: true, trim: true },
    holderEmail:  { type: String, required: true, lowercase: true, trim: true },
    holderPhone:  { type: String },
    type: {
      type:     String,
      required: true,
      enum:     ['AUTO', 'HOME', 'LIFE', 'HEALTH', 'TRAVEL', 'COMMERCIAL', 'CYBER'],
    },
    status: {
      type:     String,
      required: true,
      enum:     ['ACTIVE', 'PENDING', 'EXPIRED', 'CANCELLED', 'UNDER_REVIEW', 'CLAIMED'],
      index:    true,
    },
    premium:        { type: Number, required: true, min: 0 },
    coverageAmount: { type: Number, required: true, min: 0 },
    startDate:      { type: Date, required: true },
    endDate:        { type: Date, required: true },
    metadata:       { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps:  true,
    versionKey:  false,
    collection:  'policies',
  },
);

PolicySchema.index({ holderName: 'text', holderEmail: 'text' });
PolicySchema.index({ status: 1, type: 1 });
PolicySchema.index({ endDate: 1 });

// ─── Policy Event Schema ────────────────────────────────────────────────────────

const PolicyEventSchema = new Schema<IPolicyEventDocument>(
  {
    policyId: {
      type:     Schema.Types.ObjectId,
      ref:      'Policy',
      required: true,
      index:    true,
    },
    policyNumber: { type: String, required: true, index: true },
    eventType:    { type: String, required: true, index: true },
    category: {
      type: String,
      enum: ['LIFECYCLE', 'PAYMENT', 'CLAIM', 'REVIEW', 'DOCUMENT', 'SYSTEM'],
      required: true,
    },
    description:   { type: String, required: true },
    performedBy:   { type: String, required: true },
    correlationId: { type: String, required: true, index: true },  // ← uniqueIdentifier
    requestId:     { type: String, required: true },
    severity: {
      type:    String,
      enum:    ['INFO', 'WARN', 'ERROR'],
      default: 'INFO',
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,  // we manage createdAt manually
    versionKey: false,
    collection: 'policy_events',
  },
);

PolicyEventSchema.index({ correlationId: 1, createdAt: 1 });
PolicyEventSchema.index({ policyId: 1, createdAt: -1 });
PolicyEventSchema.index({ policyNumber: 1, eventType: 1 });

export const PolicyModel      = mongoose.model<IPolicyDocument>('Policy', PolicySchema);
export const PolicyEventModel = mongoose.model<IPolicyEventDocument>('PolicyEvent', PolicyEventSchema);
