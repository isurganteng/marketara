const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/marketara',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 7),
  dbLog: process.env.DB_LOG === 'true',
} as const;
