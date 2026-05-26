// GET /api/licenses - 获取授权信息

import { NextRequest, NextResponse } from 'next/server';
import { LicenseService } from '../../../lib/license/LicenseService';
import type { MembershipTier } from '../../../types/membership';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userTier = searchParams.get('tier') as MembershipTier | null;

    if (!userTier) {
      return NextResponse.json(
        { error: '缺少会员等级参数' },
        { status: 400 }
      );
    }

    const validTiers: MembershipTier[] = ['free', 'pro', 'business'];
    if (!validTiers.includes(userTier)) {
      return NextResponse.json(
        { error: '无效的会员等级' },
        { status: 400 }
      );
    }

    const licenseService = new LicenseService();
    const level = licenseService.getLicenseLevel(userTier);
    const description = licenseService.getLicenseDescription(level);
    const canCommercial = licenseService.canCommercialUse(userTier);

    return NextResponse.json({
      tier: userTier,
      level,
      description,
      canCommercialUse: canCommercial,
    });
  } catch (error: any) {
    console.error('获取授权信息失败:', error);
    return NextResponse.json(
      { error: '获取授权信息失败，请稍后重试' },
      { status: 500 }
    );
  }
}
