import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeReportPhoto } from './report-photo-storage.js';

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length);
  header.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), data])));
  return Buffer.concat([header, data, crc]);
}
function pngWithExif() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('eXIf', Buffer.from('GPS-LOCATION')),
    pngChunk('IDAT', Buffer.from([0])),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
function jpegWithExif() {
  const app1 = Buffer.from([0xff, 0xe1, 0, 15, ...Buffer.from('Exif\0\0GPS1234')]);
  const frame = Buffer.from([0xff, 0xc0, 0, 11, 8, 0, 1, 0, 1, 1, 1, 0x11, 0]);
  const scan = Buffer.from([0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 1, 2, 0xff, 0xd9]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, frame, scan]);
}

test('JPEG upload drops EXIF segments before it is stored', () => {
  const clean = sanitizeReportPhoto(jpegWithExif(), 'image/jpeg');
  assert.equal(clean.mimeType, 'image/jpeg');
  assert.ok(!clean.data.includes(Buffer.from('Exif')));
  assert.ok(!clean.data.includes(Buffer.from('GPS1234')));
  assert.deepEqual(clean.data.subarray(0, 2), Buffer.from([0xff, 0xd8]));
  assert.deepEqual(clean.data.subarray(-2), Buffer.from([0xff, 0xd9]));
});

test('PNG upload drops EXIF and ancillary metadata chunks and keeps image chunks', () => {
  const clean = sanitizeReportPhoto(pngWithExif(), 'image/png');
  assert.equal(clean.mimeType, 'image/png');
  assert.ok(!clean.data.includes(Buffer.from('eXIf')));
  assert.ok(!clean.data.includes(Buffer.from('GPS-LOCATION')));
  assert.ok(clean.data.includes(Buffer.from('IHDR')));
  assert.ok(clean.data.includes(Buffer.from('IDAT')));
  assert.ok(clean.data.includes(Buffer.from('IEND')));
});

test('invalid image bytes, type mismatch, and oversized images are rejected', () => {
  assert.throws(() => sanitizeReportPhoto(Buffer.from('plain text'), 'image/jpeg'));
  assert.throws(() => sanitizeReportPhoto(jpegWithExif(), 'image/png'));
  assert.throws(() => sanitizeReportPhoto(Buffer.alloc(3 * 1024 * 1024 + 1), 'image/jpeg'));
});
