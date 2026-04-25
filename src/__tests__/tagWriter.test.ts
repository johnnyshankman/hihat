/**
 * @jest-environment node
 */

// Mock the external libraries — this test covers OUR orchestration logic,
// not whether music-metadata can parse an MP3 or whether taglib-sharp can
// persist tags. Real-file behavior belongs in the e2e suite.
//
// `virtual: true` is required for music-metadata: it ships as ESM-only
// (v11+) and Jest's CJS resolver can't load it even just to apply the mock.
// The flag tells Jest to skip module resolution and use the factory directly.
jest.mock(
  'music-metadata',
  () => ({
    parseFile: jest.fn(),
  }),
  { virtual: true },
);

jest.mock('node-taglib-sharp', () => ({
  File: { createFromPath: jest.fn() },
}));

/* eslint-disable import/first -- jest.mock calls are hoisted above imports
   at runtime; placing the imports below keeps the source readable. */
import * as mm from 'music-metadata';
import { File as TaglibFile } from 'node-taglib-sharp';
import { isSupported, writeMetadataToFile } from '../main/library/tagWriter';
import { MetadataToWrite } from '../types/dbTypes';
/* eslint-enable import/first */

const parseFileMock = mm.parseFile as jest.MockedFunction<typeof mm.parseFile>;
const createFromPathMock = TaglibFile.createFromPath as jest.MockedFunction<
  typeof TaglibFile.createFromPath
>;

const fullMetadata: MetadataToWrite = {
  title: 'Title',
  artist: 'Artist',
  album: 'Album',
  albumArtist: 'Album Artist',
  trackNumber: 3,
  totalTracks: 10,
  discNumber: 1,
  totalDiscs: 2,
  year: 2025,
  bpm: 140,
  genre: 'Rock',
  composer: 'Composer',
  comment: 'Comment',
};

const makeParsed = (
  container: string | undefined,
  codec?: string,
): Awaited<ReturnType<typeof mm.parseFile>> =>
  // Real return shape has many fields; only `format.container`/`format.codec`
  // are read by tagWriter, so cast to satisfy the type.
  ({
    format: { container, codec },
  }) as unknown as Awaited<ReturnType<typeof mm.parseFile>>;

const makeTagStub = () => ({
  title: '',
  performers: [] as string[],
  albumArtists: [] as string[],
  album: '',
  genres: [] as string[],
  composers: [] as string[],
  comment: '',
  year: 0,
  beatsPerMinute: 0,
  track: 0,
  trackCount: 0,
  disc: 0,
  discCount: 0,
});

const makeTaglibFileStub = (tag = makeTagStub()) => ({
  tag,
  save: jest.fn(),
  dispose: jest.fn(),
});

beforeEach(() => {
  parseFileMock.mockReset();
  createFromPathMock.mockReset();
});

describe('isSupported', () => {
  test.each([
    ['MPEG', undefined],
    ['FLAC', undefined],
    ['Ogg', undefined],
    ['MPEG-4', undefined],
    ['MPEG-4/isom', undefined],
    ['M4A', undefined],
    ['M4A/mp42', undefined],
    ['isom', undefined],
    ['isom/avc1', undefined],
    ['quicktime', 'MPEG-4 AAC'],
  ])('accepts container=%j codec=%j', (container, codec) => {
    expect(isSupported(container, codec)).toBe(true);
  });

  test.each([
    ['WAV', undefined],
    ['AIFF', undefined],
    ['Matroska', undefined],
    ['', undefined],
    ['Unknown', 'AAC'],
  ])('rejects container=%j codec=%j', (container, codec) => {
    expect(isSupported(container, codec)).toBe(false);
  });

  test('codec match alone is sufficient when container is unrecognized', () => {
    // 'quicktime' isn't in the container allowlist, but the MPEG-4 codec
    // string opens the door — pin this fallback.
    expect(isSupported('quicktime', 'MPEG-4 AAC')).toBe(true);
  });

  test('codec without "MPEG-4" prefix does not rescue an unsupported container', () => {
    expect(isSupported('quicktime', 'ALAC')).toBe(false);
  });
});

