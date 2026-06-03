import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeStemEditorFeatureSettings,
  type StemEditorFeatureSettings,
} from '@/config/stemEditorFeatures';
import type { Database } from '@/lib/supabase/types';
import { isMissingPlatformSettingsError } from './StudioTabSettingsStore';

const STEM_EDITOR_FEATURE_SETTING_KEY = 'stem_editor_features';
const STEM_EDITOR_FEATURE_CHANGELOG_PREFIX = 'stem-editor-features-';

export async function readStemEditorFeatureSettings(
  supabase: SupabaseClient<Database>,
): Promise<StemEditorFeatureSettings> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', STEM_EDITOR_FEATURE_SETTING_KEY)
    .maybeSingle();

  if (!error && data?.setting_value) {
    return normalizeStemEditorFeatureSettings(data.setting_value);
  }

  if (error && !isMissingPlatformSettingsError(error)) {
    throw error;
  }

  const fallbackSettings = await readStemEditorFeatureSettingsFallback(supabase);
  if (fallbackSettings) {
    return fallbackSettings;
  }

  return normalizeStemEditorFeatureSettings(null);
}

async function readStemEditorFeatureSettingsFallback(
  supabase: SupabaseClient<Database>,
): Promise<StemEditorFeatureSettings | null> {
  const { data: fallback, error: fallbackError } = await supabase
    .from('config_changelog')
    .select('new_value')
    .like('id', `${STEM_EDITOR_FEATURE_CHANGELOG_PREFIX}%`)
    .order('changed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackError) throw fallbackError;

  return fallback?.new_value
    ? normalizeStemEditorFeatureSettings(fallback.new_value)
    : null;
}

export async function writeStemEditorFeatureSettings(
  supabase: SupabaseClient<Database>,
  value: unknown,
  operator: {
    id: string;
    name: string;
  },
): Promise<StemEditorFeatureSettings> {
  const settings = normalizeStemEditorFeatureSettings(value);
  await writeStemEditorFeatureSettingsFallback(supabase, settings, operator);

  const { error } = await supabase
    .from('platform_settings')
    .upsert({
      setting_key: STEM_EDITOR_FEATURE_SETTING_KEY,
      setting_value: settings as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'setting_key' });

  if (!error || isMissingPlatformSettingsError(error)) {
    return settings;
  }

  throw error;
}

async function writeStemEditorFeatureSettingsFallback(
  supabase: SupabaseClient<Database>,
  settings: StemEditorFeatureSettings,
  operator: {
    id: string;
    name: string;
  },
) {
  const now = new Date().toISOString();
  const { error: fallbackError } = await supabase
    .from('config_changelog')
    .insert({
      id: `${STEM_EDITOR_FEATURE_CHANGELOG_PREFIX}${Date.now()}`,
      operator_id: operator.id,
      operator_name: operator.name,
      config_type: 'cost_rule',
      previous_value: {},
      new_value: settings as unknown as Record<string, unknown>,
      changed_at: now,
      description: 'Update stem editor feature settings',
    });

  if (fallbackError) throw fallbackError;
}
