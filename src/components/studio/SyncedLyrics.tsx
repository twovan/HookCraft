'use client';

import { useRef, useEffect, useMemo, useState } from 'react';

interface SyncedLyricsProps {
  lyrics: string;
  currentTime: number;
  isPlaying: boolean;
}

interface LyricLine {
  text: string;
  startTime: number;
  isSectionMarker: boolean;
}

function hasTimedLyrics(raw: string) {
  return raw
    .split('\n')
    .some((line) => /^\[(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)?\]\s*\S+/.test(line.trim()));
}

/**
 * Parse lyrics from Lyria 3 formats and calculate accurate timing.
 *
 * Strategy: Find all timed anchors, then evenly distribute untimed lines
 * between anchors based on the time gap.
 */
function parseLyrics(raw: string): LyricLine[] {
  const lines = raw.split('\n');

  // First pass: extract raw lines with known timestamps
  const rawLines: Array<{
    text: string;
    knownTime: number | null;
    isSectionMarker: boolean;
  }> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Section markers: [[A0]], [[B1]], [Verse], [Chorus], etc.
    if (/^\[\[[A-Z]\d+\]\]$/.test(trimmed) || /^\[[A-Za-z][^\]]*\]$/.test(trimmed)) {
      rawLines.push({ text: trimmed.replace(/[\[\]]/g, ''), knownTime: null, isSectionMarker: true });
      continue;
    }

    // Format 2: [start:end] text
    const f2 = trimmed.match(/^\[(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)\]\s*(.*)$/);
    if (f2) {
      const text = f2[3].trim();
      if (text) rawLines.push({ text, knownTime: parseFloat(f2[1]), isSectionMarker: false });
      continue;
    }

    // Format 1 timed: [20.6:] text
    const f1t = trimmed.match(/^\[(\d+(?:\.\d+)?):\]\s*(.*)$/);
    if (f1t) {
      const text = f1t[2].trim();
      if (text) rawLines.push({ text, knownTime: parseFloat(f1t[1]), isSectionMarker: false });
      continue;
    }

    // Format 1 untimed: [:] text
    const f1u = trimmed.match(/^\[:\]\s*(.*)$/);
    if (f1u) {
      const text = f1u[1].trim();
      if (text) rawLines.push({ text, knownTime: null, isSectionMarker: false });
      continue;
    }

    // Plain text
    rawLines.push({ text: trimmed, knownTime: null, isSectionMarker: false });
  }

  // Second pass: interpolate timing for untimed lines
  // Find groups of lines between timed anchors and distribute evenly
  const result: LyricLine[] = [];

  // Collect all timed anchor indices (non-section, with knownTime)
  const anchorIndices: number[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    if (!rawLines[i].isSectionMarker && rawLines[i].knownTime !== null) {
      anchorIndices.push(i);
    }
  }

  if (anchorIndices.length === 0) {
    // No timing info at all, just return lines without timing
    return rawLines.map(l => ({ text: l.text, startTime: 0, isSectionMarker: l.isSectionMarker }));
  }

  // Process lines before first anchor
  const firstAnchorIdx = anchorIndices[0];
  const firstAnchorTime = rawLines[firstAnchorIdx].knownTime!;
  let beforeCount = 0;
  for (let i = 0; i < firstAnchorIdx; i++) {
    if (!rawLines[i].isSectionMarker) beforeCount++;
  }
  let beforeOffset = 0;
  for (let i = 0; i < firstAnchorIdx; i++) {
    if (rawLines[i].isSectionMarker) {
      result.push({ text: rawLines[i].text, startTime: Math.max(0, firstAnchorTime - (beforeCount - beforeOffset) * 2), isSectionMarker: true });
    } else {
      const t = Math.max(0, firstAnchorTime - (beforeCount - beforeOffset) * 2);
      result.push({ text: rawLines[i].text, startTime: t, isSectionMarker: false });
      beforeOffset++;
    }
  }

  // Process between anchors
  for (let a = 0; a < anchorIndices.length; a++) {
    const currentIdx = anchorIndices[a];
    const currentTime = rawLines[currentIdx].knownTime!;
    const nextAnchorIdx = a < anchorIndices.length - 1 ? anchorIndices[a + 1] : rawLines.length;
    const nextTime = a < anchorIndices.length - 1 ? rawLines[anchorIndices[a + 1]].knownTime! : currentTime + 30;

    // Add the anchor line itself
    result.push({ text: rawLines[currentIdx].text, startTime: currentTime, isSectionMarker: false });

    // Count non-section lines between this anchor and next
    const betweenLines: number[] = []; // indices of non-section lines between anchors
    for (let i = currentIdx + 1; i < nextAnchorIdx; i++) {
      if (!rawLines[i].isSectionMarker) {
        betweenLines.push(i);
      }
    }

    // Distribute time evenly
    const timeGap = nextTime - currentTime;
    const lineCount = betweenLines.length + 1; // +1 for the anchor itself
    const perLine = timeGap / lineCount;

    let lineNum = 1;
    for (let i = currentIdx + 1; i < nextAnchorIdx; i++) {
      if (rawLines[i].isSectionMarker) {
        result.push({ text: rawLines[i].text, startTime: currentTime + lineNum * perLine, isSectionMarker: true });
      } else {
        result.push({ text: rawLines[i].text, startTime: currentTime + lineNum * perLine, isSectionMarker: false });
        lineNum++;
      }
    }
  }

  return result;
}

