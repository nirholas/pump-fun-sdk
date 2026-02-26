const WebSocket = require('ws');
const express = require('express');
const http = require('http');

const cors = require('cors');
app.use(cors());


const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

CLIENTS = [];

wss.on('connection', (ws) => {
    CLIENTS.push(ws);
    console.log("New Client Login Suspected");

    ws.on('message', (data) => {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    });
});

// Set up CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://lair2.vercel.app');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

server.listen(80, () => {
    console.log('Server is listening on port 80');
});
