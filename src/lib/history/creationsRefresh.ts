export function buildCreationsFetchKey(userId: string | null | undefined, range: string, page: number) {
  if (!userId) return null;
  return `${userId}:${range}:${page}`;
}
