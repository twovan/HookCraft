// GET /api/credits - 获取 Credits 信息（增强版）
// POST /api/credits - 消耗 Credits（优先扣除）

import { NextRequest, NextResponse } from 'next/server';
import { CreditService } from '../../../lib/credits/CreditService';
import { supabaseAdmin } from '../../../lib/supabase/server';
import { getAuthUser } from '../../../lib/supabase/auth-helpers';
import type { CreditOperationType } from '../../../types/credits';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      // Return default free tier credits when auth cookie isn't synced
      return NextResponse.json({
        used: 0,
        total: 0,
        remaining: 0,
        tier: 'free',
        monthlyUsed: 0,
        monthlyTotal: 0,
        monthlyRemaining: 0,
        purchasedBalance: 0,
        totalAvailable: 0,
      });
    }

    const creditService = new CreditService(supabaseAdmin);
    
    try {
      const credits = await creditService.getCreditsEnhanced(user.id);
      
      return NextResponse.json({
        userId: credits.userId,
        tier: credits.tier,
        monthlyUsed: credits.monthlyUsed,
        monthlyTotal: credits.monthlyTotal,
        monthlyRemaining: credits.monthlyRemaining,
        purchasedBalance: credits.purchasedBalance,
        totalAvailable: credits.totalAvailable,
        periodStart: credits.periodStart,
        periodEnd: credits.periodEnd,
        used: credits.monthlyUsed,
        total: credits.monthlyTotal,
        remaining: credits.totalAvailable,
      });
    } catch (serviceError: any) {
      // Log the actual error for debugging
      console.error('Credits service error:', serviceError?.message || serviceError);
      
      // Try a direct query as fallback
      const { data: directCredits } = await supabaseAdmin
        .from('credits')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const { data: directPurchased } = await supabaseAdmin
        .from('purchased_credits')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: directMembership } = await supabaseAdmin
        .from('memberships')
        .select('tier')
        .eq('user_id', user.id)
        .maybeSingle();

      const tier = directMembership?.tier || 'free';
      const tierCredits = tier === 'business' ? 300 : tier === 'pro' ? 100 : 0;
      const monthlyTotal = tierCredits;
      const monthlyUsed = directCredits?.used || 0;
      const monthlyRemaining = Math.max(0, monthlyTotal - monthlyUsed);
      
      // If purchased_credits has no data, calculate from payments table
      let purchasedBalance = directPurchased?.balance || 0;
      if (purchasedBalance === 0) {
        // Map: pack price (in cents) -> credits amount
        const packPriceMap: Record<number, number> = {
          9900: 50,    // ¥99 -> 50 credits
          7900: 50,    // ¥79 (discount) -> 50 credits
          17900: 100,  // ¥179 -> 100 credits
          14300: 100,  // ¥143 (discount) -> 100 credits
          32900: 200,  // ¥329 -> 200 credits
          26300: 200,  // ¥263 (discount) -> 200 credits
        };
        const { data: payments } = await supabaseAdmin
          .from('payments')
          .select('amount')
          .eq('user_id', user.id)
          .eq('status', 'completed');
        
        let totalCreditsFromPayments = 0;
        for (const p of payments || []) {
          const credits = packPriceMap[p.amount];
          if (credits) totalCreditsFromPayments += credits;
        }
        if (totalCreditsFromPayments > 0) {
          purchasedBalance = totalCreditsFromPayments;
          // Sync back to purchased_credits table
          await supabaseAdmin
            .from('purchased_credits')
            .upsert({
              user_id: user.id,
              balance: totalCreditsFromPayments,
              total_purchased: totalCreditsFromPayments,
              version: 0,
            } as any, { onConflict: 'user_id' });
        }
      }

      return NextResponse.json({
        userId: user.id,
        tier,
        monthlyUsed,
        monthlyTotal,
        monthlyRemaining,
        purchasedBalance,
        totalAvailable: monthlyRemaining + purchasedBalance,
        used: monthlyUsed,
        total: monthlyTotal,
        remaining: monthlyRemaining + purchasedBalance,
      });
    }
  } catch (error: any) {
    console.error('获取 Credits 信息失败:', error);
    return NextResponse.json(
      { error: '获取额度信息失败' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { operations } = body as { operations: CreditOperationType[] };

    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const creditService = new CreditService(supabaseAdmin);
    const result = await creditService.consumeCredits(user.id, operations);

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        no_credits: 'Credits 不足，请购买充值包或升级会员',
        concurrent_limit: '操作冲突，请稍后重试',
      };
      return NextResponse.json(
        { error: errorMessages[result.error ?? ''] ?? '消耗失败' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: result.success,
      consumed: result.consumed,
      monthlyCost: result.monthlyCost ?? 0,
      purchasedCost: result.purchasedCost ?? 0,
      monthlyRemaining: result.monthlyRemaining ?? 0,
      purchasedRemaining: result.purchasedRemaining ?? 0,
      totalAvailable: (result.monthlyRemaining ?? 0) + (result.purchasedRemaining ?? 0),
      // Backward-compatible field
      remaining: (result.monthlyRemaining ?? 0) + (result.purchasedRemaining ?? 0),
    });
  } catch (error: any) {
    console.error('消耗 Credits 失败:', error);
    return NextResponse.json(
      { error: '操作失败，请稍后重试' },
      { status: 500 }
    );
  }
}
