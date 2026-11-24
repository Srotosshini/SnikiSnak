import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

// HTTPS is needed for the microphone when other laptops open this one by IP
// address. The Colyseus server is proxied through the same HTTPS origin at
// /colyseus, so the game socket isn't blocked as mixed content (PLAN.md Section 10).
//
// Plain http instead (`npm run play`, `--mode http`, or PLAIN_HTTP=1) is for
// playing on this one computer: localhost counts as secure, so the mic still
// works, and there's no certificate warning.
export default defineConfig(({ mode }) => ({
  plugins: mode === "http" || process.env.PLAIN_HTTP === "1" ? [] : [basicSsl()],
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
}));
