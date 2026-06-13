import type { ProducerCollaboratorWorks } from '@/types/producer';

export function parseCollaboratorWorksInput(input: string): ProducerCollaboratorWorks[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawName, ...rawWorksParts] = line.split(/[:：]/);
      const name = rawName.trim();
      const works = rawWorksParts
        .join('：')
        .split(/[,，、]/)
        .map((work) => work.trim())
        .filter(Boolean);

      return { name, works };
    })
    .filter((item) => item.name && item.works.length > 0);
}

export function formatCollaboratorWorksInput(items: ProducerCollaboratorWorks[] | undefined): string {
  return (items || [])
    .filter((item) => item.name && item.works.length > 0)
    .map((item) => `${item.name}：${item.works.join('、')}`)
    .join('\n');
}

export function normalizeCollaboratorWorks(items: unknown): ProducerCollaboratorWorks[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as { name?: unknown; works?: unknown };
      if (typeof candidate.name !== 'string' || !Array.isArray(candidate.works)) return null;

      const name = candidate.name.trim();
      const works = candidate.works
        .filter((work): work is string => typeof work === 'string')
        .map((work) => work.trim())
        .filter(Boolean);

      return name && works.length > 0 ? { name, works } : null;
    })
    .filter((item): item is ProducerCollaboratorWorks => Boolean(item));
}
