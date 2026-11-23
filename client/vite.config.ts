import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

// HTTPS is needed for the microphone when other laptops open this one by IP
// address. The Colyseus server is proxied through the same HTTPS origin at
// /colyseus, so the game socket isn't blocked as mixed content (PLAN.md Section 10).
//
// PLAIN_HTTP=1 serves plain http instead (only useful on this machine:
// localhost counts as secure, so the mic still works there).
const plainHttp = process.env.PLAIN_HTTP === "1";

export default defineConfig({
  plugins: plainHttp ? [] : [basicSsl()],
  // Three.js alone is ~700 kB minified; that's expected for this game.
  build: { chunkSizeWarningLimit: 1200 },
  server: {
    host: true,
    port: Number(process.env.CLIENT_PORT) || 5173,
    strictPort: true,
    proxy: {
      "/colyseus": {
        target: "http://localhost:2567",
        ws: true,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/colyseus/, ""),
      },
    },
  },
});
