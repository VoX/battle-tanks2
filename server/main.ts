import { Application } from "jsr:@oak/oak/application";
import { Router } from "jsr:@oak/oak/router";
import { routeStaticFilesFrom } from "./util/routeStaticFilesFrom.ts";
import { generateCert } from "./util/certgen.ts";
import { acceptConnections } from "./ServerConnectionManager.ts";

// Workaround for a Deno WebTransport bug where timed out connections throw an uncatchable error
globalThis.addEventListener("unhandledrejection", (e) => {
  if (e.reason instanceof Error && e.reason.message === "timed out") {
    console.error("Unhandled timed out error:", e.reason);
    e.preventDefault();
  }
});

const { cert, key, fingerprint } = await generateCert();
const wtUrl = new URL(
  Deno.env.get("WEBTRANSPORT_URL") || "https://localhost:8878/",
);

export const app = new Application();
const router = new Router();

router.get("/connectionInfo", (ctx) => {
  ctx.response.body = {
    url: wtUrl,
    fingerprint: fingerprint,
  };
});

app.use(router.routes());
app.use(routeStaticFilesFrom([
  `${Deno.cwd()}/client/dist`,
  `${Deno.cwd()}/client/public`,
]));

app.use(router.allowedMethods());

const httpUrl = new URL(
  Deno.env.get("HTTP_URL") || "http://localhost:8000/",
);

console.log(
  `Webtransport server listening on: ${wtUrl} with fingerprint: ${fingerprint}`,
);
const server = new Deno.QuicEndpoint({
  hostname: wtUrl.hostname,
  port: parseInt(wtUrl.port),
});
const listener = server.listen({ cert, key, alpnProtocols: ["h3"] });

const connectionManager = acceptConnections(listener, {
  onClientConnect: (clientId) => {
    console.log(`Client connected: ${clientId}`);
  },
  onClientDisconnect: (clientId) => {
    console.log(`Client disconnected: ${clientId}`);
  },
  onMessage: (clientId, data) => {
    console.log(`Message from ${clientId}:`, data);

    // You can respond to the client
    connectionManager.sendToClient(clientId, new Uint8Array([1, 2, 3, 4]))
      .catch((err) => console.error("Send error:", err));

    // Or broadcast to all clients
    connectionManager.broadcast(new Uint8Array([5, 6, 7, 8]), clientId)
      .catch((err) => console.error("Broadcast error:", err));
  },
});

console.log(
  `http server listening on: ${httpUrl}`,
);
await app.listen({
  hostname: httpUrl.hostname,
  port: parseInt(httpUrl.port),
});
