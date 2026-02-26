// ============================================
// LairOS System Features
// Notification Center, System Sounds, Lock Screen,
// Screenshot Tool, Clipboard History
// ============================================

// ============================================
// 1. NOTIFICATION CENTER
// ============================================

let notificationStack = [];
let notificationHistory = [];
const MAX_NOTIFICATIONS = 5;
const MAX_HISTORY = 50;

/**
 * Show a notification toast
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Type: 'info', 'success', 'warning', 'error'
 * @param {number} duration - Auto-dismiss duration in ms (default 5000)
 */
function showNotification(title, message, type = 'info', duration = 5000) {
    const id = 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    // Add to history
    const historyItem = {
        id,
        title,
        message,
        type,
        timestamp: new Date(),
        read: false
    };
    notificationHistory.unshift(historyItem);
    if (notificationHistory.length > MAX_HISTORY) {
        notificationHistory.pop();
    }
    saveNotificationHistory();
    updateNotificationBadge();
    
    // Play notification sound
    if (type === 'error') {
        playSound('error');
    } else {
        playSound('notification');
    }
    
    // Create notification element
    const container = document.getElementById('notification-center');
    if (!container) return id;
    
    const notif = document.createElement('div');
    notif.className = `notification-toast notification-${type}`;
    notif.id = id;
    notif.innerHTML = `
        <div class="notification-icon">${getNotificationIcon(type)}</div>
        <div class="notification-content">
            <div class="notification-title">${escapeHtml(title)}</div>
            <div class="notification-message">${escapeHtml(message)}</div>
        </div>
        <button class="notification-close" onclick="dismissNotification('${id}')">
            <span class="material-symbols-rounded">close</span>
        </button>
    `;
    
    // Click to dismiss
    notif.addEventListener('click', (e) => {
        if (!e.target.closest('.notification-close')) {
            dismissNotification(id);
        }
    });
    
    // Add to stack
    notificationStack.push({ id, element: notif });
    
    // Limit visible notifications
    while (notificationStack.length > MAX_NOTIFICATIONS) {
        const oldest = notificationStack.shift();
        if (oldest.element.parentNode) {
            oldest.element.classList.add('notification-exit');
            setTimeout(() => oldest.element.remove(), 300);
        }
    }
    
    container.appendChild(notif);
    
    // Trigger entrance animation
    requestAnimationFrame(() => {
        notif.classList.add('notification-enter');
    });
    
    // Auto-dismiss
    if (duration > 0) {
        setTimeout(() => dismissNotification(id), duration);
    }
    
    return id;
}

function dismissNotification(id) {
    const index = notificationStack.findIndex(n => n.id === id);
    if (index === -1) return;
    
    const notif = notificationStack[index];
    notificationStack.splice(index, 1);
    
    if (notif.element) {
        notif.element.classList.remove('notification-enter');
        notif.element.classList.add('notification-exit');
        setTimeout(() => {
            if (notif.element.parentNode) {
                notif.element.remove();
            }
        }, 300);
    }
}

