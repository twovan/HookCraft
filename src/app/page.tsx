import HomePageClient from '@/components/home/HomePageClient';
import { readHomepageHeroSettings } from '@/lib/homepage/heroSettings.server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const heroSettings = await readHomepageHeroSettings();

  return (
    <HomePageClient
      initialHeroBackgroundUrl={heroSettings.backgroundImageUrl}
      initialHeroOverlayEnabled={heroSettings.overlayEnabled}
    />
  );
}
