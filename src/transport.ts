import { AddressInfo } from "net";
import _debug from "debug";
import { IceLiteServer, IceParams, IceCandidate } from "./ice";
import { UdpSocket } from "./udp";

const debug = _debug("transport");

interface TransportParams {
  iceParams: IceParams;
  iceCandidates: IceCandidate[];
}

export class Transport {
  private udpSockets: UdpSocket[];
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

    const boundAInfos = [];
    // bind UDP sockets
    for (const aInfo of aInfos) {
      // TODO: pass remote aInfo to ensure unicast
      const udpSocket = new UdpSocket(aInfo);
      const boundAInfo = await udpSocket.bind(aInfo);
      debug("bound UDP socket", boundAInfo);

      this.udpSockets.push(udpSocket);
      boundAInfos.push(boundAInfo);
    }

    // then init another stuff
    this.iceServer = new IceLiteServer(this.udpSockets, remoteIceParams);
    // this.iceServer.once(SUCCESS_RESPONSE_SEND, () => sendDtlsClientHello());
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
}
