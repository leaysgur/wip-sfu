import _debug from "debug";

const debug = _debug("stun");

export interface StunHeader {
  type: number;
  length: number;
  magicCookie: number;
  transactionId: string;
}

export function parseHeader($header: Buffer): StunHeader | null {
  const type = $header.readUInt16BE(0);
  const length = $header.readUInt16BE(2);
  const magicCookie = $header.readUInt32BE(4);
  const transactionId = $header.slice(8, 20).toString("hex");

  if (magicCookie !== 0x2112a442) {
    debug("magic cookie value is invalid, discard");
    return null;
  }

  return { type, length, magicCookie, transactionId };
}
