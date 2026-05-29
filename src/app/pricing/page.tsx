import { TIER_CONFIGS } from '@/config/tierConfig';
import { getPublicCreditsPacks } from '@/config/creditsPack';
import { AdminConfigService } from '@/lib/admin/AdminConfigService';
import { mergeTierConfigsWithAdminConfig } from '@/lib/pricing/publicPricingConfig';
import { isSupabaseAdminConfigured, supabaseAdmin } from '@/lib/supabase/server';
import PricingContent from './PricingContent';

export const metadata = {
  title: 'HookCraft - 会员定价',
  description: '选择适合你的 AI 音乐创作方案',
};

export const dynamic = 'force-dynamic';

async function loadPricingConfig() {
  if (!isSupabaseAdminConfigured()) return null;

  try {
    const service = new AdminConfigService(supabaseAdmin);
    return await service.getCurrentConfig();
  } catch {
    return null;
  }
}

export default async function PricingPage() {
  const adminConfig = await loadPricingConfig();
  const tiers = mergeTierConfigsWithAdminConfig(Object.values(TIER_CONFIGS), adminConfig);
  const creditsPacks = getPublicCreditsPacks(adminConfig?.creditsPacks);

  return (
    <main className="pricing-page">
      <section className="pricing-hero">
        <div className="pricing-hero-inner">
          <div>
            <h1>选择你的创作方案</h1>
            <p>从免费预览到商业交付，为 AI 音乐 Demo、分轨编辑和版权授权选择合适额度。</p>
          </div>
          <div className="pricing-meter" aria-hidden="true">
            {Array.from({ length: 28 }).map((_, i) => (
              <span key={i} style={{ height: `${24 + ((i * 17) % 68)}%` }} />
            ))}
          </div>
        </div>
      </section>

      <PricingContent tiers={tiers} initialCreditsPacks={creditsPacks} />

      <style>{`
        .pricing-page {
          min-height: 100vh;
          background:
            linear-gradient(rgba(255,255,255,.032) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px),
            radial-gradient(circle at 10% 10%, rgba(206, 255, 53, 0.11), transparent 320px),
            radial-gradient(circle at 90% 16%, rgba(82, 214, 198, 0.09), transparent 340px),
            radial-gradient(circle at 42% 0%, rgba(255, 90, 61, 0.08), transparent 360px),
            var(--hc-bg);
          background-size: 72px 72px, 72px 72px, auto, auto, auto, auto;
          color: var(--hc-text);
          padding-bottom: 78px;
        }

        .pricing-hero {
          padding: 74px 22px 38px;
        }

        .pricing-hero-inner {
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          align-items: end;
          gap: 28px;
        }

        .pricing-hero h1 {
          margin: 0 0 14px;
          max-width: 760px;
          font-family: var(--hc-font-display);
          font-size: clamp(42px, 7vw, 78px);
          line-height: .94;
          letter-spacing: 0;
          text-wrap: balance;
        }

        .pricing-hero p {
          margin: 0;
          max-width: 680px;
          color: var(--hc-muted);
          font-size: 17px;
          line-height: 1.8;
          text-wrap: pretty;
        }

        .pricing-meter {
          height: 118px;
          display: grid;
          grid-template-columns: repeat(28, 1fr);
          align-items: end;
          gap: 4px;
          padding: 16px;
          border: 1px solid rgba(255,255,255,.14);
          border-radius: var(--hc-radius-lg);
          background:
            linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.02)),
            rgba(24, 26, 34, 0.78);
          box-shadow: var(--hc-shadow), inset 0 1px 0 rgba(255,255,255,.08);
        }

        .pricing-meter span {
          min-height: 8px;
          border-radius: 999px 999px 0 0;
          background: linear-gradient(180deg, var(--hc-lime), rgba(82, 214, 198, 0.55));
        }

        @media (max-width: 820px) {
          .pricing-hero {
            padding-top: 42px;
          }

          .pricing-hero-inner {
            grid-template-columns: 1fr;
          }

          .pricing-meter {
            height: 82px;
          }
        }
      `}</style>
    </main>
  );
}
