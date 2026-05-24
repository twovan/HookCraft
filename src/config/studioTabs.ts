export const STUDIO_TAB_OPTIONS = [
  { id: 'template', label: '模板生成' },
  { id: 'upload', label: '翻唱模式' },
  { id: 'advanced', label: '参考编曲模式' },
  { id: 'templateArrangement', label: '模板编曲' },
  { id: 'templateInstrumental', label: '模板伴奏' },
] as const;

export type StudioTab = (typeof STUDIO_TAB_OPTIONS)[number]['id'];

export interface StudioTabSettings {
  visibleTabs: StudioTab[];
  defaultTab: StudioTab;
}

const STUDIO_TAB_IDS = new Set<StudioTab>(STUDIO_TAB_OPTIONS.map((tab) => tab.id));

export const DEFAULT_STUDIO_TAB_SETTINGS: StudioTabSettings = {
  visibleTabs: STUDIO_TAB_OPTIONS.map((tab) => tab.id),
  defaultTab: 'templateArrangement',
};

export function isStudioTab(value: unknown): value is StudioTab {
  return typeof value === 'string' && STUDIO_TAB_IDS.has(value as StudioTab);
}

export function normalizeStudioTabSettings(value: unknown): StudioTabSettings {
  const input = value && typeof value === 'object'
    ? value as Partial<{ visibleTabs: unknown; defaultTab: unknown }>
    : {};
  const requestedVisibleTabs = Array.isArray(input.visibleTabs) ? input.visibleTabs : null;
  const visibleTabs = requestedVisibleTabs
    ? STUDIO_TAB_OPTIONS
      .map((tab) => tab.id)
      .filter((tab) => requestedVisibleTabs.includes(tab))
    : DEFAULT_STUDIO_TAB_SETTINGS.visibleTabs;
  const safeVisibleTabs = visibleTabs.length > 0
    ? visibleTabs
    : DEFAULT_STUDIO_TAB_SETTINGS.visibleTabs;
  const defaultTab = isStudioTab(input.defaultTab) && safeVisibleTabs.includes(input.defaultTab)
    ? input.defaultTab
    : safeVisibleTabs.includes(DEFAULT_STUDIO_TAB_SETTINGS.defaultTab)
      ? DEFAULT_STUDIO_TAB_SETTINGS.defaultTab
      : safeVisibleTabs[0];

  return {
    visibleTabs: safeVisibleTabs,
    defaultTab,
  };
}
