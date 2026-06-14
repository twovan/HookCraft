import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { isMissingPlatformSettingsError } from '../../../../lib/studio/StudioTabSettingsStore';

const DEFAULT_BACKGROUND_IMAGE_URL = '/home-hero-studio.webp';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'homepage_hero')
      .maybeSingle();

    if (error && !isMissingPlatformSettingsError(error)) throw error;

    const settings = data?.setting_value as { backgroundImageUrl?: unknown } | undefined;
    const backgroundImageUrl = typeof settings?.backgroundImageUrl === 'string' && settings.backgroundImageUrl.trim()
      ? settings.backgroundImageUrl
      : DEFAULT_BACKGROUND_IMAGE_URL;

    return NextResponse.json({ backgroundImageUrl });
  } catch (error) {
    console.error('[Homepage Hero Settings GET Error]', error);
    return NextResponse.json({ backgroundImageUrl: DEFAULT_BACKGROUND_IMAGE_URL });
  }
}
