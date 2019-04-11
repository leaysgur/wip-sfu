import { AddressInfo } from 'net';
import { RemoteInfo } from 'dgram';
import _debug from 'debug';
import { createUdpHostCandidate, IceCandidate } from './candidate';
import { generateIceChars } from './utils';
import {
  parseMessage,
  isConnectivityCheck,
  createSuccessResponseForConnectivityCheck,
} from './stun';

const debug = _debug('ice-lite');

export interface IceParams {
  usernameFragment: string;
  password: string;
}

export class IceLiteServer {
  private candidate: IceCandidate | null;
  private localParams: IceParams;
  private remoteParams: IceParams | null;

  constructor() {
    this.candidate = null;
    this.remoteParams = null;
    this.localParams = {
      usernameFragment: generateIceChars(4),
      password: generateIceChars(22),
    };

    debug('constructor()', this.getLocalParameters());
  }

  start(aInfo: AddressInfo, remoteIceParams: IceParams) {
    debug('start()');
    this.remoteParams = remoteIceParams;
    this.candidate = createUdpHostCandidate(
      this.localParams.usernameFragment,
      aInfo,
    );
  }

  stop() {
    debug('stop()');
    this.candidate = null;
  }

  handleStunPacket($packet: Buffer, rInfo: RemoteInfo): Buffer | null {
    debug('handleStunPacket()');

    // if we are not ready
    if (!(this.candidate !== null && this.remoteParams !== null)) {
      return null;
    }

    const msg = parseMessage($packet);
    // fail to parse OR not a binding request, discard
    if (msg === null) {
      return null;
    }

    // validate by ICE usage
    if (!msg.attrs.iceControlling) {
      debug('client must be an ICE-CONTROLLING, discard');
      return null;
    }
    const validUsername =
      this.localParams.usernameFragment +
      ':' +
      this.remoteParams.usernameFragment;
    if (msg.attrs.username !== validUsername) {
      debug('USERNAME is invalid, discard');
      return null;
    }
    if (!isConnectivityCheck(msg, $packet, this.localParams.password)) {
      return null;
    }

    const $res = createSuccessResponseForConnectivityCheck(
      msg.header.transactionId,
      this.remoteParams.password,
      rInfo.address,
      rInfo.port,
    );

    // if (USE-CANDIDATE) {}

    return $res;
  }

  getLocalParameters(): IceParams {
    return {
      usernameFragment: this.localParams.usernameFragment,
      password: this.localParams.password,
    };
  }

  getLocalCandidate(): IceCandidate {
    return this.candidate as IceCandidate;
  }
}