function getNotificationIcon(type) {
    const icons = {
        info: '<span class="material-symbols-rounded">info</span>',
        success: '<span class="material-symbols-rounded">check_circle</span>',
        warning: '<span class="material-symbols-rounded">warning</span>',
        error: '<span class="material-symbols-rounded">error</span>'
    };
    return icons[type] || icons.info;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toggleNotificationHistory() {
    const panel = document.getElementById('notification-history-panel');
    if (panel) {
        const isOpen = panel.classList.contains('open');
        if (isOpen) {
            panel.classList.remove('open');
            panel.setAttribute('aria-hidden', 'true');
        } else {
            closeHistoryPanels('notification-history-panel');
            renderNotificationHistory();
            panel.classList.add('open');
            panel.setAttribute('aria-hidden', 'false');
            // Mark all as read
            notificationHistory.forEach(n => n.read = true);
            saveNotificationHistory();
            updateNotificationBadge();
        }
    }
}

function renderNotificationHistory() {
    const list = document.getElementById('notification-history-list');
    if (!list) return;
    
    if (notificationHistory.length === 0) {
        list.innerHTML = '<div class="notification-history-empty">No notifications</div>';
        return;
    }
    
    list.innerHTML = notificationHistory.map(n => `
        <div class="notification-history-item notification-${n.type}">
            <div class="notification-history-icon">${getNotificationIcon(n.type)}</div>
            <div class="notification-history-content">
                <div class="notification-history-title">${escapeHtml(n.title)}</div>
                <div class="notification-history-message">${escapeHtml(n.message)}</div>
                <div class="notification-history-time">${formatTimeAgo(n.timestamp)}</div>
            </div>
        </div>
    `).join('');
}

function clearNotificationHistory() {
    notificationHistory = [];
    saveNotificationHistory();
    renderNotificationHistory();
    updateNotificationBadge();
}

function saveNotificationHistory() {
    try {
        localStorage.setItem('lair-notification-history', JSON.stringify(notificationHistory));
    } catch (e) {}
}

function loadNotificationHistory() {
    try {
        const saved = localStorage.getItem('lair-notification-history');
        if (saved) {
            notificationHistory = JSON.parse(saved).map(n => ({
                ...n,
                timestamp: new Date(n.timestamp)
            }));
        }
    } catch (e) {}
}

function updateNotificationBadge() {
    const badge = document.getElementById('notification-badge');
    if (badge) {
        const unreadCount = notificationHistory.filter(n => !n.read).length;
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
}

function formatTimeAgo(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

// ============================================
// 2. SYSTEM SOUNDS
// ============================================

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let soundsEnabled = true;
let soundVolume = 0.5;
const soundCache = {};

const soundDefinitions = {
    open: { frequency: 600, duration: 0.1, type: 'sine', ramp: 'up' },
    close: { frequency: 400, duration: 0.15, type: 'sine', ramp: 'down' },
    minimize: { frequency: 300, duration: 0.1, type: 'sine', ramp: 'down' },
    notification: { frequency: 800, duration: 0.15, type: 'sine', ramp: 'up', second: { frequency: 1000, delay: 0.1 } },
    error: { frequency: 200, duration: 0.3, type: 'square', ramp: 'none' },
    click: { frequency: 1000, duration: 0.05, type: 'sine', ramp: 'down' },
    unlock: { frequency: 500, duration: 0.2, type: 'sine', ramp: 'up', second: { frequency: 700, delay: 0.15 } },
    lock: { frequency: 700, duration: 0.15, type: 'sine', ramp: 'down', second: { frequency: 500, delay: 0.1 } },
    screenshot: { frequency: 1200, duration: 0.1, type: 'sine', ramp: 'down' }
};

/**
 * Play a system sound
 * @param {string} soundName - Name of sound: 'open', 'close', 'minimize', 'notification', 'error', 'click', 'unlock', 'lock', 'screenshot'
 */
function playSound(soundName) {
    if (!soundsEnabled || soundVolume <= 0) return;
    
    // Resume audio context if suspended (browser autoplay policy)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    const soundDef = soundDefinitions[soundName];
    if (!soundDef) return;
    
    playSynthSound(soundDef);
}

function playSynthSound(def) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = def.type || 'sine';
    oscillator.frequency.setValueAtTime(def.frequency, audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    
    const volume = soundVolume * 0.3; // Scale down for comfort
    
    if (def.ramp === 'up') {
        gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + def.duration * 0.3);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + def.duration);
    } else if (def.ramp === 'down') {
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + def.duration);
    } else {
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + def.duration);
    }
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + def.duration + 0.1);
    
    // Play second tone if defined
    if (def.second) {
        setTimeout(() => {
            playSynthSound({
                frequency: def.second.frequency,
                duration: def.duration,
                type: def.type,
                ramp: def.ramp
            });
        }, def.second.delay * 1000);
    }
}

function setSoundEnabled(enabled) {
    soundsEnabled = enabled;
    try {
        localStorage.setItem('lair-sounds-enabled', JSON.stringify(enabled));
    } catch (e) {}
}

function setSoundVolume(volume) {
    soundVolume = Math.max(0, Math.min(1, volume));
    try {
        localStorage.setItem('lair-sound-volume', JSON.stringify(soundVolume));
    } catch (e) {}
}

