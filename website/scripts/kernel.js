var dragging = false, remToPx = parseFloat(getComputedStyle(document.documentElement).fontSize), navheight;

var pumpdotcsscache, transactionLib = [], notificationContext = {};

/**
 * Parses a full HTML document string and extracts head/body content separately.
 * Prevents nested <!DOCTYPE><html><body> structures when apps are wrapped in iframes.
 */
function parseAppHTML(html) {
    if (!html || typeof html !== 'string') return { headContent: '', bodyContent: html || '', bodyAttrs: '' };

    // Strip DOCTYPE declaration
    let clean = html.replace(/<!DOCTYPE[^>]*>/i, '').trim();

    // Extract head content (between first <head> and first </head>)
    let headContent = '';
    const headOpenMatch = clean.match(/<head[^>]*>/i);
    const headCloseIdx = clean.search(/<\/head>/i);
    if (headOpenMatch && headCloseIdx !== -1) {
        const headStart = headOpenMatch.index + headOpenMatch[0].length;
        headContent = clean.substring(headStart, headCloseIdx)
            // Remove charset meta (wrapper provides it)
            .replace(/<meta\s+[^>]*charset[^>]*>/gi, '')
            // Remove viewport meta (not needed in iframe)
            .replace(/<meta\s+[^>]*name=["']viewport["'][^>]*>/gi, '')
            // Remove title tags (window title set separately)
            .replace(/<title>[^<]*<\/title>/gi, '')
            .trim();
    }

    // Extract body content (between first <body> and LAST </body>)
    let bodyContent = clean;
    let bodyAttrs = '';
    const bodyOpenMatch = clean.match(/<body([^>]*)>/i);
    const bodyCloseIdx = clean.lastIndexOf('</body>');
    if (bodyOpenMatch && bodyCloseIdx !== -1) {
        const bodyStart = bodyOpenMatch.index + bodyOpenMatch[0].length;
        bodyContent = clean.substring(bodyStart, bodyCloseIdx);
        bodyAttrs = (bodyOpenMatch[1] || '').trim();
    } else if (headOpenMatch && headCloseIdx !== -1) {
        // Has head but no body tags — use everything after </head>
        bodyContent = clean.substring(headCloseIdx + 7)
            .replace(/<\/?html[^>]*>/gi, '')
            .trim();
    } else {
        // No HTML structure — strip any stray html tags and use as-is
        bodyContent = clean.replace(/<\/?html[^>]*>/gi, '').trim();
    }

    return { headContent, bodyContent, bodyAttrs };
}

async function openlaunchprotocol(appid, data, id, winuid) {
    sysLog("OLP", `Opening "${data}" in "${appid}" for ${winuid || id || 'operation'}`);
    let x = {
        "appid": appid,
        "data": data,
        "winuid": winuid
    };
    Gtodo = x;
    openfile(x.appid, { data: Gtodo });
}

let _olpResolverMap = new Map();

function OLPreturn(data, transferID) {
    if (_olpResolverMap.has(transferID)) {
        const { resolve, timeout } = _olpResolverMap.get(transferID);
        clearTimeout(timeout);
        resolve(data);
        _olpResolverMap.delete(transferID);
    }

    // legacy code
    if (iframeReferences[transferID]) {
        iframeReferences[transferID].postMessage({ returned: data, id: transferID, action: 'loadlocalfile' }, '*');
    }
}

async function useHandler(name, stufftodo) {
    let data = await getSetting('handlers');

    return new Promise((resolve, reject) => {
        const transferID = `${name}-${Date.now()}`;
        const timeout = setTimeout(() => {
            _olpResolverMap.delete(transferID);
            resolve(undefined);
        }, 600000);

        _olpResolverMap.set(transferID, { resolve, timeout });

        openfile(data[name], { data: stufftodo, trid: transferID });
    });
}

const iframeReferences = {};

async function openfile(x, stufftodo) {
    sysLog("openfile", `${x}${stufftodo ? ' with params' : ''}`);
    let unid = x;
    try {
        if (!unid) {
            console.error("No app id provided");
            return;
        }

        let mm = await getFileById(unid);
        // mm is the file
        if (!mm) {
            console.error("Error: File not found", unid);
            return;
        }
        // extract type from file extension
        mm.type = ptypext(mm.fileName);

        if (mm.type == "app") {
            // run the app if it is one
            await openapp(mm.fileName, unid, stufftodo);
        } else if (mm.type == "osl") {
            runAsOSL(mm.content)
        } else if (mm.type == "lnk") {
            let z = JSON.parse(decodeBase64Content(mm.content));
            openfile(z.open)
        } else {
            // Not a .lnk file or an .osl file nor an .app file.
            let appIdToOpen = null;
            const fileExtension = mm.fileName.substring(mm.fileName.lastIndexOf('.'));

            if (fileTypeAssociations[fileExtension] && fileTypeAssociations[fileExtension].length > 0) {
                appIdToOpen = fileTypeAssociations[fileExtension][0];
            } else if (fileTypeAssociations['all'] && fileTypeAssociations['all'].length > 0) {
                appIdToOpen = fileTypeAssociations['all'][0];
            }

            if (appIdToOpen) {
                openlaunchprotocol(appIdToOpen, unid);
            } else {
                say(`No apps installed can read this file. <br><a type="btn" onclick="useHandler('content_store', {'opener':'search', 'data':'${mm.type}'});">Search for handlers <span ic class="material-symbols-rounded">
								arrow_forward
							</span></a>`, "failed")
            }

        }
    } catch (error) {
        console.error(":( Error:", error);
        say("<h1>Unable to open file</h1>File Error: " + error, "failed")
    }
}

async function buildIframeApiBridge(appid, title, winuid, perms) {
    async function checkAndSetPermission(namespace) {
        if (!Array.isArray(perms)) {
            perms = [];
            await setSetting(appid, { perms }, "AppRegistry.json");
        }
        if (perms.includes(namespace)) return true;

        const confirmed = await justConfirm(
            `Allow ${namespace} permission?`,
            `${toTitleCase(await getFileNameByID(appid))} asks permission to ${describeNamespaces(namespace)}. Allow it?`
        );
        if (confirmed) {
            perms.push(namespace);
            await setSetting(appid, { perms }, "AppRegistry.json");
            return true;
        }
        return false;
    }
    function sendLargeMessage(target, data, transactionId, chunkSize = 65536) {
        try {
            const json = JSON.stringify(data);
            if (json.length <= chunkSize) {
                target.postMessage({ transactionId, result: data, isJson: true, success: true }, '*');
                return;
            }
            const totalChunks = Math.ceil(json.length / chunkSize);
            for (let i = 0; i < totalChunks; i++) {
                const chunk = json.slice(i * chunkSize, (i + 1) * chunkSize);
                target.postMessage({
                    transactionId, chunk, chunkIndex: i, totalChunks, isJson: true, success: true
                }, '*');
            }
        } catch (error) {
        }
    }

    async function handleNtxSessionMessage(event) {
        const { action, params, transactionId } = event.data;
        const contextID = genUID();
        notificationContext[contextID] = {
            appID: appid,
            windowID: winuid
        };
        try {
            const [namespace, method] = action.split(".");
            if (ntxWrapper[namespace]?.[method]) {
                if (!await checkAndSetPermission(namespace)) return;

                const fn = ntxWrapper[namespace][method];
                const args = [...params];
                if (supportsXData(namespace, method)) args.push(contextID);

                const result = await fn(...args)

                sendLargeMessage(event.source, result, transactionId);
            } else {
                throw new Error(`Invalid NTX action: ${action}`);
            }
        } catch (error) {
            console.error("Error handling NTX message:", error);
            event.source.postMessage({ transactionId, error: error.message, success: false }, '*');
        } finally {
            delete transactionLib[transactionId];
        }
    }

    function handleMessage(event) {
        if (!event.data || event.data.iframeId !== winuid) return;

        if (event.data.data === "gfdone") {
            setTimeout(() => {
                const loader = document.querySelector(`#window${CSS.escape(winuid)} .windowloader`);
                if (loader) {
                    loader.classList.add("transp5");
                    setTimeout(() => loader.remove(), 500);
                }
            }, 500)
        } else if (event.data.type === "iframeClick") {
            const targetWindow = document.querySelector(`[data-winuid="${winuid}"]`);
            nowapp = winuid;
            putwinontop("window" + winuid);
            if (winds[winuid]) winds[winuid].zIndex = targetWindow.style.zIndex;
        } else if (event.data.transactionId && event.data.action) {
            handleNtxSessionMessage(event);
        }
    }

    if (window._messageListeners?.[winuid]) {
        window.removeEventListener("message", window._messageListeners[winuid]);
    }
    window.addEventListener("message", handleMessage);
    if (!window._messageListeners) window._messageListeners = {};
    window._messageListeners[winuid] = handleMessage;
}

async function prepareIframeContentHeadless(cont, appid, winuid) {
    const contentString = isBase64(cont) ? decodeBase64Content(cont) : (cont || "<center><h1>Unavailable</h1>App Data cannot be read.</center>");
    const ntxScript = `<script>
document.addEventListener('mousedown', () => {
    window.parent.postMessage({ type: 'iframeClick', iframeId: '${winuid}' }, '*');
});
var myWindow = {};
window.addEventListener("message", async (e) => {
    if (e.data.type === "myWindow") {
        try {
            await onStartup();
            setTimeout(() => myWindow.close(), 0);
        } catch (t) {}
        myWindow = {
            ...e.data.data,
            close: () => ntxSession.send("sysUI.clwin", myWindow.windowID),
            setTitle: (e) => ntxSession.send("sysUI.setTitle", myWindow.windowID, e)
        };
        window.parent.postMessage({ data: "gfdone", iframeId: myWindow.windowID }, "*");
    }
});
class NTXSession {
    constructor() {
        this.transactionIdCounter = 0;
        this.pendingRequests = {};
        this.listeners = {};
        const chunks = {};
        window.addEventListener("message", t => {
            const { transactionId: s, chunk: n, chunkIndex: i, totalChunks: o, isJson: a, success: d, error: r, type: c, payload: l } = t.data;
            if (s && typeof d === "boolean") {
                if (a && n !== undefined) {
                    if (!chunks[s]) chunks[s] = { chunks: [], received: 0, total: o };
                    chunks[s].chunks[i] = n;
                    chunks[s].received++;
                    if (chunks[s].received === o) {
                        const fullData = chunks[s].chunks.join("");
                        delete chunks[s];
                        const result = JSON.parse(fullData);
                        if (this.pendingRequests[s]) {
                            this.pendingRequests[s].resolve(result);
                            delete this.pendingRequests[s];
                        }
                    }
                } else {
                    if (this.pendingRequests[s]) {
                        d ? this.pendingRequests[s].resolve(t.data.result) : this.pendingRequests[s].reject(r);
                        delete this.pendingRequests[s];
                    }
                }
            } else if (c && l !== undefined && this.listeners[c]) {
                this.listeners[c].forEach(e => e(l));
            }
        });
    }
    generateTransactionId() {
        return \`txn_\${Date.now()}_\${this.transactionIdCounter++}\`;
    }
    send(action, ...params) {
        return new Promise((resolve, reject) => {
            const txnId = this.generateTransactionId();
            this.pendingRequests[txnId] = { resolve, reject };
            window.parent.postMessage({ transactionId: txnId, action: action, params: params, iframeId: '${winuid}' }, "*");
        });
    }
}
var ntxSession = new NTXSession();
</script>`;
    const { headContent: appHead, bodyContent: appBody, bodyAttrs } = parseAppHTML(contentString);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">${appHead}</head><body${bodyAttrs ? ' ' + bodyAttrs : ''}>${appBody}${ntxScript}<script defer>window.parent.postMessage({type:"iframeReady",windowID:"${winuid}"}, "*");</script></body></html>`;
    return new Blob([html], { type: 'text/html' });
}

async function prepareIframeContent(cont, appid, winuid) {
    let contentString = isBase64(cont) ? decodeBase64Content(cont) : (cont || "<center><h1>Unavailable</h1>App Data cannot be read.</center>");

    let styleBlock = '';
    if (getMetaTagContent(contentString, 'pump-include')?.includes('pump.css')) {
        let updatedCss = pumpdotcsscache || '';
        const pumpCssTag = document.getElementById('pumpcsstag');
        if (pumpCssTag) {
            const customCss = pumpCssTag.textContent;
            const variableRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
            let customVariables = {};
            let match;
            while ((match = variableRegex.exec(customCss)) !== null) {
                customVariables[`--${match[1]}`] = match[2].trim();
            }
            updatedCss = pumpdotcsscache.replace(/:root\s*{([^}]*)}/, (match, declarations) => {
                let updated = declarations.trim();
                for (const [key, val] of Object.entries(customVariables)) {
                    const regex = new RegExp(`(${key}\\s*:\\s*).*?;`, 'g');
                    updated = updated.replace(regex, `$1${val};`);
                }
                return `:root { ${updated} }`;
            });
        }
        styleBlock += `<style>${updatedCss}</style>`;
    }

    async function cacheFont(url, cacheKey, maxAttempts = 2, delayMs = 2000) {
        const cache = await caches.open('font-cache');
        let response = await cache.match(url);
        if (!response) {
            for (let i = 0; i < maxAttempts; i++) {
                try {
                    response = await fetch(url, { cache: 'reload' });
                    if (response.ok) {
                        await cache.put(url, response.clone());
                        break;
                    }
                } catch (_) { }
                await new Promise(r => setTimeout(r, delayMs));
            }
        }
    }

    if (getMetaTagContent(contentString, 'pump-include')?.includes('material-symbols-rounded')) {
        const fontUrl = `${window.location.origin}/libs/MaterialSymbolsRounded.woff2`;
        cacheFont(fontUrl, 'material-symbols-rounded');
        styleBlock += `<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"><style>@font-face{font-family:'Material Symbols Rounded';font-style:normal;font-display:swap;src:url(${fontUrl}) format('woff2');}.material-symbols-rounded{font-family:'Material Symbols Rounded';font-weight:normal;font-style:normal;font-size:24px;line-height:1;display:inline-block;white-space:nowrap;direction:ltr;-webkit-font-smoothing:antialiased;font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;}</style>`;
    }

    const ctxScript = getMetaTagContent(contentString, 'pump-include')?.includes('contextMenu') ? await fetch('scripts/ctxmenu.js').then(res => res.text()) : '';

    /* ── Early globals (non-deferred, goes in <head> so inline body scripts can use cfetch) ── */
    const earlyScript = `<script>
/* Sandbox escape mitigation: prevent iframe from modifying its own sandbox attribute.
   allow-scripts + allow-same-origin is required because apps call window.parent functions directly.
   This blocks the primary exploit vector (accessing frameElement to remove sandbox). */
try { Object.defineProperty(window, 'frameElement', { value: null, writable: false, configurable: false }); } catch(_) {}

window.PUMP_HOST = (window.location.ancestorOrigins?.[0] || '').replace(/\\/$/, '') || '${location.origin}';
window.cfetch = async function cfetch(url, opts) {
    try {
        var u = new URL(url, window.PUMP_HOST);
        if (u.origin === window.PUMP_HOST) return fetch(url, opts);
    } catch(_) {}
    var proxyUrl = window.PUMP_HOST + '/api/proxy?url=' + encodeURIComponent(url);
    if (opts && opts.method && opts.method.toUpperCase() === 'POST') {
        return fetch(proxyUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: opts.body });
    }
    return fetch(proxyUrl);
};
</script>`;

    const ntxScript = `<script defer>

document.addEventListener('mousedown', () => {
    window.parent.postMessage({ type: 'iframeClick', iframeId: '${winuid}' }, '*');
});

var myWindow = {};

window.addEventListener("message", async e => {
    if (e.data.type === "myWindow") {
        myWindow = {
            ...e.data.data,
            close: () => ntxSession.send("sysUI.clwin", myWindow.windowID),
            setTitle: (e) => ntxSession.send("sysUI.setTitle", myWindow.windowID, e)
        };
        try {
            await greenflag();
        } catch (t) {}
        window.parent.postMessage({ data: "gfdone", iframeId: myWindow.windowID }, "*");
    } else if (e.data?.type === "pump-style" && typeof e.data.css === "string") {
        let styleTag = document.getElementById("pumpcsstag");
        if (!styleTag) {
            styleTag = document.createElement("style");
            styleTag.id = "pumpcsstag";
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = e.data.css;
    }
});

class NTXSession {
    constructor() {
        this.transactionIdCounter = 0;
        this.pendingRequests = {};
        this.listeners = {};
        const chunks = {};

        window.addEventListener("message", t => {
            const {
                transactionId: s,
                chunk: n,
                chunkIndex: i,
                totalChunks: o,
                isJson: a,
                success: d,
                error: r,
                type: c,
                payload: l
            } = t.data;

            if (s && typeof d === "boolean") {
                if (a && n !== undefined) {
                    if (!chunks[s]) {
                        chunks[s] = { chunks: [], received: 0, total: o };
                    }
                    chunks[s].chunks[i] = n;
                    chunks[s].received++;
                    if (chunks[s].received === o) {
                        const fullData = chunks[s].chunks.join("");
                        delete chunks[s];
                        const result = JSON.parse(fullData);
                        if (this.pendingRequests[s]) {
                            this.pendingRequests[s].resolve(result);
                            delete this.pendingRequests[s];
                        }
                    }
                } else {
                    if (this.pendingRequests[s]) {
                        d ? this.pendingRequests[s].resolve(t.data.result) : this.pendingRequests[s].reject(r);
                        delete this.pendingRequests[s];
                    }
                }
            } else if (c && l !== undefined && this.listeners[c]) {
                this.listeners[c].forEach(e => e(l));
            }
        });
    }

    generateTransactionId() {
        return \`txn_\${Date.now()}_\${this.transactionIdCounter++}\`;
    }

    send(action, ...params) {
        return new Promise((resolve, reject) => {
            const txnId = this.generateTransactionId();
            this.pendingRequests[txnId] = { resolve, reject };
            window.parent.postMessage({
                transactionId: txnId,
                action: action,
                params: params,
                iframeId: '${winuid}'
            }, "*");
        });
    }
}

var ntxSession = new NTXSession();

const eventBus = (() => {
    const listeners = [];

    function deliver(msg) {
        if (typeof msg !== 'object' || !msg.type || !msg.event) return;
        window.parent.postMessage({ __eventBus: true, payload: msg }, '*');
    }

    function listen({ type = '*', event = '*', callback }) {
        listeners.push({ type, event, callback });
    }

    window.addEventListener('message', e => {
        const { data } = e;
        if (!data || !data.__eventBus || !data.payload) return;

        const msg = data.payload;
        listeners.forEach(({ type, event, callback }) => {
            if ((type === msg.type || type === '*') && (event === msg.event || event === '*')) {
                callback(msg);
            }
        });
    });

    return { deliver, listen };
})();

</script>
`;

    const baseHref = location.href.replace(/\/[^/]*$/, '/');
    const { headContent: appHead, bodyContent: appBody, bodyAttrs } = parseAppHTML(contentString);
    const fullBlobHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><base href="${baseHref}">${earlyScript}${styleBlock}${appHead}</head><body${bodyAttrs ? ' ' + bodyAttrs : ''}>${appBody}${ctxScript ? `<script>${ctxScript}</script>` : ''}${ntxScript}<script defer>window.parent.postMessage({type:"iframeReady",windowID:"${winuid}"}, "*");</script></body></html>`;

    return new Blob([fullBlobHTML], { type: 'text/html' });
}

async function loadIframe(windowContent, windowLoader, loaderSpinner, cont, appid, winuid, title, params) {
    sysLog("loadIframe", title);
    const iconHtml = await getAppIcon(0, appid) || defaultAppIcon;
    loaderSpinner.insertAdjacentHTML('beforebegin', iconHtml);

    let registry = await getSetting(appid, "AppRegistry.json") || { perms: [] };

    // Merge permissions declared in the app HTML via <meta name="pump-perms"> or legacy <meta name="permissions">
    const rawContent = isBase64(cont) ? decodeBase64Content(cont) : (cont || "");
    const declaredPerms = (getMetaTagContent(rawContent, 'pump-perms') || '').split(/[\s,]+/).filter(Boolean);
    const legacyPerms = (getMetaTagContent(rawContent, 'permissions') || '').split(/[\s,]+/).filter(Boolean);
    const mergedPerms = [...new Set([...(registry.perms || []), ...declaredPerms, ...legacyPerms])];

    let contentBlob;
    if (title == "headless_373452343985$#%")
        contentBlob = await prepareIframeContentHeadless(cont, appid, winuid);
    else
        contentBlob = await prepareIframeContent(cont, appid, winuid);
    const blobURL = URL.createObjectURL(contentBlob);

    const iframe = document.createElement("iframe");
    if (!mergedPerms.includes("unsandboxed")) {
        // Note: allow-scripts + allow-same-origin together can theoretically escape sandboxing.
        // This is mitigated by freezing frameElement in earlyScript (see prepareIframeContent).
        // Full fix requires migrating all apps from window.parent.fn() to ntxSession.send().
        let sandboxValue = "allow-scripts allow-modals allow-popups allow-popups-to-escape-sandbox";
        if (mergedPerms.includes("network")) {
            sandboxValue += " allow-same-origin";
        }
        iframe.setAttribute("sandbox", sandboxValue);
        iframe.setAttribute("allow", "camera; microphone");
    }
    iframe.src = blobURL;
    iframe.onload = async () => {
        const myWindowData = { appID: appid, windowID: winuid, setTitle: "later", ...(params && { params }) };
        sysLog("iframe", `injecting myWindow for ${appid} (win:${winuid})`);
        iframe.contentWindow.postMessage({ type: "myWindow", data: myWindowData }, "*");
        await buildIframeApiBridge(appid, title, winuid, registry.perms);
    };

    windowContent.appendChild(iframe);
    iframeReferences[winuid] = iframe.contentWindow;
    if (!winds[winuid]) winds[winuid] = {};
    winds[winuid].src = blobURL;
    winds[winuid].visualState = "free";
}

async function openwindow(title, cont, ic, theme, aspectratio, appid, params) {
    const winuid = initializeWindowState(title, appid, params);

    const { windowDiv, windowHeader, windowContent, windowLoader, loaderSpinner } = createWindowShell(winuid, appid);

    populateWindowHeader(windowHeader, title, ic, winuid);
    const controls = createHeaderControls(winuid, windowDiv);
    windowHeader.appendChild(controls);

    await applyWindowAppearance(windowDiv, windowHeader, theme, aspectratio);

    windowDiv.onclick = () => {
        nowapp = winuid;
        updateFocusedWindowBorder();
    };

    await loadIframe(windowContent, windowLoader, loaderSpinner, cont, appid, winuid, title, params);

    finalizeWindow(windowDiv, winuid);

    if (title != "headless_373452343985$#%") {
        loadtaskspanel();
    } else {
        setTimeout(() => {
            if (document.body.contains(windowDiv)) {
                loadtaskspanel();
            }
        }, 3000);

        setTimeout(() => {
            if (document.body.contains(windowDiv)) clwin(winuid);
        }, 30000);
    }

    attachDragHandler(windowDiv, windowHeader, winuid);
    attachResizeHandlers(windowDiv);
}

async function openapp(appTitle, external, customtodo, headless = false) {
    if (gid('appdmod').open) gid('appdmod').close();
    if (gid('searchwindow').open) gid('searchwindow').close();

    try {
        let AppContent;
        if (external === 1) {
            AppContent = await fetchData(`appdata/${appTitle}.html`);
            if (!AppContent) return;

            external = await createFile("Apps/", toTitleCase(appTitle), "app", AppContent);
        } else {
            AppContent = await getFileById(external);
            if (!appTitle) appTitle = AppContent.fileName;
            AppContent = AppContent.content;
        }

        if (headless) {
            if (Gtodo == null && customtodo) Gtodo = customtodo;
            let appIcon = 0;
            try { appIcon = await getAppIcon(external); } catch (e) { };
            await openwindow("headless_373452343985$#%", AppContent, appIcon, getAppTheme(AppContent), getAppAspectRatio(AppContent), external, customtodo);
            gid("window" + Object.keys(winds).pop()).style.display = "none";
            Gtodo = null;
            return;
        }

        if (Gtodo == null && customtodo) Gtodo = customtodo;

        let appIcon = defaultAppIcon;
        try { appIcon = await getAppIcon(0, external); } catch (e) { };
        await openwindow(appTitle, AppContent, appIcon, getAppTheme(AppContent), getAppAspectRatio(AppContent), external, Gtodo);
        Gtodo = null;
    } catch (error) {
        sysLog("openapp", `Error: ${error.message || error}`);
        say("<h1>Unable to open app</h1>" + (error.message || error), "failed");
    }
}

function minim(winuid) {
    const x = gid('window' + winuid);

    if (winds[winuid]["visualState"] === "minimized") {
        x.style.display = "flex";
        winds[winuid]["visualState"] = "free";
    } else {
        if (isWinOnTop('window' + winuid)) {
            x.classList.add("transp4");
            winds[winuid]["visualState"] = "minimized";

            setTimeout(() => {
                x.classList.remove("transp4");
                x.style.display = "none";
                nowapp = '';
            }, 100);
        } else {
            putwinontop('window' + winuid);
        }
    }
}

function flwin(winElement) {
    winElement.classList.add("transp2");
    const winuid = winElement.getAttribute("data-winuid");
    const flbtn = winElement.getElementsByClassName("flbtn")[0];

    const isFree = winds[winuid]["visualState"] != "fullscreen";

    if (isFree) {
        maximizeWindow(winuid);
        flbtn.innerHTML = "close_fullscreen";
    } else {
        resetWindow(winuid);
        flbtn.innerHTML = "open_in_full";
    }

    setTimeout(() => {
        winElement.classList.remove("transp2");
    }, 1000);
}

async function safeRemoveApp(id) {
    try {
        await remSettingKey(id, "AppRegistry.json");
        let settingid = handlers["content_store"];
        await remSettingKey(id, settingid + ".json");
        return true;
    } catch (error) {
        console.error("Error removing app:", error);
        return false;
    }
}

function updateFocusedWindowBorder() {
    if (!sessionSettings.windowoutline) return;
    Object.keys(winds).forEach(winuid => {
        const winEl = document.getElementById("window" + winuid);
        if (winEl) winEl.style.boxShadow = "";
    });
    const focusedWinuid = Object.keys(winds).find(winuid => winuid === nowapp);
    if (focusedWinuid) {
        const winEl = document.getElementById("window" + focusedWinuid);
        if (winEl) winEl.style.boxShadow = "0 0 0 2px var(--col-bgh)";
    }
}