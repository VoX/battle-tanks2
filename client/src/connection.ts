
export async function connect() {
  const { url, fingerprint } = await (await fetch("/connectionInfo")).json();

  console.log("Connecting to:", url, fingerprint);

  const certHash = hexStringToUint8Array(fingerprint);

  const client = new WebTransport(url, {
    serverCertificateHashes: [{
      algorithm: "sha-256",
      value: certHash,
    }],
  });

  await client.ready;

  const writer = client.datagrams.writable.getWriter();
  const reader = client.datagrams.readable.getReader();

  setInterval(async () => {
    await writer.write(new Uint8Array([3, 0, 3, 0]));   
    const datagramResponse = await reader.read();
    console.log("datagram:", datagramResponse.value, datagramResponse.done);
  }, 1000);
}

function hexStringToUint8Array(hex: string) {
  // Remove any spaces or colons just in case
  hex = hex.replace(/[^a-fA-F0-9]/g, "");
  if (hex.length % 2 !== 0) {
    throw new Error("Hex string must have an even number of characters");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

