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
 * Format a date string to a human-readable string
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) {
    return 'Never';
  }

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Format a file size in bytes to a human-readable string
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
