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

type IceState = "new" | "connected" | "completed";

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

    debug("constructor()", this);
  }

  async start(aInfos: AddressInfo[], remoteIceParams: IceParams) {
    debug("start()");

    const boundAInfos = [];
    for (const aInfo of aInfos) {
      const udpSocket = await createAndBindSocket(aInfo);
      boundAInfos.push(udpSocket.address() as AddressInfo);

      udpSocket.on("message", ($packet, rInfo) => {
        if (!isStun($packet)) {
          return;
        }
        this.handleStunPacket($packet, rInfo, udpSocket);
      });

      this.udpSockets.push(udpSocket);
      debug("bind UDP socket", udpSocket);
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
    debug("handleStunPacket()", rInfo.address, rInfo.port);

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
    rInfo;
    socket;

    // TODO: when setSelected
    // - start DTLS
    // - close other sockets
    switch (this.state) {
      case "new": {
        this.setState("connected");
        // add
        // setSelected
        break;
      }
      case "connected": {
        if (useCandidate) {
          // add
          // setSelected
          this.setState("completed");
        } else {
          // add
        }
        break;
      }
      case "completed": {
        if (useCandidate) {
          // add
          // setSelected
          this.setState("completed");
        } else {
          // add
        }
        break;
      }
    }
  }

  private setState(newState: IceState) {
    debug(`setState() from ${this.state} to ${newState}`);
    this.state = newState;
    this.emit("stateChange", newState);
  }
}
