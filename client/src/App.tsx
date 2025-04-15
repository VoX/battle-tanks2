import "./App.css";
import { useEffect, useState, useRef } from "react";
import { connect, ConnectionManager } from "./ConnectionManager.ts";

function App() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const connectionRef = useRef<ConnectionManager | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    connect({
      onConnectionStatusChange: (status: boolean) => {
        if (isMounted) setConnected(status);
      },
      onMessage: (data: Uint8Array) => {
        if (isMounted) {
          setMessages((prev) => [
            ...prev,
            Array.from(data as Uint8Array).map((b: number) => b.toString(16).padStart(2, "0")).join(" ")
          ]);
        }
      },
    }).then((conn: ConnectionManager) => {
      connectionRef.current = conn;
    });
    return () => {
      isMounted = false;
      connectionRef.current?.disconnect();
    };
  }, []);

  const handleSend = async () => {
    try {
      await connectionRef.current?.sendMessage(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
      setMessages((prev) => [...prev, "Sent: de ad be ef"]);
    } catch (e) {
      setMessages((prev) => [...prev, "Send failed: " + (e instanceof Error ? e.message : String(e))]);
    }
  };

  return (
    <>
      <h1>WebTransport Example</h1>
      <div className="card">
        <div style={{ marginBottom: 8 }}>
          <span>Status: </span>
          <span style={{ color: connected ? "#4caf50" : "#f44336" }}>
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <button type="button" onClick={handleSend} disabled={!connected}>
          Send
        </button>
      </div>
      <div style={{ textAlign: "left", margin: "1em auto", maxWidth: 600 }}>
        <h3>Messages</h3>
        <ul style={{ background: "#222", color: "#fff", padding: 12, borderRadius: 8, minHeight: 40 }}>
          {messages.length === 0 ? <li>No messages yet.</li> : messages.map((msg, i) => <li key={i}>{msg}</li>)}
        </ul>
      </div>
    </>
  );
}

export default App;
