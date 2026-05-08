/**
 * Format a duration in seconds to a human-readable string (MM:SS)
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export function formatDuration(seconds: number): string {
  // Handle invalid inputs
  if (
    seconds === undefined ||
    seconds === null ||
    Number.isNaN(seconds) ||
    seconds < 0
  ) {
    return '0:00';
  }

  // Round to nearest second
  const totalSeconds = Math.round(seconds);

  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = Math.floor(totalSeconds % 60);

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Calculate total duration in decimal format from an array of tracks
 * @param tracks - Array of tracks with duration in seconds
 * @returns Total duration formatted as "X.Y mins", "X.Y hours", or "X.Y days"
 */
export function calculateTotalHours(
  tracks: Array<{ duration: number }>,
): string {
  const totalSeconds = tracks.reduce(
    (sum, track) => sum + (track.duration || 0),
    0,
  );

  const totalMinutes = totalSeconds / 60;
  const totalHours = totalMinutes / 60;
  const totalDays = totalHours / 24;

  // Under 1 hour: show minutes
  if (totalHours < 1) {
    const mins = totalMinutes.toFixed(1);
    return `${mins}${mins === '1.0' ? 'm' : 'm'}`;
  }

  // Under 24 hours: show hours
  if (totalHours < 24) {
    const hrs = totalHours.toFixed(1);
    return `${hrs}${hrs === '1.0' ? 'h' : 'h'}`;
  }

  // 24 hours or more: show days
  const days = totalDays.toFixed(1);
  return `${days}${days === '1.0' ? 'd' : 'd'}`;
}

/**
 * Format a "time remaining" estimate from elapsed wall-clock time and
 * file counts. Returns an empty string when the estimate would be too
 * volatile to be useful (very small samples / very recent start).
 *
 * Used by both the library scan and library backup progress dialogs so
 * their wording stays consistent.
 *
 * @param elapsedMs - Milliseconds since the operation started
 * @param processed - Files processed so far
 * @param total - Total files expected
 * @returns Human-readable estimate (e.g. "3 minutes", "1 hour 5 minutes")
 *          or an empty string when no estimate should be shown yet.
 */
export function formatEta(
  elapsedMs: number,
  processed: number,
  total: number,
): string {
  // Volatility guard: with only a handful of samples the estimate
  // bounces wildly. Suppress until we have either enough files OR
  // enough wall-clock time to smooth it out.
  if (processed < 5 && elapsedMs < 2000) return '';
  if (processed === 0) return '';
  const remaining = total - processed;
  if (remaining <= 0) return '';

  const msPerFile = elapsedMs / processed;
  const etaMs = remaining * msPerFile;

  if (etaMs < 60_000) {
    return `${Math.ceil(etaMs / 1000)} seconds`;
  }
  if (etaMs < 3_600_000) {
    return `${Math.ceil(etaMs / 60_000)} minutes`;
  }
  const hours = Math.floor(etaMs / 3_600_000);
  const minutes = Math.ceil((etaMs % 3_600_000) / 60_000);
  return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
}
