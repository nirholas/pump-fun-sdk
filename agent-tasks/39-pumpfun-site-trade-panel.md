# Task 39: PumpFun Site — Token Detail Trade Panel Redesign (Buy/Sell with SOL/Token Toggle)

## Context

You are working in the `pump-fun-sdk` repository. The `pumpfun-site/` directory is a static token launchpad UI (pure HTML/CSS/JS, zero dependencies). The token detail page (`token.html`) has a buy/sell panel but it needs to match pump.fun's trading interface more closely.

**Files to modify:**
- `pumpfun-site/token.html` (~508 lines) — trade panel HTML and inline script
- `pumpfun-site/styles.css` (~1196 lines) — trade panel styling

**DO NOT** modify `app.js`.

**Key info:** The trade panel is on the right side of the token detail page. It currently has Buy/Sell toggle buttons and an amount input. The actual trading is a demo (shows alert). Wallet connection state comes from app.js.

## Objective

Redesign the trade panel to match pump.fun:
1. **Buy/Sell toggle tabs** at the top
2. **Quick amount buttons** (0.5 SOL, 1 SOL, 5 SOL, 10 SOL for buy; 25%, 50%, 75%, 100% for sell)
3. **SOL/Token amount toggle** — switch between entering amount in SOL or tokens
4. **Slippage setting** — inline slippage input with default 1%
5. **Estimated output** — shows "You'll receive ~X tokens" or "You'll receive ~X SOL"
6. **Balance display** — shows connected wallet SOL balance
7. **Transaction button** — green for buy, red for sell

## Design Reference (pump.fun)

Pump.fun's trade panel:
- Top: "Buy" | "Sell" tabs (Buy is green active, Sell turns red when active)
- Quick selector buttons in a row: "reset | 1 SOL | 5 SOL | 10 SOL" (for buy)
- For sell: "reset | 25% | 50% | 75% | 100%"
- Toggle between SOL and token amount input (small switch icon)
- Amount input field with currency label
- Slippage: small "⚙️" icon that expands to show slippage % input
- "Place trade" button (green for buy, red for sell)
- Shows balance below

## Requirements

### 1. Trade Panel HTML

```html
<div class="trade-panel">
  <!-- Buy/Sell Toggle -->
  <div class="trade-toggle">
    <button class="trade-toggle-btn active buy-active" data-side="buy" onclick="switchTradeSide('buy')">Buy</button>
    <button class="trade-toggle-btn" data-side="sell" onclick="switchTradeSide('sell')">Sell</button>
  </div>

  <!-- Quick Amount Buttons -->
  <div class="quick-amounts" id="quickAmounts">
    <button class="quick-btn" onclick="resetAmount()">reset</button>
    <button class="quick-btn" onclick="setQuickAmount(0.5)">0.5 SOL</button>
    <button class="quick-btn" onclick="setQuickAmount(1)">1 SOL</button>
    <button class="quick-btn" onclick="setQuickAmount(5)">5 SOL</button>
    <button class="quick-btn" onclick="setQuickAmount(10)">10 SOL</button>
  </div>
  <div class="quick-amounts sell-amounts" id="quickAmountsSell" style="display:none">
    <button class="quick-btn" onclick="resetAmount()">reset</button>
    <button class="quick-btn" onclick="setQuickPercent(25)">25%</button>
    <button class="quick-btn" onclick="setQuickPercent(50)">50%</button>
    <button class="quick-btn" onclick="setQuickPercent(75)">75%</button>
    <button class="quick-btn" onclick="setQuickPercent(100)">100%</button>
  </div>

  <!-- Amount Input -->
  <div class="trade-input-group">
    <div class="trade-input-wrap">
      <input type="number" id="tradeAmount" class="trade-input" placeholder="0.00" step="any" min="0" oninput="updateEstimate()">
      <button class="input-currency-btn" id="currencyToggle" onclick="toggleCurrency()">
        <span id="currencyLabel">SOL</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
      </button>
    </div>
    <div class="trade-estimate" id="tradeEstimate">
      <!-- Shows estimated output -->
    </div>
  </div>

  <!-- Slippage -->
  <div class="slippage-row">
    <button class="slippage-toggle" onclick="toggleSlippage()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
      Slippage: <span id="slippageDisplay">1%</span>
    </button>
    <div class="slippage-input-wrap" id="slippageWrap" style="display:none">
      <input type="number" id="slippageInput" class="slippage-input" value="1" min="0.1" max="50" step="0.1">
      <span>%</span>
    </div>
  </div>

  <!-- Balance -->
  <div class="trade-balance" id="tradeBalance">
    <!-- Shows SOL balance when connected -->
  </div>

  <!-- Trade Button -->
  <button class="trade-submit-btn buy-btn" id="tradeSubmitBtn" onclick="executeTrade()">
    Place trade
  </button>
</div>
```

### 2. Trade Panel Script (inline in token.html)

