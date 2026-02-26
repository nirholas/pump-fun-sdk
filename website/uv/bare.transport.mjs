// Bare Transport for bare-mux v2
// Compatible with public Bare servers (Bare protocol v3)

export default class BareTransport {
    constructor(bareServer) {
        // Handle array of servers or single server
        if (Array.isArray(bareServer)) {
            this.servers = bareServer;
            this.server = bareServer[0];
        } else {
            this.servers = [bareServer];
            this.server = bareServer;
        }
        this.serverIndex = 0;
        this.ready = false;
        console.log("BareTransport: initialized with server", this.server);
    }

    async init() {
        // Verify the bare server is accessible
        try {
            const url = this.server.replace(/\/$/, '') + '/';
            const response = await fetch(url, { method: 'GET' });
            if (response.ok) {
                this.ready = true;
                console.log("BareTransport: connected to", this.server);
                return;
            }
        } catch (e) {
            console.warn("BareTransport: failed to connect to", this.server, e);
        }
        
        // Try other servers if available
        for (let i = 0; i < this.servers.length; i++) {
            if (i === this.serverIndex) continue;
            try {
                const url = this.servers[i].replace(/\/$/, '') + '/';
                const response = await fetch(url);
                if (response.ok) {
                    this.server = this.servers[i];
                    this.serverIndex = i;
                    this.ready = true;
                    console.log("BareTransport: connected to fallback", this.server);
                    return;
                }
            } catch (e) {
                // Try next
            }
        }
        
        // Still set ready even if no server responded - let it fail on actual requests
        this.ready = true;
    }

    async request(remote, method, body, headers, signal) {
        // Bare Server v3 protocol - /v3/ endpoint
        const bareUrl = this.server.replace(/\/$/, '') + '/v3/';
        
        // Prepare bare request headers - must use Headers object
        const bareHeaders = new Headers();
        bareHeaders.set('X-Bare-URL', remote.toString());
        bareHeaders.set('X-Bare-Headers', JSON.stringify(headers || {}));
        
        console.log('BareTransport: requesting', remote.toString(), 'via', bareUrl);
        
        try {
            const response = await fetch(bareUrl, {
                method: method || 'GET',
                headers: bareHeaders,
                body: body,
                signal: signal,
                mode: 'cors'
            });

            // Parse response headers
            const xBareStatus = response.headers.get('x-bare-status');
            const xBareStatusText = response.headers.get('x-bare-status-text');
            const xBareHeaders = response.headers.get('x-bare-headers');

            let responseHeaders = {};
            if (xBareHeaders) {
                try {
                    responseHeaders = JSON.parse(xBareHeaders);
                } catch (e) {
                    console.warn("BareTransport: failed to parse x-bare-headers");
                }
            }

            // Get response body
            const responseBody = await response.arrayBuffer();

            return {
                body: responseBody,
                headers: responseHeaders,
                status: parseInt(xBareStatus) || response.status,
                statusText: xBareStatusText || response.statusText
            };
        } catch (err) {
            // Try next server on failure
            this.serverIndex = (this.serverIndex + 1) % this.servers.length;
            this.server = this.servers[this.serverIndex];
            console.warn("BareTransport: request failed, switching to", this.server);
            throw err;
        }
    }

    connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror) {
        // WebSocket through bare server
        const wsUrl = this.server.replace(/^http/, 'ws').replace(/\/$/, '') + '/v3/';
        
        try {
            const ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                // Send the actual target URL and headers
                ws.send(JSON.stringify({
                    type: 'connect',
                    url: url.toString(),
                    protocols: protocols,
                    headers: requestHeaders
                }));
            };
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'open') {
                        onopen(data.protocol || '');
                    } else if (data.type === 'message') {
                        onmessage(data.data);
                    } else if (data.type === 'close') {
                        onclose(data.code || 1000, data.reason || '');
                    } else if (data.type === 'error') {
                        onerror(data.error || 'Unknown error');
                    }
                } catch (e) {
                    // Raw message
                    onmessage(event.data);
                }
            };
            
            ws.onclose = (event) => {
                onclose(event.code, event.reason);
            };
            
            ws.onerror = () => {
                onerror('WebSocket error');
            };

            // Return send and close functions
            const send = (data) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'data', data: data }));
                }
            };
            
            const close = (code, reason) => {
                ws.close(code, reason);
            };
            
            return [send, close];
        } catch (err) {
            onerror(err.message);
            return [() => {}, () => {}];
        }
    }

    meta() {
        return {};
    }
}
