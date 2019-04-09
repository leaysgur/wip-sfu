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
  private usernameFragment: string;
  private password: string;
  private candidate: IceCandidate | null;
  private udpSocket: Socket;

  constructor(udpSocket: Socket) {
    super();

    this.udpSocket = udpSocket;
    const aInfo = this.udpSocket.address() as AddressInfo;

    this.usernameFragment = generateIceChars(4);
    this.password = generateIceChars(22);
    this.candidate = createUdpHostCandidate(this.usernameFragment, aInfo);

    debug('constructor()', this.getLocalParameters());
  }

  listen() {
    debug('listen()');

    this.udpSocket.on('message', packet => {
      console.log(packet);
    });
  }

  getLocalParameters(): IceLiteParams {
    return {
      usernameFragment: this.usernameFragment,
      password: this.password,
      candidate: this.candidate as IceCandidate,
    };
  }
}
