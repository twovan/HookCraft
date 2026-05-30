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
}: {
  advanced: boolean;
  density: DawTrackDensity;
  selected?: boolean;
}) {
  if (advanced) {
    if (density === 'compact') return 82;
    return 104;
  }

  if (density === 'compact') return 54;
  return 66;
}
