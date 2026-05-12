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

    // Get accepted invitations as active producers
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: producers, count, error } = await supabaseAdmin
      .from('producer_invitations')
      .select('*', { count: 'exact' })
      .eq('status', 'accepted')
      .order('accepted_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    // Get all invitations for the invitations table
    const { data: invitations, count: invCount } = await supabaseAdmin
      .from('producer_invitations')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(50);

    // Stats
    const { count: activeCount } = await supabaseAdmin
      .from('producer_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'accepted');

    const { count: pendingCount } = await supabaseAdmin
      .from('producer_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Calculate average revenue share
    const allAccepted = producers || [];
    const avgShare = allAccepted.length > 0
      ? allAccepted.reduce((sum: number, p: any) => sum + (p.revenue_share || 0.7), 0) / allAccepted.length
      : 0.7;

    return NextResponse.json({
      data: (producers || []).map((p: any) => ({
        id: p.id,
        name: p.invitee_name,
        email: p.invitee_email,
        expertiseTags: p.expertise_tags || [],
        revenueShare: p.revenue_share,
        status: 'active',
        templateCount: 0,
        totalSales: 0,
        totalEarnings: 0,
        acceptedAt: p.accepted_at,
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
      total: count || 0,
      invitationsTotal: invCount || 0,
      page,
      pageSize,
      stats: {
        activeProducers: activeCount || 0,
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
