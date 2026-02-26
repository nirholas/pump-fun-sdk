function calculateWindowSize(aspectratio) {
    if (!aspectratio) aspectratio = "9/6";
    const [widthFactor, heightFactor] = aspectratio.split('/').map(Number);
    const aspectRatioValue = widthFactor / heightFactor;
    const maxVW = 90, maxVH = 90;

    const maxWidthPx = (window.innerWidth * maxVW) / 100;
    const maxHeightPx = (window.innerHeight * maxVH) / 100;
    let heightPx = (maxHeightPx / 100) * 70;
    let widthPx = heightPx * aspectRatioValue;

    if (widthPx > maxWidthPx) {
        widthPx = maxWidthPx;
        heightPx = widthPx / aspectRatioValue;
    }

    const widthVW = (widthPx / window.innerWidth) * 100;
    const heightVH = (heightPx / window.innerHeight) * 100;

    const offset = 5 * Object.keys(winds).length;
    const left = `calc(50vw - ${widthVW / 2}vw + ${offset}px)`;
    const top = `calc(50vh - ${heightVH / 2}vh + ${offset}px)`;

    return { left, top, width: `${widthVW}vw`, height: `${heightVH}vh` };
}

const snappingDivs = document.querySelectorAll('#snappingIndicator div');

function snappingconthide() {
    let snappingIndicator = document.getElementById('snappingIndicator');
    snappingIndicator.style.transition = "opacity 0.2s";
    snappingIndicator.style.opacity = "0";
    setTimeout(() => {
        snappingIndicator.style.display = "none";
    }, 200);
}


function initializeWindowState(title, appid, params) {
    appsHistory.push(title);
    if (appsHistory.length > 5) {
        appsHistory = appsHistory.slice(-5);
    }

    sysLog(title, `at ${appid}${(params) ? " opened with " + Object.keys(params).length + " params." : ""}`);

    const winuid = genUID();
    if (!winds[winuid]) { winds[winuid] = {}; }
    winds[winuid].title = title;
    winds[winuid].appid = appid;

    return winuid;
}

function createWindowShell(winuid, appid) {
    const windowDiv = document.createElement("div");
    windowDiv.id = "window" + winuid;
    windowDiv.className = "window";
    windowDiv.setAttribute("data-winuid", winuid);
    windowDiv.setAttribute("data-appid", appid);
    windowDiv.style.position = "absolute";

    const windowHeader = document.createElement("div");
    windowHeader.id = "window" + winuid + "header";
    windowHeader.className = "windowheader ctxAvail";

    const windowContent = document.createElement("div");
    windowContent.className = "windowcontent";

    const windowLoader = document.createElement("div");
    windowLoader.className = "windowloader";
    setTimeout(async ()=> {if (!(await getSetting("windowloader"))) {windowLoader.style.opacity = "0";}}, 0);
    const loaderSpinner = document.createElement("div");
    loaderSpinner.className = "loader33";
    windowLoader.appendChild(loaderSpinner);

    windowContent.appendChild(windowLoader);
    windowDiv.appendChild(windowHeader);
    windowDiv.appendChild(windowContent);

    return { windowDiv, windowHeader, windowContent, windowLoader, loaderSpinner };
}

function populateWindowHeader(header, title, ic, winuid) {
    const dataSpan = document.createElement("div");
    dataSpan.className = "windowdataspan";
    dataSpan.innerHTML = ic != null ? ic : "";

    const titleSpan = document.createElement("div");
    titleSpan.className = "title";
    titleSpan.id = "window" + winuid + "titlespan";
    titleSpan.innerHTML = (title == "headless_373452343985$#%") ? "Running..." : toTitleCase(basename(title));

    dataSpan.appendChild(titleSpan);
    header.appendChild(dataSpan);
}

function createHeaderControls(winuid, windowDiv) {
    const controlsContainer = document.createElement("div");
    controlsContainer.className = "ibtnsside";

    const isMobile = matchMedia('(pointer: coarse)').matches;

    const createButton = (title, icon, ...classes) => {
        const button = document.createElement("button");
        button.setAttribute("title", title);
        const span = document.createElement("span");
        span.classList.add("material-symbols-rounded", ...classes);
        span.textContent = icon;
        button.appendChild(span);
        return button;
    };

    const closeButton = createButton("Close", "close", "wincl", "winclosebtn");
    closeButton.onclick = () => {
        clwin(winuid);
        loadtaskspanel();
    };

    const minimizeButton = createButton("Minimize", "remove", "wincl", "flbtn");
    minimizeButton.onclick = () => {
        snappingconthide();
        minim(winuid);
    };

    controlsContainer.appendChild(closeButton);

    if (!isMobile) {
        const maximizeButton = createButton("Maximize", "open_in_full", "wincl", "flbtn");
        maximizeButton.querySelector('span').style.fontSize = '0.7rem';
        maximizeButton.onclick = () => {
            snappingconthide();
            flwin(windowDiv);
        };
        controlsContainer.appendChild(maximizeButton);
    }

    controlsContainer.appendChild(minimizeButton);
    return controlsContainer;
}

