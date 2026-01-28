// server.js
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 9080;

// Create a WebSocket server bound to all interfaces (0.0.0.0)
const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`Client connected from ${ip}`);

  // Send a welcome message
  ws.send(
    JSON.stringify({ type: "welcome", msg: "Hello from Node WS server" }),
  );

  // Echo messages back (and demonstrate JSON routing)
  ws.on("message", (data) => {
    const text = data.toString();
    console.log(`Received: ${text}`);
    ws.send(JSON.stringify({ type: "echo", payload: text }));
  });

  ws.on("close", (code, reason) => {
    console.log(`Client disconnected: code=${code}, reason=${reason}`);
  });

  ws.on("error", (err) => {
    console.error("WS error:", err);
  });
});

console.log(`WebSocket server listening on ws://0.0.0.0:${PORT}`);
