import { AddressInfo } from "net";
import * as dgram from "dgram";
import { Socket, RemoteInfo } from "dgram";
import { EventEmitter } from "events";
import _debug from "debug";

const debug = _debug("udp");

export class UdpSocket extends EventEmitter {
  private sock: Socket;

  constructor(aInfo: AddressInfo) {
    super();

    const type = aInfo.family === "IPv4" ? "udp4" : "udp6";
    this.sock = dgram.createSocket(type);
  }

  get address(): AddressInfo {
    return this.sock.address() as AddressInfo;
  }

  async bind(aInfo: AddressInfo): Promise<AddressInfo> {
    return new Promise((resolve, reject) => {
      this.sock.once("error", reject);
      this.sock.bind(aInfo.port, aInfo.address, () => {
        this.sock.removeListener("error", reject);
        this.sock.on("message", this.handlePacket.bind(this));
        resolve(this.address);
      });
    });
  }

  // See https://tools.ietf.org/html/rfc7983#section-7
  handlePacket($packet: Buffer, rInfo: RemoteInfo) {
    switch (true) {
      case $packet[0] >= 0 && $packet[0] <= 3: {
        this.emit("stun", $packet, rInfo);
        break;
      }
      case $packet[0] >= 20 && $packet[0] <= 63: {
        debug("handle dtls packet");
        break;
      }
      case $packet[0] >= 128 && $packet[0] <= 191: {
        debug("handle rtp/rtcp packet");
        break;
      }
      default:
        debug("discard unknown packet");
    }
  }

  send($packet: Buffer, rInfo: RemoteInfo) {
    this.sock.send($packet, rInfo.port, rInfo.address);
  }
}
