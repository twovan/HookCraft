import { supabaseAdmin } from '@/lib/supabase/server';
import { isMissingPlatformSettingsError } from '@/lib/studio/StudioTabSettingsStore';
import { normalizeContentPagesSettings, type ContentPagesSettings } from './contentPages';

export const CONTENT_PAGES_SETTING_KEY = 'content_pages';

export async function readContentPagesSettings(): Promise<ContentPagesSettings> {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', CONTENT_PAGES_SETTING_KEY)
      .maybeSingle();

    if (error && !isMissingPlatformSettingsError(error)) throw error;

    return normalizeContentPagesSettings(data?.setting_value);
  } catch (error) {
    console.error('[Content Pages Settings Read Error]', error);
    return normalizeContentPagesSettings(undefined);
  }
}
