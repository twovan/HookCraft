import { describe, expect, it } from 'vitest';
import {
  buildDawEditorLayoutMetrics,
  resolveDawTrackHeight,
} from './stemEditorDawLayout';

describe('stem editor DAW layout metrics', () => {
  it('keeps the loaded editor in a full viewport DAW shell', () => {
    const metrics = buildDawEditorLayoutMetrics({
      compactTransport: true,
      inspectorCollapsed: false,
      viewportHeight: 900,
    });

    expect(metrics.sideRailWidth).toBe(0);
    expect(metrics.headerHeight).toBe(72);
    expect(metrics.inspectorWidth).toBe(300);
    expect(metrics.bottomTransportHeight).toBe(86);
    expect(metrics.stageMinHeight).toBe(900);
  });

  it('uses denser track heights that still leave room for controls', () => {
    expect(resolveDawTrackHeight({ advanced: false, density: 'compact' })).toBe(54);
    expect(resolveDawTrackHeight({ advanced: false, density: 'comfortable' })).toBe(66);
    expect(resolveDawTrackHeight({ advanced: true, density: 'compact' })).toBe(82);
    expect(resolveDawTrackHeight({ advanced: true, density: 'comfortable' })).toBe(104);
  });

  it('keeps selected tracks the same height as unselected tracks', () => {
    expect(resolveDawTrackHeight({ advanced: false, density: 'compact', selected: true })).toBe(54);
    expect(resolveDawTrackHeight({ advanced: false, density: 'comfortable', selected: true })).toBe(66);
    expect(resolveDawTrackHeight({ advanced: true, density: 'compact', selected: true })).toBe(82);
    expect(resolveDawTrackHeight({ advanced: true, density: 'comfortable', selected: true })).toBe(104);
  });
});
