import { NextRequest, NextResponse } from 'next/server';
import { CreditService } from '../../../../lib/credits/CreditService';
import { supabaseAdmin } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${cronSecret}`;
}

function getChinaDay(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    day: 'numeric',
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === 'day')?.value ?? 0);
}

function shouldRunMonthlyReset(req: NextRequest, now: Date) {
  const force = req.nextUrl.searchParams.get('force') === 'true';
  return force || getChinaDay(now) === 1;
}

async function resetExpiredCredits(creditService: CreditService, now: Date) {
  const { data: rows, error } = await supabaseAdmin
    .from('credits')
    .select('user_id')
    .lte('period_end', now.toISOString());

  if (error) throw error;

  let resetCount = 0;
  const failures: Array<{ userId: string; error: string }> = [];

  for (const row of rows ?? []) {
    try {
      await creditService.resetMonthlyCredits(row.user_id);
      resetCount += 1;
    } catch (error) {
      failures.push({
        userId: row.user_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { resetCount, failures };
}

async function resetPreviewCounts(creditService: CreditService) {
  const { data: rows, error } = await supabaseAdmin
    .from('preview_counts')
    .select('user_id');

  if (error) throw error;

  let resetCount = 0;
  const failures: Array<{ userId: string; error: string }> = [];

  for (const row of rows ?? []) {
    try {
      await creditService.resetMonthlyPreviews(row.user_id);
      resetCount += 1;
    } catch (error) {
      failures.push({
        userId: row.user_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { resetCount, failures };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  if (!shouldRunMonthlyReset(req, now)) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'not_month_start_in_china',
    });
  }

  try {
    const creditService = new CreditService(supabaseAdmin);
    const credits = await resetExpiredCredits(creditService, now);
    const previews = await resetPreviewCounts(creditService);
    const failures = [...credits.failures, ...previews.failures];

    return NextResponse.json({
      success: failures.length === 0,
      resetCredits: credits.resetCount,
      resetPreviews: previews.resetCount,
      failures,
    }, { status: failures.length === 0 ? 200 : 207 });
  } catch (error) {
    console.error('Monthly credits reset failed:', error);
    return NextResponse.json(
      { error: 'Monthly credits reset failed' },
      { status: 500 }
    );
  }
}