function loadSoundSettings() {
    try {
        const enabled = localStorage.getItem('lair-sounds-enabled');
        if (enabled !== null) soundsEnabled = JSON.parse(enabled);
        
        const volume = localStorage.getItem('lair-sound-volume');
        if (volume !== null) soundVolume = JSON.parse(volume);
    } catch (e) {}
}

// ============================================
// 3. LOCK SCREEN
// ============================================

let isLocked = false;
let lockTimeout = null;
let lockTimeoutDuration = 0; // 0 = disabled

function lockScreen() {
    if (isLocked) return;
    isLocked = true;
    
    playSound('lock');
    
    const lockScreen = document.getElementById('lock-screen');
    if (lockScreen) {
        lockScreen.classList.add('active');
        updateLockScreenClock();
        
        // Start clock update interval
        lockScreen.clockInterval = setInterval(updateLockScreenClock, 1000);
    }
    
    // Close any open dialogs/panels
    document.querySelectorAll('dialog[open]').forEach(d => {
        if (d.id !== 'lock-screen') d.close();
    });
}

function unlockScreen(password = null) {
    const lockScreen = document.getElementById('lock-screen');
    if (!lockScreen) return;
    
    // If password is required, check it
    const passwordInput = document.getElementById('lock-password-input');
    if (passwordInput && passwordInput.style.display !== 'none') {
        // Password validation would go here
        // For now, we just unlock
    }
    
    playSound('unlock');
    
    lockScreen.classList.add('unlocking');
    
    setTimeout(() => {
        isLocked = false;
        lockScreen.classList.remove('active', 'unlocking');
        if (lockScreen.clockInterval) {
            clearInterval(lockScreen.clockInterval);
        }
        
        // Reset lock timeout
        resetLockTimeout();
    }, 500);
}