async function applyWindowAppearance(windowDiv, header, theme, aspectratio) {
    const isMobile = matchMedia('(pointer: coarse)').matches;
    const sizeStyles = !isMobile ? calculateWindowSize(aspectratio) : { left: '0', top: '0', width: 'calc(100% - 0px)', height: 'calc(100% - 58px)' };
    Object.assign(windowDiv.style, sizeStyles);

    let bgColor = await getSetting("WindowBgColor");
    windowDiv.style.background = bgColor || 'transparent';

    if (theme != null) {
        header.style.backgroundColor = theme;
        header.style.color = isDark(theme) ? "white" : "black";
    }
}
function attachDragHandler(windowDiv, header, winuid) {
    header.addEventListener("mousedown", () => {
        putwinontop('window' + winuid);
        if (winds[winuid]) winds[winuid].zIndex = windowDiv.style.zIndex;
    });

    dragElement(windowDiv);

    header.addEventListener("mouseup", (event) => {
        let target = event.target;
        while (target) {
            if (target.classList?.contains('wincl')) return;
            target = target.parentElement;
        }
        checksnapping(document.getElementById('window' + winuid), event, winuid);
        snappingconthide();
    });
}

function attachResizeHandlers(windowDiv) {
    const resizers = [
        { class: "resizer top-left", cursor: "nwse-resize", width: "10px", height: "10px", top: "-5px", left: "-5px" },
        { class: "resizer top-right", cursor: "nesw-resize", width: "10px", height: "10px", top: "-5px", right: "-5px" },
        { class: "resizer bottom-left", cursor: "nesw-resize", width: "10px", height: "10px", bottom: "-5px", left: "-5px" },
        { class: "resizer bottom-right", cursor: "nwse-resize", width: "10px", height: "10px", bottom: "-5px", right: "-5px" },
        { class: "resizer top", cursor: "ns-resize", width: "100%", height: "5px", top: "-5px" },
        { class: "resizer bottom", cursor: "ns-resize", width: "100%", height: "5px", bottom: "-5px" },
        { class: "resizer left", cursor: "ew-resize", width: "5px", height: "100%", left: "-5px" },
        { class: "resizer right", cursor: "ew-resize", width: "5px", height: "100%", right: "-5px" }
    ];

    resizers.forEach(resizer => {
        const div = document.createElement("div");
        div.className = resizer.class;
        Object.assign(div.style, {
            position: "absolute",
            width: resizer.width,
            height: resizer.height,
            cursor: resizer.cursor,
            background: "transparent",
            top: resizer.top,
            bottom: resizer.bottom,
            left: resizer.left,
            right: resizer.right
        });
        windowDiv.appendChild(div);

        div.addEventListener("mousedown", (e) => {
            e.preventDefault();
            let startX = e.clientX, startY = e.clientY;
            let startWidth = windowDiv.offsetWidth, startHeight = windowDiv.offsetHeight;
            let startLeft = windowDiv.offsetLeft, startTop = windowDiv.offsetTop;

            const iframeOverlay = document.createElement('div');
            Object.assign(iframeOverlay.style, {
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 999, backgroundColor: 'transparent', cursor: resizer.cursor
            });
            document.body.appendChild(iframeOverlay);

            function resizeMove(ev) {
                let dx = ev.clientX - startX;
                let dy = ev.clientY - startY;

                if (resizer.class.includes("right")) {
                    let newWidth = startWidth + dx;
                    if (newWidth > 50) {
                        windowDiv.style.width = newWidth + "px";
                    }
                }

                if (resizer.class.includes("bottom")) {
                    let newHeight = startHeight + dy;
                    if (newHeight > 50) {
                        windowDiv.style.height = newHeight + "px";
                    }
                }

                if (resizer.class.includes("left")) {
                    let newWidth = startWidth - dx;
                    if (newWidth > 50) {
                        windowDiv.style.width = newWidth + "px";
                        windowDiv.style.left = startLeft + dx + "px";
                    }
                }

                if (resizer.class.includes("top")) {
                    let newHeight = startHeight - dy;
                    if (newHeight > 50) {
                        windowDiv.style.height = newHeight + "px";
                        windowDiv.style.top = startTop + dy + "px";
                    }
                }
            }


            function stopResize(event) {
                document.removeEventListener("mousemove", resizeMove);
                document.removeEventListener("mouseup", stopResize);
                snappingconthide();
                if (iframeOverlay) {
                    document.body.removeChild(iframeOverlay);
                }
                const mouseUpEvent = new MouseEvent('mouseup', { clientX: event.clientX, clientY: event.clientY });
                windowDiv.dispatchEvent(mouseUpEvent);
            }

            document.addEventListener("mousemove", resizeMove);
            document.addEventListener("mouseup", stopResize);
        });
    });
}

