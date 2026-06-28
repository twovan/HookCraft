import { describe, expect, it } from 'vitest';
import { normalizeStudioTabSettings, STUDIO_TAB_OPTIONS } from './studioTabs';

describe('studio tab settings', () => {
  it('includes simple mode as an admin-toggleable Studio tab', () => {
    expect(STUDIO_TAB_OPTIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'simple', label: '简单模式' }),
      ]),
    );
  });

  it('allows simple mode as the default tab when visible', () => {
    expect(normalizeStudioTabSettings({
      visibleTabs: ['simple'],
      defaultTab: 'simple',
    })).toEqual({
      visibleTabs: ['simple'],
      defaultTab: 'simple',
    });
  });
});
