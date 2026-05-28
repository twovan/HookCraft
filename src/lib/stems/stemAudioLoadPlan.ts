export interface StemAudioLoadPlanItem {
  type: string;
  knownEmpty?: boolean;
  loaded?: boolean;
}

export function selectStemTypesForAudioLoad(items: StemAudioLoadPlanItem[]) {
  return items
    .filter((item) => !item.knownEmpty && !item.loaded)
    .map((item) => item.type);
}
