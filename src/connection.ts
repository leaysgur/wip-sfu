import { AddressInfo } from 'net';
import * as dgram from 'dgram';
import { Socket, RemoteInfo } from 'dgram';
import _debug from 'debug';
import { IceLiteServer, IceParams, IceCandidate } from './ice';

const debug = _debug('connection');

export interface ConnectParams {
  iceParams: IceParams;
  iceCandidates: IceCandidate[];
}

export class Connection {
  private aInfos: AddressInfo[];
  private udpSockets: Socket[];
  private iceServer: IceLiteServer;

  constructor(aInfos: AddressInfo[]) {
    debug('constructor()');

    this.aInfos = aInfos;
    this.udpSockets = [];
    this.iceServer = new IceLiteServer();
  }

  async start(remoteIceParams: IceParams): Promise<ConnectParams> {
    debug('start()', remoteIceParams);

    for (const aInfo of this.aInfos) {
      const type = aInfo.family === 'IPv4' ? 'udp4' : 'udp6';
      const udpSocket = dgram.createSocket(type);
      await this.bindUdpSocket(udpSocket, aInfo);
      udpSocket.on('message', ($packet: Buffer, rInfo: RemoteInfo) =>
        this.handlePacket($packet, rInfo, udpSocket),
      );
      this.udpSockets.push(udpSocket);
      debug('bind UDP socket', aInfo);
    }

    const boundAddressInfo = this.udpSockets.map(
      udpSocket => udpSocket.address() as AddressInfo,
    );
    this.iceServer.start(boundAddressInfo, remoteIceParams);

    return {
      iceParams: this.iceServer.getLocalParameters(),
      iceCandidates: this.iceServer.getLocalCandidates(),
    };
  }

  // See https://tools.ietf.org/html/rfc7983#section-7
  handlePacket($packet: Buffer, rInfo: RemoteInfo, udpSocket: Socket) {
    switch (true) {
      case $packet[0] >= 0 && $packet[0] <= 3: {
        const $res = this.iceServer.handleStunPacket($packet, rInfo);
        $res && udpSocket.send($res, rInfo.port, rInfo.address);
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

  private bindUdpSocket(sock: Socket, aInfo: AddressInfo): Promise<void> {
    return new Promise((resolve, reject) => {
      sock.once('error', reject);
      sock.bind(aInfo.port, aInfo.address, () => {
        sock.removeListener('error', reject);
        resolve();
      });
    });
  }
}
