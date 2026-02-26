/**
 * LairOS Onboarding — Guided first-run experience
 * Shows a multi-step tour when the user first enters the desktop.
 * Persists completion to settings so it only shows once.
 */

const LairOnboarding = (() => {
  // ── Steps ──────────────────────────────────────────────
  const steps = [
    {
      id: 'welcome',
      title: 'Welcome to LairOS',
      subtitle: 'Your Web3 operating system',
      body: `
        <p class="ob-hero-text">LairOS is a desktop-style environment built for DeFi research, portfolio tracking, and crypto intelligence — all in your browser.</p>
        <div class="ob-feature-pills">
          <span class="ob-pill"><span class="material-symbols-rounded">trending_up</span> Live Markets</span>
          <span class="ob-pill"><span class="material-symbols-rounded">smart_toy</span> AI Chat</span>
          <span class="ob-pill"><span class="material-symbols-rounded">account_balance_wallet</span> Portfolio</span>
          <span class="ob-pill"><span class="material-symbols-rounded">grid_view</span> Heatmaps</span>
          <span class="ob-pill"><span class="material-symbols-rounded">newspaper</span> News</span>
          <span class="ob-pill"><span class="material-symbols-rounded">candlestick_chart</span> Charts</span>
        </div>
      `,
      cta: 'Show Me Around',
      highlight: null,
    },
    {
      id: 'taskbar',
      title: 'The Taskbar',
      subtitle: 'Your command center lives at the bottom',
      body: `
        <div class="ob-annotated">
          <div class="ob-anno-item"><span class="material-symbols-rounded">N</span><div><b>App Menu</b><br>Browse &amp; launch all installed apps</div></div>
          <div class="ob-anno-item"><span class="material-symbols-rounded">search</span><div><b>Search</b><br>Find files, apps &amp; settings</div></div>
          <div class="ob-anno-item"><span class="material-symbols-rounded">schedule</span><div><b>System Tray</b><br>BTC price, gas, Fear &amp; Greed — live</div></div>
        </div>
      `,
      cta: 'Next',
      highlight: '#lairnav',
    },
    {
      id: 'sidebar',
      title: 'Quick Sidebar',
      subtitle: 'One-click access to core apps',
      body: `
        <div class="ob-annotated">
          <div class="ob-anno-item"><span class="material-symbols-rounded">folder</span><div><b>Files</b> — Your documents &amp; downloads</div></div>
          <div class="ob-anno-item"><span class="material-symbols-rounded">language</span><div><b>Browser</b> — Built-in web browser</div></div>
          <div class="ob-anno-item"><span class="material-symbols-rounded">cloud</span><div><b>AI</b> — Chat with Lair AI</div></div>
          <div class="ob-anno-item"><span class="material-symbols-rounded">show_chart</span><div><b>DeFi</b> — DeFi dashboard &amp; data</div></div>
          <div class="ob-anno-item"><span class="material-symbols-rounded">storefront</span><div><b>Store</b> — Install more apps</div></div>
        </div>
      `,
      cta: 'Next',
      highlight: '#lair-sidebar',
    },
    {
      id: 'shortcuts',
      title: 'Power User Tips',
      subtitle: 'Speed up your workflow',
      body: `
        <div class="ob-shortcuts">
          <div class="ob-shortcut-row"><kbd>Ctrl</kbd> + <kbd>K</kbd><span>Open Command Palette</span></div>
          <div class="ob-shortcut-row"><kbd>Right-click</kbd><span>Context menu on desktop &amp; apps</span></div>
          <div class="ob-shortcut-row"><kbd>Drag</kbd><span>Move &amp; resize windows freely</span></div>
          <div class="ob-shortcut-row"><span class="material-symbols-rounded" style="font-size:16px">widgets</span><span>Right-click desktop → Add widgets</span></div>
        </div>
      `,
      cta: 'Next',
      highlight: null,
    },
    {
      id: 'quickstart',
      title: 'Jump Right In',
      subtitle: 'Pick an app to start exploring',
      body: `
        <div class="ob-quickstart-grid">
          <button class="ob-qs-card" data-app="dashboard">
            <span class="material-symbols-rounded">dashboard</span>
            <span class="ob-qs-name">Dashboard</span>
            <span class="ob-qs-desc">Market overview at a glance</span>
          </button>
          <button class="ob-qs-card" data-app="lairtrending">
            <span class="material-symbols-rounded">trending_up</span>
            <span class="ob-qs-name">Trending</span>
            <span class="ob-qs-desc">Hot tokens right now</span>
          </button>
          <button class="ob-qs-card" data-app="lairai">
            <span class="material-symbols-rounded">smart_toy</span>
            <span class="ob-qs-name">Lair AI</span>
            <span class="ob-qs-desc">Chat-driven DeFi research</span>
          </button>
          <button class="ob-qs-card" data-app="lairheatmap">
            <span class="material-symbols-rounded">grid_view</span>
            <span class="ob-qs-name">Heatmap</span>
            <span class="ob-qs-desc">Visual market sentiment</span>
          </button>
          <button class="ob-qs-card" data-app="lairdexscreener">
            <span class="material-symbols-rounded">candlestick_chart</span>
            <span class="ob-qs-name">DEX Screener</span>
            <span class="ob-qs-desc">Live on-chain charts</span>
          </button>
          <button class="ob-qs-card" data-app="store">
            <span class="material-symbols-rounded">storefront</span>
            <span class="ob-qs-name">App Store</span>
            <span class="ob-qs-desc">Discover &amp; install more apps</span>
          </button>
        </div>
      `,
      cta: 'Finish Setup',
      highlight: null,
    },
  ];

  let currentStep = 0;
  let overlayEl = null;
  let spotlightEl = null;

  // ── DOM ─────────────────────────────────────────────────

  function buildOverlay() {
    // Spotlight ring (highlights UI elements)
    spotlightEl = document.createElement('div');
    spotlightEl.id = 'ob-spotlight';
    document.body.appendChild(spotlightEl);

    // Main overlay
    overlayEl = document.createElement('div');
    overlayEl.id = 'ob-overlay';
    overlayEl.innerHTML = `
      <div class="ob-backdrop"></div>
      <div class="ob-dialog">
        <button class="ob-skip" id="ob-skip-btn" title="Skip onboarding">
          <span class="material-symbols-rounded">close</span>
        </button>
        <div class="ob-progress">
          ${steps.map((_, i) => `<div class="ob-dot${i === 0 ? ' active' : ''}" data-step="${i}"></div>`).join('')}
        </div>
        <div class="ob-content" id="ob-content"></div>
        <div class="ob-footer">
          <button class="ob-btn-secondary" id="ob-back-btn">Back</button>
          <button class="ob-btn-primary" id="ob-next-btn">Next</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlayEl);

    // Events
    document.getElementById('ob-next-btn').addEventListener('click', nextStep);
    document.getElementById('ob-back-btn').addEventListener('click', prevStep);
    document.getElementById('ob-skip-btn').addEventListener('click', finish);

    // Quick-start card clicks (delegated)
    overlayEl.addEventListener('click', (e) => {
      const card = e.target.closest('.ob-qs-card');
      if (card) {
        const appName = card.dataset.app;
        if (appName && typeof openapp === 'function') {
          finish();
          setTimeout(() => openapp(appName, 1), 300);
        }
      }
    });
  }

  function render() {
    const step = steps[currentStep];
    const content = document.getElementById('ob-content');
    const nextBtn = document.getElementById('ob-next-btn');
    const backBtn = document.getElementById('ob-back-btn');

    // Content
    content.innerHTML = `
      <h1 class="ob-title">${step.title}</h1>
      <p class="ob-subtitle">${step.subtitle}</p>
      <div class="ob-body">${step.body}</div>
    `;

    // Buttons
    nextBtn.textContent = step.cta;
    backBtn.style.display = currentStep === 0 ? 'none' : '';

    // On the last step, "Finish Setup" is the CTA
    if (currentStep === steps.length - 1) {
      nextBtn.classList.add('ob-finish');
    } else {
      nextBtn.classList.remove('ob-finish');
    }

    // Progress dots
    overlayEl.querySelectorAll('.ob-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === currentStep);
      dot.classList.toggle('completed', i < currentStep);
    });

    // Spotlight
    updateSpotlight(step.highlight);

    // Animate in
    content.classList.remove('ob-animate-in');
    void content.offsetWidth; // reflow
    content.classList.add('ob-animate-in');
  }

  function updateSpotlight(selector) {
    if (!selector) {
      spotlightEl.style.display = 'none';
      return;
    }
    const target = document.querySelector(selector);
    if (!target) {
      spotlightEl.style.display = 'none';
      return;
    }
    const rect = target.getBoundingClientRect();
    const pad = 6;
    spotlightEl.style.display = 'block';
    spotlightEl.style.top = (rect.top - pad) + 'px';
    spotlightEl.style.left = (rect.left - pad) + 'px';
    spotlightEl.style.width = (rect.width + pad * 2) + 'px';
    spotlightEl.style.height = (rect.height + pad * 2) + 'px';

    // Make sure spotlight is above overlay
    spotlightEl.style.zIndex = '100002';
  }

  // ── Navigation ─────────────────────────────────────────

  function nextStep() {
    if (currentStep >= steps.length - 1) {
      finish();
      return;
    }
    currentStep++;
    render();
  }

  function prevStep() {
    if (currentStep <= 0) return;
    currentStep--;
    render();
  }

  async function finish() {
    // Animate out
    overlayEl.classList.add('ob-closing');
    spotlightEl.style.display = 'none';

    setTimeout(() => {
      overlayEl.remove();
      spotlightEl.remove();
      overlayEl = null;
      spotlightEl = null;
    }, 400);

    // Mark as completed
    try {
      if (typeof setSetting === 'function') {
        await setSetting('onboardingCompleted', true);
      }
    } catch (e) {
      console.warn('[Onboarding] Could not persist completion:', e);
    }
  }

  // ── Public API ─────────────────────────────────────────

  async function shouldShow() {
    try {
      if (typeof getSetting === 'function') {
        const completed = await getSetting('onboardingCompleted');
        return !completed;
      }
    } catch (e) {}
    return true;
  }

  async function start() {
    const show = await shouldShow();
    if (!show) return;

    buildOverlay();
    currentStep = 0;
    render();

    // Animate in
    requestAnimationFrame(() => {
      overlayEl.classList.add('ob-visible');
    });
  }

  // Allow manual trigger from settings/command palette
  async function forceStart() {
    if (overlayEl) return; // already open
    buildOverlay();
    currentStep = 0;
    render();
    requestAnimationFrame(() => {
      overlayEl.classList.add('ob-visible');
    });
  }

  return { start, forceStart, shouldShow };
})();
