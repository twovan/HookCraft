export function formatStemTimecode(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00.00';
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds - minutes * 60;
  return `${minutes}:${remaining.toFixed(2).padStart(5, '0')}`;
}

export function parseStemTimecode(value: string) {
  const text = value.trim();
  if (!text) return null;

  if (!text.includes(':')) {
    const seconds = Number(text);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  }

  const [minutesText, secondsText] = text.split(':');
  if (secondsText === undefined || text.split(':').length !== 2) return null;

  const minutes = Number(minutesText);
  const seconds = Number(secondsText);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) {
    return null;
  }

  return minutes * 60 + seconds;
}

export function clampStemTimecodeInput(value: string, duration: number) {
  const parsedTime = parseStemTimecode(value);
  if (parsedTime === null) return { ok: false as const };

  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : parsedTime;
  return {
    ok: true as const,
    time: Math.max(0, Math.min(safeDuration, parsedTime)),
  };
}
