'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

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
  return raw.split('\n').some((line) => /^\[(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)?\]\s*\S+/.test(line.trim()));
}

function parseLyrics(raw: string): LyricLine[] {
  const lines = raw.split('\n');
  const rawLines: Array<{
    text: string;
    knownTime: number | null;
    isSectionMarker: boolean;
  }> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^\[\[[A-Z]\d+\]\]$/.test(trimmed) || /^\[[A-Za-z][^\]]*\]$/.test(trimmed)) {
      rawLines.push({ text: trimmed.replace(/[\[\]]/g, ''), knownTime: null, isSectionMarker: true });
      continue;
    }

    const rangeMatch = trimmed.match(/^\[(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)\]\s*(.*)$/);
    if (rangeMatch) {
      const text = rangeMatch[3].trim();
      if (text) rawLines.push({ text, knownTime: parseFloat(rangeMatch[1]), isSectionMarker: false });
      continue;
    }

    const timedMatch = trimmed.match(/^\[(\d+(?:\.\d+)?):\]\s*(.*)$/);
    if (timedMatch) {
      const text = timedMatch[2].trim();
      if (text) rawLines.push({ text, knownTime: parseFloat(timedMatch[1]), isSectionMarker: false });
      continue;
    }

    const untimedMatch = trimmed.match(/^\[:\]\s*(.*)$/);
    if (untimedMatch) {
      const text = untimedMatch[1].trim();
      if (text) rawLines.push({ text, knownTime: null, isSectionMarker: false });
      continue;
    }

    rawLines.push({ text: trimmed, knownTime: null, isSectionMarker: false });
  }

  const anchorIndices: number[] = [];
  for (let index = 0; index < rawLines.length; index++) {
    if (!rawLines[index].isSectionMarker && rawLines[index].knownTime !== null) {
      anchorIndices.push(index);
    }
  }

  if (anchorIndices.length === 0) {
    return rawLines.map((line) => ({
      text: line.text,
      startTime: 0,
      isSectionMarker: line.isSectionMarker,
    }));
  }

  const result: LyricLine[] = [];
  const firstAnchorIndex = anchorIndices[0];
  const firstAnchorTime = rawLines[firstAnchorIndex].knownTime!;
  let beforeCount = 0;

  for (let index = 0; index < firstAnchorIndex; index++) {
    if (!rawLines[index].isSectionMarker) beforeCount++;
  }

  let beforeOffset = 0;
  for (let index = 0; index < firstAnchorIndex; index++) {
    const time = Math.max(0, firstAnchorTime - (beforeCount - beforeOffset) * 2);
    result.push({
      text: rawLines[index].text,
      startTime: time,
      isSectionMarker: rawLines[index].isSectionMarker,
    });
    if (!rawLines[index].isSectionMarker) beforeOffset++;
  }

  for (let anchor = 0; anchor < anchorIndices.length; anchor++) {
    const currentIndex = anchorIndices[anchor];
    const currentTime = rawLines[currentIndex].knownTime!;
    const nextAnchorIndex = anchor < anchorIndices.length - 1 ? anchorIndices[anchor + 1] : rawLines.length;
    const nextTime = anchor < anchorIndices.length - 1 ? rawLines[anchorIndices[anchor + 1]].knownTime! : currentTime + 30;

    result.push({ text: rawLines[currentIndex].text, startTime: currentTime, isSectionMarker: false });

    const betweenLines: number[] = [];
    for (let index = currentIndex + 1; index < nextAnchorIndex; index++) {
      if (!rawLines[index].isSectionMarker) betweenLines.push(index);
    }

    const perLine = (nextTime - currentTime) / (betweenLines.length + 1);
    let lineNumber = 1;

    for (let index = currentIndex + 1; index < nextAnchorIndex; index++) {
      result.push({
        text: rawLines[index].text,
        startTime: currentTime + lineNumber * perLine,
        isSectionMarker: rawLines[index].isSectionMarker,
      });
      if (!rawLines[index].isSectionMarker) lineNumber++;
    }
  }

  return result;
}

function getCurrentLineIndex(lines: LyricLine[], currentTime: number): number {
  const adjustedTime = currentTime - 0.3;
  let currentIndex = -1;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.isSectionMarker) continue;

    if (adjustedTime >= line.startTime) {
      currentIndex = index;
    } else {
      break;
    }
  }

  return currentIndex;
}

