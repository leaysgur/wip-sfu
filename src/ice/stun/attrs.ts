import { calcPaddingByte } from "./utils";

export interface StunAttrs {
  username?: string;
  iceControlling?: boolean;
  priority?: number;
  useCandidate?: boolean;
  messageIntegrity?: Buffer;
  fingerprint?: Buffer;
}

export function parseAttrs($attrs: Buffer): StunAttrs | null {
  const attrs: StunAttrs = {};

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

    try {
      readValueByType(type, $value, attrs);
    } catch {
      return null;
    }
  }

  return attrs;
}

function readValueByType(type: number, $value: Buffer, attrs: StunAttrs) {
  switch (type) {
    case 0x0006: {
      attrs.username = $value.toString();
      break;
    }
    case 0x802a: {
      attrs.iceControlling = true;
      break;
    }
    case 0x0024: {
      attrs.priority = $value.readUInt32BE(0);
      break;
    }
    case 0x0025: {
      attrs.useCandidate = true;
      break;
    }
    case 0x0008: {
      attrs.messageIntegrity = $value;
      break;
    }
    case 0x8028: {
      attrs.fingerprint = $value;
      break;
    }
    case 0xc057: {
      // ignore NETWORK-COST
      break;
    }
  }
}
