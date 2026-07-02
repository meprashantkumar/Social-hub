import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  // "lax" for same-site (dev, or app+api on the same registrable domain).
  // "none" (which forces Secure) is required if the SPA and API are on
  // genuinely different sites in production.
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),

  // 32 bytes as 64 hex chars — used to AES-256-GCM encrypt stored OAuth tokens.
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "ENCRYPTION_KEY must be 64 hex chars (32 bytes)"),
  // Signs the short-lived OAuth `state` param (CSRF + carries workspace/user).
  OAUTH_STATE_SECRET: z.string().min(16, "OAUTH_STATE_SECRET must be at least 16 characters"),
  // Public base URL of THIS API, used to build the OAuth redirect_uri.
  API_BASE_URL: z.string().url().default("http://localhost:4000"),

  // Platform OAuth apps (optional — a platform is "not configured" until set).
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),

  // Instagram (Meta) — "API setup with Instagram business login". App-specific id/secret.
  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),

  // LinkedIn — a LinkedIn Developer app with "Sign In with LinkedIn using OpenID
  // Connect" + "Share on LinkedIn" products. Client id/secret.
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  // Monthly version (YYYYMM) sent to LinkedIn's versioned Posts/Images API. Bump
  // this if LinkedIn deprecates the version (they support each for ~1 year).
  LINKEDIN_API_VERSION: z.string().regex(/^\d{6}$/, "LINKEDIN_API_VERSION must be YYYYMM").default("202506"),

  // X (Twitter) — an X Developer app (OAuth 2.0, confidential/"Web App" client
  // with a client secret). Client id/secret.
  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),

  // Cloudinary (media uploads). Optional — uploads are "not configured" until set.
  // cloud_name + api_key are public; the api_secret signs uploads and must stay server-side.
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Scheduler poll interval (seconds) for auto-publishing due posts. 0 disables it.
  SCHEDULER_INTERVAL_SECONDS: z.coerce.number().int().min(0).default(30),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
