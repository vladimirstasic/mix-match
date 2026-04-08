import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3001"),
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  acrcloud: {
    host: process.env.ACRCLOUD_HOST!,
    accessKey: process.env.ACRCLOUD_ACCESS_KEY!,
    accessSecret: process.env.ACRCLOUD_ACCESS_SECRET!,
  },
  uploadDir: process.env.UPLOAD_DIR || "/tmp/mix-detective",
};
