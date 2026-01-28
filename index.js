// app.js
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = createServer(app);
const port = process.env.PORT || 10000;

// Serve an HTTP health endpoint (optional)
app.get("/", (_req, res) => res.send("OK"));

// Attach WS to the same server; use a path like /ws
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  console.log("WS client connected from", req.socket.remoteAddress);
  ws.send(
    JSON.stringify({ type: "welcome", msg: "Hello from Render WS server" }),
  );

  ws.on("message", (data) => {
    const text = data.toString();
    console.log("Received:", text);
    ws.send(JSON.stringify({ type: "echo", payload: text }));
  });

  ws.on("close", (code, reason) => {
    console.log("WS closed:", code, reason.toString());
  });
});

server.listen(port, () => {
  console.log(`HTTP+WS listening on port ${port}`);
});
