import { z } from 'zod';
import { EU_ALLERGENS } from './allergens';
import { ACTIVITY_LEVELS, GOALS, SEXES } from './targets';

export const DIET_PATTERNS = ['omnivore', 'flexitarian', 'pescatarian', 'vegetarian', 'vegan', 'other'] as const;
export const COOKING_TIMES = ['under_15', '15_30', '30_60', 'over_60'] as const;
export const BUDGETS = ['tight', 'moderate', 'comfortable', 'prefer_not_say'] as const;
export const USAGE_MODES = ['photo', 'barcode', 'voice', 'plan', 'recipes', 'coach'] as const;

export type DietPattern = (typeof DIET_PATTERNS)[number];
export type UsageMode = (typeof USAGE_MODES)[number];

/** Consent types recorded in `user_consents` (append-only log). */
export const CONSENT_TYPES = ['health_data', 'ai_processing', 'photo_storage', 'analytics'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];
export const CONSENT_VERSION = '2026-11-v1';

export const OnboardingAnswersSchema = z.object({
  goals: z.array(z.enum(GOALS)).min(1),
  primaryGoal: z.enum(GOALS),
  ageYears: z.number().int().min(13).max(110).nullable(),
  sex: z.enum(SEXES).nullable(),
  heightCm: z.number().min(120).max(230).nullable(),
  weightKg: z.number().min(30).max(300).nullable(),
  targetWeightKg: z.number().min(30).max(300).nullable(),
  activity: z.enum(ACTIVITY_LEVELS).nullable(),
  weeklyWorkouts: z.number().int().min(0).max(14).nullable(),
  diet: z.enum(DIET_PATTERNS).nullable(),
  allergies: z.array(z.enum(EU_ALLERGENS)),
  likes: z.array(z.string().max(40)).max(20),
  dislikes: z.array(z.string().max(40)).max(20),
  mealsPerDay: z.number().int().min(1).max(8).nullable(),
  cookingTime: z.enum(COOKING_TIMES).nullable(),
  budget: z.enum(BUDGETS).nullable(),
  country: z.string().length(2),
  region: z.string().max(60).nullable(),
  stores: z.array(z.string().max(40)).max(10),
  usage: z.array(z.enum(USAGE_MODES)),
  notifications: z.boolean(),
  healthDataConsent: z.boolean(),
});
export type OnboardingAnswers = z.infer<typeof OnboardingAnswersSchema>;

export const EMPTY_ONBOARDING: OnboardingAnswers = {
  goals: [],
  primaryGoal: 'eat_balanced',
  ageYears: null,
  sex: null,
  heightCm: null,
  weightKg: null,
  targetWeightKg: null,
  activity: null,
  weeklyWorkouts: null,
  diet: null,
  allergies: [],
  likes: [],
  dislikes: [],
  mealsPerDay: null,
  cookingTime: null,
  budget: null,
  country: 'ES',
  region: null,
  stores: [],
  usage: [],
  notifications: false,
  healthDataConsent: false,
};

/** Supermarkets offered as optional preferences in Spain (no integration implied). */
export const SPAIN_STORES = ['mercadona', 'lidl', 'carrefour', 'aldi', 'dia', 'alcampo', 'eroski', 'consum'] as const;
