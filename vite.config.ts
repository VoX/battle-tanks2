import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import deno from "@deno/vite-plugin";
import "react";
import "react-dom";

export default defineConfig({
  root: "./client",
  server: {
    port: 3000,
    strictPort: true,
    origin: "http://127.0.0.1:8000",
    hmr: {
      protocol: "ws",
      host: "127.0.0.1",
      port: 3000,
    },
  },
  plugins: [
    react(),
    deno(),
  ],
  build: { target: "esnext" },
  optimizeDeps: {
    include: ["react/jsx-runtime"],
  },
});
