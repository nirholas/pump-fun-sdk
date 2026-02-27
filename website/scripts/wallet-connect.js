/**
 * PumpOS Wallet Connection Module
 * OS-level wallet management with postMessage bus for all iframed apps.
 * Supports MetaMask (injected), WalletConnect v2, and Coinbase Wallet.
 */
(function () {
    'use strict';

    // ──────────────────────────── Chain Config ────────────────────────────
    const CHAINS = {
        1:     { name: 'Ethereum',  symbol: 'ETH',   decimals: 18, color: '#627EEA', rpc: 'https://eth.llamarpc.com',           explorer: 'https://etherscan.io' },
        8453:  { name: 'Base',      symbol: 'ETH',   decimals: 18, color: '#0052FF', rpc: 'https://mainnet.base.org',            explorer: 'https://basescan.org' },
        42161: { name: 'Arbitrum',  symbol: 'ETH',   decimals: 18, color: '#28A0F0', rpc: 'https://arb1.arbitrum.io/rpc',        explorer: 'https://arbiscan.io' },
        137:   { name: 'Polygon',   symbol: 'POL',   decimals: 18, color: '#8247E5', rpc: 'https://polygon-rpc.com',             explorer: 'https://polygonscan.com' },
        10:    { name: 'Optimism',  symbol: 'ETH',   decimals: 18, color: '#FF0420', rpc: 'https://mainnet.optimism.io',         explorer: 'https://optimistic.etherscan.io' },
        56:    { name: 'BSC',       symbol: 'BNB',   decimals: 18, color: '#F0B90B', rpc: 'https://bsc-dataseed.binance.org',    explorer: 'https://bscscan.com' },
    };

    const SUPPORTED_CHAIN_IDS = Object.keys(CHAINS).map(Number);

    // WalletConnect project ID — configurable via localStorage
    function getWCProjectId() {
        return localStorage.getItem('lair_wc_project_id') || '';
    }

    // ──────────────────────────── State ────────────────────────────
    const state = {
        address: null,
        chainId: null,
        balance: null,
        provider: null,     // 'injected' | 'walletconnect' | 'coinbase'
        connecting: false,
        wcProvider: null,   // WalletConnect provider instance
        cbProvider: null,   // Coinbase provider instance
    };

    // ──────────────────────────── DOM Refs ────────────────────────────
    let walletBtn, walletModal, walletDropdown, chainDropdown, txConfirmModal;

    // ──────────────────────────── Utility ────────────────────────────
    function truncAddr(addr) {
        if (!addr) return '';
        return addr.slice(0, 6) + '\u2026' + addr.slice(-4);
    }

    function toHex(num) {
        return '0x' + Number(num).toString(16);
    }

    function fromHex(hex) {
        return parseInt(hex, 16);
    }

    function formatBalance(weiHex) {
        try {
            const wei = BigInt(weiHex);
            const whole = wei / BigInt(1e18);
            const frac = wei % BigInt(1e18);
            const fracStr = frac.toString().padStart(18, '0').slice(0, 4);
            const eth = parseFloat(whole.toString() + '.' + fracStr);
            if (eth === 0 && wei > 0n) return '<0.0001';
            if (eth < 1) return eth.toFixed(4);
            if (eth < 1000) return eth.toFixed(3);
            return eth.toFixed(2);
        } catch {
            return '0';
        }
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // ──────────────────────────── Identicon (Canvas) ────────────────────────────
    function generateIdenticon(address, size) {
        size = size || 28;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Seed from address bytes
        let seed = 0;
        for (let i = 2; i < address.length; i++) {
            seed = ((seed << 5) - seed + address.charCodeAt(i)) | 0;
        }

        function rand() {
            seed = (seed * 16807 + 0) % 2147483647;
            return (seed & 0x7fffffff) / 0x7fffffff;
        }

        // Background circle
        const bgH = Math.floor(rand() * 360);
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = 'hsl(' + bgH + ', 65%, 25%)';
        ctx.fill();

        // 5x5 symmetric pattern
        const cells = 5;
        const cellSize = size / cells;
        const patH = (bgH + 120 + Math.floor(rand() * 120)) % 360;

        for (let y = 0; y < cells; y++) {
            for (let x = 0; x <= Math.floor(cells / 2); x++) {
                if (rand() > 0.45) {
                    const l = 45 + Math.floor(rand() * 30);
                    ctx.fillStyle = 'hsl(' + patH + ', 70%, ' + l + '%)';
                    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                    if (x !== cells - 1 - x) {
                        ctx.fillRect((cells - 1 - x) * cellSize, y * cellSize, cellSize, cellSize);
                    }
                }
            }
        }

        // Clip to circle
        const canvas2 = document.createElement('canvas');
        canvas2.width = size;
        canvas2.height = size;
        const ctx2 = canvas2.getContext('2d');
        ctx2.beginPath();
        ctx2.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx2.closePath();
        ctx2.clip();
        ctx2.drawImage(canvas, 0, 0);

        return canvas2.toDataURL();
    }

    // ──────────────────────────── Broadcast to Apps ────────────────────────────
    function broadcast(type, extra) {
        extra = extra || {};
        var chain = CHAINS[state.chainId] || {};
        var msg = {
            type: type,
            address: state.address,
            chainId: state.chainId,
            chainName: chain.name || 'Unknown',
            balance: state.balance,
        };
        // Merge extra
        for (var k in extra) {
            if (extra.hasOwnProperty(k)) msg[k] = extra[k];
        }

        // Use PumpOS eventBus if available
        if (typeof eventBusWorker !== 'undefined' && eventBusWorker.deliver) {
            eventBusWorker.deliver({ type: 'wallet', event: type, data: msg });
        }

        // Direct postMessage to all iframes
        var iframes = document.querySelectorAll('iframe');
        iframes.forEach(function (iframe) {
            try {
                iframe.contentWindow.postMessage(msg, '*');
            } catch (e) { /* cross-origin, skip */ }
        });
    }

    // ──────────────────────────── Balance Fetching ────────────────────────────
    function getActiveProvider() {
        if (state.provider === 'walletconnect' && state.wcProvider) return state.wcProvider;
        if (state.provider === 'coinbase' && state.cbProvider) return state.cbProvider;
        return window.ethereum || null;
    }

    async function fetchBalance() {
        if (!state.address) { state.balance = null; return; }
        var p = getActiveProvider();
        if (!p) { state.balance = null; return; }

        try {
            var raw = await p.request({
                method: 'eth_getBalance',
                params: [state.address, 'latest']
            });
            state.balance = formatBalance(raw);
        } catch (e) {
            console.warn('[PumpWallet] Balance fetch failed:', e);
            state.balance = null;
        }
    }

    // ──────────────────────────── UI Rendering ────────────────────────────
    function updateUI() {
        if (!walletBtn) return;

        if (state.connecting) {
            walletBtn.innerHTML =
                '<div class="wallet-btn-inner wallet-connecting">' +
                    '<span class="wallet-spinner"></span>' +
                    '<span class="wallet-btn-label">Connecting\u2026</span>' +
                '</div>';
            walletBtn.className = 'navmalobj wallet-btn wallet-state-connecting';
            return;
        }

        if (state.address) {
            var chain = CHAINS[state.chainId] || { name: 'Unknown', color: '#888', symbol: '?' };
            var balText = state.balance != null ? (state.balance + ' ' + chain.symbol) : '';
            var icon = generateIdenticon(state.address);

            walletBtn.innerHTML =
                '<div class="wallet-btn-inner wallet-connected-inner">' +
                    '<span class="wallet-chain-dot" style="background:' + chain.color + '" title="' + escapeHtml(chain.name) + '"></span>' +
                    '<img class="wallet-identicon" src="' + icon + '" width="20" height="20" />' +
                    '<span class="wallet-addr">' + truncAddr(state.address) + '</span>' +
                    (balText ? '<span class="wallet-balance">' + escapeHtml(balText) + '</span>' : '') +
                '</div>';
            walletBtn.className = 'navmalobj wallet-btn wallet-state-connected';

            // Update dropdown content
            updateDropdownUI(chain);
        } else {
            walletBtn.innerHTML =
                '<div class="wallet-btn-inner wallet-disconnected-inner">' +
                    '<span class="material-symbols-rounded wallet-icon-glyph">account_balance_wallet</span>' +
                    '<span class="wallet-btn-label">Connect</span>' +
                '</div>';
            walletBtn.className = 'navmalobj wallet-btn wallet-state-disconnected';
        }
    }

    function updateDropdownUI(chain) {
        if (!walletDropdown) return;
        var addrFull = document.getElementById('wallet-dd-address');
        var chainName = document.getElementById('wallet-dd-chain');
        var balDisp = document.getElementById('wallet-dd-balance');
        var identiconDD = document.getElementById('wallet-dd-identicon');

        if (addrFull) addrFull.textContent = state.address || '';
        if (chainName) {
            chainName.textContent = chain.name;
            chainName.style.color = chain.color;
        }
        if (balDisp) balDisp.textContent = state.balance != null ? (state.balance + ' ' + chain.symbol) : '—';
        if (identiconDD && state.address) identiconDD.src = generateIdenticon(state.address, 40);

        // Highlight current chain in chain dropdown
        document.querySelectorAll('.wallet-chain-item').forEach(function (el) {
            var cid = parseInt(el.dataset.chainId, 10);
            el.classList.toggle('wallet-chain-active', cid === state.chainId);
        });
    }

    // ──────────────────────────── Connect: Injected (MetaMask, Brave, etc.) ────────────────────────────
    async function connectInjected() {
        if (!window.ethereum) {
            notify('MetaMask Not Found', 'Install MetaMask browser extension to connect.', 'warning');
            window.open('https://metamask.io/download/', '_blank');
            return false;
        }

        state.connecting = true;
        updateUI();

        try {
            var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (!accounts || accounts.length === 0) throw new Error('No accounts returned');

            state.address = accounts[0];
            state.chainId = fromHex(await window.ethereum.request({ method: 'eth_chainId' }));
            state.provider = 'injected';

            await fetchBalance();
            persist();
            state.connecting = false;
            updateUI();
            closeModal();
            broadcast('WALLET_CONNECTED');
            notify('Wallet Connected', truncAddr(state.address), 'success');
            return true;
        } catch (e) {
            console.error('[PumpWallet] Injected connect failed:', e);
            notify('Connection Failed', e.message || 'User rejected the request.', 'error');
            state.connecting = false;
            updateUI();
            return false;
        }
    }

    // ──────────────────────────── Connect: WalletConnect v2 ────────────────────────────
    async function connectWalletConnect() {
        var projectId = getWCProjectId();
        if (!projectId) {
            notify('WalletConnect', 'Project ID required. Go to cloud.walletconnect.com to get one, then set it in PumpOS terminal: localStorage.setItem("lair_wc_project_id", "YOUR_ID")', 'warning');
            return false;
        }

        state.connecting = true;
        updateUI();

        try {
            // Dynamic import from esm.sh CDN
            var mod = await import('https://esm.sh/@walletconnect/ethereum-provider@2.17.0');
            var EthereumProvider = mod.EthereumProvider || mod.default;
            if (!EthereumProvider) throw new Error('WalletConnect provider not found in module');

            var wcProvider = await EthereumProvider.init({
                projectId: projectId,
                chains: [1],
                optionalChains: SUPPORTED_CHAIN_IDS.filter(function (id) { return id !== 1; }),
                showQrModal: true,
                metadata: {
                    name: 'PumpOS',
                    description: 'PumpOS — Web3 Desktop Environment',
                    url: window.location.origin,
                    icons: [window.location.origin + '/n.png'],
                },
            });

            await wcProvider.enable();

            state.wcProvider = wcProvider;
            state.address = wcProvider.accounts[0];
            state.chainId = wcProvider.chainId;
            state.provider = 'walletconnect';

            await fetchBalance();
            persist();
            state.connecting = false;
            updateUI();
            closeModal();
            broadcast('WALLET_CONNECTED');
            notify('Wallet Connected', truncAddr(state.address) + ' via WalletConnect', 'success');

            // Event listeners
            wcProvider.on('accountsChanged', onAccountsChanged);
            wcProvider.on('chainChanged', onChainChanged);
            wcProvider.on('disconnect', function () { disconnect(); });

            return true;
        } catch (e) {
            console.error('[PumpWallet] WalletConnect failed:', e);
            var msg = e.message || 'WalletConnect connection failed.';
            if (msg.includes('fetch')) msg = 'Could not load WalletConnect SDK. Check your internet connection.';
            notify('WalletConnect Failed', msg, 'error');
            state.connecting = false;
            updateUI();
            return false;
        }
    }

    // ──────────────────────────── Connect: Coinbase Wallet ────────────────────────────
    async function connectCoinbase() {
        // If Coinbase Wallet extension is installed, it injects window.ethereum
        // Try the extension first
        if (window.ethereum && window.ethereum.isCoinbaseWallet) {
            return connectInjected();
        }

        state.connecting = true;
        updateUI();

        try {
            var mod = await import('https://esm.sh/@coinbase/wallet-sdk@4.3.0');
            var CoinbaseWalletSDK = mod.CoinbaseWalletSDK || mod.default;
            if (!CoinbaseWalletSDK) throw new Error('Coinbase SDK not found');

            var sdk = new CoinbaseWalletSDK({
                appName: 'PumpOS',
                appLogoUrl: window.location.origin + '/n.png',
            });

            var provider = sdk.makeWeb3Provider();
            state.cbProvider = provider;

            var accounts = await provider.request({ method: 'eth_requestAccounts' });
            if (!accounts || accounts.length === 0) throw new Error('No accounts returned');

            state.address = accounts[0];
            state.chainId = fromHex(await provider.request({ method: 'eth_chainId' }));
            state.provider = 'coinbase';

            await fetchBalance();
            persist();
            state.connecting = false;
            updateUI();
            closeModal();
            broadcast('WALLET_CONNECTED');
            notify('Wallet Connected', truncAddr(state.address) + ' via Coinbase', 'success');
            return true;
        } catch (e) {
            console.error('[PumpWallet] Coinbase connect failed:', e);
            var msg = e.message || 'Coinbase Wallet connection failed.';
            if (msg.includes('fetch')) msg = 'Could not load Coinbase SDK. Check your internet connection.';
            notify('Coinbase Failed', msg, 'error');
            state.connecting = false;
            updateUI();
            return false;
        }
    }

    // ──────────────────────────── Disconnect ────────────────────────────
    async function disconnect() {
        if (state.wcProvider) {
            try { await state.wcProvider.disconnect(); } catch (e) { /* ok */ }
            state.wcProvider = null;
        }
        state.cbProvider = null;

        var had = !!state.address;
        state.address = null;
        state.chainId = null;
        state.balance = null;
        state.provider = null;

        localStorage.removeItem('lair_wallet');
        updateUI();
        closeDropdown();
        closeChainDropdown();
        broadcast('WALLET_DISCONNECTED');

        if (had) notify('Wallet Disconnected', '', 'info');
    }

    // ──────────────────────────── Chain Switching ────────────────────────────
    async function switchChain(chainId) {
        var hexId = toHex(chainId);
        var chain = CHAINS[chainId];
        if (!chain) return;

        var p = getActiveProvider();
        if (!p) return;

        try {
            await p.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: hexId }]
            });
        } catch (err) {
            if (err.code === 4902 || (err.data && err.data.originalError && err.data.originalError.code === 4902)) {
                try {
                    await p.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: hexId,
                            chainName: chain.name,
                            nativeCurrency: { name: chain.symbol, symbol: chain.symbol, decimals: chain.decimals },
                            rpcUrls: [chain.rpc],
                            blockExplorerUrls: [chain.explorer],
                        }]
                    });
                } catch (addErr) {
                    notify('Chain Switch Failed', addErr.message || 'Could not add chain.', 'error');
                }
            } else {
                notify('Chain Switch Failed', err.message || 'Could not switch chain.', 'error');
            }
        }
        closeChainDropdown();
    }

    // ──────────────────────────── Event Handlers (EIP-1193) ────────────────────────────
    function onAccountsChanged(accounts) {
        if (!accounts || accounts.length === 0) {
            disconnect();
            return;
        }
        state.address = accounts[0];
        fetchBalance().then(function () {
            persist();
            updateUI();
            broadcast('WALLET_CONNECTED');
        });
    }

    function onChainChanged(chainIdRaw) {
        state.chainId = typeof chainIdRaw === 'string' ? fromHex(chainIdRaw) : Number(chainIdRaw);
        fetchBalance().then(function () {
            persist();
            updateUI();
            broadcast('CHAIN_CHANGED');
        });
    }

    function setupEthereumListeners() {
        if (!window.ethereum) return;
        window.ethereum.on('accountsChanged', onAccountsChanged);
        window.ethereum.on('chainChanged', onChainChanged);
        window.ethereum.on('disconnect', function () {
            // MetaMask emits disconnect on chain change sometimes; only disconnect if no accounts
            if (state.provider === 'injected') {
                window.ethereum.request({ method: 'eth_accounts' }).then(function (accs) {
                    if (!accs || accs.length === 0) disconnect();
                }).catch(function () { /* ignore */ });
            }
        });
    }

    // ──────────────────────────── Persistence ────────────────────────────
    function persist() {
        if (state.address) {
            localStorage.setItem('lair_wallet', JSON.stringify({
                address: state.address,
                chainId: state.chainId,
                provider: state.provider,
            }));
        }
    }

    async function autoReconnect() {
        var saved = localStorage.getItem('lair_wallet');
        if (!saved) return;

        try {
            var data = JSON.parse(saved);
            if (!data.address) return;

            // Only auto-reconnect injected wallets (MetaMask etc.) — they persist sessions
            if (data.provider === 'injected' && window.ethereum) {
                var accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts && accounts.length > 0) {
                    var match = accounts.find(function (a) {
                        return a.toLowerCase() === data.address.toLowerCase();
                    });
                    if (match) {
                        state.address = match;
                        state.chainId = fromHex(await window.ethereum.request({ method: 'eth_chainId' }));
                        state.provider = 'injected';
                        await fetchBalance();
                        updateUI();
                        broadcast('WALLET_CONNECTED');
                        return;
                    }
                }
            }
            // For WC/CB, user must reconnect manually
        } catch (e) {
            console.warn('[PumpWallet] Auto-reconnect failed:', e);
        }
    }

    // ──────────────────────────── Transaction Signing Proxy ────────────────────────────
    function setupTransactionProxy() {
        window.addEventListener('message', function (e) {
            if (!e.data || e.data.type !== 'TRANSACTION_REQUEST') return;
            if (!state.address) {
                try {
                    e.source.postMessage({ type: 'TRANSACTION_RESULT', error: 'No wallet connected', status: 'rejected' }, '*');
                } catch (ex) { /* ok */ }
                return;
            }
            showTxConfirmation({
                to: e.data.to,
                value: e.data.value,
                data: e.data.data,
                gasLimit: e.data.gasLimit,
                requestId: e.data.requestId,
                source: e.source,
            });
        });
    }

    function showTxConfirmation(tx) {
        if (!txConfirmModal) return;
        var chain = CHAINS[state.chainId] || { symbol: 'ETH', name: 'Unknown' };

        var elTo = document.getElementById('wallet-tx-to');
        var elVal = document.getElementById('wallet-tx-value');
        var elData = document.getElementById('wallet-tx-data');
        var elFrom = document.getElementById('wallet-tx-from');
        var elChain = document.getElementById('wallet-tx-chain');

        if (elTo) elTo.textContent = tx.to ? truncAddr(tx.to) : '—';
        if (elVal) elVal.textContent = (tx.value || '0') + ' ' + chain.symbol;
        if (elData) elData.textContent = tx.data ? (tx.data.length > 24 ? tx.data.slice(0, 24) + '\u2026' : tx.data) : 'None';
        if (elFrom) elFrom.textContent = truncAddr(state.address);
        if (elChain) elChain.textContent = chain.name;

        var confirmBtn = document.getElementById('wallet-tx-confirm');
        var rejectBtn = document.getElementById('wallet-tx-reject');

        function cleanup() {
            confirmBtn.onclick = null;
            rejectBtn.onclick = null;
            txConfirmModal.close();
        }

        confirmBtn.onclick = async function () {
            try {
                var p = getActiveProvider();
                if (!p) throw new Error('No provider');

                var txParams = { from: state.address, to: tx.to };
                if (tx.value) {
                    var wei = BigInt(Math.floor(parseFloat(tx.value) * 1e18));
                    txParams.value = '0x' + wei.toString(16);
                }
                if (tx.data) txParams.data = tx.data;
                if (tx.gasLimit) txParams.gas = toHex(tx.gasLimit);

                var hash = await p.request({ method: 'eth_sendTransaction', params: [txParams] });
                try {
                    tx.source.postMessage({ type: 'TRANSACTION_RESULT', hash: hash, status: 'submitted', requestId: tx.requestId }, '*');
                } catch (ex) { /* ok */ }
                notify('Transaction Submitted', truncAddr(hash), 'success');
            } catch (err) {
                try {
                    tx.source.postMessage({ type: 'TRANSACTION_RESULT', error: err.message, status: 'rejected', requestId: tx.requestId }, '*');
                } catch (ex) { /* ok */ }
                notify('Transaction Failed', err.message || 'Signing error', 'error');
            }
            cleanup();
        };

        rejectBtn.onclick = function () {
            try {
                tx.source.postMessage({ type: 'TRANSACTION_RESULT', error: 'User rejected', status: 'rejected', requestId: tx.requestId }, '*');
            } catch (ex) { /* ok */ }
            cleanup();
        };

        txConfirmModal.showModal();
    }

    // ──────────────────────────── Modal / Dropdown Controls ────────────────────────────
    function openModal() {
        if (state.address) {
            toggleDropdown();
            return;
        }
        if (!walletModal) return;

        // Update provider availability indicators
        var mmBtn = document.getElementById('wallet-opt-metamask');
        if (mmBtn) {
            var hasMM = !!window.ethereum;
            var mmStatus = mmBtn.querySelector('.wallet-opt-status');
            if (mmStatus) mmStatus.textContent = hasMM ? 'Detected' : 'Not installed';
            mmBtn.classList.toggle('wallet-opt-unavailable', !hasMM);
        }

        var wcBtn = document.getElementById('wallet-opt-walletconnect');
        if (wcBtn) {
            var hasWC = !!getWCProjectId();
            var wcStatus = wcBtn.querySelector('.wallet-opt-status');
            if (wcStatus) wcStatus.textContent = hasWC ? 'Scan QR code' : 'Needs Project ID';
        }

        walletModal.showModal();
    }

    function closeModal() {
        if (walletModal && walletModal.open) walletModal.close();
    }

    function toggleDropdown() {
        if (!walletDropdown || !state.address) return;
        closeChainDropdown();
        walletDropdown.classList.toggle('wallet-dropdown-open');
    }

    function closeDropdown() {
        if (walletDropdown) walletDropdown.classList.remove('wallet-dropdown-open');
    }

    function toggleChainDropdown() {
        if (!chainDropdown || !state.address) return;
        closeDropdown();
        chainDropdown.classList.toggle('wallet-chain-dropdown-open');
    }

    function closeChainDropdown() {
        if (chainDropdown) chainDropdown.classList.remove('wallet-chain-dropdown-open');
    }

    // Close dropdowns on outside click
    document.addEventListener('click', function (e) {
        if (walletDropdown && walletDropdown.classList.contains('wallet-dropdown-open')) {
            if (!walletBtn.contains(e.target) && !walletDropdown.contains(e.target)) {
                closeDropdown();
            }
        }
        if (chainDropdown && chainDropdown.classList.contains('wallet-chain-dropdown-open')) {
            if (!chainDropdown.contains(e.target) && !e.target.closest('#wallet-chain-selector')) {
                closeChainDropdown();
            }
        }
    });

    // ──────────────────────────── Notifications helper ────────────────────────────
    function notify(title, message, type) {
        if (typeof showNotification === 'function') {
            showNotification(title, message || '', type || 'info');
        } else {
            console.log('[PumpWallet] ' + type + ': ' + title + (message ? ' — ' + message : ''));
        }
    }

    // ──────────────────────────── Init ────────────────────────────
    function init() {
        walletBtn = document.getElementById('wallet-connect-btn');
        walletModal = document.getElementById('wallet-connect-modal');
        walletDropdown = document.getElementById('wallet-dropdown');
        chainDropdown = document.getElementById('wallet-chain-dropdown');
        txConfirmModal = document.getElementById('wallet-tx-modal');

        if (!walletBtn) {
            console.warn('[PumpWallet] #wallet-connect-btn not found in DOM');
            return;
        }

        // Wallet button handler
        walletBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            openModal();
        });

        // Provider selection in modal
        var optMM = document.getElementById('wallet-opt-metamask');
        var optWC = document.getElementById('wallet-opt-walletconnect');
        var optCB = document.getElementById('wallet-opt-coinbase');

        if (optMM) optMM.addEventListener('click', function () { closeModal(); connectInjected(); });
        if (optWC) optWC.addEventListener('click', function () { closeModal(); connectWalletConnect(); });
        if (optCB) optCB.addEventListener('click', function () { closeModal(); connectCoinbase(); });

        // Disconnect
        var discBtn = document.getElementById('wallet-disconnect-btn');
        if (discBtn) discBtn.addEventListener('click', function () { disconnect(); });

        // Copy address
        var copyBtn = document.getElementById('wallet-copy-addr');
        if (copyBtn) {
            copyBtn.addEventListener('click', function () {
                if (state.address) {
                    navigator.clipboard.writeText(state.address).then(function () {
                        notify('Copied', state.address, 'info');
                    });
                }
                closeDropdown();
            });
        }

        // View on explorer
        var explorerBtn = document.getElementById('wallet-view-explorer');
        if (explorerBtn) {
            explorerBtn.addEventListener('click', function () {
                if (state.address && state.chainId && CHAINS[state.chainId]) {
                    window.open(CHAINS[state.chainId].explorer + '/address/' + state.address, '_blank');
                }
                closeDropdown();
            });
        }

        // Chain selector button
        var chainSelBtn = document.getElementById('wallet-chain-selector');
        if (chainSelBtn) {
            chainSelBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                toggleChainDropdown();
            });
        }

        // Chain items
        document.querySelectorAll('.wallet-chain-item').forEach(function (el) {
            el.addEventListener('click', function () {
                var cid = parseInt(el.dataset.chainId, 10);
                if (cid && cid !== state.chainId) switchChain(cid);
                else closeChainDropdown();
            });
        });

        // Close modal via backdrop click
        if (walletModal) {
            walletModal.addEventListener('click', function (e) {
                if (e.target === walletModal) closeModal();
            });
        }

        // Close modal button
        var closeBtn = document.getElementById('wallet-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', function () { closeModal(); });

        // Setup ethereum event listeners
        setupEthereumListeners();

        // Setup transaction proxy
        setupTransactionProxy();

        // Initial UI
        updateUI();

        // Auto-reconnect
        autoReconnect();

        console.log('[PumpWallet] Initialized');
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Defer slightly to ensure other scripts loaded
        setTimeout(init, 0);
    }

    // ──────────────────────────── Public API ────────────────────────────
    window.PumpWallet = {
        connect: connectInjected,
        connectWC: connectWalletConnect,
        connectCB: connectCoinbase,
        disconnect: disconnect,
        switchChain: switchChain,
        getState: function () {
            return {
                address: state.address,
                chainId: state.chainId,
                chainName: state.chainId && CHAINS[state.chainId] ? CHAINS[state.chainId].name : null,
                balance: state.balance,
                provider: state.provider,
                connected: !!state.address,
            };
        },
        getChains: function () { return CHAINS; },
    };

})();
