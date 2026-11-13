/**
 * @jest-environment node
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import writeFileAtomic from '../main/db/atomicWrite';

describe('writeFileAtomic', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hihat-atomic-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('replaces the file and leaves no temp file behind', () => {
    const target = path.join(dir, 'library.db');
    fs.writeFileSync(target, 'old contents');

    writeFileAtomic(target, Buffer.from('new contents'));

    expect(fs.readFileSync(target, 'utf-8')).toBe('new contents');
    expect(fs.readdirSync(dir)).toEqual(['library.db']);
  });

  test('creates the file when it does not exist yet', () => {
    const target = path.join(dir, 'marker.json');

    writeFileAtomic(target, '{"kind":"scan"}');

    expect(JSON.parse(fs.readFileSync(target, 'utf-8'))).toEqual({
      kind: 'scan',
    });
  });

  test('a failed write leaves the previous file untouched', () => {
    const target = path.join(dir, 'library.db');
    fs.writeFileSync(target, 'old contents');
    const writeSync = jest.spyOn(fs, 'writeSync').mockImplementation(() => {
      throw new Error('disk full');
    });

    try {
      expect(() => writeFileAtomic(target, Buffer.from('new'))).toThrow(
        'disk full',
      );
    } finally {
      writeSync.mockRestore();
    }
    expect(fs.readFileSync(target, 'utf-8')).toBe('old contents');
  });
});
