import { handler, json } from '@/server/http';
import { requireUser, userClient } from '@/server/supabase';

const TABLES = [
  'profiles',
  'user_preferences',
  'health_profiles',
  'user_consents',
  'daily_targets',
  'weight_logs',
  'favorites',
  'contributions',
  'ai_usage',
  'activity_events',
  'streak_daily_activity',
  'user_streaks',
  'user_achievements',
] as const;

/** GDPR data export (art. 15/20): everything the user owns, as JSON. */
export const GET = handler(async (request: Request) => {
  const { user, token } = await requireUser(request);
  const db = userClient(token);
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), userId: user.id, email: user.email ?? null };
  for (const table of TABLES) {
    const { data, error } = await db.from(table).select('*');
    if (error) throw error;
    out[table] = data;
  }
  const { data: entries, error } = await db.from('food_entries').select('*, food_entry_items(*)').order('consumed_on');
  if (error) throw error;
  out.food_entries = entries;
  return json(out, {
    headers: { 'Content-Disposition': `attachment; filename="export-${new Date().toISOString().slice(0, 10)}.json"` },
  });
});
