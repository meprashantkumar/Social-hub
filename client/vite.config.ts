import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Allow the app to be reached through a cloudflared/ngrok HTTPS tunnel.
    // Instagram OAuth requires an https redirect URL, so for local testing we
    // run the whole app through a tunnel (browser + /api proxy + OAuth callback
    // all share the tunnel host, which keeps the CSRF state cookie working).
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      // Forward API calls to the backend so the browser sees everything as
      // same-origin — this makes the httpOnly refresh cookie "just work" in dev.
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
