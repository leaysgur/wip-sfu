import * as http from 'http';
import { IncomingMessage, ServerResponse, Server } from 'http';
import _debug from 'debug';
import { IceParams } from './ice';
import { Connection, ConnectParams } from './connection';

const debug = _debug('server');

export interface SfuServerOptions {
  httpPort: number;
  httpAddress: string;
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
    this.httpServer.listen(this.options.httpPort, this.options.httpAddress);
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

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(connParams));
  }
}
