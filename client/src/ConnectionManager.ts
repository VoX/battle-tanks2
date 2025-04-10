// Connection Manager for WebTransport

export interface ConnectionOptions {
  onConnectionStatusChange?: (connected: boolean) => void;
  onMessage?: (data: Uint8Array) => void;
  heartbeatInterval?: number; // in milliseconds
  clientId?: string; // Unique identifier for the client
}

export class ConnectionManager {
  private client: WebTransport | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private isConnected = false;
  private reconnectAttempt = 0;
  private intervalId: number | null = null;
  private reconnectTimeoutId: number | null = null;
  private readonly maxReconnectDelay = 1000; // 30 seconds max delay
  private options: ConnectionOptions;

  constructor(options: ConnectionOptions = {}) {
    this.options = {
      heartbeatInterval: 1000,
      clientId: crypto.randomUUID(),
      ...options,
    };
  }

  /**
   * Initiates connection to the server
   */
  async connect(): Promise<void> {
    await this.setupConnection();
  }

  /**
   * Sends a datagram through the WebTransport connection
   * @param data The data to send
   * @returns Promise that resolves when data is sent, or rejects if connection is not available
   */
  async sendMessage(data: Uint8Array): Promise<void> {
    if (!this.isConnected || !this.writer) {
      throw new Error("Connection not established");
    }

    try {
      await this.writer.write(data);
    } catch (error) {
      console.error("Error sending message:", error);
      this.isConnected = false;
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Disconnects from the server and cleans up resources
   */
  async disconnect(): Promise<void> {
    await this.cleanupConnection();
  }

  /**
   * Returns the current connection status
   */
  isConnectedToServer(): boolean {
    return this.isConnected;
  }

  private async setupConnection(): Promise<void> {
    try {
      const { url, fingerprint } = await (await fetch("/connectionInfo"))
        .json();

      const connectionUrl = new URL(url);
      connectionUrl.pathname = "/" + this.options.clientId;

      console.log("Connecting to:", connectionUrl, fingerprint);

      const certHash = hexStringToUint8Array(fingerprint);

      // Clean up previous connection if it exists
      await this.cleanupConnection();

      this.client = new WebTransport(connectionUrl, {
        serverCertificateHashes: [{
          algorithm: "sha-256",
          value: certHash,
        }],
      });

      // Set up connection event listeners
      this.client.closed.then(() => {
        console.log("Connection closed, attempting to reconnect...");
        this.updateConnectionStatus(false);
        this.scheduleReconnect();
      }).catch((error) => {
        console.error("Connection closed with error:", error);
        this.updateConnectionStatus(false);
        this.scheduleReconnect();
      });

      await this.client.ready;
      this.reconnectAttempt = 0;
      console.log("Connection established successfully");

      this.writer = this.client.datagrams.writable.getWriter();
      this.reader = this.client.datagrams.readable.getReader();

      this.updateConnectionStatus(true);

      // Start processing incoming messages
      this.startMessageProcessing();
    } catch (error) {
      console.error("Failed to establish connection:", error);
      this.updateConnectionStatus(false);
      this.scheduleReconnect();
    }
  }

  private startMessageProcessing(): void {
    // Set up the interval for receiving data and heartbeat
    this.intervalId = setInterval(async () => {
      if (!this.isConnected || !this.reader) return;

      try {
        const datagramResponse = await this.reader.read();

        if (datagramResponse.done) {
          console.log("Reader completed, reconnecting...");
          this.updateConnectionStatus(false);
          this.scheduleReconnect();
          return;
        }

        if (datagramResponse.value && this.options.onMessage) {
          this.options.onMessage(datagramResponse.value);
        }
      } catch (error) {
        console.error("Error during data exchange:", error);
        this.updateConnectionStatus(false);
        this.scheduleReconnect();
      }
    }, this.options.heartbeatInterval);
  }

  private async cleanupConnection(): Promise<void> {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (e) {
        console.warn("Error canceling reader:", e);
      }
      this.reader = null;
    }

    if (this.writer) {
      try {
        await this.writer.close();
      } catch (e) {
        console.warn("Error closing writer:", e);
      }
      this.writer = null;
    }

    if (this.client) {
      try {
        await this.client.close();
      } catch (e) {
        console.warn("Error closing client:", e);
      }
      this.client = null;
    }

    this.updateConnectionStatus(false);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId) {
      return;
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      1000 * (2 ** this.reconnectAttempt) + Math.random() * 1000,
      this.maxReconnectDelay,
    );

    console.log(
      `Scheduling reconnection attempt ${this.reconnectAttempt + 1} in ${
        Math.round(delay)
      }ms`,
    );

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.reconnectAttempt++;
      this.setupConnection();
    }, delay);
  }

  private updateConnectionStatus(connected: boolean): void {
    const statusChanged = this.isConnected !== connected;
    this.isConnected = connected;

    if (statusChanged && this.options.onConnectionStatusChange) {
      this.options.onConnectionStatusChange(connected);
    }
  }
}

/**
 * Creates and connects a ConnectionManager instance
 * @param options Connection options
 * @returns Promise that resolves to a ConnectionManager instance
 */
export async function connect(
  options?: ConnectionOptions,
): Promise<ConnectionManager> {
  const connectionManager = new ConnectionManager(options);
  await connectionManager.connect();
  return connectionManager;
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
