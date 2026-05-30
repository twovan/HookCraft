type StemLike = {
  type: string;
};

export function normalizeDeletedStemTypes(value: unknown, stems: StemLike[]) {
  const knownTypes = new Set(stems.map((stem) => stem.type));
  if (!Array.isArray(value)) return [];

  return value
    .map((type) => String(type || '').trim())
    .filter((type, index, values) => knownTypes.has(type) && values.indexOf(type) === index);
}

export function addDeletedStemType(value: unknown, type: string, stems: StemLike[]) {
  const normalized = normalizeDeletedStemTypes(value, stems);
  if (!stems.some((stem) => stem.type === type) || normalized.includes(type)) {
    return normalized;
  }
  return [...normalized, type];
}

export function filterDeletedStems<TStem extends StemLike>(stems: TStem[], deletedTypes: string[]) {
  const deletedTypeSet = new Set(deletedTypes);
  return stems.filter((stem) => !deletedTypeSet.has(stem.type));
}
