import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../common/utils/logger';

const MONGOOSE_OPTIONS: mongoose.ConnectOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);

    mongoose.connection.on('connected', () => {
      logger.info({ msg: 'MongoDB connected', uri: env.MONGODB_URI.replace(/\/\/.*@/, '//***@') });
    });

    mongoose.connection.on('error', (err) => {
      logger.error({ msg: 'MongoDB connection error', error: err });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn({ msg: 'MongoDB disconnected' });
    });

    await mongoose.connect(env.MONGODB_URI, MONGOOSE_OPTIONS);
  } catch (error) {
    logger.error({ msg: 'Failed to connect to MongoDB', error });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info({ msg: 'MongoDB disconnected gracefully' });
}

export function getDatabaseStatus(): 'connected' | 'disconnected' | 'connecting' | 'disconnecting' {
  const states: Record<number, 'disconnected' | 'connected' | 'connecting' | 'disconnecting'> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] ?? 'disconnected';
}