```javascript
let tradeSide = 'buy';
let inputCurrency = 'sol'; // 'sol' or 'token'

function switchTradeSide(side) {
  tradeSide = side;
  const btns = document.querySelectorAll('.trade-toggle-btn');
  btns.forEach(b => {
    b.classList.remove('active', 'buy-active', 'sell-active');
    if (b.dataset.side === side) {
      b.classList.add('active', side === 'buy' ? 'buy-active' : 'sell-active');
    }
  });

  // Toggle quick amounts
  document.getElementById('quickAmounts').style.display = side === 'buy' ? 'flex' : 'none';
  document.getElementById('quickAmountsSell').style.display = side === 'sell' ? 'flex' : 'none';

  // Update button style
  const submitBtn = document.getElementById('tradeSubmitBtn');
  if (submitBtn) {
    submitBtn.className = `trade-submit-btn ${side === 'buy' ? 'buy-btn' : 'sell-btn'}`;
    submitBtn.textContent = side === 'buy' ? 'Place trade' : 'Place trade';
  }

  resetAmount();
}

function setQuickAmount(sol) {
  const input = document.getElementById('tradeAmount');
  if (input) input.value = sol;
  updateEstimate();
}

function setQuickPercent(pct) {
  // Placeholder: would calculate % of token balance
  const input = document.getElementById('tradeAmount');
  if (input) input.placeholder = `${pct}% of balance`;
  updateEstimate();
}

function resetAmount() {
  const input = document.getElementById('tradeAmount');
  if (input) { input.value = ''; input.placeholder = '0.00'; }
  const est = document.getElementById('tradeEstimate');
  if (est) est.textContent = '';
}

function toggleCurrency() {
  inputCurrency = inputCurrency === 'sol' ? 'token' : 'sol';
  const label = document.getElementById('currencyLabel');
  if (label) label.textContent = inputCurrency === 'sol' ? 'SOL' : (window._tokenSymbol || 'TOKEN');
  updateEstimate();
}

function toggleSlippage() {
  const wrap = document.getElementById('slippageWrap');
  if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'flex' : 'none';
}

// Update slippage display
document.getElementById('slippageInput')?.addEventListener('input', function() {
  const display = document.getElementById('slippageDisplay');
  if (display) display.textContent = this.value + '%';
});

function updateEstimate() {
  const input = document.getElementById('tradeAmount');
  const est = document.getElementById('tradeEstimate');
  if (!input || !est) return;

  const amount = parseFloat(input.value);
  if (!amount || amount <= 0) { est.textContent = ''; return; }

  // Rough estimate display (actual calculation would use bonding curve math)
  if (tradeSide === 'buy') {
    est.innerHTML = `<span class="estimate-label">≈ You'll receive tokens</span>`;
  } else {
    est.innerHTML = `<span class="estimate-label">≈ You'll receive SOL</span>`;
  }
}

function executeTrade() {
  const provider = window.phantom?.solana || window.solflare;
  if (!provider || !provider.isConnected) {
    connectWallet();
    return;
  }

  const amount = document.getElementById('tradeAmount')?.value;
  if (!amount || parseFloat(amount) <= 0) {
    alert('Enter an amount');
    return;
  }

  const slippage = document.getElementById('slippageInput')?.value || '1';
  alert(`Demo: ${tradeSide.toUpperCase()} ${amount} ${inputCurrency.toUpperCase()}\nSlippage: ${slippage}%\n\nConnect to Pump SDK for real trading.`);
}
```

### 3. CSS Styles

```css
/* Trade panel */
.trade-panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  position: sticky;
  top: 80px;
}

.trade-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  background: var(--bg);
  border-radius: 10px;
  padding: 3px;
  margin-bottom: 16px;
}
.trade-toggle-btn {
  padding: 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.trade-toggle-btn.buy-active {
  background: rgba(123,255,105,0.15);
  color: var(--green);
}
.trade-toggle-btn.sell-active {
  background: rgba(255,77,77,0.15);
  color: #ff4d4d;
}

/* Quick amounts */
.quick-amounts {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.quick-btn {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
  min-width: 50px;
  text-align: center;
}
.quick-btn:hover {
  border-color: var(--green);
  color: var(--text);
}

/* Trade input */
.trade-input-group {
  margin-bottom: 12px;
}
.trade-input-wrap {
  display: flex;
  align-items: center;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.2s;
}
.trade-input-wrap:focus-within {
  border-color: var(--green);
}
.trade-input {
  flex: 1;
  padding: 14px 16px;
  background: transparent;
  border: none;
  color: var(--text);
  font-size: 18px;
  font-weight: 600;
  outline: none;
  -moz-appearance: textfield;
}
.trade-input::-webkit-outer-spin-button,
.trade-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
}
.input-currency-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  margin-right: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s;
}
.input-currency-btn:hover { border-color: var(--green); }

.trade-estimate {
  padding: 6px 0;
  font-size: 12px;
  color: var(--text-secondary);
}
.estimate-label { font-style: italic; }

/* Slippage */
.slippage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.slippage-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}
.slippage-toggle:hover { color: var(--text); }
.slippage-input-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}
.slippage-input {
  width: 50px;
  padding: 4px 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 13px;
  text-align: center;
}

/* Trade balance */
.trade-balance {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  text-align: right;
}

/* Trade submit */
.trade-submit-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}
.trade-submit-btn:active { transform: scale(0.98); }
.buy-btn {
  background: var(--green);
  color: var(--bg);
}
.buy-btn:hover { opacity: 0.9; }
.sell-btn {
  background: #ff4d4d;
  color: white;
}
.sell-btn:hover { opacity: 0.9; }
```

### 4. Verification

- Buy/Sell toggle should switch panel state (green vs red theme)
- Quick amount buttons should populate the input
- Currency toggle should switch between SOL and token ticker
- Slippage gear icon should expand to show input
- Trade button should require wallet connection
- Panel should be sticky on scroll (desktop)
- Mobile should show panel below the chart

## Anti-Patterns

- Do NOT implement real trading logic — keep the demo alert
- Do NOT modify `app.js`
- Do NOT add npm dependencies
- Do NOT break existing token page functionality (chart, thread, holders)
- Do NOT fetch token prices from additional APIs
