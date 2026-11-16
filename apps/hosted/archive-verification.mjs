import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

const expandedLimit = 64 * 1024 * 1024;
const block = 512;

function tarOctal(bytes) {
  const integer = bytes.toString('latin1').replace(/[\0 ]+$/, '').trimStart();
  return /^[0-7]+$/.test(integer) ? Number.parseInt(integer, 8) : NaN;
}

function pinnedCommit(prefix) {
  const header = prefix.subarray(0, block);
  if (header[156] !== 0x67 || header.toString('ascii', 257, 262) !== 'ustar') return null;
  let checksum = 0;
  for (let i = 0; i < block; i++) checksum += i >= 148 && i < 156 ? 32 : header[i];
  if (checksum !== tarOctal(header.subarray(148, 156))) return null;
  const length = tarOctal(header.subarray(124, 136));
  if (!(length > 0 && length <= block)) return null;
  const metadata = prefix.subarray(block, block + length);
  let commit = null;
  for (let offset = 0; offset < metadata.length;) {
    const separator = metadata.indexOf(32, offset);
    if (separator < 0) return null;
    const number = metadata.toString('latin1', offset, separator);
    if (!/^[1-9][0-9]{0,2}$/.test(number)) return null;
    const end = offset + Number(number);
    if (end <= separator + 1 || end > metadata.length || metadata[end - 1] !== 10) return null;
    const entry = metadata.toString('latin1', separator + 1, end - 1);
    if (entry.startsWith('comment=')) {
      if (commit !== null || !/^comment=[a-f0-9]{40}$/.test(entry)) return null;
      commit = entry.slice(8);
    }
    offset = end;
  }
  return commit;
}

export async function verifyArchiveEnvelope(bytes, expectedCommit) {
  const prefix = Buffer.alloc(block * 2);
  let tail = Buffer.alloc(0);
  let size = 0;
  let tooLarge = false;
  try {
    await pipeline(Readable.from([bytes]), createGunzip(), async chunks => {
      for await (const chunk of chunks) {
        if (size < prefix.length) chunk.copy(prefix, size, 0, prefix.length - size);
        size += chunk.length;
        if (size > expandedLimit) {
          tooLarge = true;
          throw new Error('Archive expanded size limit exceeded');
        }
        tail = chunk.length >= block * 2 ? chunk.subarray(-block * 2)
          : Buffer.concat([tail, chunk]).subarray(-block * 2);
      }
    });
  } catch {
    return tooLarge ? 'too-large' : 'invalid-archive';
  }
  if (size < block * 4 || size % block !== 0 || tail.some(byte => byte !== 0)) return 'invalid-archive';
  return pinnedCommit(prefix) === expectedCommit ? 'verified' : 'wrong-revision';
}
