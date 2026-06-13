import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';

/**
 * GET /api/admin/producers
 * 获取制作人列表和统计
 */
export async function GET(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    // Get active producer profiles first. Older flows only used accepted invitations,
    // but templates belong to rows in `producers`.
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: producerProfiles, count: profileCount, error: profileError } = await supabaseAdmin
      .from('producers')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (profileError) throw profileError;

    // Get all invitations for the invitations table
    const { data: invitations, count: invCount } = await supabaseAdmin
      .from('producer_invitations')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(50);

    // Stats
    const { count: activeProfileCount } = await supabaseAdmin
      .from('producers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { count: pendingCount } = await supabaseAdmin
      .from('producer_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Calculate average revenue share
    const allProfiles = producerProfiles || [];
    const avgShare = allProfiles.length > 0
      ? allProfiles.reduce((sum: number, p: any) => sum + (Number(p.revenue_share) || 0.7), 0) / allProfiles.length
      : 0.7;

    // Calculate template count per producer
    const producerIds = allProfiles.map((p: any) => p.id);
    let templateStats: Record<string, number> = {};
    if (producerIds.length > 0) {
      const { data: templateCounts } = await supabaseAdmin
        .from('templates')
        .select('producer_id')
        .in('producer_id', producerIds);

      if (templateCounts) {
        for (const t of templateCounts) {
          if (t.producer_id) {
            templateStats[t.producer_id] = (templateStats[t.producer_id] || 0) + 1;
          }
        }
      }
    }

    return NextResponse.json({
      data: allProfiles.map((p: any) => ({
        id: p.id,
        name: p.display_name,
        email: '',
        avatarUrl: p.avatar_url,
        bio: p.bio || '',
        expertiseTags: p.style_tags || [],
        representativeWorks: p.representative_works || [],
        useCases: p.use_cases || [],
        collaborators: p.collaborators || [],
        collaboratorWorks: p.collaborator_works || [],
        revenueShare: Number(p.revenue_share) || 0.7,
        status: 'active',
        templateCount: templateStats[p.id] || 0,
        totalSales: 0,
        totalEarnings: 0,
        acceptedAt: p.joined_at || p.created_at,
      })),
      invitations: (invitations || []).map((inv: any) => ({
        id: inv.id,
        inviteeName: inv.invitee_name,
        inviteeEmail: inv.invitee_email,
        expertiseTags: inv.expertise_tags || [],
        revenueShare: inv.revenue_share,
        expiryDays: inv.expiry_days,
        status: inv.status,
        createdAt: inv.created_at,
      })),
      total: profileCount || 0,
      invitationsTotal: invCount || 0,
      page,
      pageSize,
      stats: {
        activeProducers: activeProfileCount || 0,
        pendingInvitations: pendingCount || 0,
        totalEarnings: 0,
        avgRevenueShare: Math.round(avgShare * 100),
      },
    });
  } catch (error) {
    console.error('[Admin Producers GET Error]', error);
    return NextResponse.json({ error: '获取制作人列表失败' }, { status: 500 });
  }
}
