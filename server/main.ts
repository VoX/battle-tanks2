import { Application } from "jsr:@oak/oak/application";
import { Router } from "jsr:@oak/oak/router";
import routeStaticFilesFrom from "./util/routeStaticFilesFrom.ts";
import { decodeBase64 } from "jsr:@std/encoding@^1.0.5/base64";

export const app = new Application();
const router = new Router();

app.use(router.routes());
app.use(routeStaticFilesFrom([
  `${Deno.cwd()}/client/dist`,
  `${Deno.cwd()}/client/public`,
]));

const cert = Deno.readTextFileSync("localhost.crt");
const certHash = await crypto.subtle.digest(
  "SHA-256",
  decodeBase64(cert.split("\n").slice(1, -2).join("")),
);

console.log(certHash);

const server = new Deno.QuicEndpoint({
  hostname: "localhost",
  port: 9000,
});
const listener = server.listen({
  cert,
  key: Deno.readTextFileSync("localhost.key"),
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

      (async () => {
        for await (const stream of wt.incomingUnidirectionalStreams) {
          const out = await wt.createUnidirectionalStream();
          stream.pipeTo(out).catch(() => {});
        }
      })();



      wt.datagrams.readable.pipeTo(wt.datagrams.writable);
    });
  }
})();


if (import.meta.main) {
  console.log("Server listening on port http://localhost:8000");
  await app.listen({ port: 8000 });
}