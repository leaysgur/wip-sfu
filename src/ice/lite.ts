import { RemoteInfo } from "dgram";
import _debug from "debug";
import { createUdpHostCandidate, IceCandidate } from "./candidate";
import { generateIceChars } from "./utils";
import {
  parseMessage,
  isConnectivityCheck,
  createSuccessResponseForConnectivityCheck
} from "./stun";
import { UdpSocket } from "../udp";

const debug = _debug("ice-lite");

export interface IceParams {
  usernameFragment: string;
  password: string;
}

export class IceLiteServer {
  private localParams: IceParams;
  private remoteParams: IceParams;
  private candidates: IceCandidate[];

  constructor(udpSockets: UdpSocket[], remoteIceParams: IceParams) {
    this.localParams = {
      usernameFragment: generateIceChars(4),
      password: generateIceChars(22)
    };
    this.remoteParams = remoteIceParams;

    const aInfos = udpSockets.map(sock => sock.address);
    this.candidates = aInfos.map((aInfo, idx) =>
      createUdpHostCandidate(this.localParams.usernameFragment, aInfo, idx)
    );

    for (const udpSocket of udpSockets) {
      udpSocket.on("stun", ($packet: Buffer, rInfo: RemoteInfo) => {
        const $res = this.handleStunPacket($packet, rInfo);
        $res && udpSocket.send($res, rInfo);

        // TODO: send success response means this remote candidate can be valid tuple
      });
    }

    debug("constructor()", this.getLocalParameters());
  }

  handleStunPacket($packet: Buffer, rInfo: RemoteInfo): Buffer | null {
    debug("handleStunPacket()", rInfo);

    // if we are not ready
    if (!(this.candidates.length !== 0 && this.remoteParams !== null)) {
      return null;
    }

    const msg = parseMessage($packet);
    // fail to parse OR not a binding request, discard
    if (msg === null) {
      return null;
    }

    // validate by ICE usage
    if (!msg.attrs.iceControlling) {
      debug("client must be an ICE-CONTROLLING, discard");
      return null;
    }
    const validUsername =
      this.localParams.usernameFragment +
      ":" +
      this.remoteParams.usernameFragment;
    if (msg.attrs.username !== validUsername) {
      debug("USERNAME is invalid, discard");
      return null;
    }
    if (!isConnectivityCheck(msg, $packet, this.localParams.password)) {
      return null;
    }

    if (msg.attrs.useCandidate) {
      debug("receive USE-CANDIDATE");
      // TODO: connected -> completed
    }

    const $res = createSuccessResponseForConnectivityCheck(
      msg.header.transactionId,
      this.remoteParams.password,
      rInfo.address,
      rInfo.port
    );

    return $res;
  }

  getLocalParameters(): IceParams {
    return {
      usernameFragment: this.localParams.usernameFragment,
      password: this.localParams.password
    };
  }

  getLocalCandidates(): IceCandidate[] {
    return this.candidates;
  }
}
