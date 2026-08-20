import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

class DatabaseService {
  private static instance: DatabaseService;
  private isConnected = false;

  private constructor() {
    this.setupListeners();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private setupListeners(): void {
    mongoose.connection.on('connected', () => {
      this.isConnected = true;
      logger.info('🍃 MongoDB connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      this.isConnected = false;
      logger.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      logger.warn('⚠️ MongoDB connection disconnected. Attempting to reconnect...');
    });
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('🍃 MongoDB already connected.');
      return;
    }

    try {
      mongoose.set('strictQuery', true);
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        autoIndex: env.NODE_ENV !== 'production',
      });
    } catch (error) {
      logger.error('❌ Failed to connect to MongoDB on startup:', error);
      // In development or local runs without MongoDB, allow process to warn or handle
      if (env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    try {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('🍃 MongoDB disconnected gracefully.');
    } catch (error) {
      logger.error('❌ Error during MongoDB disconnection:', error);
    }
  }

  public isReady(): boolean {
    return mongoose.connection.readyState === 1;
  }
}

export const databaseService = DatabaseService.getInstance();
