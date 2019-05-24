import { AddressInfo } from "net";
import { Socket, RemoteInfo } from "dgram";
import _debug from "debug";
import { IceLiteServer, IceParams, IceCandidate } from "./ice";
import { createAndBindSocket, isStun, isDtls, isRtp } from "./udp";

const debug = _debug("transport");

interface TransportParams {
  iceParams: IceParams;
  iceCandidates: IceCandidate[];
}

export class Transport {
  private udpSockets: Socket[];
  private iceServer: IceLiteServer | null;

  constructor() {
    debug("constructor()");

    this.udpSockets = [];
    this.iceServer = null;
  }

  async start(
    aInfos: AddressInfo[],
    remoteIceParams: IceParams
  ): Promise<void> {
    debug("start()", remoteIceParams);

    // bind UDP sockets
    const boundAInfos = [];
    for (const aInfo of aInfos) {
      // TODO: pass rInfo to ensure unicast
      const udpSocket = await createAndBindSocket(aInfo);
      udpSocket.on("message", ($packet, rInfo) =>
        this.handlePacket($packet, rInfo, udpSocket)
      );
      this.udpSockets.push(udpSocket);

      const boundAInfo = udpSocket.address() as AddressInfo;
      debug("bound UDP socket", boundAInfo);
      boundAInfos.push(boundAInfo);
    }

    // then init another stuff
    this.iceServer = new IceLiteServer(boundAInfos, remoteIceParams);
    // TODO this.dtls = ...
  }

  getParams(): TransportParams {
    if (this.iceServer === null) {
      throw new Error("Transport.start() is not called yet!");
    }

    return {
      iceParams: this.iceServer.getLocalParameters(),
      iceCandidates: this.iceServer.getLocalCandidates()
    };
  }

  handlePacket($packet: Buffer, rInfo: RemoteInfo, socket: Socket) {
    if (this.iceServer === null) {
      return;
    }

    switch (true) {
      case isStun($packet): {
        const $res = this.iceServer.handleStunPacket($packet, rInfo);
        if ($res !== null) {
          socket.send($res, rInfo.port, rInfo.address);
        }
        break;
      }
      case isDtls($packet): {
        debug("handle dtls packet");
        break;
      }
      case isRtp($packet): {
        debug("handle rtp+rtcp packet");
        break;
      }
      default:
        debug("discard unknown packet");
    }
  }
}
