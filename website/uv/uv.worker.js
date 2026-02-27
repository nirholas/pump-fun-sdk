/*
 * Bare-mux SharedWorker for PumpOS UV Proxy
 * This is a self-contained bare-mux worker with built-in transport
 */

// Public bare servers (using Titanium Network community servers)
const BARE_SERVERS = [
    'https://uv.holyubofficial.net/',
    'https://bare.palladiumnetwork.net/',
];
let currentBareIndex = 0;

// Track current transport state
let currentTransport = null;
let currentTransportName = '';

// Broadcast channel for coordinating across contexts
const channel = new BroadcastChannel('bare-mux');
channel.postMessage({ type: 'refreshPort' });

// Built-in Bare transport implementation
class BareFetchTransport {
    constructor(server) {
        this.server = server || BARE_SERVERS[0];
        this.ready = false;
    }
    
    async init() {
        this.ready = true;
    }
    
    async request(remote, method, body, headers, signal) {
        // Build bare request headers (Bare V3 protocol)
        const bareHeaders = new Headers();
        bareHeaders.set('X-Bare-URL', remote.toString());
        bareHeaders.set('X-Bare-Headers', JSON.stringify(headers || {}));
        
        // The bare server endpoint
        const bareUrl = this.server.endsWith('/') ? this.server : this.server + '/';
        
        try {
            const response = await fetch(bareUrl, {
                method: method || 'GET',
                headers: bareHeaders,
                body: body,
                signal: signal
            });
            
            // Parse X-Bare response headers
            const xBareStatus = response.headers.get('x-bare-status') || response.status.toString();
            const xBareStatusText = response.headers.get('x-bare-status-text') || response.statusText;
            const xBareHeaders = response.headers.get('x-bare-headers');
            
            let responseHeaders = {};
            if (xBareHeaders) {
                try {
                    responseHeaders = JSON.parse(xBareHeaders);
                } catch (e) {
                    console.warn('Failed to parse x-bare-headers:', e);
                }
            }
            
            return {
                body: await response.arrayBuffer(),
                headers: responseHeaders,
                status: parseInt(xBareStatus),
                statusText: xBareStatusText
            };
        } catch (err) {
            // Try next server on failure
            currentBareIndex = (currentBareIndex + 1) % BARE_SERVERS.length;
            this.server = BARE_SERVERS[currentBareIndex];
            console.warn('Bare server failed, trying:', this.server);
            throw err;
        }
    }
    
    connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror) {
        // WebSocket support - placeholder for now
        onerror('WebSocket not implemented');
        return [() => {}, () => {}];
    }
    
    meta() {
        return {};
    }
}

// Initialize default transport
currentTransport = new BareFetchTransport(BARE_SERVERS[0]);
currentTransportName = 'BareFetchTransport';

// Handle fetch requests
async function handleFetch(message, port) {
    try {
        if (!currentTransport) {
            throw new Error('No transport set');
        }
        
        if (!currentTransport.ready) {
            await currentTransport.init();
        }
        
        const { remote, method, headers, body } = message.fetch;
        
        const resp = await currentTransport.request(
            new URL(remote),
            method,
            body,
            headers,
            null
        );
        
        // Transfer body if it's transferable
        if (resp.body instanceof ArrayBuffer) {
            port.postMessage({ type: 'fetch', fetch: resp }, [resp.body]);
        } else {
            port.postMessage({ type: 'fetch', fetch: resp });
        }
    } catch (err) {
        console.error('bare-mux fetch error:', err);
        port.postMessage({ type: 'error', error: err });
    }
}

// Handle WebSocket requests
async function handleWebsocket(message, port) {
    try {
        if (!currentTransport) {
            throw new Error('No transport set');
        }
        
        if (!currentTransport.ready) {
            await currentTransport.init();
        }
        
        const { url, protocols, requestHeaders, channel: wsChannel } = message.websocket;
        
        const onopen = (protocol) => {
            wsChannel.postMessage({ type: 'open', args: [protocol] });
        };
        const onclose = (code, reason) => {
            wsChannel.postMessage({ type: 'close', args: [code, reason] });
        };
        const onerror = (error) => {
            wsChannel.postMessage({ type: 'error', args: [error] });
        };
        const onmessage = (data) => {
            if (data instanceof ArrayBuffer) {
                wsChannel.postMessage({ type: 'message', args: [data] }, [data]);
            } else {
                wsChannel.postMessage({ type: 'message', args: [data] });
            }
        };
        
        currentTransport.connect(
            new URL(url),
            protocols,
            requestHeaders,
            onopen,
            onmessage,
            onclose,
            onerror
        );
        
        port.postMessage({ type: 'websocket' });
    } catch (err) {
        console.error('bare-mux websocket error:', err);
        port.postMessage({ type: 'error', error: err });
    }
}

// Handle incoming connections
function handleConnection(port) {
    port.onmessage = async (event) => {
        const { message, port: responsePort } = event.data;
        
        if (!message) {
            console.warn('bare-mux-worker: message without message property');
            return;
        }
        
        switch (message.type) {
            case 'ping':
                responsePort.postMessage({ type: 'pong' });
                break;
                
            case 'set':
                try {
                    // Handle transport setting
                    // For our built-in transport, we just acknowledge
                    if (message.client?.args?.[0]) {
                        // If a bare server URL is provided, use it
                        currentTransport = new BareFetchTransport(message.client.args[0]);
                        currentTransportName = 'BareFetchTransport';
                    }
                    console.log('bare-mux: set transport to', currentTransportName);
                    responsePort.postMessage({ type: 'set' });
                } catch (err) {
                    console.error('bare-mux set error:', err);
                    responsePort.postMessage({ type: 'error', error: err });
                }
                break;
                
            case 'get':
                responsePort.postMessage({ type: 'get', name: currentTransportName });
                break;
                
            case 'fetch':
                await handleFetch(message, responsePort);
                break;
                
            case 'websocket':
                await handleWebsocket(message, responsePort);
                break;
                
            default:
                console.warn('bare-mux-worker: unknown message type:', message.type);
        }
    };
}

// SharedWorker entry point
self.onconnect = (event) => {
    const port = event.ports[0];
    handleConnection(port);
    port.start();
};

console.debug('bare-mux-worker: initialized with built-in BareFetchTransport');
