var dragging = false, remToPx = parseFloat(getComputedStyle(document.documentElement).fontSize), navheight;

var pumpdotcsscache, transactionLib = [], notificationContext = {};

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
    console.log("Opening file:", x, stufftodo);
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
        console.log('HANDLE NTX INCOMING', event.data)
        const { action, params, transactionId } = event.data;
        const contextID = genUID();
        console.log(5345, appid)
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
                    console.log("Loader found, removing it.");
                    loader.classList.add("transp5");
                    setTimeout(() => loader.remove(), 500);
                }
            }, 500)
        } else if (event.data.type === "iframeClick") {
            const targetWindow = document.querySelector(`[data-winuid="${winuid}"]`);
            nowapp = winuid;
            putwinontop("window" + winuid);
            winds[winuid].zIndex = targetWindow.style.zIndex;
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
    console.log(888, e);
    if (e.data.type === "myWindow") {
    console.log("TRY CALL ONSTARTUP", e.data);
        try {
            await onStartup();
    console.log("ONSTARTUP OVER", e.data);
            setTimeout(() => myWindow.close(), 0);
        } catch (t) {}
        myWindow = {
            ...e.data.data,
            close: () => {console.log("CLOSEREQ");ntxSession.send("sysUI.clwin", myWindow.windowID)},
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
                        console.log(45, t.data.result, s)
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
    console.log("this frame is responding");
</script>`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${contentString}${ntxScript}<script defer>window.parent.postMessage({type:"iframeReady",windowID:"${winuid}"}, "*");</script></body></html>`;
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
        const fontUrl = `${location.origin}/libs/MaterialSymbolsRounded.woff2`;
        cacheFont(fontUrl, 'material-symbols-rounded');
        styleBlock += `<style>@font-face{font-family:'Material Symbols Rounded';font-style:normal;src:url(${fontUrl}) format('woff2');}.material-symbols-rounded{font-family:'Material Symbols Rounded';font-weight:normal;font-style:normal;font-size:24px;line-height:1;display:inline-block;white-space:nowrap;direction:ltr;-webkit-font-smoothing:antialiased;}</style>`;
    }

    const ctxScript = getMetaTagContent(contentString, 'pump-include')?.includes('contextMenu') ? await fetch('scripts/ctxmenu.js').then(res => res.text()) : '';

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
                        console.log(45,t.data.result, s)
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
                        console.log(45, action)
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
    console.log("this regular frame is responding");

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

    const fullBlobHTML = `<!DOCTYPE html><html><head><meta charset="utf-8">${styleBlock}</head><body>${contentString}${ctxScript ? `<script>${ctxScript}</script>` : ''}${ntxScript}<script defer>window.parent.postMessage({type:"iframeReady",windowID:"${winuid}"}, "*");</script></body></html>`;

    return new Blob([fullBlobHTML], { type: 'text/html' });
}

async function loadIframe(windowContent, windowLoader, loaderSpinner, cont, appid, winuid, title, params) {
    console.log("LOADFRAME:", title)
    const iconHtml = await getAppIcon(0, appid) || defaultAppIcon;
    loaderSpinner.insertAdjacentHTML('beforebegin', iconHtml);

    // Get existing registry or create new one
    let registry = await getSetting(appid, "AppRegistry.json") || { perms: [] };
    
    // Extract declared permissions from app's meta tag and auto-grant them
    const contentString = isBase64(cont) ? decodeBase64Content(cont) : cont;
    const declaredPerms = getMetaTagContent(contentString, 'permissions');
    if (declaredPerms) {
        const declaredPermsArray = declaredPerms.split(',').map(p => p.trim()).filter(p => p);
        // Merge declared permissions into registry (auto-grant)
        if (!Array.isArray(registry.perms)) registry.perms = [];
        declaredPermsArray.forEach(perm => {
            if (!registry.perms.includes(perm)) {
                registry.perms.push(perm);
            }
        });
        // Save the auto-granted permissions
        await setSetting(appid, registry, "AppRegistry.json");
    }
    
    let contentBlob;
    if (title == "headless_373452343985$#%")
        contentBlob = await prepareIframeContentHeadless(cont, appid, winuid);
    else
        contentBlob = await prepareIframeContent(cont, appid, winuid);
    const blobURL = URL.createObjectURL(contentBlob);

    const iframe = document.createElement("iframe");
    if (!registry.perms?.includes("unsandboxed")) {
        iframe.setAttribute("sandbox", "allow-scripts allow-modals");
        iframe.setAttribute("allow", "camera; microphone");
    }
    iframe.src = blobURL;
    iframe.onload = async () => {
        const myWindowData = { appID: appid, windowID: winuid, setTitle: "later", ...(params && { params }) };
        console.log("TRY INJECT MYWINDOW", myWindowData, iframe)
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

    const fetchDataAndSave = async (appTitle) => {
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
            openwindow(appTitle, AppContent, appIcon, getAppTheme(AppContent), getAppAspectRatio(AppContent), external, Gtodo);
            Gtodo = null;
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    fetchDataAndSave(appTitle);
}

function minim(winuid) {
    const x = gid('window' + winuid);

    if (winds[winuid]["visualState"] === "minimized") {
        // Restore window with animation
        x.style.display = "flex";
        x.classList.add('window-restore-anim');
        winds[winuid]["visualState"] = winds[winuid]["prevVisualState"] || "free";
        setTimeout(() => {
            x.classList.remove('window-restore-anim');
        }, 300);
    } else {
        if (isWinOnTop('window' + winuid)) {
            // Minimize with animation
            winds[winuid]["prevVisualState"] = winds[winuid]["visualState"];
            winds[winuid]["visualState"] = "minimized";
            x.classList.add('window-minimize-anim');

            setTimeout(() => {
                x.classList.remove('window-minimize-anim');
                x.style.display = "none";
                nowapp = '';
            }, 300);
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