(function () {
    'use strict';

    class PumpBus {
        static appId = null;
        static initialized = false;
        static requestCounter = 0;
        static listeners = new Map();
        static pendingRequests = new Map();

        static register(appId) {
            if (!appId || typeof appId !== 'string') return;
            this.appId = appId;
            this._ensureInitialized();
            this._post({
                kind: 'register',
                appId
            });
        }

        static send(targetAppId, event, data) {
            if (!targetAppId || !event) return;
            this._ensureInitialized();
            this._post({
                kind: 'event',
                source: this.appId || 'unknown',
                targetAppId,
                event,
                data: data ?? null
            });
        }

        static broadcast(event, data) {
            if (!event) return;
            this._ensureInitialized();
            this._post({
                kind: 'event',
                source: this.appId || 'unknown',
                broadcast: true,
                event,
                data: data ?? null
            });
        }

        static on(event, callback) {
            if (!event || typeof callback !== 'function') return;
            this._ensureInitialized();
            if (!this.listeners.has(event)) {
                this.listeners.set(event, new Set());
            }
            this.listeners.get(event).add(callback);
        }

        static off(event, callback) {
            if (!event || !this.listeners.has(event)) return;
            if (callback && typeof callback === 'function') {
                this.listeners.get(event).delete(callback);
                if (this.listeners.get(event).size === 0) {
                    this.listeners.delete(event);
                }
                return;
            }
            this.listeners.delete(event);
        }

        static request(targetAppId, event, data, timeoutMs = 5000) {
            if (!targetAppId || !event) {
                return Promise.reject(new Error('targetAppId and event are required'));
            }

            this._ensureInitialized();
            const requestId = this._nextRequestId();

            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    this.pendingRequests.delete(requestId);
                    reject(new Error(`PumpBus request timed out: ${event}`));
                }, Math.max(1, timeoutMs));

                this.pendingRequests.set(requestId, { resolve, reject, timer });

                this._post({
                    kind: 'event',
                    source: this.appId || 'unknown',
                    targetAppId,
                    event,
                    data: data ?? null,
                    requestId
                });
            });
        }

        static _nextRequestId() {
            this.requestCounter += 1;
            return `lair_req_${Date.now()}_${this.requestCounter}`;
        }

        static _post(payload) {
            if (!window.parent || window.parent === window) return;
            window.parent.postMessage({ __lairBus: true, payload }, '*');
        }

        static async _handleEventMessage(payload) {
            const callbacks = this.listeners.get(payload.event);
            if (!callbacks || callbacks.size === 0) {
                if (payload.requestId) {
                    this._post({
                        kind: 'response',
                        source: this.appId || 'unknown',
                        responseTo: payload.requestId,
                        data: null
                    });
                }
                return;
            }

            let responseValue = null;
            let hasResponse = false;

            const callbackList = Array.from(callbacks);
            for (const callback of callbackList) {
                try {
                    const result = await callback(payload.data, payload);
                    if (!hasResponse && result !== undefined) {
                        responseValue = result;
                        hasResponse = true;
                    }
                } catch (error) {
                    console.error('PumpBus event handler failed:', error);
                }
            }

            if (payload.requestId) {
                this._post({
                    kind: 'response',
                    source: this.appId || 'unknown',
                    responseTo: payload.requestId,
                    data: hasResponse ? responseValue : null
                });
            }
        }

        static _handleResponseMessage(payload) {
            const pending = this.pendingRequests.get(payload.responseTo);
            if (!pending) return;
            clearTimeout(pending.timer);
            this.pendingRequests.delete(payload.responseTo);
            pending.resolve(payload.data);
        }

        static _ensureInitialized() {
            if (this.initialized) return;
            window.addEventListener('message', (event) => {
                const message = event.data;
                if (!message || !message.__lairBus || !message.payload) return;

                const payload = message.payload;
                if (payload.kind === 'response' && payload.responseTo) {
                    this._handleResponseMessage(payload);
                    return;
                }

                if (payload.kind === 'event' && payload.event) {
                    this._handleEventMessage(payload);
                }
            });
            this.initialized = true;
        }
    }

    PumpBus._ensureInitialized();
    window.PumpBus = PumpBus;
})();