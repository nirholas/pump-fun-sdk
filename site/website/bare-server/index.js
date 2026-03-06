import { createBareServer } from "@tomphttp/bare-server-node";
import express from "express";
import { createServer } from "node:http";

const app = express();
const bareServer = createBareServer("/bare/");

// CORS headers for all origins (PumpOS needs this)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Expose-Headers", "*");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    name: "PumpOS Bare Server",
    version: "1.0.0",
    bare: "/bare/",
    documentation: "https://github.com/tomphttp/bare-server-node"
  });
});

// Status endpoint
app.get("/status", (req, res) => {
  res.json({
    online: true,
    timestamp: new Date().toISOString()
  });
});

const server = createServer();

server.on("request", (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

server.on("upgrade", (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`🚀 PumpOS Bare Server running on port ${PORT}`);
  console.log(`   Bare endpoint: http://localhost:${PORT}/bare/`);
});
