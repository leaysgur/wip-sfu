import { createHmac } from 'crypto';
import * as crc32 from 'buffer-crc32';

/**
 * Calculate padding bytes
 *
 * (2, 4) -> 2
 * (4, 4) -> 0
 * (7, 4) -> 3
 * (15, 4) -> 1
 */
export function calcPaddingByte(curByte: number, boundaryByte: number): number {
  const missingBoundaryByte = curByte % boundaryByte;
  const paddingByte =
    missingBoundaryByte === 0 ? 0 : boundaryByte - missingBoundaryByte;
  return paddingByte;
}

export function bufferXor(a: Buffer, b: Buffer): Buffer {
  if (a.length !== b.length) {
    throw new TypeError('You can not XOR buffers which length are different');
  }

  const length = a.length;
  const buffer = Buffer.allocUnsafe(length);

  for (let i = 0; i < length; i++) {
    buffer[i] = a[i] ^ b[i];
  }

  return buffer;
}

export function createAttr(type: number, $value: Buffer): Buffer {
  // 2byte(16bit) for type
  const $type = Buffer.alloc(2);
  $type.writeUInt16BE(type, 0);

  // 2byte(16bit) for length
  const $length = Buffer.alloc(2);
  $length.writeUInt16BE($value.length, 0);

  const paddingByte = calcPaddingByte($value.length, 4);
  const $padding = Buffer.alloc(paddingByte);

  return Buffer.concat([$type, $length, $value, $padding]);
}

export function generateFingerprint($msg: Buffer): Buffer {
  // without FINGERPRINT: 8byte(header: 4byte + value: 4byte(32bit))
  const $crc32 = crc32($msg.slice(0, -8));
  return bufferXor($crc32, Buffer.from('5354554e', 'hex'));
}

export function generateIntegrity($msg: Buffer, integrityKey: string): Buffer {
  // without MESSAGE-INTEGRITY: 24byte(header: 4byte + value: 20byte(sha1))
  return createHmac('sha1', integrityKey)
    .update($msg.slice(0, -24))
    .digest();
}

export function generateIntegrityWithFingerprint(
  $msg: Buffer,
  integrityKey: string,
): Buffer {
  // modify header length to ignore FINGERPRINT(8byte)
  const msgLen = $msg.readUInt16BE(2);
  $msg.writeUInt16BE(msgLen - 8, 2);

  // without 32byte MESSAGE-INTEGRITY(24byte)
  // + FINGERPRINT: 8byte = (header: 4byte + value: 4byte)
  return createHmac('sha1', integrityKey)
    .update($msg.slice(0, -32))
    .digest();
}
