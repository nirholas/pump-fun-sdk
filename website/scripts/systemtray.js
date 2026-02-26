/**
 * LairOS System Tray — live crypto data, network status, volume, quick actions
 */
(function () {
	'use strict';

	// Route all external API calls through /api/proxy to avoid CORS + rate-limit issues
	const PROXY = '/api/proxy?url=';
	const COINGECKO_BTC_URL = PROXY + encodeURIComponent('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=true');
	const FNG_URL = PROXY + encodeURIComponent('https://api.alternative.me/fng/');
	// Etherscan free tier (no key needed for gasoracle)
	const GAS_URL = PROXY + encodeURIComponent('https://api.etherscan.io/api?module=gastracker&action=gasoracle');

	const UPDATE_INTERVAL = 120_000; // 120s — avoids CoinGecko free-tier 429s

	// ── State ──
	let volumeLevel = 60;
	let qaOpen = false;
	let _btcCache = null;
	let _gasCache = null;
	let _fngCache = null;

	// ── Helpers ──
	function $(id) { return document.getElementById(id); }

	function formatUSD(n) {
		if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
		if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
		if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
		return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
	}

	// ── BTC Price ──
	function renderBTC(price, change, mcap) {
		const el = $('btc-price');
		if (!el) return;
		const arrow = change >= 0 ? '▲' : '▼';
		const sign = change >= 0 ? '+' : '';
		el.textContent = `${formatUSD(price)} ${arrow}${sign}${change.toFixed(1)}%`;
		el.className = 'tray-value ' + (change >= 0 ? 'price-up' : 'price-down');
		const trayBtc = $('tray-btc');
		if (trayBtc) {
			trayBtc.setAttribute('data-tooltip',
				`Bitcoin: $${Number(price).toLocaleString('en-US', { minimumFractionDigits: 2 })} | 24h: ${sign}${change.toFixed(1)}% | MCap: ${formatUSD(mcap)}`
			);
		}
	}

	async function fetchBTC() {
		try {
			const res = await fetch(COINGECKO_BTC_URL);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			_btcCache = { price: data.bitcoin.usd, change: data.bitcoin.usd_24h_change, mcap: data.bitcoin.usd_market_cap };
			renderBTC(_btcCache.price, _btcCache.change, _btcCache.mcap);
		} catch (e) {
			if (_btcCache) renderBTC(_btcCache.price, _btcCache.change, _btcCache.mcap);
			else console.warn('SystemTray: BTC fetch failed', e.message);
		}
	}

	// ── Gas Price ──
	function renderGas(low, avg, fast) {
		const el = $('gas-price');
		if (!el) return;
		el.textContent = `${avg} gwei`;
		el.className = 'tray-value ' + (avg < 20 ? 'gas-low' : avg <= 50 ? 'gas-mid' : 'gas-high');
		const trayGas = $('tray-gas');
		if (trayGas) {
			trayGas.setAttribute('data-tooltip',
				`ETH Gas | Low: ${low} | Avg: ${avg} | Fast: ${fast} gwei`
			);
		}
	}

	async function fetchGas() {
		try {
			const res = await fetch(GAS_URL);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			if (data.status !== '1' || !data.result) return;
			_gasCache = { low: parseInt(data.result.SafeGasPrice, 10), avg: parseInt(data.result.ProposeGasPrice, 10), fast: parseInt(data.result.FastGasPrice, 10) };
			renderGas(_gasCache.low, _gasCache.avg, _gasCache.fast);
		} catch (e) {
			if (_gasCache) renderGas(_gasCache.low, _gasCache.avg, _gasCache.fast);
			else console.warn('SystemTray: Gas fetch failed', e.message);
		}
	}

	// ── Fear & Greed ──
	function renderFNG(value, label) {
		const emojiEl = $('fng-emoji');
		const valEl = $('fng-value');
		if (!emojiEl || !valEl) return;
		let emoji, cls;
		if (value <= 25) { emoji = '😨'; cls = 'fng-fear'; }
		else if (value <= 45) { emoji = '😟'; cls = 'fng-fear'; }
		else if (value <= 55) { emoji = '😐'; cls = 'fng-neutral'; }
		else if (value <= 75) { emoji = '😏'; cls = 'fng-greed'; }
		else { emoji = '🤑'; cls = 'fng-greed'; }
		emojiEl.textContent = emoji;
		valEl.textContent = value;
		valEl.className = 'tray-value ' + cls;
		const trayFng = $('tray-fng');
		if (trayFng) {
			trayFng.setAttribute('data-tooltip', `Fear & Greed: ${value} — ${label}`);
		}
	}

	async function fetchFNG() {
		try {
			const res = await fetch(FNG_URL);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			const entry = data.data && data.data[0];
			if (!entry) return;
			_fngCache = { value: parseInt(entry.value, 10), label: entry.value_classification };
			renderFNG(_fngCache.value, _fngCache.label);
		} catch (e) {
			if (_fngCache) renderFNG(_fngCache.value, _fngCache.label);
			else console.warn('SystemTray: FNG fetch failed', e.message);
		}
	}

	// ── Network Status ──
	function updateNetwork(online) {
		const dot = $('network-dot');
		if (!dot) return;
		dot.className = 'tray-dot ' + (online ? 'online' : 'offline');

		const trayNet = $('tray-network');
		if (trayNet) {
			trayNet.setAttribute('data-tooltip', online ? 'Network: Online' : 'Network: Offline');
		}

		// Update quick actions too
		const qaStatus = $('qa-network-status');
		if (qaStatus) qaStatus.textContent = online ? 'Online' : 'Offline';
	}

	// ── Volume Control ──
	function initVolume() {
		const volItem = $('tray-volume');
		const popup = $('volume-slider-popup');
		const slider = $('volume-slider');
		const levelEl = $('volume-level');
		if (!volItem || !popup || !slider) return;

		// Restore saved volume
		try {
			const saved = localStorage.getItem('lair-os-volume');
			if (saved !== null) volumeLevel = parseInt(saved, 10);
		} catch (_) {}
		slider.value = volumeLevel;
		if (levelEl) levelEl.textContent = volumeLevel + '%';
		updateVolumeIcon();

		volItem.addEventListener('click', (e) => {
			e.stopPropagation();
			const visible = popup.style.display !== 'none';
			popup.style.display = visible ? 'none' : 'flex';
		});

		slider.addEventListener('input', () => {
			volumeLevel = parseInt(slider.value, 10);
			if (levelEl) levelEl.textContent = volumeLevel + '%';
			updateVolumeIcon();
			try { localStorage.setItem('lair-os-volume', volumeLevel); } catch (_) {}
			const qaVol = $('qa-volume-value');
			if (qaVol) qaVol.textContent = volumeLevel + '%';
		});

		// Close popup when clicking elsewhere
		document.addEventListener('click', (e) => {
			if (!volItem.contains(e.target)) popup.style.display = 'none';
		});
	}

	function updateVolumeIcon() {
		const icon = document.querySelector('#tray-volume .tray-icon-mat');
		if (!icon) return;
		if (volumeLevel === 0) icon.textContent = 'volume_off';
		else if (volumeLevel < 40) icon.textContent = 'volume_down';
		else icon.textContent = 'volume_up';
	}

	// ── Quick Actions Panel ──
	window.toggleQuickActions = function () {
		const panel = $('quick-actions-panel');
		if (!panel) return;
		qaOpen = !qaOpen;
		panel.classList.toggle('open', qaOpen);
	};

	function initQuickActionsToggle() {
		// Allow clicking network dot area to open quick actions
		const netItem = $('tray-network');
		if (netItem) {
			netItem.addEventListener('click', (e) => {
				e.stopPropagation();
				toggleQuickActions();
			});
		}

		// Close quick actions when clicking elsewhere
		document.addEventListener('click', (e) => {
			const panel = $('quick-actions-panel');
			if (qaOpen && panel && !panel.contains(e.target)) {
				qaOpen = false;
				panel.classList.remove('open');
			}
		});
	}

	// ── Fetch All ──
	async function fetchAll() {
		await Promise.allSettled([fetchBTC(), fetchGas(), fetchFNG()]);
	}

	// ── Init ──
	function init() {
		// Network status
		updateNetwork(navigator.onLine);
		window.addEventListener('online', () => updateNetwork(true));
		window.addEventListener('offline', () => updateNetwork(false));

		// Volume
		initVolume();

		// Quick Actions
		initQuickActionsToggle();

		// Initial data fetch
		fetchAll();

		// Periodic updates
		setInterval(fetchAll, UPDATE_INTERVAL);

		// Clock tooltip (daily update)
		updateClockTooltip();
		setInterval(updateClockTooltip, 60_000);
	}

	function updateClockTooltip() {
		const timeEl = document.querySelector('#draggable-time');
		if (!timeEl) return;
		const now = new Date();
		const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
		const monthName = now.toLocaleDateString('en-US', { month: 'long' });
		const day = now.getDate();
		const year = now.getFullYear();
		const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
		const offset = now.getTimezoneOffset();
		const offsetHrs = Math.abs(Math.floor(offset / 60));
		const sign = offset <= 0 ? '+' : '-';
		timeEl.title = `${dayName}, ${monthName} ${day}, ${year} • UTC${sign}${offsetHrs}`;
	}

	// Wait for DOM
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
