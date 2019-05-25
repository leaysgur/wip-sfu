import { AddressInfo } from "net";
import { RemoteInfo } from "dgram";
import _debug from "debug";
import {
  IceLiteServer,
  IceParams,
  IceCandidate,
  IceState,
  SelectedPair
} from "./ice";
import { isDtls, isRtp } from "./udp";

const debug = _debug("transport");

interface TransportParams {
  iceParams: IceParams;
  iceCandidates: IceCandidate[];
}

export class Transport {
  private iceServer: IceLiteServer;
  private selectedPair: SelectedPair | null;

  constructor() {
    debug("constructor()");
    this.iceServer = new IceLiteServer();
    this.selectedPair = null;
  }

  async start(
    aInfos: AddressInfo[],
    remoteIceParams: IceParams
  ): Promise<void> {
    debug("start()", remoteIceParams);

    // then init another stuff
    await this.iceServer.start(aInfos, remoteIceParams);

    this.iceServer.on("selectedPair", (selectedPair: SelectedPair) => {
      debug("onIce:selectedPair");
      this.selectedPair = selectedPair;
      this.selectedPair.socket.on("message", this.handlePacket);

      // TODO: this.dtlsServer.run();
    });
    this.iceServer.on("stateChange", (state: IceState) => {
      debug("onIce:stateChange", state);
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

  private handlePacket($packet: Buffer, rInfo: RemoteInfo) {
    if (this.selectedPair === null) {
      return;
    }
    if (
      rInfo.address !== this.selectedPair.rInfo.address ||
      rInfo.port !== this.selectedPair.rInfo.port
    ) {
      return;
    }

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
  }
}
