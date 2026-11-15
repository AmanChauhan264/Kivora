import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment files
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().positive().max(65535))
      .default('5000'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters (256 bits) for HMAC-SHA256'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters (256 bits) for HMAC-SHA256'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    CORS_ORIGIN: z
      .string()
      .default('http://localhost:3000,http://localhost:3001,http://localhost:3002'),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // 1. Enforce distinct keys for Access and Refresh token families
    if (data.JWT_ACCESS_SECRET === data.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be distinct secrets',
        path: ['JWT_REFRESH_SECRET'],
      });
    }

    // 2. Reject known development placeholder values in production mode
    if (data.NODE_ENV === 'production') {
      const devPlaceholders = [
        'kivora_dev_',
        'placeholder',
        'secret_do_not_use',
        'default_secret',
        'change_me',
        '1234567890',
      ];

      const isWeakAccess = devPlaceholders.some((term) =>
        data.JWT_ACCESS_SECRET.toLowerCase().includes(term)
      );
      const isWeakRefresh = devPlaceholders.some((term) =>
        data.JWT_REFRESH_SECRET.toLowerCase().includes(term)
      );

      if (isWeakAccess) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'JWT_ACCESS_SECRET contains insecure development placeholder in production environment',
          path: ['JWT_ACCESS_SECRET'],
        });
      }

      if (isWeakRefresh) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'JWT_REFRESH_SECRET contains insecure development placeholder in production environment',
          path: ['JWT_REFRESH_SECRET'],
        });
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formattedErrors = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`\n❌ Invalid Environment Configuration:\n${formattedErrors}\n`);
    throw new Error(`Environment configuration validation failed.`);
  }
  return result.data;
}

export const env = validateEnv();
