import { Application } from "jsr:@oak/oak/application";
import { Router } from "jsr:@oak/oak/router";
import routeStaticFilesFrom from "./util/routeStaticFilesFrom.ts";

export const app = new Application();
const router = new Router();

app.use(router.routes());
app.use(routeStaticFilesFrom([
  `${Deno.cwd()}/client/dist`,
  `${Deno.cwd()}/client/public`,
]));

const cert = Deno.readTextFileSync("ecdsa.crt");
const key = Deno.readTextFileSync("ecdsa.key");

const server = new Deno.QuicEndpoint({
  hostname: "local.test",
  port: 8878,
});
const listener = server.listen({
  cert,
  key,
  alpnProtocols: ["h3"],
});

(async () => {
  for await (const conn of listener) {
    const wt = await Deno.upgradeWebTransport(conn);

    wt.ready.then(() => {
      (async () => {
        for await (const bidi of wt.incomingBidirectionalStreams) {
          bidi.readable.pipeTo(bidi.writable).catch(() => {});
        }
      })();

      wt.datagrams.readable.pipeTo(wt.datagrams.writable);
    });
  }
})();



if (import.meta.main) {
  await app.listen({ port: 8000, secure:true,cert, key });
}