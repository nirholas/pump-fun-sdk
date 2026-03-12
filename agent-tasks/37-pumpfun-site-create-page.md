# Task 37: PumpFun Site — Create Token Page Redesign

## Context

You are working in the `pump-fun-sdk` repository. The `pumpfun-site/` directory is a static token launchpad UI (pure HTML/CSS/JS, zero dependencies). The create token page (`create.html`) has a form but it doesn't match pump.fun's clean create flow and the form submission just shows an `alert()`.

**Files to modify:**
- `pumpfun-site/create.html` (~193 lines) — page structure
- `pumpfun-site/styles.css` (~1196 lines) — form styling

**DO NOT** modify `app.js`.

## Objective

Redesign the create token page to match pump.fun's minimal create flow:
1. Centered card layout with clean form
2. Image upload with drag-and-drop preview
3. Collapsible "Advanced options" section
4. Form validation with inline error messages
5. Cost summary showing launch fee

## Design Reference (pump.fun)

Pump.fun's create page:
- **Centered card** — narrow width (~480px), dark card background
- **Title**: "Create a coin" with subtitle "It's free to create. No coding required."
- **Image upload**: Large drop zone at top with "Drag & drop or click to upload" text, shows preview after upload
- **Fields** (in order):
  - Name (required)
  - Ticker/Symbol (required)
  - Description (textarea, optional)
- **"Show more options ▼"** collapsible section containing:
  - Twitter link
  - Telegram link
  - Website link
- **Tip**: "Tip: coin data cannot be changed after creation"
- **Launch button**: Large green button "Create coin" at bottom
- Shows connected wallet requirement if not connected

## Requirements

### 1. Page HTML

Replace the form content with:

```html
<div class="create-container">
  <div class="create-card">
    <div class="create-header">
      <h1>Create a coin</h1>
      <p class="create-subtitle">It's free to create. No coding required.</p>
    </div>

    <form id="createForm" onsubmit="handleCreate(event)">
      <!-- Image upload -->
      <div class="form-group">
        <label class="upload-zone" id="uploadZone">
          <input type="file" id="tokenImage" accept="image/*" hidden>
          <div class="upload-placeholder" id="uploadPlaceholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
            <span>Drag & drop or click to upload</span>
            <span class="upload-hint">PNG, JPG, GIF up to 5MB</span>
          </div>
          <img id="uploadPreview" class="upload-preview" style="display:none" alt="Token image preview">
        </label>
      </div>

      <!-- Name -->
      <div class="form-group">
        <label for="tokenName" class="form-label">Name <span class="required">*</span></label>
        <input type="text" id="tokenName" class="form-input" placeholder="e.g. My Awesome Token" maxlength="32" required>
        <span class="form-hint">Max 32 characters</span>
      </div>

      <!-- Ticker -->
      <div class="form-group">
        <label for="tokenTicker" class="form-label">Ticker <span class="required">*</span></label>
        <input type="text" id="tokenTicker" class="form-input" placeholder="e.g. MAT" maxlength="10" required>
        <span class="form-hint">Max 10 characters</span>
      </div>

      <!-- Description -->
      <div class="form-group">
        <label for="tokenDesc" class="form-label">Description</label>
        <textarea id="tokenDesc" class="form-input form-textarea" placeholder="Tell us about your coin..." rows="3" maxlength="500"></textarea>
        <span class="form-hint"><span id="descCount">0</span>/500</span>
      </div>

      <!-- Advanced options -->
      <button type="button" class="advanced-toggle" onclick="toggleAdvanced()">
        <span>Show more options</span>
        <svg id="advancedArrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      <div class="advanced-options" id="advancedOptions" style="display:none">
        <div class="form-group">
          <label for="twitterLink" class="form-label">Twitter link</label>
          <input type="url" id="twitterLink" class="form-input" placeholder="https://x.com/...">
        </div>
        <div class="form-group">
          <label for="telegramLink" class="form-label">Telegram link</label>
          <input type="url" id="telegramLink" class="form-input" placeholder="https://t.me/...">
        </div>
        <div class="form-group">
          <label for="websiteLink" class="form-label">Website</label>
          <input type="url" id="websiteLink" class="form-input" placeholder="https://...">
        </div>
      </div>

      <!-- Tip -->
      <div class="create-tip">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <span>Tip: coin data cannot be changed after creation</span>
      </div>

      <!-- Submit -->
      <button type="submit" class="create-submit-btn" id="createSubmitBtn">
        Create coin
      </button>

      <!-- Wallet warning -->
      <div class="create-wallet-warning" id="walletWarning" style="display:none">
        <span>Connect your wallet to create a coin</span>
        <button type="button" class="btn-wallet-connect" onclick="connectWallet()">Connect wallet</button>
      </div>
    </form>
  </div>
</div>
```

### 2. Inline Script (at bottom of create.html)

