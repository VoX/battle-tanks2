import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


const client = new WebTransport(
  `https://localhost:${server.addr.port}/path`,
  {
    serverCertificateHashes: [{
      algorithm: "sha-256",
      value: new Uint8Array([
        0x9c, 0x1b, 0x4f, 0x8d, 0x2e, 0x3a, 0x5b, 0x6f, 0x4c, 0x5f,
        0x4b, 0x1f, 0x2c, 0x3d, 0x4e, 0x5f, 0x6a, 0x7b, 0x8c, 0x9d,
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09,
      ]),
    }],
  },
);

client.ready.then(async () => {
  const bi = await client.createBidirectionalStream();

  {
    const writer = bi.writable.getWriter();
    await writer.write(new Uint8Array([1, 0, 1, 0]));
    writer.releaseLock();
  }

  {
    const reader = bi.readable.getReader();
    const response = await reader.read();
    console.log(response);
    reader.releaseLock();
  }

  {
    const uni = await client.createUnidirectionalStream();
    const writer = uni.getWriter();
    await writer.write(new Uint8Array([0, 2, 0, 2]));
    writer.releaseLock();
  }

  {
    const uni =
      (await client.incomingUnidirectionalStreams.getReader().read()).value;
    const reader = uni!.getReader();
    const response = await reader.read();
    console.log(response);
    reader.releaseLock();
  }

  await client.datagrams.writable.getWriter().write(
    new Uint8Array([3, 0, 3, 0]),
  );
  const datagramResponse = await client.datagrams.readable.getReader().read();
  console.log(datagramResponse);

  client.close();
});