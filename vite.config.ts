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
    proxy: {
      "/connectionInfo": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
        ws: false,
      },
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
