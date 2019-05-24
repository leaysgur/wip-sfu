import { AddressInfo } from "net";
import * as dgram from "dgram";
import { Socket } from "dgram";

export function createAndBindSocket(aInfo: AddressInfo): Promise<Socket> {
  const type = aInfo.family === "IPv4" ? "udp4" : "udp6";
  const sock = dgram.createSocket(type);

  return new Promise((resolve, reject) => {
    sock.once("error", reject);
    sock.bind(aInfo.port, aInfo.address, () => {
      sock.removeListener("error", reject);
      resolve(sock);
    });
  });
}

// See https://tools.ietf.org/html/rfc7983#section-7
export function isStun($packet: Buffer): boolean {
  // STUN packet must have 20byte header
  return $packet[0] >= 0 && $packet[0] <= 3 && $packet.length > 20;
}
export function isDtls($packet: Buffer): boolean {
  return $packet[0] >= 20 && $packet[0] <= 63;
}
export function isRtp($packet: Buffer): boolean {
  return $packet[0] >= 128 && $packet[0] <= 191;
}
