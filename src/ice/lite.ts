import { AddressInfo } from 'net';
import _debug from 'debug';
import { createUdpHostCandidate, IceCandidate } from './candidate';
import { generateIceChars } from './utils';

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
    console.log($packet.slice(0, 20));

    // TODO: handle stun packet
    // parse it
    // check attrs
    // copy tId
    // return success-response
    return null;
  }

  getLocalParameters(): IceLiteParams {
    return {
      usernameFragment: this.usernameFragment,
      password: this.password,
      candidate: this.candidate as IceCandidate,
    };
  }
}
