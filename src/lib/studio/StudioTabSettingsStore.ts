import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeStudioTabSettings,
  type StudioTabSettings,
} from '@/config/studioTabs';
import type { Database } from '@/lib/supabase/types';

const PLATFORM_SETTINGS_TABLE = 'platform_settings';
const STUDIO_TAB_SETTING_KEY = 'studio_tabs';
const STUDIO_TAB_CHANGELOG_PREFIX = 'studio-tabs-setting-';

export function isMissingPlatformSettingsError(error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : '';

  return message.includes(`public.${PLATFORM_SETTINGS_TABLE}`) ||
    message.includes(`relation "${PLATFORM_SETTINGS_TABLE}" does not exist`);
}

export async function readStudioTabSettings(
  supabase: SupabaseClient<Database>,
): Promise<StudioTabSettings> {
  const fallbackSettings = await readStudioTabSettingsFallback(supabase);
  if (fallbackSettings) {
    return fallbackSettings;
  }

  const { data, error } = await supabase
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', STUDIO_TAB_SETTING_KEY)
    .maybeSingle();

  if (!error && data?.setting_value) {
    return normalizeStudioTabSettings(data?.setting_value);
  }

  if (error && !isMissingPlatformSettingsError(error)) {
    throw error;
  }

  return normalizeStudioTabSettings(null);
}

async function readStudioTabSettingsFallback(
  supabase: SupabaseClient<Database>,
): Promise<StudioTabSettings | null> {
  const { data: fallback, error: fallbackError } = await supabase
    .from('config_changelog')
    .select('new_value')
    .like('id', `${STUDIO_TAB_CHANGELOG_PREFIX}%`)
    .order('changed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackError) throw fallbackError;

  return fallback?.new_value
    ? normalizeStudioTabSettings(fallback.new_value)
    : null;
}

export async function writeStudioTabSettings(
  supabase: SupabaseClient<Database>,
  value: unknown,
  operator: {
    id: string;
    name: string;
  },
): Promise<StudioTabSettings> {
  const settings = normalizeStudioTabSettings(value);
  await writeStudioTabSettingsFallback(supabase, settings, operator);

  const { error } = await supabase
    .from('platform_settings')
    .upsert({
      setting_key: STUDIO_TAB_SETTING_KEY,
      setting_value: settings as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'setting_key' });

  if (!error || isMissingPlatformSettingsError(error)) {
    return settings;
  }

  throw error;
}

async function writeStudioTabSettingsFallback(
  supabase: SupabaseClient<Database>,
  settings: StudioTabSettings,
  operator: {
    id: string;
    name: string;
  },
) {
  const now = new Date().toISOString();
  const { error: fallbackError } = await supabase
    .from('config_changelog')
    .insert({
      id: `${STUDIO_TAB_CHANGELOG_PREFIX}${Date.now()}`,
      operator_id: operator.id,
      operator_name: operator.name,
      config_type: 'cost_rule',
      previous_value: {},
      new_value: settings as unknown as Record<string, unknown>,
      changed_at: now,
      description: 'Update Studio tab settings',
    });

  if (fallbackError) throw fallbackError;
}
