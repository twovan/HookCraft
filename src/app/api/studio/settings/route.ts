import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { normalizeStudioTabSettings } from '@/config/studioTabs';
import { isSupabaseAdminConfigured, supabaseAdmin } from '@/lib/supabase/server';
import { readStudioTabSettings } from '@/lib/studio/StudioTabSettingsStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    noStore();

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(normalizeStudioTabSettings(null));
    }

    return NextResponse.json(await readStudioTabSettings(supabaseAdmin));
  } catch {
    return NextResponse.json(normalizeStudioTabSettings(null));
  }
}