function getCurrentLineIndex(lines: LyricLine[], currentTime: number): number {
  // Subtract 0.3s to slightly delay highlight (lyrics timestamps are slightly ahead)
  const adjustedTime = currentTime - 0.3;
  let currentIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.isSectionMarker) continue;

    if (adjustedTime >= line.startTime) {
      currentIdx = i;
    } else {
      break;
    }
  }

  return currentIdx;
}

export default function SyncedLyrics({ lyrics, currentTime, isPlaying }: SyncedLyricsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const hasTiming = useMemo(() => hasTimedLyrics(lyrics), [lyrics]);
  const parsedLines = useMemo(() => parseLyrics(lyrics), [lyrics]);
  const currentLineIndex = useMemo(
    () => hasTiming ? getCurrentLineIndex(parsedLines, currentTime) : -1,
    [hasTiming, parsedLines, currentTime]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(lyrics);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  };

  // Auto-scroll within container only (don't affect page scroll)
  useEffect(() => {
    if (!hasTiming || currentLineIndex < 0 || !containerRef.current) return;
    const container = containerRef.current;
    const lineEl = container.children[currentLineIndex] as HTMLElement | undefined;
    if (lineEl) {
      const containerTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const lineTop = lineEl.offsetTop - container.offsetTop;
      const lineBottom = lineTop + lineEl.offsetHeight;

      // Only scroll if the current line is outside the visible area
      if (lineTop < containerTop + 20 || lineBottom > containerTop + containerHeight - 20) {
        const targetScroll = lineTop - containerHeight / 3;
        container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
      }
    }
  }, [hasTiming, currentLineIndex]);

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 8,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#c0a7fc' }}>歌词</div>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            border: '1px solid rgba(117, 54, 213, 0.45)',
            background: copied ? 'rgba(34, 197, 94, 0.12)' : 'rgba(117, 54, 213, 0.14)',
            color: copied ? '#86efac' : '#c0a7fc',
            borderRadius: 999,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
          }}
        >
          {copied ? '已复制' : '复制歌词'}
        </button>
      </div>
      {copied && (
        <div style={{
          marginBottom: 8,
          borderRadius: 8,
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.22)',
          color: '#86efac',
          fontSize: 11,
          padding: '6px 8px',
          lineHeight: 1.5,
        }}>
          歌词已复制到剪贴板
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          background: '#0d0d14',
          borderRadius: 12,
          padding: 16,
          maxHeight: 200,
          overflowY: 'auto',
          border: '1px solid #2a2a40',
        }}
      >
        {parsedLines.map((line, idx) => {
          if (line.isSectionMarker) {
            return (
              <div key={idx} style={{
                color: '#c0a7fc',
                fontSize: 12,
                fontWeight: 700,
                margin: '10px 0 6px',
              }}>
                {line.text}
              </div>
            );
          }

          const isCurrent = hasTiming && idx === currentLineIndex;

          return (
            <div
              key={idx}
              style={{
                fontSize: isCurrent ? 14 : 13,
                fontWeight: isCurrent ? 600 : 400,
                color: isCurrent ? '#c0a7fc' : '#9ca3af',
                lineHeight: 1.8,
                transition: 'all 0.2s ease',
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                padding: '3px 8px',
                margin: '3px 0',
                borderRadius: 8,
                background: isCurrent ? 'rgba(117, 54, 213, 0.18)' : 'transparent',
                borderLeft: isCurrent ? '2px solid #7536d5' : '2px solid transparent',
              }}
            >
              {line.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
