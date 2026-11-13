import fs from 'fs';

/**
 * Replace `filePath` with `data` so that a crash, force quit or power
 * loss at any point leaves either the previous complete file or the new
 * complete file on disk, never a truncated one.
 *
 * Writes to a sibling `.tmp` file, fsyncs it, then renames it over the
 * target. `rename` within one directory is atomic on APFS/HFS+ and ext4.
 */
export default function writeFileAtomic(
  filePath: string,
  data: Uint8Array | string,
): void {
  const tmpPath = `${filePath}.tmp`;
  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeSync(fd, typeof data === 'string' ? Buffer.from(data) : data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, filePath);
}
