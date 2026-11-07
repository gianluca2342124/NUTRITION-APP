import 'server-only';
import { z } from 'zod';

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));
const int = (def: number) => z.coerce.number().int().positive().default(def);
const effort = z.enum(['low', 'medium', 'high', 'xhigh', 'max']);

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optional,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional,
  SUPABASE_SERVICE_ROLE_KEY: optional,
  PUBLIC_SITE_URL: z.string().default('http://localhost:3000'),
  API_ALLOWED_ORIGINS: z.string().default('http://localhost:8081,http://localhost:19006'),

  ANTHROPIC_API_KEY: optional,
  AI_MODEL_VISION: z.string().default('claude-opus-5-5'),
  AI_MODEL_EXTRACTION: z.string().default('claude-opus-5-5'),
  AI_MODEL_CLASSIFICATION: z.string().default('claude-opus-5-5'),
  AI_MODEL_CONVERSATION: z.string().default('claude-opus-5-5'),
  AI_EFFORT_VISION: effort.default('medium'),
  AI_EFFORT_EXTRACTION: effort.default('medium'),
  AI_EFFORT_CLASSIFICATION: effort.default('low'),
  AI_EFFORT_CONVERSATION: effort.default('medium'),
  AI_FALLBACKS: z.enum(['default', 'off']).default('default'),

  TRANSCRIPTION_API_URL: optional,
  TRANSCRIPTION_API_KEY: optional,
  TRANSCRIPTION_MODEL: optional,

  AI_DAILY_LIMIT_MEAL_PHOTO: int(25),
  AI_DAILY_LIMIT_LABEL: int(25),
  AI_DAILY_LIMIT_PARSE_MEAL: int(60),
  AI_DAILY_LIMIT_TRANSCRIBE: int(60),

  OFF_USER_AGENT: z.string().default('NutritionPlatform/0.1 (development)'),
  OFF_CACHE_DAYS: int(30),
});

export type ServerEnv = z.infer<typeof EnvSchema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (!cached) cached = EnvSchema.parse(process.env);
  return cached;
}

export function supabaseConfigured(): boolean {
  const e = env();
  return Boolean(e.NEXT_PUBLIC_SUPABASE_URL && e.NEXT_PUBLIC_SUPABASE_ANON_KEY && e.SUPABASE_SERVICE_ROLE_KEY);
}
