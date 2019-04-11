import { AddressInfo } from 'net';
import * as dgram from 'dgram';
import { Socket, RemoteInfo } from 'dgram';
import _debug from 'debug';
import { IceLiteServer, IceParams, IceCandidate } from './ice';

const debug = _debug('connection');

export interface ConnectParams {
  iceParams: IceParams;
  iceCandidate: IceCandidate;
}

export class Connection {
  private address: string;
  private udpSocket: Socket;
  private iceServer: IceLiteServer;

  constructor(address: string) {
    debug('constructor()');
    this.address = address;

    this.udpSocket = dgram.createSocket('udp4');
    this.iceServer = new IceLiteServer();
  }

  async start(remoteIceParams: IceParams): Promise<ConnectParams> {
    debug('start()', remoteIceParams);
    await this.bindUdpSocket(this.udpSocket, this.address);
    this.udpSocket.on('message', this.handlePacket.bind(this));

    const aInfo = this.udpSocket.address() as AddressInfo;
    debug('bind UDP socket', aInfo);

    this.iceServer.start(aInfo, remoteIceParams);

    return {
      iceParams: this.iceServer.getLocalParameters(),
      iceCandidate: this.iceServer.getLocalCandidate(),
    };
  }

  // See https://tools.ietf.org/html/rfc7983#section-7
  handlePacket($packet: Buffer, rInfo: RemoteInfo) {
    switch (true) {
      case $packet[0] >= 0 && $packet[0] <= 3: {
        const $res = this.iceServer.handleStunPacket($packet);
        $res && this.udpSocket.send($res, rInfo.port, rInfo.address);
        // TODO: remove
        // $res && this.udpSocket.send($res, 55555);
        break;
      }
      case $packet[0] >= 20 && $packet[0] <= 63: {
        debug('handle dtls packet');
        break;
      }
      case $packet[0] >= 128 && $packet[0] <= 191: {
        debug('handle rtp/rtcp packet');
        break;
      }
      default:
        debug('discard unknown packet');
    }
  }

  private bindUdpSocket(sock: Socket, address: string): Promise<void> {
    return new Promise((resolve, reject) => {
      sock.once('error', reject);
      sock.bind(0, address, () => {
        sock.removeListener('error', reject);
        resolve();
      });
    });
  }
}