function updateLockScreenClock() {
    const timeEl = document.getElementById('lock-screen-time');
    const dateEl = document.getElementById('lock-screen-date');
    
    if (timeEl) {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        
        // Use same format as system
        if (typeof timetypecondition !== 'undefined' && timetypecondition) {
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const h12 = (hours % 12) || 12;
            timeEl.textContent = `${h12}:${minutes} ${ampm}`;
        } else {
            timeEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes}`;
        }
    }
    
    if (dateEl) {
        const now = new Date();
        dateEl.textContent = now.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
    }
}

function setLockTimeout(minutes) {
    lockTimeoutDuration = minutes * 60 * 1000;
    try {
        localStorage.setItem('lair-lock-timeout', JSON.stringify(minutes));
    } catch (e) {}
    resetLockTimeout();
}

function resetLockTimeout() {
    if (lockTimeout) {
        clearTimeout(lockTimeout);
        lockTimeout = null;
    }
    
    if (lockTimeoutDuration > 0 && !isLocked) {
        lockTimeout = setTimeout(lockScreen, lockTimeoutDuration);
    }
}

function loadLockSettings() {
    try {
        const timeout = localStorage.getItem('lair-lock-timeout');
        if (timeout !== null) {
            lockTimeoutDuration = JSON.parse(timeout) * 60 * 1000;
        }
    } catch (e) {}
}

// ============================================
// 4. SCREENSHOT TOOL
// ============================================

let screenshotMode = null; // 'fullscreen', 'window', 'selection'
let selectionStart = null;
let selectionOverlay = null;

async function takeScreenshot(mode = 'fullscreen') {
    // Load html2canvas if not already loaded
    if (typeof html2canvas === 'undefined') {
        await loadHtml2Canvas();
    }
    
    screenshotMode = mode;
    
    switch (mode) {
        case 'fullscreen':
            captureFullScreen();
            break;
        case 'window':
            captureActiveWindow();
            break;
        case 'selection':
            startSelectionCapture();
            break;
        default:
            showScreenshotMenu();
    }
}

function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
        if (typeof html2canvas !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function captureFullScreen() {
    playSound('screenshot');
    
    try {
        // Hide UI elements temporarily
        const lockScreen = document.getElementById('lock-screen');
        const notifCenter = document.getElementById('notification-center');
        const screenshotMenu = document.getElementById('screenshot-menu');
        
        if (notifCenter) notifCenter.style.visibility = 'hidden';
        if (screenshotMenu) screenshotMenu.style.display = 'none';
        
        const canvas = await html2canvas(document.body, {
            allowTaint: true,
            useCORS: true,
            scale: window.devicePixelRatio || 1,
            logging: false
        });
        
        if (notifCenter) notifCenter.style.visibility = 'visible';
        
        showScreenshotPreview(canvas);
    } catch (error) {
        console.error('Screenshot failed:', error);
        showNotification('Screenshot', 'Failed to capture screenshot', 'error');
    }
}

async function captureActiveWindow() {
    playSound('screenshot');
    
    // Find the topmost window
    const windows = document.querySelectorAll('.window');
    let topWindow = null;
    let maxZ = -1;
    
    windows.forEach(win => {
        const z = parseInt(win.style.zIndex) || 0;
        if (z > maxZ) {
            maxZ = z;
            topWindow = win;
        }
    });
    
    if (!topWindow) {
        showNotification('Screenshot', 'No active window to capture', 'warning');
        return;
    }
    
    try {
        const canvas = await html2canvas(topWindow, {
            allowTaint: true,
            useCORS: true,
            scale: window.devicePixelRatio || 1,
            logging: false
        });
        
        showScreenshotPreview(canvas);
    } catch (error) {
        console.error('Screenshot failed:', error);
        showNotification('Screenshot', 'Failed to capture window', 'error');
    }
}

function startSelectionCapture() {
    const overlay = document.createElement('div');
    overlay.id = 'screenshot-selection-overlay';
    overlay.className = 'screenshot-selection-overlay';
    overlay.innerHTML = `
        <div class="screenshot-selection-hint">Click and drag to select area</div>
        <div class="screenshot-selection-box" id="screenshot-selection-box"></div>
    `;
    
    document.body.appendChild(overlay);
    selectionOverlay = overlay;
    
    let isSelecting = false;
    let startX, startY;
    const selectionBox = overlay.querySelector('.screenshot-selection-box');
    
    overlay.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;
        selectionBox.style.display = 'block';
        selectionBox.style.left = startX + 'px';
        selectionBox.style.top = startY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
    });
    
    overlay.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;
        
        const currentX = e.clientX;
        const currentY = e.clientY;
        
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        
        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
    });
    
    overlay.addEventListener('mouseup', async (e) => {
        if (!isSelecting) return;
        isSelecting = false;
        
        const rect = selectionBox.getBoundingClientRect();
        overlay.remove();
        
        if (rect.width > 10 && rect.height > 10) {
            await captureSelection(rect);
        }
    });
    
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
        }
    });
    
    overlay.tabIndex = 0;
    overlay.focus();
}

async function captureSelection(rect) {
    playSound('screenshot');
    
    try {
        const fullCanvas = await html2canvas(document.body, {
            allowTaint: true,
            useCORS: true,
            scale: window.devicePixelRatio || 1,
            logging: false
        });
        
        const scale = window.devicePixelRatio || 1;
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = rect.width * scale;
        croppedCanvas.height = rect.height * scale;
        
        const ctx = croppedCanvas.getContext('2d');
        ctx.drawImage(
            fullCanvas,
            rect.left * scale, rect.top * scale,
            rect.width * scale, rect.height * scale,
            0, 0,
            rect.width * scale, rect.height * scale
        );
        
        showScreenshotPreview(croppedCanvas);
    } catch (error) {
        console.error('Screenshot failed:', error);
        showNotification('Screenshot', 'Failed to capture selection', 'error');
    }
}

function showScreenshotPreview(canvas) {
    const preview = document.createElement('div');
    preview.className = 'screenshot-preview-modal';
    preview.innerHTML = `
        <div class="screenshot-preview-content">
            <div class="screenshot-preview-header">
                <h3>Screenshot Preview</h3>
                <button class="screenshot-close-btn" onclick="this.closest('.screenshot-preview-modal').remove()">
                    <span class="material-symbols-rounded">close</span>
                </button>
            </div>
            <div class="screenshot-preview-image"></div>
            <div class="screenshot-preview-actions">
                <button class="screenshot-action-btn" id="screenshot-download-btn">
                    <span class="material-symbols-rounded">download</span>
                    Download
                </button>
                <button class="screenshot-action-btn" id="screenshot-copy-btn">
                    <span class="material-symbols-rounded">content_copy</span>
                    Copy
                </button>
            </div>
        </div>
    `;
    
    const imageContainer = preview.querySelector('.screenshot-preview-image');
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '60vh';
    imageContainer.appendChild(canvas);
    
    document.body.appendChild(preview);
    
    // Download button
    preview.querySelector('#screenshot-download-btn').onclick = () => {
        const link = document.createElement('a');
        link.download = `lair-screenshot-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showNotification('Screenshot', 'Screenshot saved', 'success');
        preview.remove();
    };
    
    // Copy button
    preview.querySelector('#screenshot-copy-btn').onclick = async () => {
        try {
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            showNotification('Screenshot', 'Copied to clipboard', 'success');
            preview.remove();
        } catch (error) {
            showNotification('Screenshot', 'Failed to copy to clipboard', 'error');
        }
    };
    
    // Close on backdrop click
    preview.addEventListener('click', (e) => {
        if (e.target === preview) {
            preview.remove();
        }
    });
}

