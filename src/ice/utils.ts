import { randomBytes } from 'crypto';

export function generateIceChars(len: number): string {
  const chars =
    'abcdefghijklmnopqrstuvwxyz' +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
    '1234567890' +
    '+/';

  let res = '';
  while (len--) {
    const random = randomBytes(4).readUInt32BE(0) / Math.pow(2, 32);
    res += chars.charAt(random * chars.length);
  }

  return res;
}
