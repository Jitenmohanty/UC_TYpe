import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('/api/v1'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  DEFAULT_ALLOCATION_RADIUS_KM: z.coerce.number().default(5),
  LOCATION_MAX_AGE_MINUTES: z.coerce.number().default(30),
  ASSIGNMENT_OFFER_TIMEOUT_SECONDS: z.coerce.number().default(60),
  MAX_ALLOCATION_ATTEMPTS: z.coerce.number().default(3),
  ALLOCATION_RETRY_DELAYS_SECONDS: z.string().default('30,60,120'),

  RANKING_WEIGHT_DISTANCE: z.coerce.number().default(0.4),
  RANKING_WEIGHT_AVAILABILITY: z.coerce.number().default(0.2),
  RANKING_WEIGHT_RATING: z.coerce.number().default(0.15),
  RANKING_WEIGHT_ACCEPTANCE_RATE: z.coerce.number().default(0.1),
  RANKING_WEIGHT_COMPLETION_RATE: z.coerce.number().default(0.1),
  RANKING_WEIGHT_WORKLOAD: z.coerce.number().default(0.05),

  CUSTOMER_CANCEL_FREE_MINUTES: z.coerce.number().default(30),
  MAX_BARBER_CANCELLATIONS_PER_MONTH: z.coerce.number().default(3),

  RATE_LIMIT_LOGIN_PER_HOUR: z.coerce.number().default(100),
  RATE_LIMIT_BOOKING_PER_HOUR: z.coerce.number().default(20),
  RATE_LIMIT_LOCATION_UPDATE_PER_MINUTE: z.coerce.number().default(10),

  CORS_ORIGIN: z.string().default('http://localhost:3001'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Twilio SMS configuration
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;

export type Env = z.infer<typeof envSchema>;

// Helper: parse allocation retry delays from comma-separated string
export const getAllocationRetryDelays = (): number[] =>
  env.ALLOCATION_RETRY_DELAYS_SECONDS.split(',').map((s) => parseInt(s.trim(), 10));

// Helper: ranking weights as object
export const getRankingWeights = () => ({
  distance: env.RANKING_WEIGHT_DISTANCE,
  availability: env.RANKING_WEIGHT_AVAILABILITY,
  rating: env.RANKING_WEIGHT_RATING,
  acceptanceRate: env.RANKING_WEIGHT_ACCEPTANCE_RATE,
  completionRate: env.RANKING_WEIGHT_COMPLETION_RATE,
  workload: env.RANKING_WEIGHT_WORKLOAD,
});