function finalizeWindow(windowDiv, winuid) {
    document.body.appendChild(windowDiv);

    const zIndexes = Object.values(winds).map(w => Number(w.zIndex) || 0);
    const maxZ = Math.max(0, ...zIndexes);
    windowDiv.style.zIndex = maxZ + 1;

    putwinontop('window' + winuid);
}

function resetWindow(id) {
    const x = document.getElementById("window" + id);
    x.classList.add("snapping");

    const aspectRatio = x.getAttribute("data-aspectratio") || "9/6";
    const sizeStyles = calculateWindowSize(aspectRatio);

    Object.assign(x.style, sizeStyles);
    x.getElementsByClassName("flbtn")[0].innerHTML = "open_in_full";

    winds[id]["visualState"] = "free";

    setTimeout(() => {
        x.classList.remove("snapping");
    }, 1000);
}

function maximizeWindow(id) {
    updateNavSize();
    const x = document.getElementById("window" + id);
   suppressNudge = true;
x.classList.add("snapping");
    x.style.width = "calc(100% - 0px)";
    x.style.height = "calc(100% - " + navheight + "px)";
    x.style.top = "0";
    x.style.left = "0";
    x.getElementsByClassName("flbtn")[0].innerHTML = "close_fullscreen";

    winds[id]["visualState"] = "fullscreen";

    setTimeout(() => {
    x.classList.remove("snapping");
    suppressNudge = false;
}, 1000);
}

let suppressNudge = false;
function nudgeWindowIntoView(el) {
    if (suppressNudge || !sessionSettings.keepvisible) return;
    const rect = el.getBoundingClientRect();
    const padding = 10;
    let left = el.offsetLeft;
    let top = el.offsetTop;
    let nudged = false;
    if (rect.right > window.innerWidth - padding) {
        left -= (rect.right - window.innerWidth + padding);
        nudged = true;
    }
    if (rect.left < padding) {
        left += (padding - rect.left);
        nudged = true;
    }
    if (rect.bottom > window.innerHeight - padding) {
        top -= (rect.bottom - window.innerHeight + padding);
        nudged = true;
    }
    if (rect.top < padding) {
        top += (padding - rect.top);
        nudged = true;
    }
    if (nudged) {
        el.classList.add("snapping");
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        setTimeout(() => {
            el.classList.remove("snapping");
        }, 500);
    }
}

