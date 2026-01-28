// app.js
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

// --------------------
// Config
// --------------------
const app = express();
const server = createServer(app);
const port = process.env.PORT || 10000;

// Debug switches
const DEBUG_WS = process.env.DEBUG_WS === "1"; // set DEBUG_WS=1 to enable extra logs
const MAX_PREVIEW = Number(process.env.DEBUG_PREVIEW || 128); // bytes to preview for binary frames

// Optional: simple HTTP request logs (for / health check or future routes)
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`,
    );
  });
  next();
});

// Health endpoint
app.get("/", (_req, res) => res.send("OK"));

// --------------------
// WebSocket setup
// --------------------
const wss = new WebSocketServer({ server, path: "/ws" });

// Track connected clients
const clients = new Set();

// Utility: short timestamp
const ts = () => new Date().toISOString();

// Utility: preview binary payload
function previewBuffer(buf, max = MAX_PREVIEW) {
  const len = buf.length;
  const slice = buf.subarray(0, Math.min(len, max));
  const hex = [...slice].map((b) => b.toString(16).padStart(2, "0")).join(" ");
  return `${len} bytes${len > max ? ` (showing ${max})` : ""}: ${hex}`;
}

// Broadcast helper
function broadcast(obj) {
  const msg = typeof obj === "string" ? obj : JSON.stringify(obj);
  let delivered = 0;
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(msg);
      delivered++;
    }
  }
  if (DEBUG_WS) {
    console.log(
      `[WS][${ts()}] Broadcast delivered to ${delivered}/${clients.size}`,
    );
  }
}

// Connection handler
wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;
  clients.add(ws);

  console.log(`[WS][${ts()}] CONNECT ${ip} | total=${clients.size}`);
  ws.send(
    JSON.stringify({ type: "welcome", msg: "Hello from Render WS server" }),
  );

  // Message frames (text + binary)
  ws.on("message", (data, isBinary) => {
    if (isBinary) {
      console.log(`[WS][${ts()}] < BIN from ${ip} :: ${previewBuffer(data)}`);
      // Echo back as binary (optional)
      ws.send(data, { binary: true });
    } else {
      const text = data.toString();
      console.log(`[WS][${ts()}] < TXT from ${ip} :: ${text}`);
      // Echo back as JSON (example)
      ws.send(JSON.stringify({ type: "echo", payload: text }));
    }
  });

  // Control frames
  ws.on("ping", (data) => {
    console.log(`[WS][${ts()}] < PING from ${ip} :: ${previewBuffer(data)}`);
    // ws.pong() is automatically handled by 'ws', but you can respond manually:
    // ws.pong(data);
  });

  ws.on("pong", (data) => {
    console.log(`[WS][${ts()}] < PONG from ${ip} :: ${previewBuffer(data)}`);
  });

  // Errors
  ws.on("error", (err) => {
    console.error(`[WS][${ts()}] ERROR ${ip} ::`, err);
  });

  // Close
  ws.on("close", (code, reason) => {
    clients.delete(ws);
    // reason is a Buffer per ws; convert safely
    const reasonStr = reason?.toString?.() || "";
    console.log(
      `[WS][${ts()}] CLOSE ${ip} :: code=${code} reason="${reasonStr}" | total=${clients.size}`,
    );
  });

  // Optional: send a heartbeat (server → client) at intervals
  if (DEBUG_WS) {
    const HEARTBEAT_MS = Number(process.env.DEBUG_HEARTBEAT || 30000);
    const interval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        const hb = JSON.stringify({ type: "heartbeat", t: ts() });
        ws.send(hb);
        console.log(`[WS][${ts()}] > HEARTBEAT to ${ip}`);
        // You can also trigger a ping to measure latency:
        ws.ping(); // client will emit 'pong'
      } else {
        clearInterval(interval);
      }
    }, HEARTBEAT_MS);
  }
});

// --------------------
// Server start
// --------------------
server.listen(port, () => {
  console.log(`HTTP+WS listening on port ${port}`);
  console.log(
    `WS endpoint: wss://<your-render-service>.onrender.com/ws (Render enforces TLS; use wss)`,
  );
  console.log(
    `Debug: DEBUG_WS=${DEBUG_WS ? "ON" : "OFF"}, PREVIEW=${MAX_PREVIEW} bytes`,
  );
});

// --------------------
// Example: trigger a periodic broadcast (debug only)
// --------------------
if (DEBUG_WS) {
  const BROADCAST_MS = Number(process.env.DEBUG_BROADCAST || 60000);
  setInterval(() => {
    broadcast({ type: "server_broadcast", t: ts(), clients: clients.size });
  }, BROADCAST_MS);
}
