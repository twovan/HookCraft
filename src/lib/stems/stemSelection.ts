export function resolveVisibleStemSelection(visibleStemTypes: string[], currentStemType: string | null | undefined) {
  if (visibleStemTypes.length === 0) return null;
  if (currentStemType && visibleStemTypes.includes(currentStemType)) return currentStemType;
  return visibleStemTypes[0] ?? null;
}
