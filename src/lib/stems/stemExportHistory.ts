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

const STEM_EXPORT_HISTORY_STORAGE_PREFIX = 'hookcraft-stem-export-history';

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

export function clearStemExportRecords(_records: StemExportRecord[] = []): StemExportRecord[] {
  return [];
}

export function buildStemExportHistoryStorageKey(projectId: string | undefined | null) {
  const normalizedProjectId = typeof projectId === 'string' && projectId.trim()
    ? projectId.trim()
    : 'draft';
  return `${STEM_EXPORT_HISTORY_STORAGE_PREFIX}:${normalizedProjectId}`;
}

function isStemExportRecord(value: unknown): value is StemExportRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<StemExportRecord>;
  return typeof record.id === 'string'
    && record.id.length > 0
    && (record.scope === 'mix' || record.scope === 'stem')
    && typeof record.label === 'string'
    && record.label.length > 0
    && typeof record.trackCount === 'number'
    && Number.isFinite(record.trackCount)
    && typeof record.fileType === 'string'
    && record.fileType.length > 0
    && typeof record.finishedAt === 'string'
    && record.finishedAt.length > 0;
}

export function parseStemExportRecords(value: string | null | undefined, limit = 3): StemExportRecord[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStemExportRecord).slice(0, Math.max(1, limit));
  } catch {
    return [];
  }
}

export function serializeStemExportRecords(records: StemExportRecord[]) {
  return JSON.stringify(records.filter(isStemExportRecord));
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
