import { AddressInfo } from "net";
import _debug from "debug";
import { IceLiteServer, IceParams, IceCandidate } from "./ice";
import { isDtls, isRtp } from "./udp";

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

    this.iceServer.once("connected", () => {
      // TODO: replace this with
      // this.dtlsServer.start({ transport: this.iceServer });
      this.iceServer.on("message", $packet => {
        switch (true) {
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
      });
    });
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
