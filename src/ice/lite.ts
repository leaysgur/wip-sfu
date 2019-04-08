import { EventEmitter } from 'events';
import { AddressInfo } from 'net';
import { Socket } from 'dgram';
import _debug from 'debug';
import { createUdpHostCandidate, IceCandidate } from './candidate';
import { generateIceChars } from './utils';

const debug = _debug('ice-lite');

export interface IceLiteParams {
  usernameFragment: string;
  password: string;
  candidate: IceCandidate;
}

export class IceLiteServer extends EventEmitter {
  state: RTCIceTransportState;
  usernameFragment: string;
  password: string;
  candidate: IceCandidate | null;
  udpSocket: Socket | null;

  constructor() {
    super();

    this.state = 'new';
    this.usernameFragment = generateIceChars(4);
    this.password = generateIceChars(22);
    this.candidate = null;
    this.udpSocket = null;

    debug('constructor()', this);
  }

  listen(udpSocket: Socket) {
    debug('listen()');

    this.udpSocket = udpSocket;
    const aInfo = this.udpSocket.address() as AddressInfo;
    this.candidate = createUdpHostCandidate(this.usernameFragment, aInfo);

    this.udpSocket.on('message', debug.extend('udp'));
  }

  getLocalParameters(): IceLiteParams {
    return {
      usernameFragment: this.usernameFragment,
      password: this.password,
      candidate: this.candidate as IceCandidate,
    };
  }
}
