/**
 * @jest-environment node
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import * as mm from 'music-metadata';
import { writeMetadataToFile } from '../main/library/tagWriter';

const TEST_SONGS_DIR = path.resolve(
  __dirname,
  '../../e2e/fixtures/test-songs-large',
);
const SAMPLE_MP3 = path.join(
  TEST_SONGS_DIR,
  '001 - Aurora Synth - Dream of Love.mp3',
);
const SAMPLE_M4A = path.join(
  TEST_SONGS_DIR,
  '201 - Test Artist - Test M4A Song.m4a',
);

const tempFiles: string[] = [];

function makeTempCopy(src: string): string {
  const ext = path.extname(src);
  const dest = path.join(os.tmpdir(), `tagwriter-test-${Date.now()}${ext}`);
  fs.copyFileSync(src, dest);
  tempFiles.push(dest);
  return dest;
}

describe('writeMetadataToFile', () => {
  afterEach(() => {
    tempFiles.forEach((f) => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
    tempFiles.length = 0;
  });

  test('MP3 file remains playable after metadata edit', async () => {
    const tempFile = makeTempCopy(SAMPLE_MP3);

    const original = await mm.parseFile(tempFile, { skipCovers: false });
    const originalDuration = original.format.duration!;

    const result = await writeMetadataToFile(tempFile, {
      title: 'Regression Test Title',
      artist: 'Regression Artist',
      album: 'Regression Album',
      albumArtist: 'Regression Album Artist',
      trackNumber: 3,
      totalTracks: 10,
      discNumber: 1,
      totalDiscs: 2,
      year: 2025,
      bpm: 140,
      genre: 'Test Genre',
      composer: 'Test Composer',
      comment: 'Test Comment',
    });

    expect(result.success).toBe(true);

    // Verify the file is still valid audio
    const after = await mm.parseFile(tempFile, { skipCovers: false });

    // Duration must be preserved (within 1 second tolerance)
    expect(after.format.duration).toBeDefined();
    expect(after.format.duration!).toBeGreaterThan(0);
    expect(Math.abs(after.format.duration! - originalDuration)).toBeLessThan(1);

    // File size sanity
    const newSize = fs.statSync(tempFile).size;
    expect(newSize).toBeGreaterThan(0);

    // Written metadata should be readable
    expect(after.common.title).toBe('Regression Test Title');
    expect(after.common.artist).toBe('Regression Artist');
    expect(after.common.album).toBe('Regression Album');
  });

  test('MP3 album art is preserved when editing metadata', async () => {
    const tempFile = makeTempCopy(SAMPLE_MP3);

    const original = await mm.parseFile(tempFile, { skipCovers: false });
    const originalPictureCount = (original.common.picture ?? []).length;
    const originalPictureData =
      originalPictureCount > 0 ? original.common.picture![0].data : null;

    await writeMetadataToFile(tempFile, {
      title: 'Art Preservation Test',
      artist: original.common.artist ?? '',
      album: original.common.album ?? '',
      albumArtist: original.common.albumartist ?? '',
      trackNumber: original.common.track.no ?? null,
      totalTracks: original.common.track.of ?? null,
      discNumber: original.common.disk.no ?? null,
      totalDiscs: original.common.disk.of ?? null,
      year: original.common.year ?? null,
      bpm: original.common.bpm ?? null,
      genre: original.common.genre?.[0] ?? '',
      composer: original.common.composer?.[0] ?? null,
      comment: null,
    });

    const after = await mm.parseFile(tempFile, { skipCovers: false });
    const afterPictureCount = (after.common.picture ?? []).length;

    // Album art count must be preserved
    expect(afterPictureCount).toBe(originalPictureCount);

    // If the original had album art, the image data must be identical
    const afterPictureData =
      afterPictureCount > 0 ? after.common.picture![0].data : null;
    expect(afterPictureData).toEqual(originalPictureData);
  });

  test('M4A file metadata is written to the file and readable', async () => {
    const tempFile = makeTempCopy(SAMPLE_M4A);

    const original = await mm.parseFile(tempFile, { skipCovers: false });
    const originalDuration = original.format.duration!;

    const result = await writeMetadataToFile(tempFile, {
      title: 'M4A Test Title',
      artist: 'M4A Test Artist',
      album: 'M4A Test Album',
      albumArtist: 'M4A Test Album Artist',
      trackNumber: 5,
      totalTracks: 12,
      discNumber: 2,
      totalDiscs: 3,
      year: 2026,
      bpm: 120,
      genre: 'Ambient',
      composer: 'M4A Composer',
      comment: 'M4A Comment',
    });

    expect(result.success).toBe(true);

    // Re-parse and verify written metadata
    const after = await mm.parseFile(tempFile, { skipCovers: false });

    // Duration must be preserved (within 1 second tolerance)
    expect(after.format.duration).toBeDefined();
    expect(after.format.duration!).toBeGreaterThan(0);
    expect(Math.abs(after.format.duration! - originalDuration)).toBeLessThan(1);

    // Written metadata should be readable
    expect(after.common.title).toBe('M4A Test Title');
    expect(after.common.artist).toBe('M4A Test Artist');
    expect(after.common.album).toBe('M4A Test Album');
  });

  test('M4A album art is preserved when editing metadata', async () => {
    const tempFile = makeTempCopy(SAMPLE_M4A);

    const original = await mm.parseFile(tempFile, { skipCovers: false });
    const originalPictureCount = (original.common.picture ?? []).length;

    await writeMetadataToFile(tempFile, {
      title: 'M4A Art Test',
      artist: 'Test Artist',
      album: 'Test Album',
      albumArtist: '',
      trackNumber: null,
      totalTracks: null,
      discNumber: null,
      totalDiscs: null,
      year: null,
      bpm: null,
      genre: '',
      composer: null,
      comment: null,
    });

    const after = await mm.parseFile(tempFile, { skipCovers: false });
    const afterPictureCount = (after.common.picture ?? []).length;

    // Album art count must stay the same (no art added or removed)
    expect(afterPictureCount).toBe(originalPictureCount);
  });

  test('unsupported format files return failure without modifying the file', async () => {
    // Create a plain text file with a .wav extension — truly unsupported content
    const fakePath = path.join(os.tmpdir(), `tagwriter-test-${Date.now()}.wav`);
    fs.writeFileSync(fakePath, 'this is not an audio file');
    tempFiles.push(fakePath);

    const originalBytes = fs.readFileSync(fakePath);

    const result = await writeMetadataToFile(fakePath, {
      title: 'Should Not Write',
      artist: 'Should Not Write',
      album: 'Should Not Write',
      albumArtist: '',
      trackNumber: null,
      totalTracks: null,
      discNumber: null,
      totalDiscs: null,
      year: null,
      bpm: null,
      genre: '',
      composer: null,
      comment: null,
    });

    expect(result.success).toBe(false);

    // File must be completely untouched
    const afterBytes = fs.readFileSync(fakePath);
    expect(afterBytes).toEqual(originalBytes);
  });
});
