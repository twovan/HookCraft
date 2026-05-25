import { describe, expect, it } from 'vitest';
import { buildStemExportPreflight } from './stemExportPreflight';

describe('buildStemExportPreflight', () => {
  const tracks = [
    { type: 'vocals', label: '人声', loaded: true, muted: false, solo: false, volume: 1 },
    { type: 'drums', label: '鼓组', loaded: false, muted: false, solo: false, volume: 0.8 },
    { type: 'bass', label: '贝斯', loaded: true, muted: true, solo: false, volume: 1 },
    { type: 'fx', label: '效果', loaded: false, muted: false, solo: false, volume: 1, knownEmpty: true },
  ];

  it('previews the current mix by excluding muted and empty tracks', () => {
    expect(buildStemExportPreflight({
      tracks,
      mode: 'current-mix',
      hasSoloTrack: false,
      waitForAll: false,
    })).toMatchObject({
      plannedTypes: ['vocals', 'drums'],
      exportableTypes: ['vocals'],
      missingTypes: ['drums'],
      skippedTypes: ['bass'],
      emptyTypes: ['fx'],
      canExport: true,
      disabledReason: null,
      summary: '将导出 1/2 条，等待 1 条缓存',
    });
  });

  it('waits for planned tracks when strict readiness is selected', () => {
    expect(buildStemExportPreflight({
      tracks: [
        { type: 'vocals', label: '人声', loaded: false, muted: false, solo: false, volume: 1 },
      ],
      mode: 'current-mix',
      hasSoloTrack: false,
      waitForAll: true,
    })).toMatchObject({
      plannedTypes: ['vocals'],
      exportableTypes: [],
      missingTypes: ['vocals'],
      canExport: true,
      disabledReason: null,
    });
  });

  it('uses only solo tracks when solo export is selected', () => {
    expect(buildStemExportPreflight({
      tracks: [
        { type: 'vocals', label: '人声', loaded: true, muted: false, solo: true, volume: 1 },
        { type: 'drums', label: '鼓组', loaded: true, muted: false, solo: false, volume: 1 },
      ],
      mode: 'solo-only',
      hasSoloTrack: true,
      waitForAll: false,
    })).toMatchObject({
      plannedTypes: ['vocals'],
      exportableTypes: ['vocals'],
      skippedTypes: ['drums'],
      canExport: true,
      disabledReason: null,
    });
  });

  it('explains when solo export has no selected solo track', () => {
    expect(buildStemExportPreflight({
      tracks: [
        { type: 'vocals', label: '人声', loaded: true, muted: false, solo: false, volume: 1 },
      ],
      mode: 'solo-only',
      hasSoloTrack: false,
      waitForAll: false,
    })).toMatchObject({
      canExport: false,
      disabledReason: '请先选择至少一条独奏轨道。',
    });
  });

  it('explains when ready-only export has no loaded selected track yet', () => {
    expect(buildStemExportPreflight({
      tracks: [
        { type: 'vocals', label: '人声', loaded: false, muted: false, solo: false, volume: 1 },
      ],
      mode: 'current-mix',
      hasSoloTrack: false,
      waitForAll: false,
    })).toMatchObject({
      canExport: false,
      disabledReason: '还没有已加载的可导出轨道。',
    });
  });
});
