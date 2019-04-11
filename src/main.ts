import { SfuServer } from './server';

const SFU_ADDRESS = '127.0.0.1';
const HTTP_PORT = 9001;

(async function() {
  const sfuServer = new SfuServer({
    httpPort: HTTP_PORT,
    sfuAddress: SFU_ADDRESS,
  });

  await sfuServer.start().catch(err => {
    console.error(err);
    sfuServer.stop();
  });
})();
