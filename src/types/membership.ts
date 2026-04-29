// types/membership.ts - 会员系统核心类型定义

/** 会员等级 */
export type MembershipTier = 'free' | 'pro' | 'business';

/** 计费周期 */
export type BillingCycle = 'monthly' | 'yearly';

/** 支付渠道 */
export type PaymentProvider = 'stripe' | 'paypal' | 'wechat' | 'alipay';

/** 授权等级 */
export type LicenseLevel = 'personal' | 'commercial' | 'full_commercial';

/** 功能权限键 */
export type FeatureKey =
  | 'preview'                     // Preview 预览试听
  | 'full_demo'                   // 完整 Demo 生成
  | 'base_singer'                 // 基础歌手声模
  | 'premium_singer'              // 高级歌手声模
  | 'free_template'               // 免费模板
  | 'paid_template'               // 收费模板
  | 'reference_audio_upload'      // 上传参考音频
  | 'multi_track_editor'          // 多轨编辑器
  | 'effects_processor'           // 效果器
  | 'ai_mixing'                   // AI 辅助混音
  | 'ai_mastering'                // AI 母带处理
  | 'export_wav'                  // WAV 导出
  | 'export_midi'                 // MIDI 导出
  | 'export_stems'                // 分轨导出
  | 'export_mp3_320'              // 高品质 MP3 导出
  | 'priority_queue'              // 优先队列
  | 'commercial_use'              // 个人商用权限
  | 'full_commercial_use'         // 完整商用权限
  | 'credits_pack_discount'       // Credits 充值包折扣
  | 'image_input';                // 图片灵感输入（Lyria 3 多模态）

/** 订阅状态 */
export type SubscriptionStatus =
  | 'active'          // 正常激活
  | 'expiring'        // 即将到期（7 天内）
  | 'expired'         // 已过期
  | 'cancelled'       // 已取消（仍在当前周期内）
  | 'grace_period';   // 宽限期（降级后 30 天内）

/** 会员信息 */
export interface MembershipInfo {
  userId: string;
  tier: MembershipTier;
  billingCycle: BillingCycle | null;       // Free 用户为 null
  startDate: Date | null;
  expiresAt: Date | null;                 // Free 用户为 null
  autoRenew: boolean;
  paymentProvider: PaymentProvider | null;
  subscriptionId: string | null;          // 外部支付平台的订阅 ID
  status: SubscriptionStatus;
}
