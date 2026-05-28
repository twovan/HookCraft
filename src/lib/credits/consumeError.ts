import type { ConsumeResult } from '@/types/credits';

export function getConsumeCreditsErrorMessage(error: ConsumeResult['error']) {
  if (error === 'no_credits') {
    return 'Credits 余额不足，请先充值或升级套餐';
  }

  if (error === 'concurrent_limit') {
    return 'Credits 扣减冲突，请稍后重试';
  }

  return 'Credits 扣减失败，请重试';
}
