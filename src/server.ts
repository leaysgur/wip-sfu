import * as http from 'http';
import { IncomingMessage, ServerResponse, Server } from 'http';
import _debug from 'debug';
import { IceParams } from './ice';
import { Connection, ConnectParams } from './connection';

const debug = _debug('server');

export interface SfuServerOptions {
  httpPort: number;
  sfuAddress: string;
}

export class SfuServer {
  private options: SfuServerOptions;
  private httpServer: Server;
  private pubConnections: Map<string, Connection>;

  constructor(options: SfuServerOptions) {
    debug('constructor()', options);
    this.options = options;

    this.pubConnections = new Map();

    this.httpServer = http.createServer(
      (req: IncomingMessage, res: ServerResponse) => {
        const url = req.url!;
        const query = new URLSearchParams(url.split('?')[1]);

        res.setHeader('Access-Control-Allow-Origin', '*');

        switch (true) {
          case url.startsWith('/publish'): {
            this.handlePublish(query, res);
            break;
          }
          default: {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('GET /offer only allowed!');
          }
        }
      },
    );

    debug('http server created');
  }

  async start() {
    debug('start()');
    this.httpServer.listen(this.options.httpPort);
  }

  stop() {
    debug('stop()');
    this.httpServer.close();
  }

  private async handlePublish(query: URLSearchParams, res: ServerResponse) {
    // TODO: validate query

    const id = query.get('id') as string;
    const remoteIceParams = {
      usernameFragment: query.get('usernameFragment'),
      password: query.get('password'),
    } as IceParams;

    debug('handlePublish()', id);

    const conn = new Connection(this.options.sfuAddress);
    const connParams = (await conn
      .start(remoteIceParams)
      .catch(console.error)) as ConnectParams;

    this.pubConnections.set(id, conn);

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(this.paramsToAnswerSDP(connParams));
  }

  private paramsToAnswerSDP(params: ConnectParams): string {
    const {
      iceParams: { usernameFragment, password },
      iceCandidate,
    } = params;
    const candidate = iceCandidate;

    return [
      'v=0',
      'o=wip-webrtc 10000 1 IN IP4 0.0.0.0',
      's=-',
      't=0 0',
      'a=ice-lite',
      // tslint:disable-next-line:max-line-length
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
}
