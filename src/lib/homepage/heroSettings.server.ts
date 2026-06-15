import { supabaseAdmin } from '@/lib/supabase/server';
import { isMissingPlatformSettingsError } from '@/lib/studio/StudioTabSettingsStore';
import {
  HOMEPAGE_HERO_SETTING_KEY,
  type HomepageHeroSettings,
  normalizeHomepageHeroSettings,
} from './heroSettings';

export async function readHomepageHeroSettings(): Promise<HomepageHeroSettings> {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', HOMEPAGE_HERO_SETTING_KEY)
      .maybeSingle();

    if (error && !isMissingPlatformSettingsError(error)) throw error;

    return normalizeHomepageHeroSettings(data?.setting_value as Partial<HomepageHeroSettings> | undefined);
  } catch (error) {
    console.error('[Homepage Hero Settings Read Error]', error);
    return normalizeHomepageHeroSettings(undefined);
  }
}
