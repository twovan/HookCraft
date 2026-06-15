export const DEFAULT_HOME_HERO_BACKGROUND_URL = '/home-hero-studio.webp';
export const HOMEPAGE_HERO_SETTING_KEY = 'homepage_hero';
export const HOMEPAGE_HERO_HISTORY_LIMIT = 8;

export interface HomepageHeroSettings {
  backgroundImageUrl: string;
  history: string[];
  overlayEnabled: boolean;
}

export function normalizeHomepageHeroSettings(value: Partial<HomepageHeroSettings> | undefined): HomepageHeroSettings {
  const backgroundImageUrl = typeof value?.backgroundImageUrl === 'string' && value.backgroundImageUrl.trim()
    ? value.backgroundImageUrl
    : DEFAULT_HOME_HERO_BACKGROUND_URL;
  const history = Array.from(new Set([
    backgroundImageUrl,
    ...(Array.isArray(value?.history) ? value.history : []),
    DEFAULT_HOME_HERO_BACKGROUND_URL,
  ].filter((item): item is string => typeof item === 'string' && item.trim().length > 0))).slice(0, HOMEPAGE_HERO_HISTORY_LIMIT);

  return {
    backgroundImageUrl,
    history,
    overlayEnabled: typeof value?.overlayEnabled === 'boolean' ? value.overlayEnabled : true,
  };
}

export function updateHomepageHeroHistory(
  settings: HomepageHeroSettings,
  backgroundImageUrl: string,
): HomepageHeroSettings {
  const nextUrl = backgroundImageUrl.trim() || DEFAULT_HOME_HERO_BACKGROUND_URL;
  return {
    ...settings,
    backgroundImageUrl: nextUrl,
    history: Array.from(new Set([nextUrl, ...settings.history, DEFAULT_HOME_HERO_BACKGROUND_URL]))
      .slice(0, HOMEPAGE_HERO_HISTORY_LIMIT),
  };
}
