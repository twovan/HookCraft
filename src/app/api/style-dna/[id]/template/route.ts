import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { StyleDnaRepository } from '@/lib/style-dna/StyleDnaRepository';

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const repo = new StyleDnaRepository(supabaseAdmin);
  const bundle = await repo.getJobBundle(params.id, user.id);
  const latestDna = bundle.styleDnas[0];
  const latestPackage = bundle.promptPackages[0] || null;

  if (!latestDna) {
    return NextResponse.json({ error: 'Style DNA not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const tags = [
    ...stringArray(latestDna.genre),
    ...stringArray(latestDna.suno_friendly_style_tags),
    latestDna.tempo_range,
  ].filter(Boolean).slice(0, 16);

  const template = await repo.createTemplate({
    id: createId('style-template'),
    user_id: user.id,
    style_dna_id: latestDna.id,
    name: String(body.name || latestDna.name || 'Style DNA Template').trim() || 'Style DNA Template',
    description: String(body.description || latestDna.summary || '').trim(),
    style_dna_snapshot: latestDna,
    prompt_package_snapshot: latestPackage,
    tags,
    created_at: now,
    updated_at: now,
  });

  return NextResponse.json({ template });
}
