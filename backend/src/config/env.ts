import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    CLIENT_URL: z.string().url({ message: 'CLIENT_URL must be a valid URL' }).default('http://localhost:3000'),
    CLIENT_NETWORK_URL: z.string().url({ message: 'CLIENT_NETWORK_URL must be a valid URL' }).optional().or(z.literal('')),
    MONGODB_URI: z.string().min(1, { message: 'MONGODB_URI is required' }).default('mongodb://localhost:27017/linkdrop'),
    STORAGE_PROVIDER: z.enum(['local', 's3', 'r2', 'google-drive']).default('local'),
    UPLOAD_DIR: z.string().default('uploads'),
    TEMP_DIR: z.string().default('temp'),
    MAX_FILE_SIZE: z.coerce.number().int().positive().default(2147483648), // 2GB
    MAX_FILES: z.coerce.number().int().positive().default(100),
    TRANSFER_EXPIRY_MINUTES: z.coerce.number().int().positive().default(10),
    MAX_DOWNLOADS: z.coerce.number().int().positive().default(1),
    CLEANUP_INTERVAL_MINUTES: z.coerce.number().int().positive().default(5),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
    GOOGLE_DRIVE_CLIENT_ID: z.string().optional(),
    GOOGLE_DRIVE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_DRIVE_REFRESH_TOKEN: z.string().optional(),
    GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),

    // WebRTC Configuration
    WEBRTC_ENABLED: z.coerce.boolean().default(true),
    WEBRTC_CHUNK_SIZE: z.coerce.number().int().positive().default(16384),
    WEBRTC_CONNECTION_TIMEOUT: z.coerce.number().int().positive().default(30000),
    WEBRTC_STUN_URL: z.string().default('stun:stun.l.google.com:19302'),
    WEBRTC_TURN_URL: z.string().optional(),
    WEBRTC_TURN_USERNAME: z.string().optional(),
    WEBRTC_TURN_CREDENTIAL: z.string().optional(),
    AUTO_VERIFY: z.coerce.boolean().default(true),

    // Bulk Transfer Configuration
    BULK_TRANSFER_ENABLED: z.coerce.boolean().default(true),
    BULK_CODE_LENGTH: z.coerce.number().int().positive().default(9),
    BULK_HEARTBEAT_INTERVAL: z.coerce.number().int().positive().default(5000),
    BULK_HOST_TIMEOUT: z.coerce.number().int().positive().default(15000),
    MAX_BULK_PARTICIPANTS: z.coerce.number().int().positive().default(50),
    MAX_BULK_FILE_SIZE: z.coerce.number().int().positive().default(2147483648),
    MAX_BULK_TOTAL_SIZE: z.coerce.number().int().positive().default(10737418240),
    MAX_DISPLAY_NAME_LENGTH: z.coerce.number().int().positive().default(40),
  })
  .refine(
    (data) => {
      if (data.STORAGE_PROVIDER === 'google-drive') {
        return Boolean(
          data.GOOGLE_DRIVE_CLIENT_ID &&
            data.GOOGLE_DRIVE_CLIENT_SECRET &&
            data.GOOGLE_DRIVE_REFRESH_TOKEN &&
            data.GOOGLE_DRIVE_FOLDER_ID
        );
      }
      return true;
    },
    {
      message:
        'Google Drive credentials (GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID) are required when STORAGE_PROVIDER is "google-drive"',
      path: ['STORAGE_PROVIDER'],
    }
  );

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ FATAL: Invalid Environment Configuration');
    console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();
export type EnvConfig = z.infer<typeof envSchema>;
