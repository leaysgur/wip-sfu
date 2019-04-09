import { SfuServer } from './server';

const SFU_ADDRESS = '127.0.0.1';
const SFU_PORT = 0; // means random
const HTTP_PORT = 9001;

(async function() {
  const sfuServer = new SfuServer();

  await sfuServer
    .start({
      httpPort: HTTP_PORT,
      sfuPort: SFU_PORT,
      sfuAddress: SFU_ADDRESS,
    })
    .catch(err => {
      console.error(err);
      sfuServer.stop();
    });
})();
