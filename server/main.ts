import { Application } from "jsr:@oak/oak/application";
import { Router } from "jsr:@oak/oak/router";
import routeStaticFilesFrom from "./util/routeStaticFilesFrom.ts";
import { generateCert } from "./util/certgen.ts";
import { acceptConnections } from "./systems/connection.ts";
import { proxyRequestHandler } from "./proxyRequestHandler.ts";

globalThis.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled rejection:", e.reason);
  e.preventDefault();
});

const { cert, key, fingerprint } = await generateCert();

console.log(`Generated certificate with fingerprint: ${fingerprint}`);

export const app = new Application();
const router = new Router();

router.get("/connectionInfo", (ctx) => {
  ctx.response.body = {
    url: "https://localhost:8878/",
    fingerprint: fingerprint,
  };
});

app.use(router.routes());
app.use(routeStaticFilesFrom([
  `${Deno.cwd()}/client/dist`,
  `${Deno.cwd()}/client/public`,
]));
app.use(router.allowedMethods());

const server = new Deno.QuicEndpoint({ hostname: "localhost", port: 8878 });
const listener = server.listen({ cert, key, alpnProtocols: ["h3"] });

acceptConnections(listener);

if (import.meta.main) {
  Deno.serve({
    port: 8001,
    key: Deno.readTextFileSync("devCerts/key.pem"),
    cert: Deno.readTextFileSync("devCerts/cert.pem"),
  }, proxyRequestHandler);

  await app.listen({ port: 8000 });
}
