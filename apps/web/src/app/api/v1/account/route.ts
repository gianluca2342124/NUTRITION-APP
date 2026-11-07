import { handler, json } from '@/server/http';
import { requireUser, serviceClient } from '@/server/supabase';

const PHOTO_BUCKETS = ['meal-photos', 'label-photos'] as const;

/**
 * Deletes the account. Private photos are removed first; every user-owned row
 * is removed by ON DELETE CASCADE; contributions are kept anonymised
 * (user_id set to null) as described in the privacy policy.
 */
export const DELETE = handler(async (request: Request) => {
  const { user } = await requireUser(request);
  const db = serviceClient();
  for (const bucket of PHOTO_BUCKETS) {
    for (;;) {
      const { data, error } = await db.storage.from(bucket).list(user.id, { limit: 100 });
      if (error) throw error;
      if (!data?.length) break;
      const { error: removeError } = await db.storage.from(bucket).remove(data.map((f) => `${user.id}/${f.name}`));
      if (removeError) throw removeError;
      if (data.length < 100) break;
    }
  }
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) throw error;
  return json({ deleted: true });
});
