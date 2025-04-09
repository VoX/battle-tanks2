import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { connect } from "./ConnectionManager.ts";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


const connection = await connect({
  onConnectionStatusChange: (connected) => {
    console.log("Connection status:", connected ? "Connected" : "Disconnected");
  },
  onMessage: (data) => {
    console.log("Received message:", data);
  }
});

await connection.sendMessage(new Uint8Array([1, 2, 3, 4]));
