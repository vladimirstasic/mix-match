import 'dotenv/config';

const required = [
  'DATABASE_URL',
  'ACRCLOUD_HOST',
  'ACRCLOUD_ACCESS_KEY',
  'ACRCLOUD_ACCESS_SECRET',
  'CLERK_SECRET_KEY',
  'CLERK_PUBLISHABLE_KEY',
];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  acrcloud: {
    host: process.env.ACRCLOUD_HOST!,
    accessKey: process.env.ACRCLOUD_ACCESS_KEY!,
    accessSecret: process.env.ACRCLOUD_ACCESS_SECRET!,
  },
  uploadDir: process.env.UPLOAD_DIR || '/tmp/mix-match',
  clerkSecretKey: process.env.CLERK_SECRET_KEY!,
  clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY!,
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  },
  polar: {
    accessToken: process.env.POLAR_ACCESS_TOKEN || '',
    webhookSecret: process.env.POLAR_WEBHOOK_SECRET || '',
    productIdPro: process.env.POLAR_PRODUCT_PRO || '',
    productIdStudio: process.env.POLAR_PRODUCT_STUDIO || '',
    environment: (process.env.POLAR_ENV || 'sandbox') as 'sandbox' | 'production',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  betaMode: process.env.BETA_MODE === 'true',
};
