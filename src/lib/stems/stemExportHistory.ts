export type StemExportRecordScope = 'mix' | 'stem';

export interface StemExportRecord {
  id: string;
  scope: StemExportRecordScope;
  label: string;
  trackCount: number;
  fileType: string;
  finishedAt: string;
}

export interface StemExportRecordInput {
  scope: StemExportRecordScope;
  label: string;
  trackCount: number;
  fileType: string;
  finishedAt?: string | Date;
}

export interface StemExportRecordView {
  title: string;
  detail: string;
}

function normalizeFinishedAt(value: string | Date | undefined) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return value;
  return new Date().toISOString();
}

export function createStemExportRecord(input: StemExportRecordInput): StemExportRecord {
  const finishedAt = normalizeFinishedAt(input.finishedAt);
  return {
    id: `${input.scope}-${finishedAt}-${input.label}`,
    scope: input.scope,
    label: input.label,
    trackCount: Math.max(0, Math.round(input.trackCount)),
    fileType: input.fileType.toUpperCase(),
    finishedAt,
  };
}

export function appendStemExportRecord(records: StemExportRecord[], record: StemExportRecord, limit = 3) {
  return [record, ...records].slice(0, Math.max(1, limit));
}

export function formatStemExportRecord(record: StemExportRecord, locale = 'zh-CN'): StemExportRecordView {
  const finishedAt = new Date(record.finishedAt);
  const time = Number.isNaN(finishedAt.getTime())
    ? '--:--:--'
    : finishedAt.toLocaleTimeString(locale, { hour12: false });

  return {
    title: record.scope === 'stem'
      ? `${record.label}单轨 ${record.fileType}`
      : `${record.label} ${record.fileType}`,
    detail: `${time} · ${record.trackCount} 条轨道`,
  };
}
