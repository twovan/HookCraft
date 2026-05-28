export type DawTrackDensity = 'comfortable' | 'compact';

export interface DawEditorLayoutInput {
  compactTransport: boolean;
  inspectorCollapsed: boolean;
  viewportHeight?: number;
}

export interface DawEditorLayoutMetrics {
  sideRailWidth: number;
  headerHeight: number;
  inspectorWidth: number;
  bottomTransportHeight: number;
  stageMinHeight: number;
}

export function buildDawEditorLayoutMetrics(input: DawEditorLayoutInput): DawEditorLayoutMetrics {
  const stageMinHeight = Number.isFinite(input.viewportHeight)
    ? Math.max(720, Math.round(input.viewportHeight || 0))
    : 720;

  return {
    sideRailWidth: 48,
    headerHeight: 72,
    inspectorWidth: input.inspectorCollapsed ? 58 : 300,
    bottomTransportHeight: input.compactTransport ? 86 : 146,
    stageMinHeight,
  };
}

export function resolveDawTrackHeight({
  advanced,
  density,
  selected = false,
}: {
  advanced: boolean;
  density: DawTrackDensity;
  selected?: boolean;
}) {
  if (advanced) {
    if (density === 'compact') return selected ? 104 : 82;
    return selected ? 128 : 104;
  }

  if (density === 'compact') return selected ? 74 : 54;
  return selected ? 92 : 66;
}
