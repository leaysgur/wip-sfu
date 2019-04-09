import _debug from 'debug';
import { readHeader, StunHeader } from './header';
import { readAttrs, StunAttrs } from './attrs';
import { generateFingerprint, generateIntegrityWithFingerprint } from './utils';

const debug = _debug('stun');

export interface StunMessage {
  header: StunHeader;
  attrs: StunAttrs;
}

export function readMessage($packet: Buffer): StunMessage | null {
  const packetLen = $packet.length;
  if (packetLen < 20) {
    debug('header length must be 20, discard');
    return null;
  }

  const $header = $packet.slice(0, 20);
  const $attrs = $packet.slice(20, packetLen);

  const header = readHeader($header);
  if (header === null) {
    return null;
  }

  // validate by STUN usage
  if (header.length + 20 !== packetLen) {
    debug('header.length is invalid, discard');
    return null;
  }

  const attrs = readAttrs($attrs);
  if (attrs === null) {
    debug('error thrown while reading attrs, discard');
    return null;
  }

  // write into
  return { header, attrs };
}

export function isConnectivityCheck(
  msg: StunMessage,
  $packet: Buffer,
  integrityKey: string,
): boolean {
  if (msg.header.type !== 0x0001) {
    debug('not a BINDING-REQUEST, discard');
    return false;
  }

  if (!msg.attrs.username) {
    debug('client must have a USERNAME, discard');
    return false;
  }

  if (!(msg.attrs.fingerprint && msg.attrs.messageIntegrity)) {
    debug('both FINGERPRINT and MESSAGE-INTEGRITY are not found, discard');
    return false;
  }

  const $fingerprint = generateFingerprint($packet);
  if (!$fingerprint.equals(msg.attrs.fingerprint)) {
    debug('FINGERPRINT missmatch, discard');
    return false;
  }

  const $integrity = generateIntegrityWithFingerprint($packet, integrityKey);
  if (!$integrity.equals(msg.attrs.messageIntegrity)) {
    debug('MESSAGE-INTEGRITY missmatch, discard');
    return false;
  }

  return true;
}
