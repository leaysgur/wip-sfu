import { AddressInfo } from "net";
import { RemoteInfo, Socket } from "dgram";
import { EventEmitter } from "events";
import _debug from "debug";
import { createAndBindSocket, isStun } from "../udp";
import { createUdpHostCandidate, IceCandidate } from "./candidate";
import { generateIceChars } from "./utils";
import {
  parseMessage,
  isConnectivityCheck,
  createSuccessResponseForConnectivityCheck
} from "./stun";

const debug = _debug("ice-lite");

export interface SelectedPair {
  socket: Socket;
  rInfo: RemoteInfo;
}

export type IceState = "new" | "connected" | "completed";

export interface IceParams {
  usernameFragment: string;
  password: string;
}

export class IceLiteServer extends EventEmitter {
  state: IceState;
  private udpSockets: Socket[];
  private localParams: IceParams;
  private remoteParams: IceParams;
  private candidates: IceCandidate[];

  constructor() {
    super();

    this.state = "new";
    this.udpSockets = [];
    this.localParams = {
      usernameFragment: generateIceChars(4),
      password: generateIceChars(22)
    };
    this.remoteParams = {
      usernameFragment: "",
      password: ""
    };
    this.candidates = [];

    debug("constructor()", this.localParams);
  }

  async start(aInfos: AddressInfo[], remoteIceParams: IceParams) {
    debug("start()");

    const boundAInfos = [];
    for (const aInfo of aInfos) {
      const udpSocket = await createAndBindSocket(aInfo);
      const boundAInfo = udpSocket.address() as AddressInfo;
      debug("bind UDP socket", boundAInfo);

      udpSocket.on("message", ($packet, rInfo) => {
        if (!isStun($packet)) {
          return;
        }
        this.handleStunPacket($packet, rInfo, udpSocket);
      });

      this.udpSockets.push(udpSocket);
      boundAInfos.push(boundAInfo);
    }

    // need bound port
    this.candidates = boundAInfos.map((aInfo, idx) =>
      createUdpHostCandidate(this.localParams.usernameFragment, aInfo, idx)
    );
    this.remoteParams = remoteIceParams;
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

  private handleStunPacket($packet: Buffer, rInfo: RemoteInfo, socket: Socket) {
    debug("handleStunPacket() from", rInfo);

    const msg = parseMessage($packet);
    // fail to parse OR not a binding request, discard
    if (msg === null) {
      return;
    }

    // validate by ICE usage
    if (!msg.attrs.iceControlling) {
      debug("client must be an ICE-CONTROLLING, discard");
      return;
    }
    const validUsername =
      this.localParams.usernameFragment +
      ":" +
      this.remoteParams.usernameFragment;
    if (msg.attrs.username !== validUsername) {
      debug("USERNAME is invalid, discard");
      return;
    }
    if (!isConnectivityCheck(msg, $packet, this.localParams.password)) {
      debug("Invalid STUN request, discard");
      return;
    }

    // send back success response
    const $res = createSuccessResponseForConnectivityCheck(
      msg.header.transactionId,
      this.remoteParams.password,
      rInfo.address,
      rInfo.port
    );
    socket.send($res, rInfo.port, rInfo.address);

    // it means this pair is selected and available
    this.handleSelectedPair(socket, rInfo, !!msg.attrs.useCandidate);
  }

  private handleSelectedPair(
    socket: Socket,
    rInfo: RemoteInfo,
    useCandidate: boolean
  ) {
    debug("handleSelectedPair()", rInfo, useCandidate);

    switch (this.state) {
      // set selected this 1st candidate
      case "new": {
        this.setSelectedPair({ socket, rInfo });
        this.setState("connected");
        break;
      }
      //  2nd, 3rd.. candidates OR 1st candidate conn checks
      case "connected": {
        if (useCandidate) {
          this.setState("completed");
        }
        break;
      }
      case "completed": {
        break;
      }
    }
  }

  private setSelectedPair(pair: SelectedPair) {
    debug("setSelectedPair()", pair.rInfo, pair.socket.address());

    for (const udpSocket of this.udpSockets) {
      if (udpSocket !== pair.socket) {
        udpSocket.removeAllListeners();
        udpSocket.close();
      }
    }

    this.emit("selectedPair", pair);
  }

  private setState(newState: IceState) {
    debug(`setState() from ${this.state} to ${newState}`);
    this.state = newState;
    this.emit("stateChange", newState);
  }
}
