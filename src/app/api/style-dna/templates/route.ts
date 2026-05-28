import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { StyleDnaRepository } from '@/lib/style-dna/StyleDnaRepository';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });

  const repo = new StyleDnaRepository(supabaseAdmin);
  const templates = await repo.listTemplates(user.id);
  return NextResponse.json({ templates });
}
