import { describe, expect, it } from 'vitest';
import {
  appendStemExportRecord,
  createStemExportRecord,
  formatStemExportRecord,
  type StemExportRecord,
} from './stemExportHistory';

describe('stem export history', () => {
  it('formats a mix export record with time and track count', () => {
    const record = createStemExportRecord({
      scope: 'mix',
      label: '当前混音',
      trackCount: 7,
      fileType: 'WAV',
      finishedAt: '2026-05-25T10:30:04.000Z',
    });

    expect(formatStemExportRecord(record, 'zh-CN')).toMatchObject({
      title: '当前混音 WAV',
      detail: '18:30:04 · 7 条轨道',
    });
  });

  it('formats a single stem export record', () => {
    const record = createStemExportRecord({
      scope: 'stem',
      label: '人声',
      trackCount: 1,
      fileType: 'WAV',
      finishedAt: '2026-05-25T10:30:04.000Z',
    });

    expect(formatStemExportRecord(record, 'zh-CN')).toMatchObject({
      title: '人声单轨 WAV',
      detail: '18:30:04 · 1 条轨道',
    });
  });

  it('keeps only the latest records', () => {
    const records = ['a', 'b', 'c', 'd'].reduce<StemExportRecord[]>((current, label) => appendStemExportRecord(current, createStemExportRecord({
      scope: 'mix',
      label,
      trackCount: 1,
      fileType: 'WAV',
      finishedAt: `2026-05-25T10:30:0${label.charCodeAt(0) - 97}.000Z`,
    }), 3), []);

    expect(records.map((record) => record.label)).toEqual(['d', 'c', 'b']);
  });
});