function showScreenshotMenu() {
    const existingMenu = document.getElementById('screenshot-menu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }
    
    const menu = document.createElement('div');
    menu.id = 'screenshot-menu';
    menu.className = 'screenshot-menu';
    menu.innerHTML = `
        <div class="screenshot-menu-title">Screenshot</div>
        <button class="screenshot-menu-option" onclick="takeScreenshot('fullscreen'); this.closest('.screenshot-menu').remove();">
            <span class="material-symbols-rounded">fullscreen</span>
            Full Screen
        </button>
        <button class="screenshot-menu-option" onclick="takeScreenshot('window'); this.closest('.screenshot-menu').remove();">
            <span class="material-symbols-rounded">web_asset</span>
            Active Window
        </button>
        <button class="screenshot-menu-option" onclick="takeScreenshot('selection'); this.closest('.screenshot-menu').remove();">
            <span class="material-symbols-rounded">crop</span>
            Selection
        </button>
    `;
    
    document.body.appendChild(menu);
    
    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

// ============================================
// 5. CLIPBOARD HISTORY
// ============================================

let clipboardHistory = [];
const MAX_CLIPBOARD_ITEMS = 10;

function initClipboardHistory() {
    loadClipboardHistory();
    
    // Monitor clipboard changes
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCopy);
}

function handleCopy(e) {
    setTimeout(() => {
        navigator.clipboard.readText().then(text => {
            if (text && text.trim()) {
                addToClipboardHistory(text, 'text');
            }
        }).catch(() => {
            // Clipboard read might be blocked
        });
    }, 100);
}

function addToClipboardHistory(content, type = 'text') {
    // Avoid duplicates
    const existingIndex = clipboardHistory.findIndex(item => item.content === content);
    if (existingIndex !== -1) {
        clipboardHistory.splice(existingIndex, 1);
    }
    
    clipboardHistory.unshift({
        content,
        type,
        timestamp: new Date()
    });
    
    if (clipboardHistory.length > MAX_CLIPBOARD_ITEMS) {
        clipboardHistory.pop();
    }
    
    saveClipboardHistory();
}

function saveClipboardHistory() {
    try {
        localStorage.setItem('lair-clipboard-history', JSON.stringify(clipboardHistory));
    } catch (e) {}
}

function loadClipboardHistory() {
    try {
        const saved = localStorage.getItem('lair-clipboard-history');
        if (saved) {
            clipboardHistory = JSON.parse(saved).map(item => ({
                ...item,
                timestamp: new Date(item.timestamp)
            }));
        }
    } catch (e) {}
}

function toggleClipboardPanel() {
    const panel = document.getElementById('clipboard-history-panel');
    if (panel) {
        const isOpen = panel.classList.contains('open');
        if (isOpen) {
            panel.classList.remove('open');
            panel.setAttribute('aria-hidden', 'true');
        } else {
            closeHistoryPanels('clipboard-history-panel');
            renderClipboardHistory();
            panel.classList.add('open');
            panel.setAttribute('aria-hidden', 'false');
        }
    }
}

function closeHistoryPanels(exceptId = '') {
    const panelIds = ['notification-history-panel', 'clipboard-history-panel', 'nc-panel'];
    panelIds.forEach((id) => {
        if (id === exceptId) return;
        const panel = document.getElementById(id);
        if (!panel) return;
        // Handle both old .open and new .nc-panel--open class conventions
        if (panel.classList.contains('open')) {
            panel.classList.remove('open');
            panel.setAttribute('aria-hidden', 'true');
        }
        if (panel.classList.contains('nc-panel--open')) {
            panel.classList.remove('nc-panel--open');
            panel.setAttribute('aria-hidden', 'true');
        }
    });
}

function initPanelDismissHandlers() {
    document.addEventListener('mousedown', (event) => {
        const clickedInsidePanel = event.target.closest('#notification-history-panel, #clipboard-history-panel, #nc-panel');
        if (clickedInsidePanel) return;
        closeHistoryPanels();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeHistoryPanels();
        }
    });
}

