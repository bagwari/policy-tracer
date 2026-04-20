import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';

export async function connectMongo(): Promise<void> {
  if (connectionState === 'connected') return;

  connectionState = 'connecting';
  logger.info('Connecting to MongoDB…', { uri: config.MONGO_URI.replace(/\/\/.*@/, '//***@') });

  mongoose.connection.on('connected', () => {
    connectionState = 'connected';
    logger.info('✅ MongoDB connected');
  });

  mongoose.connection.on('disconnected', () => {
    connectionState = 'disconnected';
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    connectionState = 'error';
    logger.error('MongoDB error', { error: err.message });
  });

  await mongoose.connect(config.MONGO_URI, {
    serverSelectionTimeoutMS: 8_000,
    connectTimeoutMS:         10_000,
    socketTimeoutMS:          45_000,
    maxPoolSize:              10,
    retryWrites:              true,
  });
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
  connectionState = 'disconnected';
  logger.info('MongoDB disconnected gracefully');
}

export async function checkMongoHealth(): Promise<'ok' | 'error'> {
  try {
    if (mongoose.connection.readyState !== 1) return 'error';
    await mongoose.connection.db?.admin().ping();
    return 'ok';
  } catch {
    return 'error';
  }
}
