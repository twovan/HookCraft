import HomePageClient from '@/components/home/HomePageClient';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isMissingPlatformSettingsError } from '@/lib/studio/StudioTabSettingsStore';

const DEFAULT_HOME_HERO_BACKGROUND_URL = '/home-hero-studio.webp';

export const dynamic = 'force-dynamic';

async function readHomepageHeroSettings() {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'homepage_hero')
      .maybeSingle();

    if (error && !isMissingPlatformSettingsError(error)) throw error;

    const settings = data?.setting_value as { backgroundImageUrl?: unknown; overlayEnabled?: unknown } | undefined;
    return {
      backgroundImageUrl: typeof settings?.backgroundImageUrl === 'string' && settings.backgroundImageUrl.trim()
        ? settings.backgroundImageUrl
        : DEFAULT_HOME_HERO_BACKGROUND_URL,
      overlayEnabled: typeof settings?.overlayEnabled === 'boolean' ? settings.overlayEnabled : true,
    };
  } catch (error) {
    console.error('[Homepage Hero Settings SSR Error]', error);
    return {
      backgroundImageUrl: DEFAULT_HOME_HERO_BACKGROUND_URL,
      overlayEnabled: true,
    };
  }
}

export default async function HomePage() {
  const heroSettings = await readHomepageHeroSettings();

  return (
    <HomePageClient
      initialHeroBackgroundUrl={heroSettings.backgroundImageUrl}
      initialHeroOverlayEnabled={heroSettings.overlayEnabled}
    />
  );
}
