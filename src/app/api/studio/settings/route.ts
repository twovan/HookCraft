import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { normalizeStudioTabSettings } from '@/config/studioTabs';
import { isSupabaseAdminConfigured, supabaseAdmin } from '@/lib/supabase/server';
import { readStudioTabSettings } from '@/lib/studio/StudioTabSettingsStore';
import { readStemEditorFeatureSettings } from '@/lib/studio/StemEditorFeatureSettingsStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    noStore();

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(normalizeStudioTabSettings(null));
    }

    const [studioTabs, stemEditorFeatures] = await Promise.all([
      readStudioTabSettings(supabaseAdmin),
      readStemEditorFeatureSettings(supabaseAdmin),
    ]);

    return NextResponse.json({
      ...studioTabs,
      studioTabs,
      stemEditorFeatures,
    });
  } catch {
    return NextResponse.json(normalizeStudioTabSettings(null));
  }
}
