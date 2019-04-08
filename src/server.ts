import { createSocket, Socket, BindOptions } from 'dgram';
import _debug from 'debug';
import { createServer } from './ice';

const debug = _debug('server');

(async function() {
  debug('bind UDP socket');
  const udpSocket = await bindUdpSocket({ address: '127.0.0.1', port: 0 });

  debug('start ICE-Lite server');
  const iceServer = createServer();
  iceServer.listen(udpSocket);
  debug(iceServer.toJSON());

  // server: listen http /offer
  // broswer: createOffer, sLD
  // browser: send it
  // server: receive it
  // server: create answer SDP
  // server: return it
  // browser: sRD
})();

function bindUdpSocket(options: BindOptions): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const sock = createSocket('udp4');
    sock.once('error', reject);
    sock.bind(options.port, options.address, () => {
      sock.removeListener('error', reject);
      resolve(sock);
    });
  });
}
