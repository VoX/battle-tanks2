export interface ClientConnection {
  id: string;
  connection: WebTransport;
  datagramWriter: WritableStreamDefaultWriter<Uint8Array>;
}

export interface ConnectionHandlerOptions {
  /**
   * Called when a new client connects
   * @param clientId Unique identifier for the client
   */
  onClientConnect?: (clientId: string) => void;

  /**
   * Called when a client disconnects
   * @param clientId Unique identifier for the client
   */
  onClientDisconnect?: (clientId: string) => void;

  /**
   * Called when a message is received from a client
   * @param clientId Unique identifier for the client
   * @param data The received message data
   */
  onMessage?: (clientId: string, data: Uint8Array) => void;
}

export class ServerConnectionManager {
  private clients: Map<string, ClientConnection> = new Map();
  private options: ConnectionHandlerOptions;

  constructor(options: ConnectionHandlerOptions = {}) {
    this.options = options;
  }

  /**
   * Start accepting connections from a QUIC listener
   * @param listener The QUIC listener to accept connections from
   */
  acceptConnections(listener: Deno.QuicListener): void {
    (async () => {
      for await (const conn of listener) {
        try {
          const wt = await Deno.upgradeWebTransport(conn);
          await this.handleNewConnection(wt.url, wt);
        } catch (error) {
          console.error("Error handling connection:", error);
        }
      }
    })();
  }

  /**
   * Send a message to a specific client
   * @param clientId ID of the client to send the message to
   * @param data Message data to send
   * @returns Promise that resolves when the message is sent
   */
  async sendToClient(clientId: string, data: Uint8Array): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not connected`);
    }

    try {
      await client.datagramWriter.write(data);
    } catch (error) {
      console.error(`Error sending message to client ${clientId}:`, error);
      await this.handleClientDisconnect(clientId);
      throw error;
    }
  }

  /**
   * Broadcast a message to all connected clients
   * @param data Message data to broadcast
   * @param excludeClientId Optional client ID to exclude from the broadcast
   */
  async broadcast(data: Uint8Array, excludeClientId?: string): Promise<void> {
    const sendPromises: Promise<void>[] = [];

    for (const clientId of this.clients.keys()) {
      if (excludeClientId && clientId === excludeClientId) {
        continue;
      }

      sendPromises.push(
        this.sendToClient(clientId, data)
          .catch((err) =>
            console.error(`Error broadcasting to client ${clientId}:`, err)
          ),
      );
    }

    await Promise.all(sendPromises);
  }

  /**
   * Get all connected client IDs
   */
  getConnectedClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Check if a specific client is connected
   */
  isClientConnected(clientId: string): boolean {
    return this.clients.has(clientId);
  }

  /**
   * Get count of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Disconnect all clients and clean up resources
   */
  async close(): Promise<void> {
    const clientIds = this.getConnectedClientIds();
    for (const clientId of clientIds) {
      try {
        const client = this.clients.get(clientId);
        if (client) {
          await client.datagramWriter.close();
          await client.connection.close();
        }
      } catch (error) {
        console.error(`Error during close for client ${clientId}:`, error);
      } finally {
        this.clients.delete(clientId);
        if (this.options.onClientDisconnect) {
          this.options.onClientDisconnect(clientId);
        }
      }
    }
  }

  private async handleNewConnection(
    url: string,
    wt: WebTransport,
  ): Promise<void> {
    try {
      await wt.ready;
      const datagramWriter = wt.datagrams.writable.getWriter();

      const clientId = new URL(url).pathname.substring(1);

      // Store client connection
      this.clients.set(clientId, {
        id: clientId,
        connection: wt,
        datagramWriter,
      });

      // Notify about new connection
      if (this.options.onClientConnect) {
        this.options.onClientConnect(clientId);
      }

      // Handle client disconnection
      wt.closed
        .then(() => this.handleClientDisconnect(clientId))
        .catch((error: Error) => {
          console.error(
            `Client ${clientId} connection closed with error:`,
            error,
          );
          this.handleClientDisconnect(clientId);
        });

      // Handle incoming messages
      this.processClientMessages(clientId, wt);
    } catch (error) {
      console.error("Error during connection setup:", error);
    }
  }

  private async processClientMessages(
    clientId: string,
    wt: WebTransport,
  ): Promise<void> {
    const reader = wt.datagrams.readable.getReader();

    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          console.log(`Client ${clientId} datagrams stream closed`);
          break;
        }

        if (value && this.options.onMessage) {
          this.options.onMessage(clientId, value);
        }
      }
    } catch (error) {
      console.error(`Error processing messages for client ${clientId}:`, error);
    } finally {
      reader.releaseLock();
      await this.handleClientDisconnect(clientId);
    }
  }

  private async handleClientDisconnect(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      return; // Client already disconnected
    }

    try {
      this.clients.delete(clientId);

      try {
        await client.datagramWriter.close();
      } catch (error) {
        console.warn(`Error closing writer for client ${clientId}:`, error);
      }

      try {
        await client.connection.close();
      } catch (error) {
        console.warn(`Error closing connection for client ${clientId}:`, error);
      }

      if (this.options.onClientDisconnect) {
        this.options.onClientDisconnect(clientId);
      }
    } catch (error) {
      console.error(
        `Error during disconnect cleanup for client ${clientId}:`,
        error,
      );
    }
  }
}

/**
 * Creates a server connection manager and starts accepting connections
 * @param listener The QUIC listener to accept connections from
 * @param options Connection handler options
 * @returns The created ServerConnectionManager instance
 */
export function acceptConnections(
  listener: Deno.QuicListener,
  options: ConnectionHandlerOptions = {},
): ServerConnectionManager {
  const connectionManager = new ServerConnectionManager(options);
  connectionManager.acceptConnections(listener);
  return connectionManager;
}
