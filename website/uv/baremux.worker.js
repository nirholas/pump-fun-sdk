// Bare-mux SharedWorker for LairOS
// This handles transport requests from the main page and service worker

let currentTransport = null;
let currentTransportName = "";

const channel = new BroadcastChannel("bare-mux");
channel.postMessage({ type: "refreshPort" });

// Built-in Bare Transport (for when dynamic import fails)
class BuiltInBareTransport {
    constructor(bareServer) {
        if (Array.isArray(bareServer)) {
            this.servers = bareServer;
            this.server = bareServer[0];
        } else {
            this.servers = [bareServer];
            this.server = bareServer;
        }
        this.serverIndex = 0;
        this.ready = false;
        console.log("BuiltInBareTransport: initialized with server", this.server);
    }

    async init() {
        // Try each server until one works
        for (const server of this.servers) {
            try {
                const url = server.replace(/\/$/, '') + '/';
                console.log("BuiltInBareTransport: trying server", url);
                const response = await fetch(url, { 
                    method: 'GET',
                    mode: 'cors',
                    headers: { 'Accept': '*/*' }
                });
                if (response.ok || response.status === 200) {
                    this.server = server;
                    this.ready = true;
                    console.log("BuiltInBareTransport: connected to", server);
                    return;
                }
            } catch (e) {
                console.warn("BuiltInBareTransport: failed to connect to", server, e.message);
            }
        }
        // Allow to proceed even if no server responded
        this.ready = true;
        console.warn("BuiltInBareTransport: no server responded, using first:", this.server);
    }

    async request(remote, method, body, headers, signal) {
        // Bare Server v3 protocol - uses /v3/ endpoint
        const bareUrl = this.server.replace(/\/$/, '') + '/v3/';
        
        // Must send X-Bare-URL header with the full target URL
        const requestHeaders = new Headers();
        requestHeaders.set('X-Bare-URL', remote.toString());
        requestHeaders.set('X-Bare-Headers', JSON.stringify(headers || {}));
        
        console.log('BuiltInBareTransport: fetching', remote.toString(), 'via', bareUrl);

        try {
            const response = await fetch(bareUrl, {
                method: method || 'GET',
                headers: requestHeaders,
                body: body,
                signal: signal,
                mode: 'cors'
            });

            // Check for bare-specific headers
            const xBareStatus = response.headers.get('x-bare-status');
            const xBareStatusText = response.headers.get('x-bare-status-text');
            const xBareHeaders = response.headers.get('x-bare-headers');

            let responseHeaders = {};
            if (xBareHeaders) {
                try { responseHeaders = JSON.parse(xBareHeaders); } catch (e) {}
            }

            const responseBody = await response.arrayBuffer();
            
            return {
                body: responseBody,
                headers: responseHeaders,
                status: parseInt(xBareStatus) || response.status,
                statusText: xBareStatusText || response.statusText
            };
        } catch (err) {
            console.error("BuiltInBareTransport: request failed:", err);
            // Try next server
            this.serverIndex = (this.serverIndex + 1) % this.servers.length;
            this.server = this.servers[this.serverIndex];
            throw err;
        }
    }

    connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror) {
        onerror(new Error("WebSocket not supported in built-in transport"));
        return [() => {}, () => {}];
    }

    meta() { return {}; }
}

function noClients() {
    return new Error("No BareTransport was set. Try creating a BareMuxConnection and calling setTransport() on it before using BareClient.", {
        cause: "No transport configured"
    });
}

async function handleFetch(message, port, transport) {
    const resp = await transport.request(
        new URL(message.fetch.remote),
        message.fetch.method,
        message.fetch.body,
        message.fetch.headers,
        null
    );

    if (resp.body instanceof ReadableStream || resp.body instanceof ArrayBuffer) {
        port.postMessage({ type: "fetch", fetch: resp }, [resp.body]);
    } else {
        port.postMessage({ type: "fetch", fetch: resp });
    }
}

async function handleWebsocket(message, port, transport) {
    const onopen = (protocol) => {
        message.websocket.channel.postMessage({ type: "open", args: [protocol] });
    };
    const onclose = (code, reason) => {
        message.websocket.channel.postMessage({ type: "close", args: [code, reason] });
    };
    const onerror = (error) => {
        message.websocket.channel.postMessage({ type: "error", args: [error] });
    };
    const onmessage = (data) => {
        if (data instanceof ArrayBuffer) {
            message.websocket.channel.postMessage({ type: "message", args: [data] }, [data]);
        } else {
            message.websocket.channel.postMessage({ type: "message", args: [data] });
        }
    };

    const [send, close] = transport.connect(
        new URL(message.websocket.url),
        message.websocket.protocols,
        message.websocket.requestHeaders,
        onopen,
        onmessage,
        onclose,
        onerror
    );

    message.websocket.channel.onmessage = (event) => {
        if (event.data.type === "data") {
            send(event.data.data);
        } else if (event.data.type === "close") {
            close(event.data.closeCode, event.data.closeReason);
        }
    };

    port.postMessage({ type: "websocket" });
}

function sendError(port, err, name) {
    console.error(`bare-mux worker: error while processing '${name}':`, err);
    port.postMessage({ type: "error", error: err });
}

function handleConnection(port) {
    port.onmessage = async (event) => {
        const responsePort = event.data.port;
        const message = event.data.message;

        if (message.type === "ping") {
            responsePort.postMessage({ type: "pong" });
        } else if (message.type === "set") {
            try {
                let TransportClass, name;
                
                // Try dynamic import first
                try {
                    const AsyncFunction = (async function() {}).constructor;
                    const func = new AsyncFunction(message.client.function);
                    [TransportClass, name] = await func();
                } catch (importErr) {
                    // Fallback to built-in transport
                    console.warn("bare-mux: dynamic import failed, using built-in transport:", importErr);
                    TransportClass = BuiltInBareTransport;
                    name = "BuiltInBareTransport";
                }
                
                currentTransport = new TransportClass(...message.client.args);
                currentTransportName = name;
                console.log("bare-mux: transport set to", currentTransportName);
                responsePort.postMessage({ type: "set" });
            } catch (err) {
                sendError(responsePort, err, "set");
            }
        } else if (message.type === "get") {
            responsePort.postMessage({ type: "get", name: currentTransportName });
        } else if (message.type === "fetch") {
            try {
                if (!currentTransport) throw noClients();
                if (!currentTransport.ready) await currentTransport.init();
                await handleFetch(message, responsePort, currentTransport);
            } catch (err) {
                sendError(responsePort, err, "fetch");
            }
        } else if (message.type === "websocket") {
            try {
                if (!currentTransport) throw noClients();
                if (!currentTransport.ready) await currentTransport.init();
                await handleWebsocket(message, responsePort, currentTransport);
            } catch (err) {
                sendError(responsePort, err, "websocket");
            }
        }
    };
}

// SharedWorker connection handler
self.onconnect = (event) => {
    handleConnection(event.ports[0]);
};

console.debug("bare-mux: SharedWorker initialized");
