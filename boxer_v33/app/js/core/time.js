export function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const intValue = Math.floor(n);
  return Math.min(max, Math.max(min, intValue));
}

export function formatTime(totalSec) {
  const seconds = Math.max(0, Number(totalSec) || 0);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
