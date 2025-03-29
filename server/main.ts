import { Application } from "jsr:@oak/oak/application";
import { Router } from "jsr:@oak/oak/router";
import routeStaticFilesFrom from "./util/routeStaticFilesFrom.ts";
import { generateCert } from "./util/certgen.ts";
import { acceptConnections } from "./systems/connection.ts";

const { cert, key, fingerprint } = await generateCert();
const apiCert = Deno.readTextFileSync("ecdsa.crt");
const apiKey = Deno.readTextFileSync("ecdsa.key");

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

console.log(`Generated certificate with fingerprint: ${fingerprint}`);

const server = new Deno.QuicEndpoint({ hostname: "localhost", port: 8878 });
const listener = server.listen({ cert, key, alpnProtocols: ["h3"] });

acceptConnections(listener);

async function proxyRequestHandler(req: Request) {
  try {
    const url = new URL(req.url);
    url.protocol = "http:";
    url.port = (url.pathname === "/connectionInfo" ? 8000 : 3000).toString();
    const options = {
      headers: req.headers,
      method: req.method,
      body: req.body,
    };

    return await fetch(url.toString(), options);
  } catch (error) {
    console.error("Error in proxyRequestHandler:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

if (import.meta.main) {
  Deno.serve({ port: 8001, key: apiKey, cert: apiCert }, proxyRequestHandler);

  await app.listen({ port: 8000, secure:true, key: apiKey, cert: apiCert });
}
