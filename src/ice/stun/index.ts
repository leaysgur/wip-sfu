import * as nodeIp from 'ip';
import _debug from 'debug';
import { parseHeader, StunHeader } from './header';
import { parseAttrs, StunAttrs } from './attrs';
import {
  generateFingerprint,
  generateIntegrity,
  generateIntegrityWithFingerprint,
  bufferXor,
  createAttr,
} from './utils';

const debug = _debug('stun');

export interface StunMessage {
  header: StunHeader;
  attrs: StunAttrs;
}

export function parseMessage($packet: Buffer): StunMessage | null {
  const packetLen = $packet.length;
  if (packetLen < 20) {
    debug('header length must be 20, discard');
    return null;
  }

  const $header = $packet.slice(0, 20);
  const $attrs = $packet.slice(20, packetLen);

  const header = parseHeader($header);
  if (header === null) {
    return null;
  }

  // validate by STUN usage
  if (header.length + 20 !== packetLen) {
    debug('header.length is invalid, discard');
    return null;
  }

  const attrs = parseAttrs($attrs);
  if (attrs === null) {
    debug('error thrown while parsing attrs, discard');
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

// TODO: split logic
export function createSuccessResponseForConnectivityCheck(
  transactionId: string,
  integrityKey: string,
  address: string,
  port: number,
): Buffer {
  // header
  const $type = Buffer.alloc(2);
  $type.writeUInt16BE(0x0101, 0);

  const $length = Buffer.alloc(2);
  $length.writeUInt16BE(0, 0);

  const $magicCookie = Buffer.alloc(4);
  $magicCookie.writeInt32BE(0x2112a442, 0);

  const $transactionId = Buffer.alloc(12);
  $transactionId.write(transactionId, 0, 12, 'hex');

  const $header = Buffer.concat([$type, $length, $magicCookie, $transactionId]);

  // attrs
  // set XOR-MAPPED-ADDRESS
  const $family = Buffer.alloc(2);
  // XXX: only IPv4
  $family.writeUInt16BE(0x01, 0);

  const $port = Buffer.alloc(2);
  $port.writeUInt16BE(port, 0);
  const $xport = bufferXor($port, $magicCookie.slice(0, 2));

  const $address = nodeIp.toBuffer(address);
  const $xaddress = bufferXor($address, $magicCookie);

  const $xorMappedAddress = createAttr(
    0x0020,
    Buffer.concat([$family, $xport, $xaddress]),
  );
  const xMALen = $xorMappedAddress.length;
  const mILen = 24; // 4 + 20
  const fLen = 8; // 4 + 4

  let $res = Buffer.concat([$header, $xorMappedAddress]);

  // set MESSAGE-INTEGRITY
  // need to update w/ dummy value first
  $header.writeUInt16BE(xMALen + mILen, 2);
  $res = Buffer.concat([$header, $xorMappedAddress, Buffer.alloc(mILen)]);

  // update w/ correct value
  const $integrityValue = generateIntegrity($res, integrityKey);
  const $messageIntegrity = createAttr(0x0008, $integrityValue);
  $res = Buffer.concat([$header, $xorMappedAddress, $messageIntegrity]);

  // set FINGERPRINT
  // need to update w/ dummy value first
  $header.writeUInt16BE($xorMappedAddress.length + mILen + fLen, 2);
  $res = Buffer.concat([
    $header,
    $xorMappedAddress,
    $messageIntegrity,
    Buffer.alloc(fLen),
  ]);

  // update w/ correct value
  const $fpValue = generateFingerprint($res);
  const $fingerprint = createAttr(0x8028, $fpValue);
  $res = Buffer.concat([
    $header,
    $xorMappedAddress,
    $messageIntegrity,
    $fingerprint,
  ]);

  return $res;
}
