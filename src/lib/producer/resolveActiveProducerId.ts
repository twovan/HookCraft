import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';

export async function resolveActiveProducerId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('producers')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;

  return data?.id ?? null;
}