export default function SyncedLyrics({ lyrics, currentTime, isPlaying }: SyncedLyricsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const hasTiming = useMemo(() => hasTimedLyrics(lyrics), [lyrics]);
  const parsedLines = useMemo(() => parseLyrics(lyrics), [lyrics]);
  const currentLineIndex = useMemo(
    () => (hasTiming ? getCurrentLineIndex(parsedLines, currentTime) : -1),
    [currentTime, hasTiming, parsedLines]
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

  useEffect(() => {
    if (!hasTiming || currentLineIndex < 0 || !containerRef.current) return;

    const container = containerRef.current;
    const lineElement = container.children[currentLineIndex] as HTMLElement | undefined;
    if (!lineElement) return;

    const containerTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const lineTop = lineElement.offsetTop - container.offsetTop;
    const lineBottom = lineTop + lineElement.offsetHeight;

    if (lineTop < containerTop + 20 || lineBottom > containerTop + containerHeight - 20) {
      container.scrollTo({ top: Math.max(0, lineTop - containerHeight / 3), behavior: 'smooth' });
    }
  }, [currentLineIndex, hasTiming]);

  return (
    <div style={rootStyle}>
      <div style={headerStyle}>
        <div style={headingWrapStyle}>
          <span style={statusDotStyle(isPlaying)} />
          <span style={headingStyle}>同步歌词</span>
          {hasTiming && <span style={badgeStyle}>实时跟随</span>}
        </div>
        <button type="button" onClick={handleCopy} style={copyButtonStyle(copied)}>
          {copied ? '已复制' : '复制歌词'}
        </button>
      </div>

      {copied && <div style={noticeStyle}>歌词已复制到剪贴板。</div>}

      <div ref={containerRef} style={lyricsBoxStyle}>
        {parsedLines.length === 0 ? (
          <div style={emptyStyle}>暂无歌词</div>
        ) : (
          parsedLines.map((line, index) => {
            if (line.isSectionMarker) {
              return (
                <div key={`${line.text}-${index}`} style={sectionLineStyle}>
                  {line.text}
                </div>
              );
            }

            const active = hasTiming && index === currentLineIndex;
            return (
              <div key={`${line.text}-${index}`} style={lyricLineStyle(active)}>
                {line.text}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const headingWrapStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
};

const headingStyle: CSSProperties = {
  color: 'var(--hc-text)',
  fontSize: 12,
  fontWeight: 900,
};

function statusDotStyle(isPlaying: boolean): CSSProperties {
  return {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: isPlaying ? 'var(--hc-lime)' : 'var(--hc-muted)',
    boxShadow: isPlaying ? '0 0 0 4px rgba(208,255,90,0.12)' : 'none',
    flexShrink: 0,
  };
}

const badgeStyle: CSSProperties = {
  padding: '3px 7px',
  borderRadius: 999,
  color: 'var(--hc-cyan)',
  background: 'rgba(115,247,215,0.1)',
  border: '1px solid rgba(115,247,215,0.18)',
  fontSize: 10,
  fontWeight: 850,
};

function copyButtonStyle(copied: boolean): CSSProperties {
  return {
    flexShrink: 0,
    minHeight: 30,
    padding: '0 10px',
    borderRadius: 999,
    border: copied ? '1px solid rgba(208,255,90,0.38)' : '1px solid var(--hc-line)',
    background: copied ? 'rgba(208,255,90,0.12)' : 'rgba(255,255,255,0.045)',
    color: copied ? 'var(--hc-lime)' : 'var(--hc-text)',
    fontSize: 11,
    fontWeight: 850,
    cursor: 'pointer',
  };
}

const noticeStyle: CSSProperties = {
  borderRadius: 10,
  background: 'rgba(208,255,90,0.1)',
  border: '1px solid rgba(208,255,90,0.22)',
  color: 'var(--hc-lime)',
  fontSize: 11,
  padding: '7px 9px',
  lineHeight: 1.5,
};

const lyricsBoxStyle: CSSProperties = {
  maxHeight: 220,
  overflowY: 'auto',
  borderRadius: 14,
  border: '1px solid var(--hc-line)',
  background: 'rgba(6,8,10,0.68)',
  padding: 12,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
};

const sectionLineStyle: CSSProperties = {
  color: 'var(--hc-cyan)',
  fontSize: 12,
  fontWeight: 900,
  lineHeight: 1.6,
  margin: '12px 0 6px',
  textTransform: 'uppercase',
};

function lyricLineStyle(active: boolean): CSSProperties {
  return {
    color: active ? 'var(--hc-lime)' : 'var(--hc-muted)',
    fontSize: active ? 14 : 13,
    fontWeight: active ? 850 : 500,
    lineHeight: 1.85,
    padding: '4px 9px',
    margin: '2px 0',
    borderRadius: 10,
    background: active ? 'rgba(208,255,90,0.1)' : 'transparent',
    borderLeft: active ? '2px solid var(--hc-lime)' : '2px solid transparent',
    transition: 'background 0.2s ease, color 0.2s ease, font-size 0.2s ease',
  };
}

const emptyStyle: CSSProperties = {
  color: 'var(--hc-muted)',
  fontSize: 12,
  lineHeight: 1.7,
  textAlign: 'center',
  padding: '22px 0',
};
