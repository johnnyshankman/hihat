/**
 * @jest-environment node
 */

// Real-file regression test for M4A tag writes. Unlike tagWriter.test.ts,
// this runs the REAL node-taglib-sharp against a real M4A and checks the
// bytes it leaves on disk.
//
// Why: node-taglib-sharp 5.2.3 grew moov/udta on save without updating the
// moov box size. On "faststart" files (moov before mdat, the usual iTunes /
// Apple Music layout) the extra tag bytes overwrote the mdat header and the
// first ~2KB of audio. The fixture below has that layout, and 5.2.3
// corrupts it on the first save. Any taglib upgrade that regresses this
// must fail here.
//
// music-metadata is still mocked: it is ESM-only (see tagWriter.test.ts)
// and only does container detection, which is not what this test is about.
jest.mock(
  'music-metadata',
  () => ({
    parseFile: jest.fn(),
  }),
  { virtual: true },
);

/* eslint-disable import/first -- jest.mock calls are hoisted above imports
   at runtime; placing the imports below keeps the source readable. */
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as mm from 'music-metadata';
import { File as TaglibFile } from 'node-taglib-sharp';
import { writeMetadataToFile } from '../main/library/tagWriter';
import { MetadataToWrite } from '../types/dbTypes';
/* eslint-enable import/first */

const FIXTURE = path.join(__dirname, 'fixtures', 'apple-layout.m4a');

// Boxes whose payload is a list of child boxes. `meta` is a full box: it has
// 4 bytes of version/flags before its children.
const CONTAINER_BOXES = new Set([
  'moov',
  'trak',
  'mdia',
  'minf',
  'stbl',
  'udta',
  'edts',
  'dinf',
]);

interface Box {
  type: string;
  start: number;
  headerSize: number;
  size: number;
}

/**
 * Walks the box tree and throws if any box extends past its parent or the
 * file. That overflow is exactly the corruption taglib 5.2.3 produced.
 */
function walkBoxes(
  buf: Buffer,
  start: number,
  end: number,
  out: Box[] = [],
  depth = 0,
): Box[] {
  let offset = start;
  while (offset < end) {
    if (end - offset < 8) {
      throw new Error(`Trailing ${end - offset} bytes at ${offset}`);
    }
    let size = buf.readUInt32BE(offset);
    const type = buf.toString('latin1', offset + 4, offset + 8);
    let headerSize = 8;
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(offset + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) {
      throw new Error(
        `Box '${type}' at ${offset} (size ${size}) overflows its parent, which ends at ${end}`,
      );
    }
    out.push({ type, start: offset, headerSize, size });
    // Only descend into the moov tree.
    if (type === 'meta' && depth > 0) {
      walkBoxes(buf, offset + headerSize + 4, offset + size, out, depth + 1);
    } else if (CONTAINER_BOXES.has(type)) {
      walkBoxes(buf, offset + headerSize, offset + size, out, depth + 1);
    }
    offset += size;
  }
  return out;
}

/** Returns the audio payload and the first chunk offset relative to it. */
function inspectAudio(filePath: string) {
  const buf = fs.readFileSync(filePath);
  const boxes = walkBoxes(buf, 0, buf.length);

  const mdats = boxes.filter((b) => b.type === 'mdat');
  expect(mdats).toHaveLength(1);
  const mdat = mdats[0];
  const payloadStart = mdat.start + mdat.headerSize;
  const payload = buf.subarray(payloadStart, mdat.start + mdat.size);

  const stco = boxes.find((b) => b.type === 'stco' || b.type === 'co64');
  expect(stco).toBeDefined();
  const firstEntry = stco!.start + stco!.headerSize + 8; // version/flags + count
  const firstChunkOffset =
    stco!.type === 'co64'
      ? Number(buf.readBigUInt64BE(firstEntry))
      : buf.readUInt32BE(firstEntry);

  return {
    payload,
    firstChunkRelativeToPayload: firstChunkOffset - payloadStart,
  };
}

const makeMetadata = (title: string): MetadataToWrite => ({
  title,
  artist: 'Edited Artist',
  album: 'Edited Album',
  albumArtist: 'Edited Album Artist',
  trackNumber: 4,
  totalTracks: 12,
  discNumber: 1,
  totalDiscs: 2,
  year: 2026,
  bpm: 120,
  // Long values force the tag block to grow well past any padding.
  genre: 'Genre '.repeat(40),
  composer: 'Composer '.repeat(40),
  comment: 'Comment '.repeat(200),
});

describe('M4A tag writes keep the file intact (real taglib)', () => {
  let tmpDir: string;
  let target: string;

  beforeEach(() => {
    (mm.parseFile as jest.Mock).mockResolvedValue({
      format: { container: 'M4A/isom/iso2', codec: 'MPEG-4/AAC' },
    });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hihat-m4a-'));
    target = path.join(tmpDir, 'track.m4a');
    fs.copyFileSync(FIXTURE, target);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('fixture has moov before mdat (the layout 5.2.3 corrupted)', () => {
    const buf = fs.readFileSync(FIXTURE);
    const top = walkBoxes(buf, 0, buf.length).map((b) => b.type);
    expect(top.indexOf('moov')).toBeLessThan(top.indexOf('mdat'));
  });

  test('repeated edits leave the audio untouched and the tags readable', async () => {
    const original = inspectAudio(FIXTURE);

    const editAndVerify = async (title: string) => {
      const result = await writeMetadataToFile(target, makeMetadata(title));
      expect(result).toEqual({ success: true });

      // Box tree is valid, the audio bytes are identical, and the chunk
      // table still points at the same place inside them.
      const after = inspectAudio(target);
      expect(after.payload.equals(original.payload)).toBe(true);
      expect(after.firstChunkRelativeToPayload).toBe(
        original.firstChunkRelativeToPayload,
      );

      const file = TaglibFile.createFromPath(target);
      try {
        expect(file.corruptionReasons ?? []).toEqual([]);
        expect(file.tag.title).toBe(title);
        expect(file.tag.performers).toEqual(['Edited Artist']);
        // Album art is preserved.
        expect(file.tag.pictures).toHaveLength(1);
      } finally {
        file.dispose();
      }
    };

    // 5.2.3 broke the file on the first save and refused every later one.
    await editAndVerify('First Edit');
    await editAndVerify('Second Edit');
    await editAndVerify('Third Edit');
  });
});
