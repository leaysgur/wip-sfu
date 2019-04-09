import _debug from 'debug';
import { calcPaddingByte } from './utils';

const debug = _debug('stun');

interface StunMessage {
  header: StunHeader | null;
  attrs: StunAttrs | null;
}
interface StunHeader {
  type: number;
  length: number;
  magicCookie: number;
  transactionId: string;
}
interface StunAttrs {
  username: string;
  iceControlling: boolean;
  priority: number;
  messageIntegrity: Buffer;
  fingerprint: Buffer;
}

export function parseStunMessage($packet: Buffer): StunMessage {
  const $header = $packet.slice(0, 20);
  const $attrs = $packet.slice(20, $packet.length);

  const header = parseStunHeader($header);
  // early return
  if (header === null) {
    return { header, attrs: null };
  }
  if (header.length + 20 !== $packet.length) {
    debug('length is invalid, discard');
    return { header, attrs: null };
  }

  const attrs = parseStunAttrs($attrs);

  console.log(header);
  console.log(attrs);

  // validate fingerprint
  // validate message-integrity

  return { header, attrs };
}

function parseStunHeader($header: Buffer): StunHeader | null {
  const type = $header.readUInt16BE(0);
  const length = $header.readUInt16BE(2);
  const magicCookie = $header.readUInt32BE(4);
  const transactionId = $header.slice(8, 20).toString('hex');

  if (type !== 0x0001) {
    debug('not a STUN BINDING_REQUEST, discard');
    return null;
  }

  if (magicCookie !== 0x2112a442) {
    debug('magic cookie value is invalid, discard');
    return null;
  }

  return { type, length, magicCookie, transactionId };
}

function parseStunAttrs($attrs: Buffer): StunAttrs | null {
  const map = new Map();
  let offset = 0;
  while (offset < $attrs.length) {
    const type = $attrs.readUInt16BE(offset);
    offset += 2; // 16bit = 2byte

    const length = $attrs.readUInt16BE(offset);
    offset += 2; // 16bit = 2byte

    const $value = $attrs.slice(offset, offset + length);
    offset += $value.length;

    // STUN Attribute must be in 32bit(= 4byte) boundary
    const paddingByte = calcPaddingByte(length, 4);
    offset += paddingByte;

    switch (type) {
      // USERNAME
      case 0x0006: {
        map.set('username', $value.toString());
        break;
      }
      // ICE-CONTROLLING
      case 0x802a: {
        map.set('iceControlling', true);
        break;
      }
      // PRIORITY
      case 0x0024: {
        map.set('priority', $value.readUInt32BE(0));
        break;
      }
      // MESSAGE-INTEGRITY
      case 0x0008: {
        map.set('messageIntegrity', $value);
        break;
      }
      // FINGERPRINT
      case 0x8028: {
        map.set('fingerprint', $value);
        break;
      }
      default: {
        // discard
      }
    }
  }

  if (map.size !== 5) {
    debug('some of required attrs are missing, discard');
    return null;
  }

  return {
    username: map.get('username'),
    iceControlling: map.get('iceControlling'),
    priority: map.get('priority'),
    messageIntegrity: map.get('messageIntegrity'),
    fingerprint: map.get('fingerprint'),
  };
}