async function checksnapping(x, event, winuid) {
    if (event.target.closest('.ibtnsside')) return;
    updateNavSize();
    const [wsnappingSetting, keepVisibleSetting] = await Promise.all([
    getSetting("wsnapping"),
    getSetting("keepvisible")
]);
sessionSettings.keepvisible = keepVisibleSetting;
    const logData = {
        x: x,
        eventType: event.type,
        cursorX: event.clientX,
        cursorY: event.clientY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        wsnappingSetting:wsnappingSetting
    };


    const VWInPixels = (3 * logData.viewportWidth) / 100;
    const VHInPixels = (3 * logData.viewportHeight) / 100;
    const aspectRatioValue = 9 / 6;
    const maxWidthPx = logData.viewportWidth;
    const maxHeightPx = logData.viewportHeight;
    let heightPx = (maxHeightPx / 100) * 70;
    let widthPx = heightPx * aspectRatioValue;

    if (widthPx > maxWidthPx) {
        widthPx = maxWidthPx;
        heightPx = widthPx / aspectRatioValue;
    }

    const widthVW = (widthPx / logData.viewportWidth) * 100;
    const heightVH = (heightPx / logData.viewportHeight) * 100;

    logData.VWInPixels = VWInPixels;
    logData.VHInPixels = VHInPixels;
    logData.widthPx = widthPx;
    logData.heightPx = heightPx;
    logData.widthVW = widthVW;
    logData.heightVH = heightVH;

    if (logData.wsnappingSetting) {
        if (winds[winuid]["visualState"] == "fullscreen" || winds[winuid]["visualState"] == "snapped") {
            resetWindow(winuid);
            if (sessionSettings.keepvisible) nudgeWindowIntoView(x);
            return;
        }

        if (logData.cursorY < VHInPixels || (logData.viewportHeight - logData.cursorY) < VHInPixels) {
            maximizeWindow(winuid);
        } else if (logData.cursorX < VWInPixels) {
            suppressNudge = true;
x.classList.add("snapping");
            x.style = `left: 0; top: 0; width: calc(50% - 0px); height: calc(100% - ${navheight}px);`;
            x.getElementsByClassName("flbtn")[0].innerHTML = "open_in_full";
            winds[winuid]["visualState"] = "snapped";
            setTimeout(() => {
    x.classList.remove("snapping");
    suppressNudge = false;
}, 1000);
        } else if ((logData.viewportWidth - logData.cursorX) < VWInPixels) {
            suppressNudge = true;
x.classList.add("snapping");
            x.style = `right: 0; top: 0; width: calc(50% - 0px); height: calc(100% - ${navheight}px);`;
            x.getElementsByClassName("flbtn")[0].innerHTML = "open_in_full";
            winds[winuid]["visualState"] = "snapped";
            setTimeout(() => {
    x.classList.remove("snapping");
    suppressNudge = false;
}, 1000);
        }
    }

    if (sessionSettings.keepvisible) nudgeWindowIntoView(x);
}

function dragElement(elmnt) {
    var iframeOverlay = null;
    let grabOffsetX = 0;
    let grabOffsetY = 0;
    let holdStart = 0;
    const snappingIndicator = document.getElementById('snappingIndicator');
    const snappingDivs = Array.from(document.querySelectorAll('.snappingDiv'));
    if (gid(elmnt.id + "header")) {
        gid(elmnt.id + "header").onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
        e = e || window.event;
        if (isInsideIbtnsSide(e.target)) return;
        e.preventDefault();

        holdStart = Date.now();
        grabOffsetX = e.clientX - elmnt.getBoundingClientRect().left;
        grabOffsetY = e.clientY - elmnt.getBoundingClientRect().top;
        elmnt.style.position = 'absolute';

        iframeOverlay = document.createElement('div');
        iframeOverlay.style.position = 'fixed';
        iframeOverlay.style.top = 0;
        iframeOverlay.style.left = 0;
        iframeOverlay.style.width = '100vw';
        iframeOverlay.style.height = '100vh';
        iframeOverlay.style.zIndex = '9999';
        iframeOverlay.style.backgroundColor = 'transparent';
        iframeOverlay.style.cursor = 'grabbing';
        document.body.appendChild(iframeOverlay);

        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();

        let targetLeft = e.clientX - grabOffsetX;
        let targetTop = e.clientY - grabOffsetY;

        elmnt.style.position = 'absolute';
        elmnt.style.left = `${targetLeft}px`;
        elmnt.style.top = `${targetTop}px`;

        if (Date.now() - holdStart >= 500) {
            snappingIndicator.style.opacity = "0.8";
            snappingIndicator.style.display = "block";
        }

        snappingDivs.forEach(div => {
            const rect = div.getBoundingClientRect();
            const isHovered = e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom;
            div.style.opacity = isHovered ? 0.8 : 0.2;
        });
    }

    function closeDragElement(e) {
        document.onmouseup = null;
        document.onmousemove = null;

        if (iframeOverlay) {
            document.body.removeChild(iframeOverlay);
            iframeOverlay = null;
        }

        if (snappingIndicator) {
            snappingIndicator.style.display = "none";
        }

        snappingDivs.forEach(div => {
            div.style.opacity = 0.2;
        });

        if (gid(elmnt.id + "header")) {
            const mouseUpEvent = new MouseEvent('mouseup', {
                clientX: e.clientX,
                clientY: e.clientY,
            });
            gid(elmnt.id + "header").dispatchEvent(mouseUpEvent);
        }
    }

    function isInsideIbtnsSide(target) {
        while (target) {
            if (target.classList && target.classList.contains('ibtnsside')) {
                return true;
            }
            target = target.parentElement;
        }
        return false;
    }
}