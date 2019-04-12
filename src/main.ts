import { SfuServer } from './server';

(async function() {
  const sfuServer = new SfuServer({
    http: {
      family: 'IPv4',
      address: '127,0,0,1',
      port: 9001,
    },
    sfu: [
      {
        family: 'IPv4',
        address: '127.0.0.1',
        port: 0,
      },
      {
        family: 'IPv6',
        address: '::1',
        port: 0,
      },
    ],
  });

  await sfuServer.start().catch(err => {
    console.error(err);
    sfuServer.stop();
  });
})();
