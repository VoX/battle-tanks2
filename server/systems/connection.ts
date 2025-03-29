export async function acceptConnections(listener: Deno.QuicListener) {
  (async () => {
    for await (const conn of listener) {
      const wt = await Deno.upgradeWebTransport(conn);

      wt.ready.then(() => {
        wt.datagrams.readable.pipeTo(wt.datagrams.writable);
      });
    }
  })();
}
