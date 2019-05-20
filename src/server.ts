import * as http from "http";
import { IncomingMessage, ServerResponse, Server } from "http";
import { AddressInfo } from "net";
import _debug from "debug";
import { IceParams } from "./ice";
import { Connection, ConnectParams } from "./connection";

const debug = _debug("server");

export interface SfuServerOptions {
  http: AddressInfo;
  sfu: AddressInfo[];
}

export class SfuServer {
  private options: SfuServerOptions;
  private httpServer: Server;
  private pubConnections: Map<string, Connection>;

  constructor(options: SfuServerOptions) {
    debug("constructor()", options);
    this.options = options;

    this.pubConnections = new Map();

    this.httpServer = http.createServer(
      (req: IncomingMessage, res: ServerResponse) => {
        const url = req.url;
        if (!url) {
          return;
        }
        const query = new URLSearchParams(url.split("?")[1]);

        res.setHeader("Access-Control-Allow-Origin", "*");

        switch (true) {
          case url.startsWith("/publish"): {
            this.handlePublish(query, res);
            break;
          }
          default: {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("GET /offer only allowed!");
          }
        }
      }
    );

    debug("http server created");
  }

  async start() {
    debug("start()");
    this.httpServer.listen(this.options.http);
  }

  stop() {
    debug("stop()");
    this.httpServer.close();
  }

  private async handlePublish(query: URLSearchParams, res: ServerResponse) {
    // TODO: validate query
    const id = query.get("id") || "";
    const usernameFragment = query.get("usernameFragment") || "";
    const password = query.get("password") || "";

    const remoteIceParams: IceParams = {
      usernameFragment,
      password
    };

    debug("handlePublish()", id);

    const conn = new Connection(this.options.sfu);

    try {
      const connParams = (await conn.start(remoteIceParams)) as ConnectParams;

      this.pubConnections.set(id, conn);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(connParams));
    } catch (err) {
      res.writeHead(500);
      res.end(err.toString());
    }
  }
}
