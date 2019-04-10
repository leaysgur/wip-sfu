import { AddressInfo } from 'net';
import * as http from 'http';
import { IncomingMessage, ServerResponse, Server } from 'http';
import * as dgram from 'dgram';
import { Socket, BindOptions, RemoteInfo } from 'dgram';
import _debug from 'debug';
import { IceLiteServer, IceLiteParams } from '../ice';

const debug = _debug('server');

export interface SfuServerOptions {
  httpPort: number;
  sfuPort: number;
  sfuAddress: string;
}

export class SfuServer {
  udpSocket: Socket;
  iceServer: IceLiteServer;
  httpServer: Server;

  constructor() {
    debug('constructor()');
    this.udpSocket = dgram.createSocket('udp4');

    this.iceServer = new IceLiteServer();
    this.httpServer = http.createServer(
      (req: IncomingMessage, res: ServerResponse) => {
        if (req.url && req.url.startsWith('/offer')) {
          // TODO: use it
          const query = new URLSearchParams(req.url.split('?')[1]);
          console.log(query);
          // iceServer.handleClientOffer()

          const params = this.iceServer.getLocalParameters();
          console.log(params);

          res.setHeader('Access-Control-Allow-Origin', '*');
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end(paramsToAnswerSDP(params));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('GET /offer only allowed!');
      },
    );
  }

  async start(options: SfuServerOptions) {
    debug('start()', options);

    const { httpPort, sfuAddress, sfuPort } = options;
    debug('run HTTP server');
    this.httpServer.listen(httpPort);

    debug('bind UDP socket');
    await bindUdpSocket(this.udpSocket, { port: sfuPort, address: sfuAddress });
    this.udpSocket.on('message', this.handlePacket.bind(this));

    const aInfo = this.udpSocket.address() as AddressInfo;
    this.iceServer.start(aInfo);
  }

  stop() {
    this.iceServer.stop();
    this.udpSocket.close();
    this.httpServer.close();
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
}

function paramsToAnswerSDP(params: IceLiteParams): string {
  const { candidate, usernameFragment, password } = params;

  return [
    'v=0',
    'o=wip-webrtc 10000 1 IN IP4 0.0.0.0',
    's=-',
    't=0 0',
    'a=ice-lite',
    'a=fingerprint:sha-512 10:13:09:9F:88:F4:A6:D0:18:F3:AA:F5:01:9A:E6:8A:29:FF:9E:E1:40:56:F3:97:C6:46:6A:17:FA:06:83:65:E6:85:FE:A6:30:20:48:10:EA:73:74:1A:9A:D3:66:63:01:82:F7:FA:00:EA:77:27:2B:1B:9B:C6:30:25:E5:06',
    'a=msid-semantic: WMS *',
    'a=group:BUNDLE 0',
    'm=audio 7 UDP/TLS/RTP/SAVPF 111',
    'c=IN IP4 127.0.0.1',
    'a=rtpmap:111 opus/48000/2',
    'a=fmtp:111 useinbandfec=1;stereo=1;usedtx=1',
    'a=extmap:9 urn:ietf:params:rtp-hdrext:sdes:mid',
    'a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level',
    'a=setup:active',
    'a=mid:0',
    'a=recvonly',
    `a=ice-ufrag:${usernameFragment}`,
    `a=ice-pwd:${password}`,
    `a=candidate:${candidate.foundation} ${candidate.component} ${
      candidate.protocol
    } ${candidate.priority} ${candidate.address} ${candidate.port} typ ${
      candidate.type
    }`,
    'a=end-of-candidates',
    'a=ice-options:renomination',
    'a=rtcp-mux',
    'a=rtcp-rsize',
    '',
  ].join('\r\n');
}

function bindUdpSocket(sock: Socket, options: BindOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    sock.once('error', reject);
    sock.bind(options.port, options.address, () => {
      sock.removeListener('error', reject);
      resolve();
    });
  });
}
