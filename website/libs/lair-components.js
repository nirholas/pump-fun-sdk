(function (global) {
  'use strict';

  const cacheStore = new Map();
  const DEFAULT_RETRY_DELAY = 300;
  const DEFAULT_CACHE_TTL = 30_000;
  const DEFAULT_RETRIES = 2;
  const DEFAULT_TIMEOUT_MS = 20_000;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function withTimeout(promise, timeoutMs) {
    if (!timeoutMs || timeoutMs <= 0) return promise;
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs))
    ]);
  }

  function normalizeFallbackUrls(url, fallback) {
    if (!fallback) return [];
    if (Array.isArray(fallback)) return fallback;
    if (typeof fallback === 'string') return [fallback];
    if (typeof fallback === 'function') {
      const maybe = fallback(url);
      return Array.isArray(maybe) ? maybe : maybe ? [maybe] : [];
    }
    if (fallback === true) {
      const encoded = encodeURIComponent(url);
      return [
        `https://api.allorigins.win/raw?url=${encoded}`,
        `https://cors.isomorphic-git.org/${url}`
      ];
    }
    return [];
  }

  function getComputedVar(names) {
    const style = getComputedStyle(document.documentElement);
    for (const name of names) {
      const value = style.getPropertyValue(name).trim();
      if (value) return value;
    }
    return '';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  class PumpFetch {
    static async get(url, opts = {}) {
      return this._request(url, { ...opts, parseAs: opts.parseAs || 'text' });
    }

    static async getJSON(url, opts = {}) {
      return this._request(url, { ...opts, parseAs: 'json' });
    }

    static async _request(url, opts = {}) {
      const {
        cache = true,
        ttl = DEFAULT_CACHE_TTL,
        retries = DEFAULT_RETRIES,
        fallback = false,
        parseAs = 'json',
        timeoutMs = DEFAULT_TIMEOUT_MS,
        container,
        fetchOptions = {}
      } = opts;

      const cacheKey = `${parseAs}:${url}`;
      if (cache && cacheStore.has(cacheKey)) {
        const cached = cacheStore.get(cacheKey);
        if (Date.now() < cached.expiresAt) return cached.data;
        cacheStore.delete(cacheKey);
      }

      const targets = [url, ...normalizeFallbackUrls(url, fallback)];
      let lastError = null;

      let hideLoading = null;
      if (container && global.PumpUI) {
        hideLoading = global.PumpUI.spinner(container);
      }

      try {
        for (const target of targets) {
          for (let attempt = 0; attempt <= retries; attempt += 1) {
            try {
              const response = await withTimeout(fetch(target, fetchOptions), timeoutMs);
              if (!response.ok) {
                throw new Error(`HTTP ${response.status} for ${target}`);
              }

              const data = parseAs === 'json' ? await response.json() : await response.text();
              if (cache) {
                cacheStore.set(cacheKey, {
                  data,
                  expiresAt: Date.now() + ttl
                });
              }
              return data;
            } catch (error) {
              lastError = error;
              if (attempt < retries) {
                await sleep(DEFAULT_RETRY_DELAY * (2 ** attempt));
              }
            }
          }
        }

        throw lastError || new Error('Request failed');
      } catch (error) {
        if (container && global.PumpUI) {
          global.PumpUI.error(container, error.message || 'Request failed');
        }
        throw error;
      } finally {
        if (typeof hideLoading === 'function') hideLoading();
      }
    }
  }

  const PumpTheme = {
    isDark() {
      const root = document.documentElement;
      if (root.classList.contains('dark') || root.dataset.theme === 'dark') return true;
      const bg = getComputedVar(['--col-bg1', '--col-bg2', '--background']);
      if (!bg) return true;
      const rgb = bg.match(/\d+/g);
      if (!rgb || rgb.length < 3) return true;
      const [r, g, b] = rgb.slice(0, 3).map(Number);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance < 0.5;
    },

    getColor(name) {
      return getComputedVar([
        `--colors-${name}`,
        `--col-${name}`,
        `--${name}`
      ]);
    },

    apply(container) {
      if (!container) return;
      container.classList.add('lair-theme-surface');
      container.setAttribute('data-lair-theme', this.isDark() ? 'dark' : 'light');
    }
  };

  const PumpUI = {
    spinner(container) {
      if (!container) return () => {};
      const spinner = document.createElement('div');
      spinner.className = 'lair-spinner-wrap';
      spinner.innerHTML = '<div class="lair-spinner"></div><div class="lair-spinner-text">Loading…</div>';
      container.innerHTML = '';
      container.appendChild(spinner);
      return () => {
        if (spinner.parentNode === container) container.removeChild(spinner);
      };
    },

    error(container, message, retryFn) {
      if (!container) return;
      const button = retryFn ? '<button class="lair-retry-btn" type="button">Retry</button>' : '';
      container.innerHTML = `<div class="lair-error"><div class="lair-error-msg">${escapeHtml(message || 'Something went wrong')}</div>${button}</div>`;
      if (retryFn) {
        const retryButton = container.querySelector('.lair-retry-btn');
        if (retryButton) retryButton.addEventListener('click', retryFn);
      }
    },

    empty(container, message) {
      if (!container) return;
      container.innerHTML = `<div class="lair-empty">${escapeHtml(message || 'No data available')}</div>`;
    },

    table(container, config) {
      if (!container) return;
      const { columns = [], data = [], sortable = false } = config || {};
      let rows = Array.isArray(data) ? [...data] : [];
      let sortState = { key: null, dir: 'asc' };

      const render = () => {
        const head = columns.map((col) => {
          const label = escapeHtml(col.label || col.key || '');
          const sortIcon = sortState.key === col.key ? (sortState.dir === 'asc' ? ' ▲' : ' ▼') : '';
          if (sortable && col.sortable !== false && col.key) {
            return `<th><button class="lair-th-btn" data-sort="${escapeHtml(col.key)}">${label}${sortIcon}</button></th>`;
          }
          return `<th>${label}</th>`;
        }).join('');

        const body = rows.map((row) => {
          const cells = columns.map((col) => {
            let value = row[col.key];
            if (typeof col.render === 'function') value = col.render(value, row);
            return `<td>${value == null ? '' : value}</td>`;
          }).join('');
          return `<tr>${cells}</tr>`;
        }).join('');

        container.innerHTML = `<div class="lair-table-wrap"><table class="lair-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;

        if (sortable) {
          container.querySelectorAll('[data-sort]').forEach((el) => {
            el.addEventListener('click', () => {
              const key = el.getAttribute('data-sort');
              if (!key) return;
              if (sortState.key === key) {
                sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
              } else {
                sortState = { key, dir: 'asc' };
              }

              rows.sort((a, b) => {
                const av = a[key];
                const bv = b[key];
                if (av == null) return 1;
                if (bv == null) return -1;
                if (typeof av === 'number' && typeof bv === 'number') {
                  return sortState.dir === 'asc' ? av - bv : bv - av;
                }
                return sortState.dir === 'asc'
                  ? String(av).localeCompare(String(bv))
                  : String(bv).localeCompare(String(av));
              });

              render();
            });
          });
        }
      };

      render();

      return {
        setData(nextRows) {
          rows = Array.isArray(nextRows) ? [...nextRows] : [];
          render();
        }
      };
    },

    price(value, change, opts = {}) {
      const { decimals = 2, symbol = '$' } = opts;
      const num = Number(value);
      const changeNum = Number(change);
      const formatted = Number.isFinite(num) ? `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}` : '—';
      const cls = Number.isFinite(changeNum) ? (changeNum >= 0 ? 'lair-price up' : 'lair-price down') : 'lair-price';
      return `<span class="${cls}">${formatted}</span>`;
    },

    tokenBadge(symbol, iconUrl, chain) {
      const icon = iconUrl
        ? `<img src="${escapeHtml(iconUrl)}" alt="${escapeHtml(symbol || '')}" loading="lazy" />`
        : '<span class="lair-token-dot"></span>';
      const chainLabel = chain ? `<span class="lair-token-chain">${escapeHtml(chain)}</span>` : '';
      return `<span class="lair-token-badge">${icon}<span class="lair-token-symbol">${escapeHtml(symbol || 'TOKEN')}</span>${chainLabel}</span>`;
    },

    sparkline(container, data, opts = {}) {
      if (!container || !Array.isArray(data) || data.length < 2) return null;
      const points = data.map(Number).filter((v) => Number.isFinite(v));
      if (points.length < 2) return null;

      const width = opts.width || 120;
      const height = opts.height || 32;
      const color = opts.color || getComputedVar(['--colors-accent', '--col-good']) || '#6179ff';
      const fill = `${color}22`;

      let canvas = container;
      if (!(container instanceof HTMLCanvasElement)) {
        canvas = document.createElement('canvas');
        container.innerHTML = '';
        container.appendChild(canvas);
      }

      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const min = Math.min(...points);
      const max = Math.max(...points);
      const range = max - min || 1;
      const pad = 2;

      ctx.beginPath();
      points.forEach((value, index) => {
        const x = pad + (index / (points.length - 1)) * (width - pad * 2);
        const y = pad + (1 - (value - min) / range) * (height - pad * 2);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.lineTo(width - pad, height - pad);
      ctx.lineTo(pad, height - pad);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();

      return canvas;
    }
  };

  const wsState = {
    socket: null,
    subs: new Map(),
    connected: false,
    url: null
  };

  function getWsUrl() {
    if (global.LAIR_WS_URL) return global.LAIR_WS_URL;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws`;
  }

  function ensureSocket() {
    if (wsState.socket && (wsState.socket.readyState === WebSocket.OPEN || wsState.socket.readyState === WebSocket.CONNECTING)) {
      return wsState.socket;
    }

    wsState.url = getWsUrl();
    wsState.socket = new WebSocket(wsState.url);

    wsState.socket.addEventListener('open', () => {
      wsState.connected = true;
      for (const channel of wsState.subs.keys()) {
        wsState.socket.send(JSON.stringify({ action: 'subscribe', channel }));
      }
    });

    wsState.socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data);
        const channel = payload.channel;
        const callbacks = wsState.subs.get(channel) || [];
        callbacks.forEach((cb) => cb(payload.data ?? payload));
      } catch (_) {
      }
    });

    wsState.socket.addEventListener('close', () => {
      wsState.connected = false;
    });

    wsState.socket.addEventListener('error', () => {
      wsState.connected = false;
    });

    return wsState.socket;
  }

  const PumpWS = {
    subscribe(channel, callback) {
      if (!channel || typeof callback !== 'function') return;
      const callbacks = wsState.subs.get(channel) || [];
      callbacks.push(callback);
      wsState.subs.set(channel, callbacks);
      const socket = ensureSocket();
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action: 'subscribe', channel }));
      }
    },

    unsubscribe(channel) {
      if (!channel) return;
      wsState.subs.delete(channel);
      if (wsState.socket && wsState.socket.readyState === WebSocket.OPEN) {
        wsState.socket.send(JSON.stringify({ action: 'unsubscribe', channel }));
      }
    }
  };

  const PumpPoll = {
    _timer: null,
    _isRunning: false,

    async start(fetchFn, intervalMs, callback) {
      this.stop();
      this._isRunning = true;

      const tick = async () => {
        if (!this._isRunning) return;
        try {
          const data = await fetchFn();
          if (callback) callback(data, null);
        } catch (error) {
          if (callback) callback(null, error);
        }
      };

      await tick();
      this._timer = setInterval(tick, Math.max(1000, Number(intervalMs) || 5000));
    },

    stop() {
      this._isRunning = false;
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    }
  };

  global.PumpFetch = PumpFetch;
  global.PumpUI = PumpUI;
  global.PumpTheme = PumpTheme;
  global.PumpWS = PumpWS;
  global.PumpPoll = PumpPoll;
})(window);
