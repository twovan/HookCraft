import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { normalizeStudioTabSettings } from '@/config/studioTabs';
import { supabaseAdmin } from '@/lib/supabase/server';
import { readStudioTabSettings } from '@/lib/studio/StudioTabSettingsStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    noStore();

    return NextResponse.json(await readStudioTabSettings(supabaseAdmin));
  } catch (error) {
    console.error('[Studio Settings GET Error]', error);
    return NextResponse.json(normalizeStudioTabSettings(null));
  }
}
