import { AddressInfo } from 'net';
import _debug from 'debug';
import { createUdpHostCandidate, IceCandidate } from './candidate';
import { generateIceChars } from './utils';
import {
  parseMessage,
  isConnectivityCheck,
  createSuccessResponseForConnectivityCheck,
} from '../stun';

const debug = _debug('ice-lite');

export interface IceLiteParams {
  usernameFragment: string;
  password: string;
  candidate: IceCandidate;
}

export class IceLiteServer {
  private candidate: IceCandidate | null;
  private usernameFragment: string;
  private password: string;

  constructor() {
    this.candidate = null;
    this.usernameFragment = generateIceChars(4);
    this.password = generateIceChars(22);

    debug('constructor()', this.getLocalParameters());
  }

  start(aInfo: AddressInfo) {
    debug('start()');
    this.candidate = createUdpHostCandidate(this.usernameFragment, aInfo);
  }

  stop() {
    debug('stop()');
    this.candidate = null;
  }

  handleStunPacket($packet: Buffer): Buffer | null {
    // if we are not ready
    if (this.candidate === null) {
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
    if (!isConnectivityCheck(msg, $packet, this.password)) {
      return null;
    }

    console.log(msg);
    // TODO: return success-response
    // - MESSAGE-INTEGRITY
    // - FINGERPRINT
    const $res = createSuccessResponseForConnectivityCheck(
      msg.header.transactionId,
      this.candidate.address,
      this.candidate.port,
    );
    console.log($res);
    return $res;
  }

  getLocalParameters(): IceLiteParams {
    return {
      usernameFragment: this.usernameFragment,
      password: this.password,
      candidate: this.candidate as IceCandidate,
    };
  }
}
