/**
 * UV Proxy Initialization for LairOS
 * 
 * This script handles the proper initialization of Ultraviolet with bare-mux v2.
 * Include this AFTER loading baremux.js, uv.bundle.js, and uv.config.js
 * 
 * Usage:
 *   const uv = await initUV();
 *   if (uv.ready) {
 *       const encodedUrl = uv.encodeUrl('https://example.com');
 *       iframe.src = encodedUrl;
 *   }
 */

(function(global) {
    'use strict';

    // Default bare servers
    const DEFAULT_BARE_SERVERS = [
        'https://uv.holyubofficial.net/',
        'https://bare.palladiumnetwork.net/'
    ];

    class UVProxy {
        constructor() {
            this.ready = false;
            this.connection = null;
            this.servers = DEFAULT_BARE_SERVERS;
            this.activeServer = null;
        }

        /**
         * Initialize UV with bare-mux v2
         * @param {Object} options - Configuration options
         * @param {string[]} options.bareServers - Array of bare server URLs
         * @param {string} options.workerPath - Path to bare-mux worker
         * @param {string} options.transportPath - Path to transport module
         * @returns {Promise<boolean>} - True if initialization succeeded
         */
        async init(options = {}) {
            const {
                bareServers = DEFAULT_BARE_SERVERS,
                workerPath = '/uv/baremux.worker.js',
                transportPath = '/uv/bare.transport.mjs'
            } = options;

            this.servers = bareServers;

            try {
                // Step 1: Check which bare server is available
                this.activeServer = await this.findAvailableServer();
                if (!this.activeServer) {
                    console.error('UV: No bare servers available');
                    return false;
                }
                console.log('UV: Using bare server:', this.activeServer);

                // Step 2: Create BareMux connection
                if (typeof BareMux === 'undefined') {
                    console.error('UV: BareMux not loaded. Include baremux.js first.');
                    return false;
                }

                this.connection = new BareMux.BareMuxConnection(workerPath);
                console.log('UV: BareMux connection created');

                // Step 3: Set the transport with the bare server URL
                await this.connection.setTransport(transportPath, [this.activeServer]);
                console.log('UV: Transport configured');

                // Step 4: Register service worker
                if ('serviceWorker' in navigator) {
                    const swPath = self.__uv$config?.sw ? '/uv/sw.js' : '/uv/sw.js';
                    const scope = self.__uv$config?.prefix || '/uv/service/';
                    
                    const registration = await navigator.serviceWorker.register(swPath, { scope });
                    console.log('UV: Service Worker registered:', registration.scope);
                } else {
                    console.warn('UV: ServiceWorker not supported');
                }

                this.ready = true;
                console.log('UV: Initialization complete');
                return true;

            } catch (error) {
                console.error('UV: Initialization failed:', error);
                this.ready = false;
                return false;
            }
        }

        /**
         * Find an available bare server
         * @returns {Promise<string|null>}
         */
        async findAvailableServer() {
            for (const server of this.servers) {
                try {
                    const response = await fetch(server, { 
                        method: 'GET',
                        mode: 'cors'
                    });
                    if (response.ok) {
                        return server;
                    }
                } catch (e) {
                    console.warn('UV: Server unavailable:', server);
                }
            }
            return null;
        }

        /**
         * Encode a URL for the proxy
         * @param {string} url - The URL to encode
         * @returns {string} - The encoded proxy URL
         */
        encodeUrl(url) {
            if (!self.__uv$config) {
                throw new Error('UV config not loaded');
            }
            return self.__uv$config.prefix + self.__uv$config.encodeUrl(url);
        }

        /**
         * Decode a proxy URL back to the original
         * @param {string} encodedUrl - The encoded proxy URL
         * @returns {string} - The original URL
         */
        decodeUrl(encodedUrl) {
            if (!self.__uv$config) {
                throw new Error('UV config not loaded');
            }
            const prefix = self.__uv$config.prefix;
            if (encodedUrl.startsWith(prefix)) {
                return self.__uv$config.decodeUrl(encodedUrl.slice(prefix.length));
            }
            return encodedUrl;
        }

        /**
         * Get the current transport status
         * @returns {Promise<string>}
         */
        async getTransportStatus() {
            if (!this.connection) {
                return 'Not initialized';
            }
            try {
                return await this.connection.getTransport();
            } catch (e) {
                return 'Error: ' + e.message;
            }
        }
    }

    // Create global instance
    const uvProxy = new UVProxy();

    // Export
    global.UVProxy = UVProxy;
    global.uvProxy = uvProxy;

    // Convenience function
    global.initUV = async function(options) {
        await uvProxy.init(options);
        return uvProxy;
    };

})(typeof window !== 'undefined' ? window : self);
