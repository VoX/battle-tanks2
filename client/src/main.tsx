import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


function hexStringToUint8Array(hex: string) {
  // Remove any spaces or colons just in case
  hex = hex.replace(/[^a-fA-F0-9]/g, '');
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have an even number of characters');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// Your SHA-256 fingerprint (no colons, just raw hex)
const fingerprint = "ab2fe27e4b9ab3c1b789174a7c552518e781388c659ce891e08ee7ae0d4a306d";
const certHash = hexStringToUint8Array(fingerprint);

const client = new WebTransport("https://local.test:8878/", {
  serverCertificateHashes: [{
    algorithm: "sha-256",
    value: certHash
  }]
});

client.ready.then(async () => {
  const bi = await client.createBidirectionalStream();

    const writer = bi.writable.getWriter();
    await writer.write(new Uint8Array([1, 0, 1, 0]));
    writer.releaseLock();

    const reader = bi.readable.getReader();
    const response = await reader.read();
    console.log(response);
    reader.releaseLock();

  await client.datagrams.writable.getWriter().write(
    new Uint8Array([3, 0, 3, 0]),
  );
  const datagramResponse = await client.datagrams.readable.getReader().read();
  console.log("datagram:", datagramResponse);

  client.close();
});