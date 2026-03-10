/**
 * Tag Writer Service
 *
 * Writes metadata tags to audio files using node-taglib-sharp, which supports
 * MP3 (ID3), M4A/AAC (MP4 atoms), FLAC (Vorbis Comment), and OGG formats.
 *
 * Format detection uses music-metadata's container field (reads actual file
 * contents) rather than file extensions, which can be unreliable.
 *
 * Album art and other unspecified tags are preserved — only the fields
 * explicitly passed in are modified.
 */

import * as mm from 'music-metadata';
import { File as TaglibFile } from 'node-taglib-sharp';
import { MetadataToWrite } from '../../types/dbTypes';

const SUPPORTED_CONTAINERS = ['MPEG', 'FLAC', 'Ogg'];

function isSupported(container: string, codec?: string): boolean {
  return (
    SUPPORTED_CONTAINERS.includes(container) ||
    container.startsWith('MPEG-4') ||
    container.startsWith('M4A') ||
    container.startsWith('isom') ||
    (codec != null && codec.startsWith('MPEG-4'))
  );
}

function writeTagsViaTaglib(
  filePath: string,
  metadata: MetadataToWrite,
): { success: boolean; message?: string } {
  let file: TaglibFile | undefined;
  try {
    file = TaglibFile.createFromPath(filePath);
    const { tag } = file;

    tag.title = metadata.title;
    tag.performers = [metadata.artist];
    tag.albumArtists = [metadata.albumArtist];
    tag.album = metadata.album;
    tag.genres = metadata.genre ? [metadata.genre] : [];
    tag.composers = metadata.composer ? [metadata.composer] : [];
    tag.comment = metadata.comment ?? '';
    tag.year = metadata.year ?? 0;
    tag.beatsPerMinute = metadata.bpm ?? 0;
    tag.track = metadata.trackNumber ?? 0;
    tag.trackCount = metadata.totalTracks ?? 0;
    tag.disc = metadata.discNumber ?? 0;
    tag.discCount = metadata.totalDiscs ?? 0;
    // NOTE: Do NOT touch tag.pictures — preserves existing album art

    file.save();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message || 'Failed to write tags to file',
    };
  } finally {
    file?.dispose();
  }
}

// eslint-disable-next-line import/prefer-default-export
export async function writeMetadataToFile(
  filePath: string,
  metadata: MetadataToWrite,
): Promise<{ success: boolean; message?: string }> {
  try {
    // Detect actual container format from file contents (not extension)
    const parsed = await mm.parseFile(filePath, {
      duration: false,
      skipCovers: true,
    });
    const { container } = parsed.format;

    if (!container || !isSupported(container, parsed.format.codec)) {
      return {
        success: false,
        message: `File tag writing is not supported for ${container ?? 'unknown'} format`,
      };
    }

    return writeTagsViaTaglib(filePath, metadata);
  } catch (error) {
    console.error(`Tag write failed for ${filePath}:`, error);
    return {
      success: false,
      message: (error as Error).message || 'Failed to write tags to file',
    };
  }
}