describe('writeMetadataToFile — failure paths', () => {
  test('returns success:false with a descriptive message when container is unknown', async () => {
    parseFileMock.mockResolvedValue(makeParsed('WAV'));

    const result = await writeMetadataToFile('/path/file.wav', fullMetadata);

    expect(result.success).toBe(false);
    expect(result.message).toContain('WAV');
    // Must NOT have attempted to write tags when format is unsupported
    expect(createFromPathMock).not.toHaveBeenCalled();
  });

  test('reports "unknown" when music-metadata cannot identify the container', async () => {
    parseFileMock.mockResolvedValue(makeParsed(undefined));

    const result = await writeMetadataToFile('/path/file.bin', fullMetadata);

    expect(result.success).toBe(false);
    expect(result.message).toContain('unknown');
    expect(createFromPathMock).not.toHaveBeenCalled();
  });

  test('catches parse failures and returns success:false with the error message', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    parseFileMock.mockRejectedValue(new Error('boom: bad header'));

    const result = await writeMetadataToFile('/path/corrupt.mp3', fullMetadata);

    expect(result.success).toBe(false);
    expect(result.message).toBe('boom: bad header');
    expect(createFromPathMock).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  test('catches taglib write failures and disposes the file handle', async () => {
    parseFileMock.mockResolvedValue(makeParsed('MPEG'));
    const stub = makeTaglibFileStub();
    stub.save.mockImplementation(() => {
      throw new Error('disk full');
    });
    createFromPathMock.mockReturnValue(stub as unknown as TaglibFile);

    const result = await writeMetadataToFile('/path/file.mp3', fullMetadata);

    expect(result.success).toBe(false);
    expect(result.message).toBe('disk full');
    // dispose() must run even on failure (finally block)
    expect(stub.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('writeMetadataToFile — success path & field mapping', () => {
  test('returns success:true and disposes the file when the write succeeds', async () => {
    parseFileMock.mockResolvedValue(makeParsed('MPEG'));
    const stub = makeTaglibFileStub();
    createFromPathMock.mockReturnValue(stub as unknown as TaglibFile);

    const result = await writeMetadataToFile('/path/file.mp3', fullMetadata);

    expect(result).toEqual({ success: true });
    expect(createFromPathMock).toHaveBeenCalledWith('/path/file.mp3');
    expect(stub.save).toHaveBeenCalledTimes(1);
    expect(stub.dispose).toHaveBeenCalledTimes(1);
  });

  test('maps all metadata fields onto the taglib tag', async () => {
    parseFileMock.mockResolvedValue(makeParsed('MPEG'));
    const tag = makeTagStub();
    const stub = makeTaglibFileStub(tag);
    createFromPathMock.mockReturnValue(stub as unknown as TaglibFile);

    await writeMetadataToFile('/path/file.mp3', fullMetadata);

    expect(tag.title).toBe('Title');
    expect(tag.performers).toEqual(['Artist']);
    expect(tag.albumArtists).toEqual(['Album Artist']);
    expect(tag.album).toBe('Album');
    expect(tag.genres).toEqual(['Rock']);
    expect(tag.composers).toEqual(['Composer']);
    expect(tag.comment).toBe('Comment');
    expect(tag.year).toBe(2025);
    expect(tag.beatsPerMinute).toBe(140);
    expect(tag.track).toBe(3);
    expect(tag.trackCount).toBe(10);
    expect(tag.disc).toBe(1);
    expect(tag.discCount).toBe(2);
  });

  test('empty genre becomes [] (not [""]) so taglib clears the field', async () => {
    parseFileMock.mockResolvedValue(makeParsed('MPEG'));
    const tag = makeTagStub();
    const stub = makeTaglibFileStub(tag);
    createFromPathMock.mockReturnValue(stub as unknown as TaglibFile);

    await writeMetadataToFile('/path/file.mp3', { ...fullMetadata, genre: '' });

    expect(tag.genres).toEqual([]);
  });

  test('null composer becomes [] so taglib clears the field', async () => {
    parseFileMock.mockResolvedValue(makeParsed('MPEG'));
    const tag = makeTagStub();
    const stub = makeTaglibFileStub(tag);
    createFromPathMock.mockReturnValue(stub as unknown as TaglibFile);

    await writeMetadataToFile('/path/file.mp3', {
      ...fullMetadata,
      composer: null,
    });

    expect(tag.composers).toEqual([]);
  });

  test('null comment becomes empty string', async () => {
    parseFileMock.mockResolvedValue(makeParsed('MPEG'));
    const tag = makeTagStub();
    const stub = makeTaglibFileStub(tag);
    createFromPathMock.mockReturnValue(stub as unknown as TaglibFile);

    await writeMetadataToFile('/path/file.mp3', {
      ...fullMetadata,
      comment: null,
    });

    expect(tag.comment).toBe('');
  });

  test('null numeric fields become 0', async () => {
    parseFileMock.mockResolvedValue(makeParsed('MPEG'));
    const tag = makeTagStub();
    const stub = makeTaglibFileStub(tag);
    createFromPathMock.mockReturnValue(stub as unknown as TaglibFile);

    await writeMetadataToFile('/path/file.mp3', {
      ...fullMetadata,
      trackNumber: null,
      totalTracks: null,
      discNumber: null,
      totalDiscs: null,
      year: null,
      bpm: null,
    });

    expect(tag.track).toBe(0);
    expect(tag.trackCount).toBe(0);
    expect(tag.disc).toBe(0);
    expect(tag.discCount).toBe(0);
    expect(tag.year).toBe(0);
    expect(tag.beatsPerMinute).toBe(0);
  });

  test('does not touch tag.pictures (album art preservation contract)', async () => {
    parseFileMock.mockResolvedValue(makeParsed('MPEG'));
    const tag = makeTagStub() as ReturnType<typeof makeTagStub> & {
      pictures: unknown[];
    };
    tag.pictures = ['original-picture-handle'];
    const stub = makeTaglibFileStub(tag);
    createFromPathMock.mockReturnValue(stub as unknown as TaglibFile);

    await writeMetadataToFile('/path/file.mp3', fullMetadata);

    // The pictures array reference must still be exactly what taglib gave us
    expect(tag.pictures).toEqual(['original-picture-handle']);
  });

  test('parses with skipCovers:true and duration:false (perf hint preserved)', async () => {
    parseFileMock.mockResolvedValue(makeParsed('MPEG'));
    createFromPathMock.mockReturnValue(
      makeTaglibFileStub() as unknown as TaglibFile,
    );

    await writeMetadataToFile('/path/file.mp3', fullMetadata);

    expect(parseFileMock).toHaveBeenCalledWith('/path/file.mp3', {
      duration: false,
      skipCovers: true,
    });
  });
});
