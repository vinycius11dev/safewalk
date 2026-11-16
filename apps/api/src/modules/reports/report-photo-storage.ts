import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/errors.js';

export const MAX_REPORT_PHOTO_BYTES = 3 * 1024 * 1024;
const defaultDirectory = fileURLToPath(new URL('../../../storage/report-photos/', import.meta.url));
const storageDirectory = resolve(env.SAFEWALK_REPORT_PHOTO_DIR || defaultDirectory);
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export type ReportPhotoMime = 'image/jpeg' | 'image/png';
export type StoredReportPhoto = { storageKey: string; mimeType: ReportPhotoMime; byteSize: number };

function invalidPhoto(message = 'A foto deve ser JPEG ou PNG, com até 3 MB.') {
  return new AppError(400, 'INVALID_REPORT_PHOTO', message);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.allocUnsafe(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function sanitizePng(input: Buffer): Buffer {
  if (input.length < 33 || !input.subarray(0, 8).equals(pngSignature)) throw invalidPhoto();
  const chunks: Buffer[] = [pngSignature];
  let offset = 8;
  let sawHeader = false;
  let sawData = false;
  let sawEnd = false;
  let width = 0;
  let height = 0;
  while (offset + 12 <= input.length) {
    const size = input.readUInt32BE(offset);
    if (size > MAX_REPORT_PHOTO_BYTES || offset + size + 12 > input.length)
      throw invalidPhoto('A imagem está incompleta ou inválida.');
    const type = input.toString('ascii', offset + 4, offset + 8);
    const data = input.subarray(offset + 8, offset + 8 + size);
    const expectedCrc = input.readUInt32BE(offset + 8 + size);
    if (crc32(input.subarray(offset + 4, offset + 8 + size)) !== expectedCrc)
      throw invalidPhoto('A imagem está incompleta ou inválida.');
    if (!/^[A-Za-z]{4}$/.test(type)) throw invalidPhoto('A imagem está incompleta ou inválida.');
    const critical = type[0] === type[0]?.toUpperCase();
    if (!sawHeader && type !== 'IHDR') throw invalidPhoto('A imagem está incompleta ou inválida.');
    if (critical && !['IHDR', 'PLTE', 'IDAT', 'IEND'].includes(type))
      throw invalidPhoto('Este PNG usa um formato não compatível.');
    if (type === 'IHDR') {
      if (sawHeader || size !== 13) throw invalidPhoto('A imagem está incompleta ou inválida.');
      sawHeader = true;
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (!validDimensions(width, height))
        throw invalidPhoto('A imagem tem dimensões muito grandes.');
    }
    if (type === 'IDAT') sawData = true;
    if (type === 'IEND') {
      if (size !== 0 || !sawData) throw invalidPhoto('A imagem está incompleta ou inválida.');
      chunks.push(chunk(type, data));
      sawEnd = true;
      offset += size + 12;
      break;
    }
    // Keep only essential PNG chunks. Text, EXIF, ICC, animation, and other metadata are removed.
    if (['IHDR', 'PLTE', 'IDAT'].includes(type)) chunks.push(chunk(type, data));
    offset += size + 12;
  }
  if (!sawHeader || !sawData || !sawEnd || offset !== input.length)
    throw invalidPhoto('A imagem está incompleta ou inválida.');
  return Buffer.concat(chunks);
}

function validDimensions(width: number, height: number) {
  return width > 0 && height > 0 && width <= 8000 && height <= 8000 && width * height <= 30_000_000;
}

function sanitizeJpeg(input: Buffer): Buffer {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) throw invalidPhoto();
  const output: Buffer[] = [input.subarray(0, 2)];
  let offset = 2;
  let foundScan = false;
  let frameSizeValid = false;
  let foundEnd = false;
  while (offset + 2 <= input.length) {
    if (input[offset] !== 0xff) throw invalidPhoto('A imagem está incompleta ou inválida.');
    let markerEnd = offset + 1;
    while (markerEnd < input.length && input[markerEnd] === 0xff) markerEnd++;
    if (markerEnd >= input.length) break;
    const marker = input[markerEnd]!;
    const segmentStart = offset;
    offset = markerEnd + 1;
    if (marker === 0xd9) {
      if (!foundScan) throw invalidPhoto('A imagem está incompleta ou inválida.');
      output.push(input.subarray(segmentStart, offset));
      foundEnd = true;
      break;
    }
    if (marker === 0xda) {
      if (offset + 2 > input.length) throw invalidPhoto('A imagem está incompleta ou inválida.');
      const length = input.readUInt16BE(offset);
      if (length < 2 || offset + length > input.length)
        throw invalidPhoto('A imagem está incompleta ou inválida.');
      output.push(input.subarray(segmentStart, offset + length));
      offset += length;
      const scanStart = offset;
      let foundMarker = false;
      while (offset + 1 < input.length) {
        if (input[offset] !== 0xff) {
          offset++;
          continue;
        }
        const next = input[offset + 1]!;
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
          offset += 2;
          continue;
        }
        output.push(input.subarray(scanStart, offset));
        foundScan = true;
        foundMarker = true;
        break;
      }
      if (!foundMarker) throw invalidPhoto('A imagem está incompleta ou inválida.');
      continue;
    }
    if ([0x01, ...Array.from({ length: 8 }, (_, index) => 0xd0 + index)].includes(marker)) {
      output.push(input.subarray(segmentStart, offset));
      continue;
    }
    if (offset + 2 > input.length) throw invalidPhoto('A imagem está incompleta ou inválida.');
    const length = input.readUInt16BE(offset);
    if (length < 2 || offset + length > input.length)
      throw invalidPhoto('A imagem está incompleta ou inválida.');
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker,
      )
    ) {
      if (length < 7) throw invalidPhoto('A imagem está incompleta ou inválida.');
      const height = input.readUInt16BE(offset + 3);
      const width = input.readUInt16BE(offset + 5);
      if (!validDimensions(width, height))
        throw invalidPhoto('A imagem tem dimensões muito grandes.');
      frameSizeValid = true;
    }
    const end = offset + length;
    // Drop all APPn and COM segments, which can carry EXIF, location, author, or device metadata.
    if (!(marker >= 0xe0 && marker <= 0xef) && marker !== 0xfe)
      output.push(input.subarray(segmentStart, end));
    offset = end;
  }
  const result = Buffer.concat(output);
  if (
    !foundScan ||
    !frameSizeValid ||
    !foundEnd ||
    offset !== input.length ||
    result.length < 4 ||
    result.at(-2) !== 0xff ||
    result.at(-1) !== 0xd9
  )
    throw invalidPhoto('A imagem está incompleta ou inválida.');
  return result;
}