function renderClipboardHistory() {
    const list = document.getElementById('clipboard-history-list');
    if (!list) return;
    
    if (clipboardHistory.length === 0) {
        list.innerHTML = '<div class="clipboard-history-empty">No clipboard history</div>';
        return;
    }
    
    list.innerHTML = clipboardHistory.map((item, index) => `
        <div class="clipboard-history-item" onclick="pasteFromHistory(${index})">
            <div class="clipboard-history-preview">${escapeHtml(item.content.substring(0, 100))}${item.content.length > 100 ? '...' : ''}</div>
            <div class="clipboard-history-time">${formatTimeAgo(item.timestamp)}</div>
        </div>
    `).join('');
}

async function pasteFromHistory(index) {
    const item = clipboardHistory[index];
    if (!item) return;
    
    try {
        await navigator.clipboard.writeText(item.content);
        showNotification('Clipboard', 'Copied to clipboard', 'success', 2000);
        toggleClipboardPanel();
    } catch (error) {
        showNotification('Clipboard', 'Failed to copy', 'error');
    }
}

function clearClipboardHistory() {
    clipboardHistory = [];
    saveClipboardHistory();
    renderClipboardHistory();
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

function initSystemShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+L - Lock Screen
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            lockScreen();
            return;
        }
        
        // Ctrl+Shift+S - Screenshot
        if (e.ctrlKey && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            showScreenshotMenu();
            return;
        }
        
        // Ctrl+Shift+V - Clipboard History
        if (e.ctrlKey && e.shiftKey && e.key === 'V') {
            e.preventDefault();
            toggleClipboardPanel();
            return;
        }
        
        // Escape - Close lock screen (if unlocked area is clicked)
        if (e.key === 'Escape' && isLocked) {
            // Keep locked, just hide any menus
        }
    });
    
    // Reset lock timeout on activity
    ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
        document.addEventListener(event, resetLockTimeout, { passive: true });
    });
}

// ============================================
// INITIALIZATION
// ============================================

function initSystemFeatures() {
    // Load saved settings
    loadSoundSettings();
    loadLockSettings();
    loadNotificationHistory();
    
    // Initialize clipboard monitoring
    initClipboardHistory();
    
    // Setup keyboard shortcuts
    initSystemShortcuts();

    // Setup panel dismissal handlers
    initPanelDismissHandlers();
    
    // Update notification badge
    updateNotificationBadge();

    document.getElementById('notification-history-panel')?.setAttribute('aria-hidden', 'true');
    document.getElementById('clipboard-history-panel')?.setAttribute('aria-hidden', 'true');
    
    console.log('LairOS System Features initialized');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSystemFeatures);
} else {
    initSystemFeatures();
}

// Export functions globally
window.showNotification = showNotification;
window.dismissNotification = dismissNotification;
window.toggleNotificationHistory = toggleNotificationHistory;
window.clearNotificationHistory = clearNotificationHistory;
window.playSound = playSound;
window.setSoundEnabled = setSoundEnabled;
window.setSoundVolume = setSoundVolume;
window.lockScreen = lockScreen;
window.unlockScreen = unlockScreen;
window.setLockTimeout = setLockTimeout;
window.takeScreenshot = takeScreenshot;
window.showScreenshotMenu = showScreenshotMenu;
window.toggleClipboardPanel = toggleClipboardPanel;
window.clearClipboardHistory = clearClipboardHistory;
window.pasteFromHistory = pasteFromHistory;
