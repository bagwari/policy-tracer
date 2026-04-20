import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPolicy extends Document {
  policyNumber:   string;
  holderName:     string;
  holderEmail:    string;
  holderPhone?:   string;
  type:           string;
  status:         string;
  premium:        number;
  coverageAmount: number;
  startDate:      Date;
  endDate:        Date;
  metadata:       Record<string, unknown>;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface IPolicyEvent extends Document {
  policyId:      Types.ObjectId;
  policyNumber:  string;
  eventType:     string;
  category:      string;
  description:   string;
  performedBy:   string;
  correlationId: string;
  requestId:     string;
  severity:      string;
  metadata:      Record<string, unknown>;
  createdAt:     Date;
}

const PolicySchema = new Schema<IPolicy>(
  {
    policyNumber:   { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    holderName:     { type: String, required: true, trim: true },
    holderEmail:    { type: String, required: true, lowercase: true, trim: true },
    holderPhone:    { type: String },
    type:           { type: String, required: true, enum: ['AUTO', 'HOME', 'LIFE', 'HEALTH', 'TRAVEL', 'COMMERCIAL', 'CYBER'] },
    status:         { type: String, required: true, enum: ['ACTIVE', 'PENDING', 'EXPIRED', 'CANCELLED', 'UNDER_REVIEW', 'CLAIMED'], index: true },
    premium:        { type: Number, required: true, min: 0 },
    coverageAmount: { type: Number, required: true, min: 0 },
    startDate:      { type: Date, required: true },
    endDate:        { type: Date, required: true },
    metadata:       { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false, collection: 'policies' },
);

const PolicyEventSchema = new Schema<IPolicyEvent>(
  {
    policyId:      { type: Schema.Types.ObjectId, ref: 'Policy', required: true, index: true },
    policyNumber:  { type: String, required: true, index: true },
    eventType:     { type: String, required: true, index: true },
    category:      { type: String, enum: ['LIFECYCLE', 'PAYMENT', 'CLAIM', 'REVIEW', 'DOCUMENT', 'SYSTEM'], required: true },
    description:   { type: String, required: true },
    performedBy:   { type: String, required: true },
    correlationId: { type: String, required: true, index: true },
    requestId:     { type: String, required: true },
    severity:      { type: String, enum: ['INFO', 'WARN', 'ERROR'], default: 'INFO' },
    metadata:      { type: Schema.Types.Mixed, default: {} },
    createdAt:     { type: Date, default: Date.now, index: true },
  },
  { timestamps: false, versionKey: false, collection: 'policy_events' },
);

PolicyEventSchema.index({ correlationId: 1, createdAt: 1 });
PolicyEventSchema.index({ policyId: 1, createdAt: -1 });
PolicyEventSchema.index({ policyNumber: 1, eventType: 1 });

// Avoid model re-registration on warm Lambda invocations
export const PolicyModel = mongoose.models['Policy'] as mongoose.Model<IPolicy>
  ?? mongoose.model<IPolicy>('Policy', PolicySchema);

export const PolicyEventModel = mongoose.models['PolicyEvent'] as mongoose.Model<IPolicyEvent>
  ?? mongoose.model<IPolicyEvent>('PolicyEvent', PolicyEventSchema);