```javascript
// Image upload with drag & drop
const uploadZone = document.getElementById('uploadZone');
const imageInput = document.getElementById('tokenImage');
const preview = document.getElementById('uploadPreview');
const placeholder = document.getElementById('uploadPlaceholder');

uploadZone?.addEventListener('click', () => imageInput?.click());
uploadZone?.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone?.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone?.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    showPreview(file);
  }
});

imageInput?.addEventListener('change', () => {
  if (imageInput.files[0]) showPreview(imageInput.files[0]);
});

function showPreview(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// Description counter
const descInput = document.getElementById('tokenDesc');
const descCount = document.getElementById('descCount');
descInput?.addEventListener('input', () => {
  if (descCount) descCount.textContent = descInput.value.length;
});

// Advanced toggle
function toggleAdvanced() {
  const opts = document.getElementById('advancedOptions');
  const arrow = document.getElementById('advancedArrow');
  if (!opts) return;
  const show = opts.style.display === 'none';
  opts.style.display = show ? 'block' : 'none';
  if (arrow) arrow.style.transform = show ? 'rotate(180deg)' : '';
}

// Handle form submit
function handleCreate(e) {
  e.preventDefault();

  // Check wallet
  const provider = window.phantom?.solana || window.solflare;
  if (!provider || !provider.isConnected) {
    const warning = document.getElementById('walletWarning');
    if (warning) warning.style.display = 'flex';
    return;
  }

  const name = document.getElementById('tokenName')?.value.trim();
  const ticker = document.getElementById('tokenTicker')?.value.trim();

  if (!name || !ticker) {
    alert('Name and ticker are required');
    return;
  }

  // Show success state (actual transaction would go here)
  const btn = document.getElementById('createSubmitBtn');
  if (btn) {
    btn.textContent = 'Creating...';
    btn.disabled = true;
  }

  // Simulated — in production this would build & send a transaction
  setTimeout(() => {
    alert(`Token "${name}" (${ticker}) would be created here.\n\nThis is a demo — connect to Pump SDK for real token creation.`);
    if (btn) {
      btn.textContent = 'Create coin';
      btn.disabled = false;
    }
  }, 1500);
}

// Check wallet state on load
if (typeof updateWalletButtons === 'function') {
  // Wallet buttons are handled by app.js
}
```

### 3. CSS Styles

```css
/* Create page */
.create-container {
  display: flex;
  justify-content: center;
  padding: 40px 24px;
  min-height: calc(100vh - 200px);
}
.create-card {
  width: 100%;
  max-width: 480px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 32px;
}
.create-header {
  text-align: center;
  margin-bottom: 32px;
}
.create-header h1 {
  font-size: 24px;
  font-weight: 800;
  margin: 0 0 8px;
}
.create-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

/* Upload zone */
.upload-zone {
  display: block;
  border: 2px dashed var(--border);
  border-radius: 12px;
  padding: 32px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.upload-zone:hover, .upload-zone.drag-over {
  border-color: var(--green);
  background: rgba(123,255,105,0.03);
}
.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 14px;
}
.upload-hint {
  font-size: 12px;
  color: var(--text-secondary);
  opacity: 0.6;
}
.upload-preview {
  max-width: 200px;
  max-height: 200px;
  border-radius: 12px;
  margin: 0 auto;
  display: block;
  object-fit: cover;
}

/* Form fields */
.form-group {
  margin-bottom: 20px;
}
.form-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
}
.required {
  color: #ff4d4d;
}
.form-input {
  width: 100%;
  padding: 12px 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  font-size: 14px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.form-input:focus {
  border-color: var(--green);
  outline: none;
}
.form-textarea {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}
.form-hint {
  display: block;
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
  text-align: right;
}

/* Advanced toggle */
.advanced-toggle {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 12px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: color 0.2s;
}
.advanced-toggle:hover { color: var(--text); }
.advanced-toggle svg { transition: transform 0.2s; }

.advanced-options {
  padding-top: 4px;
}

/* Tip */
.create-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255,255,255,0.02);
  border-radius: 10px;
  font-size: 12px;
  color: var(--text-secondary);
  margin: 20px 0;
}

/* Submit button */
.create-submit-btn {
  width: 100%;
  padding: 14px 24px;
  background: var(--green);
  color: var(--bg);
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}
.create-submit-btn:hover { opacity: 0.9; }
.create-submit-btn:active { transform: scale(0.98); }
.create-submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Wallet warning */
.create-wallet-warning {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255,77,77,0.08);
  border: 1px solid rgba(255,77,77,0.2);
  border-radius: 10px;
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}
.btn-wallet-connect {
  padding: 8px 16px;
  background: var(--green);
  color: var(--bg);
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .create-card { padding: 20px 16px; }
  .create-header h1 { font-size: 20px; }
}
```

### 4. Verification

- Page should show a centered form card
- Image upload should support click AND drag-and-drop, showing a preview
- Name and Ticker fields should be required
- Description should have a character counter
- "Show more options" should toggle Twitter/Telegram/Website fields
- Submit without wallet should show wallet warning
- Submit with wallet should show loading state + demo alert
- Form should look good on mobile
- Wallet button in all pages should still work

## Anti-Patterns

- Do NOT add npm dependencies
- Do NOT modify `app.js`
- Do NOT remove the existing `<script src="app.js"></script>` tag
- Do NOT implement actual token creation — keep the demo alert for now
