import { AddressInfo } from "net";
// import { Socket, RemoteInfo } from "dgram";
import _debug from "debug";
import {
  IceLiteServer,
  IceParams,
  IceCandidate,
  IceState,
  SelectedPair
} from "./ice";
// import { isDtls, isRtp } from "./udp";

const debug = _debug("transport");

interface TransportParams {
  iceParams: IceParams;
  iceCandidates: IceCandidate[];
}

export class Transport {
  private iceServer: IceLiteServer;

  constructor() {
    debug("constructor()");
    this.iceServer = new IceLiteServer();
  }

  async start(
    aInfos: AddressInfo[],
    remoteIceParams: IceParams
  ): Promise<void> {
    debug("start()", remoteIceParams);

    // then init another stuff
    await this.iceServer.start(aInfos, remoteIceParams);

    this.iceServer.on("selectedPair", ({ socket, rInfo }: SelectedPair) => {
      // TODO: store this selected
      // TODO: use selectedPair.rInfo to ignore other packet recv
      // TODO: use selectedPair.socket to packet send
      // use this socket and rAddress to send dtls, and so on..
      socket;
      rInfo;
    });
    this.iceServer.on("stateChange", (state: IceState) => {
      debug(state);
    });
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

  // TODO: private
  // handlePacket($packet: Buffer, rInfo: RemoteInfo, socket: Socket) {
  //   switch (true) {
  //     case isDtls($packet): {
  //       debug("handle dtls packet");
  //       break;
  //     }
  //     case isRtp($packet): {
  //       debug("handle rtp+rtcp packet");
  //       break;
  //     }
  //     default:
  //       debug("discard unknown packet");
  //   }
  // }
}
