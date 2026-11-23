import { listen } from "@colyseus/tools";
import app from "./app.config.js";

// Development: always port 2567, because the Vite proxy (client/vite.config.ts)
// points there. Production (`npm start`): use the host's PORT if it sets one.
const serving = process.argv.includes("--serve-client");
const port = Number(serving ? process.env.PORT : process.env.SERVER_PORT) || 2567;

listen(app, port);
