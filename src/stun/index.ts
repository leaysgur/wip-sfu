export function isStunPakcket($packet: Buffer): boolean {
  return $packet[0] >= 0 && $packet[0] <= 3;
}

export class StunMessage {
  static parse() {
    return new StunMessage();
  }
}
