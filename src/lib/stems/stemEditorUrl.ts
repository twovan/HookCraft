import type { StemSeparationMode } from '@/config/stemEditorFeatures';

export function buildStemEditorUrlWithMode(href: string, mode: StemSeparationMode) {
  const url = new URL(href, 'http://localhost');
  url.searchParams.set('separationMode', mode);
  return `${url.pathname}${url.search}${url.hash}`;
}
