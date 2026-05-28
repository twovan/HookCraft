import StudioPageClient from './StudioPageClient';
import { DEFAULT_STUDIO_TAB_SETTINGS } from '@/config/studioTabs';
import { isSupabaseAdminConfigured, supabaseAdmin } from '@/lib/supabase/server';
import { readStudioTabSettings } from '@/lib/studio/StudioTabSettingsStore';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  noStore();

  const initialStudioTabSettings = isSupabaseAdminConfigured()
    ? await readStudioTabSettings(supabaseAdmin).catch(() => DEFAULT_STUDIO_TAB_SETTINGS)
    : DEFAULT_STUDIO_TAB_SETTINGS;

  return <StudioPageClient initialStudioTabSettings={initialStudioTabSettings} />;
}
