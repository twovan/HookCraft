import { NextResponse } from 'next/server';
import { readHomepageHeroSettings } from '@/lib/homepage/heroSettings.server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await readHomepageHeroSettings());
}
