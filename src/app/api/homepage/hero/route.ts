import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { isMissingPlatformSettingsError } from '../../../../lib/studio/StudioTabSettingsStore';

const DEFAULT_BACKGROUND_IMAGE_URL = '/home-hero-studio.webp';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'homepage_hero')
      .maybeSingle();

    if (error && !isMissingPlatformSettingsError(error)) throw error;

    const settings = data?.setting_value as { backgroundImageUrl?: unknown; overlayEnabled?: unknown } | undefined;
    const backgroundImageUrl = typeof settings?.backgroundImageUrl === 'string' && settings.backgroundImageUrl.trim()
      ? settings.backgroundImageUrl
      : DEFAULT_BACKGROUND_IMAGE_URL;
    const overlayEnabled = typeof settings?.overlayEnabled === 'boolean' ? settings.overlayEnabled : true;

    return NextResponse.json({ backgroundImageUrl, overlayEnabled });
  } catch (error) {
    console.error('[Homepage Hero Settings GET Error]', error);
    return NextResponse.json({ backgroundImageUrl: DEFAULT_BACKGROUND_IMAGE_URL, overlayEnabled: true });
  }
}
