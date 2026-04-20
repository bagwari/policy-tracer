import mongoose from 'mongoose';

// Reuse connection across warm Lambda invocations
let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState >= 1) return; // already connected/connecting

  if (!connectionPromise) {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI environment variable is required');

    connectionPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5_000,
      socketTimeoutMS:          10_000,
      maxPoolSize:              3,   // small pool for Lambda
    });
  }

  await connectionPromise;
}
