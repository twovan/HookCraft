import { describe, expect, it } from 'vitest';
import {
  appendStemExportRecord,
  buildStemExportHistoryStorageKey,
  clearStemExportRecords,
  createStemExportRecord,
  formatStemExportRecord,
  parseStemExportRecords,
  serializeStemExportRecords,
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

  it('uses a stable storage key per stem job', () => {
    expect(buildStemExportHistoryStorageKey('job-123')).toBe('hookcraft-stem-export-history:job-123');
    expect(buildStemExportHistoryStorageKey('')).toBe('hookcraft-stem-export-history:draft');
  });

  it('serializes and parses valid records while dropping invalid entries', () => {
    const record = createStemExportRecord({
      scope: 'mix',
      label: 'mix',
      trackCount: 2,
      fileType: 'WAV',
      finishedAt: '2026-05-25T10:30:04.000Z',
    });

    const serialized = JSON.stringify([
      record,
      { id: 'bad', scope: 'mix', label: '', trackCount: 1, fileType: 'WAV', finishedAt: record.finishedAt },
    ]);

    expect(parseStemExportRecords(serialized)).toEqual([record]);
    expect(serializeStemExportRecords([record])).toBe(JSON.stringify([record]));
  });

  it('returns an empty history when stored data is malformed', () => {
    expect(parseStemExportRecords('{bad json')).toEqual([]);
    expect(parseStemExportRecords(null)).toEqual([]);
  });

  it('clears export records', () => {
    const record = createStemExportRecord({
      scope: 'mix',
      label: '当前混音',
      trackCount: 2,
      fileType: 'WAV',
      finishedAt: '2026-05-25T10:30:04.000Z',
    });

    expect(clearStemExportRecords([record])).toEqual([]);
  });
});
