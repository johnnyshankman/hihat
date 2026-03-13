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