export function sanitizeReportPhoto(
  data: Buffer,
  mimeType: string,
): { data: Buffer; mimeType: ReportPhotoMime } {
  if (data.length < 16 || data.length > MAX_REPORT_PHOTO_BYTES) throw invalidPhoto();
  if (mimeType === 'image/jpeg') return { data: sanitizeJpeg(data), mimeType };
  if (mimeType === 'image/png') return { data: sanitizePng(data), mimeType };
  throw invalidPhoto();
}

export async function saveReportPhoto(data: Buffer, mimeType: string): Promise<StoredReportPhoto> {
  const clean = sanitizeReportPhoto(data, mimeType);
  const storageKey = `${randomUUID()}${extname(clean.mimeType === 'image/jpeg' ? 'photo.jpg' : 'photo.png')}`;
  await mkdir(storageDirectory, { recursive: true, mode: 0o700 });
  await writeFile(resolve(storageDirectory, storageKey), clean.data, { flag: 'wx', mode: 0o600 });
  return { storageKey, mimeType: clean.mimeType, byteSize: clean.data.length };
}

export async function readReportPhoto(storageKey: string): Promise<Buffer> {
  if (!/^[0-9a-f-]{36}\.(jpg|png)$/.test(storageKey))
    throw new AppError(404, 'REPORT_PHOTO_NOT_FOUND', 'Foto não encontrada.');
  try {
    return await readFile(resolve(storageDirectory, storageKey));
  } catch {
    throw new AppError(404, 'REPORT_PHOTO_NOT_FOUND', 'Foto não encontrada.');
  }
}

export async function removeReportPhoto(storageKey: string): Promise<void> {
  if (!/^[0-9a-f-]{36}\.(jpg|png)$/.test(storageKey)) return;
  try {
    await unlink(resolve(storageDirectory, storageKey));
  } catch {
    // A missing file should not prevent replacing or deleting its metadata row.
  }
}
