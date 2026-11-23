import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { defineServer, defineRoom, monitor, playground } from "colyseus";

import { HeistRoom } from "./rooms/HeistRoom.js";

/** `npm start` passes --serve-client: the server then serves the built client (client/dist) on its own port. */
const serveClient = process.argv.includes("--serve-client");
const clientDist = fileURLToPath(new URL("../../client/dist", import.meta.url));

const server = defineServer({
  rooms: {
    heist: defineRoom(HeistRoom),
  },

  express: (app) => {
    app.get("/health", (_req, res) => {
      res.json({ ok: true });
    });

    if (serveClient) {
      if (!existsSync(clientDist)) {
        console.warn("client/dist not found: run `npm run build` first.");
      }
      app.use(express.static(clientDist));
      return;
    }

    // Development tools (not exposed when serving the game in production).
    app.use("/monitor", monitor());
    app.use("/", playground());
  },
});

export default server;
