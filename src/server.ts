import * as http from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import * as dgram from 'dgram';
import { Socket, BindOptions } from 'dgram';
import _debug from 'debug';
import { createServer } from './ice';
import { IceLiteParams } from './ice/lite';

const debug = _debug('server');

const SFU_ADDRESS = '127.0.0.1';
const HTTP_PORT = 9001;

(async function() {
  debug('bind UDP socket');
  const udpSocket = await bindUdpSocket({ address: SFU_ADDRESS, port: 0 });

  debug('start ICE-Lite server');
  const iceServer = createServer();
  iceServer.listen(udpSocket);

  debug('create http server');
  const httpServer = http.createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      if (req.url && req.url.startsWith('/offer')) {
        const params = iceServer.getLocalParameters();
        console.log(params);

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(paramsToAnswerSDP(params));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Wrong path!');
    },
  );

  debug('start http server on', HTTP_PORT);
  httpServer.listen(HTTP_PORT);

  // broswer: audioonly-sendonly
  // broswer: createOffer, sLD
  // browser: send it
  // server: receive it
  // server: create answer SDP
  // server: return it
  // browser: sRD
})();

function bindUdpSocket(options: BindOptions): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket('udp4');
    sock.once('error', reject);
    sock.bind(options.port, options.address, () => {
      sock.removeListener('error', reject);
      resolve(sock);
    });
  });
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
