
var CurrentUsername = 'Admin';
var password = "lair";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
var lethalpasswordtimes = true;

const eventBusWorker = (() => {
    const listeners = [];

    function deliver(msg, sourceWindow = null) {
        if (typeof msg !== 'object' || !msg.type || !msg.event) return;

        listeners.forEach(({ type, event, key, callback }) => {
            if ((type === msg.type || type === '*') &&
                (event === msg.event || event === '*') &&
                (key === undefined || key === msg.key || key === '*')) {
                callback(msg);
            }
        });

        broadcastToIframes(msg, sourceWindow);
    }

    function listen({ type = '*', event = '*', key, callback }) {
        listeners.push({ type, event, key, callback });
    }

    function broadcastToIframes(msg, sourceWindow) {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            if (iframe.contentWindow !== sourceWindow) {
                iframe.contentWindow.postMessage({ __eventBus: true, payload: msg }, '*');
            }
        });
    }

    window.addEventListener('message', e => {
        const { data, source } = e;
        if (!data || !data.__eventBus || !data.payload) return;
        deliver(data.payload, source);
    });

    return { deliver, listen };
})();

const lairBusRouter = (() => {
    const appWindows = new Map();
    const windowToApp = new WeakMap();
    const pendingRequests = new Map();

    function removeWindowRegistration(targetWindow) {
        const appId = windowToApp.get(targetWindow);
        if (!appId) return;

        const windows = appWindows.get(appId);
        if (windows) {
            windows.delete(targetWindow);
            if (windows.size === 0) {
                appWindows.delete(appId);
            }
        }
    }

    function registerWindow(targetWindow, appId) {
        if (!targetWindow || !appId || typeof appId !== 'string') return;

        removeWindowRegistration(targetWindow);

        if (!appWindows.has(appId)) {
            appWindows.set(appId, new Set());
        }
        appWindows.get(appId).add(targetWindow);
        windowToApp.set(targetWindow, appId);
    }

    function postToWindow(targetWindow, payload) {
        if (!targetWindow) return false;
        try {
            targetWindow.postMessage({ __lairBus: true, payload }, '*');
            return true;
        } catch (error) {
            removeWindowRegistration(targetWindow);
            return false;
        }
    }

    function resolveTargets(sourceWindow, targetAppId, isBroadcast) {
        if (isBroadcast) {
            const allTargets = [];
            appWindows.forEach((windows) => {
                windows.forEach((registeredWindow) => {
                    allTargets.push(registeredWindow);
                });
            });
            return allTargets;
        }

        if (!targetAppId || !appWindows.has(targetAppId)) {
            return [];
        }

        return Array.from(appWindows.get(targetAppId));
    }

    function routeEvent(sourceWindow, payload) {
        const targets = resolveTargets(sourceWindow, payload.targetAppId, payload.broadcast === true);
        const sourceAppId = windowToApp.get(sourceWindow) || payload.source || 'unknown';

        if (payload.requestId) {
            const timeout = setTimeout(() => {
                pendingRequests.delete(payload.requestId);
            }, 30000);

            pendingRequests.set(payload.requestId, {
                sourceWindow,
                timeout
            });
        }

        const outbound = {
            kind: 'event',
            source: sourceAppId,
            event: payload.event,
            data: payload.data ?? null,
            requestId: payload.requestId || null
        };

        targets.forEach((targetWindow) => {
            postToWindow(targetWindow, outbound);
        });
    }

    function routeResponse(payload) {
        const pending = pendingRequests.get(payload.responseTo);
        if (!pending) return;

        clearTimeout(pending.timeout);
        pendingRequests.delete(payload.responseTo);

        postToWindow(pending.sourceWindow, {
            kind: 'response',
            source: payload.source || 'unknown',
            responseTo: payload.responseTo,
            data: payload.data ?? null
        });
    }

    window.addEventListener('message', (event) => {
        const { data, source } = event;
        if (!data || !data.__lairBus || !data.payload || !source) return;

        const payload = data.payload;
        if (payload.kind === 'register') {
            registerWindow(source, payload.appId);
            return;
        }

        if (payload.kind === 'event' && payload.event) {
            routeEvent(source, payload);
            return;
        }

        if (payload.kind === 'response' && payload.responseTo) {
            routeResponse(payload);
        }
    });

    return {
        registerWindow,
        routeEvent,
        routeResponse
    };
})();

// database functions

async function readAllData(db, storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.getAll();
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function erdbsfull(x) {
    if (x === "nowarning" || await justConfirm("Are you really sure?", "Removing all the users' data includes your settings, files, and other data. Click cancel to keep it.")) {
        localStorage.removeItem('todo');
        localStorage.removeItem('magicStrings');
        localStorage.removeItem('updver');
        localStorage.removeItem('qsets');

        const indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;
        const deleteRequest = indexedDB.deleteDatabase(CurrentUsername);

        const request = indexedDB.deleteDatabase('sharedDB');

        request.onerror = function () {
            console.error('Failed to delete database trojencat');
        };

        deleteRequest.onsuccess = () => location.reload();
        deleteRequest.onerror = deleteRequest.onblocked = () => location.reload();
    }
}

async function removeUser(username = CurrentUsername) {
    try {
        const magicStrings = JSON.parse(localStorage.getItem('magicStrings')) || {};
        delete magicStrings[username];
        localStorage.setItem('magicStrings', JSON.stringify(magicStrings));

        const deleteRequest = indexedDB.deleteDatabase(username);
        deleteRequest.onsuccess = function () {
            console.log(`Database for user ${username} deleted successfully.`);
            logoutoflair();
        };
        deleteRequest.onerror = function (event) {
            console.error(`Error deleting database for user ${username}:`, event.target.error);
        };
        deleteRequest.onblocked = function () {
            console.warn(`Deletion of database for user ${username} is blocked.`);
        };
        sharedStore.deleteUser(username);
    } catch (error) {
        console.error("Error in removeUser function:", error);
    }
}

function removeSWs() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations()
            .then(registrations => {
                const promises = registrations.map(registration =>
                    caches.keys()
                        .then(cacheNames => Promise.all(cacheNames.map(cacheName => caches.delete(cacheName))))
                        .then(() => registration.unregister())
                );
                return Promise.all(promises);
            })
            .then(() => {
                console.log('All service workers and caches have been removed.');
            })
            .catch(error => {
                console.error('Error:', error);
            });
    } else {
        console.log('Service workers not supported.');
    }
}

// Password and security

async function saveMagicStringInLocalStorage(password) {
    const cryptoKey = await getKey(password);
    const encryptedMagicString = await encryptData(cryptoKey, "magicString");

    let magicStrings = {
        iv: arrayBufferToBase64(encryptedMagicString.iv),
        data: arrayBufferToBase64(encryptedMagicString.data)
    };

    sharedStore.set(0, "magic", JSON.stringify(magicStrings));
}
async function checkPassword(password) {
    const encryptedMagicStringJSON = await sharedStore.get(0, "magic");
    if (!encryptedMagicStringJSON) {
        console.error(`Magic string not found for user: ${CurrentUsername}`);
        return false;
    }
    const encryptedMagicString = JSON.parse(encryptedMagicStringJSON);
    const cryptoKey = await getKey(password);
    try {
        console.log(536, encryptedMagicString)
        const decryptedMagicString = await decryptData(
            cryptoKey,
            {
                iv: base64ToArrayBuffer(encryptedMagicString.iv),
                data: base64ToArrayBuffer(encryptedMagicString.data)
            }
        );
        return decryptedMagicString === "magicString";
    } catch (error) {
        return console.error(error);
        ;
    }
}

async function removeInvalidMagicStrings() {
    const magicStrings = JSON.parse(await sharedStore.get(0, "magic"));
    if (!magicStrings) return;
    localStorage.setItem('magicStrings', null);
}
async function changePassword(oldPassword, newPassword) {
    lethalpasswordtimes = true;

    if (!await checkPassword(oldPassword)) {
        lethalpasswordtimes = false;
        return false;
    }

    try {
        const oldKey = await getKey(oldPassword);
        const newKey = await getKey(newPassword);
        1
        if (!dbCache) {
            dbCache = await openDB(CurrentUsername, 1);
        }

        const transaction = dbCache.transaction('contentpool', 'readonly');
        const store = transaction.objectStore('contentpool');

        const contentPool = {};

        await new Promise((resolve, reject) => {
            const request = store.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    contentPool[cursor.key] = cursor.value;
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });

        const updatedContentPool = {};

        for (const [id, record] of Object.entries(contentPool)) {
            const encryptedData = record.value;  // unwrap here

            if (
                !encryptedData ||
                !(encryptedData.iv instanceof ArrayBuffer) ||
                !(encryptedData.data instanceof ArrayBuffer)
            ) {
                console.warn(`Skipping invalid entry ${id}:`, encryptedData);
                continue;
            }

            try {
                const decryptedContent = await decryptData(oldKey, encryptedData);
                const reEncryptedData = await encryptData(newKey, decryptedContent);
                updatedContentPool[id] = { key: id, value: reEncryptedData }; // wrap on write
            } catch (error) {
                console.error(`Error processing file ${id}:`, error);
                throw error;
            }
        }


        const writeTransaction = dbCache.transaction('contentpool', 'readwrite');
        const writeStore = writeTransaction.objectStore('contentpool');

        await new Promise((resolve, reject) => {
            writeTransaction.oncomplete = resolve;
            writeTransaction.onerror = () => reject(writeTransaction.error);
            writeTransaction.onabort = () => reject(writeTransaction.error);

            for (const wrappedData of Object.values(updatedContentPool)) {
                writeStore.put(wrappedData);
            }

        });

        password = newPassword;
        dbCache = null;
        cryptoKeyCache = null;

        await saveMagicStringInLocalStorage(newPassword);

        eventBusWorker.deliver({
            type: "memory",
            event: "update",
            id: "passwordChange"
        });

    } catch (error) {
        console.error("Error during password change:", error);
        lethalpasswordtimes = false;
        return false;
    }

    lethalpasswordtimes = false;
    return true;
}

// memory collector

let MemoryTimeCache = null;
let isFetchingMemory = false;
let cachedData = null;
function getTime() {
    return Date.now();
}
async function fetchmmData() {
    try {
        const data = await getdb();
        MemoryTimeCache = getTime();
        cachedData = data;
        return data ?? null;
    } catch (error) {
        console.error("Memory data unreadable", error);
        return 3;
    } finally {
        isFetchingMemory = false;
    }
}
async function updateMemoryData() {
    if (MemoryTimeCache === null || (getTime() - MemoryTimeCache) >= 1000) {
        if (!isFetchingMemory) {
            isFetchingMemory = true;
            return fetchmmData();
        } else {
            while (isFetchingMemory) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
    }
    return cachedData;
}

function parseEscapedJsonString(escapedString) {
    if (escapedString.startsWith('"') && escapedString.endsWith('"')) {
        escapedString = escapedString.slice(1, -1);
    }
    try {
        return JSON.parse(escapedString);
    } catch {
        return null;
    }
}
async function getdbWithDefault(CurrentUsername, storeName, key, defaultValue) {
    try {
        const db = await ensureObjectStore(CurrentUsername, storeName);
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    resolve(result.value);
                } else {
                    resolve(defaultValue);
                }
            };

            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        return defaultValue;
    }
}

// settings
const settingsTaskQueue = [];
let isProcessingTask = false;

async function processTask() {
    if (isProcessingTask) return;
    isProcessingTask = true;

    while (settingsTaskQueue.length > 0) {
        const { action, resolve, reject } = settingsTaskQueue.shift();
        try {
            const result = await action();
            resolve(result);
        } catch (error) {
            reject(error);
        }
    }

    isProcessingTask = false;

    if (settingsTaskQueue.length > 0) {
        queueMicrotask(processTask);
    }
}

function enqueueTask(action) {
    return new Promise((resolve, reject) => {
        settingsTaskQueue.push({ action, resolve, reject });
        if (!isProcessingTask) processTask();
    });
}

const defaultFileData = {
    "System/AppRegistry.json": {
    },
    "System/preferences.json": {
        "defFileLayout": "List",
        "wsnapping": true,
        "smartsearch": true,
        "CamImgFormat": "WEBP",
        "defSearchEngine": "NWP",
        "nvaupdcheck": true,
        "windowloader": true,
        "keepvisible": true
    }
};
async function ensureFileExists(fileName = "preferences.json", dirPath = "System/") {
    await updateMemoryData();
    try {
        const pathParts = dirPath.split('/').filter(Boolean);
        let currentPath = memory.root;

        for (let part of pathParts) {
            part += "/";
            if (!currentPath[part]) {
                currentPath[part] = {};
            }
            currentPath = currentPath[part];
        }

        if (!currentPath[fileName]) {
            const fullPath = `${dirPath}${fileName}`;
            const defaultData = defaultFileData[fullPath] || {};
            const fileDataUri = encodeToBase64DataUri(JSON.stringify(defaultData));
            await createFile(dirPath, fileName, "json", fileDataUri);
            await updateMemoryData();
        }
    } catch (err) {
        console.error(`Error ensuring file ${fileName} exists in ${dirPath}:`, err);
    }
}

const pendingFetches = new Map();
const settingCache = new Map();

var sessionSettings = {};
var sessionSettingKeys = ["wsnapping", "smartsearch", "keepvisible", "windowoutline"];
let sessionSettingsLoaded = false;

async function loadSessionSettings(fileName = "preferences.json", dirPath = "System/") {
    if (sessionSettingsLoaded) return;
    const allSettings = await getSetting("full", fileName, dirPath);
    if (!allSettings) return;
    for (const key of sessionSettingKeys) {
        if (key && key in allSettings) sessionSettings[key] = allSettings[key];
    }
    sessionSettingsLoaded = true;
}

async function getSetting(settingKey, fileName = "preferences.json", dirPath = "System/") {

    if (sessionSettingKeys.includes(settingKey)) {
        await loadSessionSettings(fileName, dirPath);
        return sessionSettings[settingKey] ?? null;
    }

    const cacheKey = `${dirPath}/${fileName}:${settingKey}`;
    const cached = settingCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < 2500) return cached.value;

    if (pendingFetches.has(cacheKey)) return pendingFetches.get(cacheKey);

    const fetchPromise = enqueueTask(async () => {
        try {
            await ensureFileExists(fileName, dirPath);
            const pathParts = dirPath.split('/').filter(Boolean);
            let currentPath = memory.root;

            for (let part of pathParts) {
                part += "/";
                if (!currentPath[part]) return null;
                currentPath = currentPath[part];
            }

            const fileContent = currentPath[fileName];
            if (!fileContent) return null;

            const base64Data = await ctntMgr.get(fileContent.id);
            if (!base64Data) return null;

            const fileSettings = JSON.parse(decodeBase64Content(base64Data));
            if (!fileSettings || typeof fileSettings !== 'object') return null;

            if (settingKey === 'full') return fileSettings;
            if (!(settingKey in fileSettings)) return null;

            const settingValue = fileSettings[settingKey];
            settingCache.set(cacheKey, { value: settingValue, timestamp: Date.now() });
            return settingValue;
        } catch (error) {
            console.error("getSetting error:", error);
            return null;
        }
        finally {
            pendingFetches.delete(cacheKey);
        }
    });

    pendingFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
}

async function setSetting(settingKey, settingValue, fileName = "preferences.json", dirPath = "System/") {
    return enqueueTask(async () => {
        try {
            await ensureFileExists(fileName, dirPath);
            await updateMemoryData();

            const pathParts = dirPath.split('/').filter(Boolean);
            let currentPath = memory.root;

            for (let part of pathParts) {
                part = part.endsWith("/") ? part : part + "/";
                if (!currentPath[part]) {
                    console.error(`Folder ${part} not found in memory.`);
                    return;
                }
                currentPath = currentPath[part];
            }

            const fileContent = currentPath[fileName];
            if (!fileContent || !fileContent.id) {
                console.error(`File ${fileName} not found in memory at ${dirPath}`);
                return;
            }

            let fileSettings = {};

            const existingBase64Data = await ctntMgr.get(fileContent.id);
            if (existingBase64Data) {
                fileSettings = JSON.parse(decodeBase64Content(existingBase64Data));
            }

            fileSettings[settingKey] = settingValue;
            const newBase64Data = encodeToBase64DataUri(JSON.stringify(fileSettings));
            await ctntMgr.set(fileContent.id, newBase64Data);

            await setdb(`set setting ${settingKey} in ${fileName}`);
            eventBusWorker.deliver({
                type: "settings",
                event: "set",
                file: fileName,
                key: settingKey
            });
        } catch (error) {
            console.error(`Error in setSetting for ${fileName}:`, error);
        }
    });
}

async function remSettingKey(settingKey, fileName = "preferences.json", dirPath = "System/") {
    return enqueueTask(async () => {
        try {
            await ensureFileExists(fileName, dirPath);
            const pathParts = dirPath.split('/').filter(Boolean);
            let currentPath = memory.root;

            for (let part of pathParts) {
                part += "/"
                if (!currentPath[part]) {
                    console.error(`Folder ${part} not found in memory.`);
                    return;
                }
                currentPath = currentPath[part];
            }

            const fileContent = currentPath[fileName];

            if (!fileContent) return;

            let fileSettings = JSON.parse(decodeBase64Content(await ctntMgr.get(fileContent.id)));

            if (fileSettings[settingKey] !== undefined) {
                delete fileSettings[settingKey];

                const updatedBase64Data = encodeToBase64DataUri(JSON.stringify(fileSettings));
                await ctntMgr.set(fileContent.id, updatedBase64Data);

                await setdb(`remove setting ${settingKey} in ${fileName}`);
                eventBusWorker.deliver({
                    type: "settings",
                    event: "remove",
                    file: fileName,
                    key: settingKey
                });
            }
        } catch (error) {
            console.error(`Error removing setting from ${fileName}:`, error);
        }
    });
}

async function resetSettings(fileName = "preferences.json", dirPath = "System/") {
    return enqueueTask(async () => {
        try {
            await ensureFileExists(fileName, dirPath);
            const fullPath = `${dirPath}${fileName}`;
            const defaultData = defaultFileData[fullPath] || {};

            const resetBase64Data = encodeToBase64DataUri(JSON.stringify(defaultData));
            const pathParts = dirPath.split('/').filter(Boolean);
            let currentPath = memory.root;

            for (let part of pathParts) {
                part += "/"
                if (!currentPath[part]) {
                    console.error(`Folder ${part} not found in memory.`);
                    return;
                }
                currentPath = currentPath[part];
            }

            const fileContent = currentPath[fileName];
            await ctntMgr.set(fileContent.id, resetBase64Data);

            await setdb(`reset settings in ${fileName}`);
            eventBusWorker.deliver({
                type: "settings",
                event: "reset",
                file: fileName
            });
        } catch (error) {
            console.error(`Error resetting settings in ${fileName}:`, error);
        }
    });
}

async function resetAllSettings() {
    return enqueueTask(async () => {
        try {
            for (const fullPath in defaultFileData) {
                const lastSlashIndex = fullPath.lastIndexOf("/");
                const dirPath = fullPath.substring(0, lastSlashIndex + 1);
                const fileName = fullPath.substring(lastSlashIndex + 1);
                const defaultData = defaultFileData[fullPath] || {};

                const resetBase64Data = encodeToBase64DataUri(JSON.stringify(defaultData));
                const fileContent = memory.root[dirPath]?.[fileName];

                if (fileContent) {
                    await ctntMgr.set(fileContent.id, resetBase64Data);
                    await setdb(`reset settings in ${fileName}`);
                    eventBusWorker.deliver({
                        type: "settings",
                        event: "reset",
                        file: fileName
                    });
                }
            }
        } catch (error) {
            console.error("Error resetting all settings files:", error);
        }
    });
}

async function ensureAllSettingsFilesExist() {
    return enqueueTask(async () => {
        try {
            for (const fullPath in defaultFileData) {
                const lastSlashIndex = fullPath.lastIndexOf("/");
                const dirPath = fullPath.substring(0, lastSlashIndex + 1);
                const fileName = fullPath.substring(lastSlashIndex + 1);
                await ensureFileExists(fileName, dirPath);
            }
        } catch (error) {
            console.error("Error ensuring all settings files exist:", error);
        }
    });
}

var appStorage = {
    get: async (key, context) => {
        context = notificationContext[context];
        if (!key) key = 'full';
        console.log(key, context)
        return await getSetting(key, context.appID + ".json", "System/appData/")
    },
    remove: async (key, context) => {
        context = notificationContext[context];
        if (!key) return null;
        await remSettingKey(key, context.appID + ".json", "System/appData/")
    },
    removeStorage: async (key, context) => {
        context = notificationContext[context];
        if (!key) return null;
        await remfile((await getFileByPath("System/appData/" + context.appID + ".json").id))
    },
    set: async (key, value, context) => {
        context = notificationContext[context];
        console.log(3597, context, key)
        if (!key) return null;
        await setSetting(key, value, context.appID + ".json", "System/appData/")
    }
}

// memory management

async function getFileNamesByFolder(folderPath) {
    folderPath = folderPath.endsWith('/') ? folderPath : folderPath + '/';
    try {
        const root = memory["root"];
        const folderNames = folderPath.split('/').filter(Boolean);
        let currentFolder = root;

        for (const name of folderNames) {
            if (!currentFolder[name + '/']) {
                console.warn("Key not found:", name + '/');
                return [];
            }
            currentFolder = currentFolder[name + '/'];
        }

        return Object.entries(currentFolder).map(([fileName, file]) => {
            const fileData = { name: fileName };
            if (file.id) fileData.id = file.id;
            if (file.metadata) fileData.metadata = file.metadata;
            return fileData;
        });
    } catch (error) {
        console.error("Error fetching data:", error);
        return null;
    }
}

async function getAllItemsInFolder(folderPath) {
    console.log(folderPath);
    folderPath = folderPath.endsWith('/') ? folderPath : folderPath + '/';

    try {
        const root = memory["root"];
        const folderNames = folderPath.split('/').filter(Boolean);
        let currentFolder = root;

        for (const name of folderNames) {
            const key = name + '/';
            if (!currentFolder[key]) {
                console.warn("Key not found:", key);
                return [];
            }
            currentFolder = currentFolder[key];
        }

        return Object.entries(currentFolder).map(([key, value]) => {
            const isFolder = typeof value === 'object' && !value.id;
            const item = {
                name: key,
                type: isFolder ? 'folder' : 'file',
                path: folderPath
            };

            if (!isFolder) {
                if (value.id) item.id = value.id;
                if (value.metadata) item.metadata = value.metadata;
            } else {
                item.path += item.name;
            }

            return item;
        });
    } catch (error) {
        console.error("Error fetching data:", error);
        return null;
    }
}

async function getFileByPath(path) {
    await updateMemoryData();
    const segments = path.split('/').filter(segment => segment);
    let current = memory.root;
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const isLastSegment = i === segments.length - 1;
        if (current[segment + '/'] && !isLastSegment) {
            current = current[segment + '/'];
        } else if (current[segment] && isLastSegment) {
            return current[segment];
        } else {
            return null;
        }
    }
    return null;
}
async function getFileById(id, dataType) {
    if (!id) return 0;
    await updateMemoryData();
    const fileDetails = await findFileDetails(id, memory.root, dataType);
    if (!fileDetails) return 3;
    return {
        fileName: fileDetails.fileName,
        id: fileDetails.id,
        content: fileDetails.content,
        metadata: fileDetails.metadata,
        path: fileDetails.path
    };

}
async function findFileDetails(id, folder, dataType, currentPath = '') {
    for (let key in folder) {
        const item = folder[key];
        if (item && typeof item === 'object') {
            if (item.id === id) {
                return {
                    fileName: key,
                    id: item.id,
                    content: !dataType || dataType === 'content' ? await ctntMgr.get(id) : undefined,
                    metadata: item.metadata,
                    path: currentPath
                };

            } else if (key.endsWith('/')) {
                const result = await findFileDetails(id, item, dataType, currentPath + key);
                if (result) return result;
            }
        }
    }
    return null;
}
async function getFileNameByID(id) {
    if (!id) return undefined;
    await updateMemoryData();
    function findFileName(id, folder, currentPath = '') {
        for (let key in folder) {
            const item = folder[key];
            if (item && typeof item === 'object') {
                if (item.id === id) {
                    return key;
                } else if (key.endsWith('/')) {
                    const result = findFileName(id, item, currentPath + key);
                    if (result) return result;
                }
            }
        }
        return null;
    }
    return findFileName(id, memory.root);
}
async function getFolderNames() {
    try {
        await updateMemoryData();
        const folderNames = [];
        for (const key in memory.root) {
            if (key.endsWith('/')) {
                folderNames.push(key);
            }
        }
        return folderNames;
    } catch (error) {
        console.error("Error fetching data:", error);
        return null;
    }
}
async function moveFileToFolder(flid, dest) {
    console.log("Moving file: " + flid + " to: " + dest);
    let fileToMove = await getFileById(flid);
    if (!fileToMove) return; // Ensure the file exists
    let removeoutput = await remfile(flid);
    await createFile(dest, fileToMove.fileName, fileToMove.type, fileToMove.content, fileToMove.metadata);
    eventBusWorker.deliver({
        "type": "memory",
        "event": "update",
        "id": "moveFile",
        "key": dest
    });
}
async function remfile(ID) {
    try {
        await updateMemoryData();
        let fileParent = null, name;
        function removeFileFromFolder(folder) {
            for (const [name, content] of Object.entries(folder)) {
                if (name.endsWith('/')) {
                    if (removeFileFromFolder(content)) return true;
                } else if (content.id === ID) {
                    delete folder[name];
                    fileParent = folder;
                    ctntMgr.remove(content.id);
                    console.log("File eliminated.");
                    return true;
                }
            }
            return false;
        } ``
        let filedat = await getFileNameByID(ID);
        if (mtpetxt(filedat) == "app") {
            await safeRemoveApp(ID)
        }
        let fileRemoved = removeFileFromFolder(memory.root);
        if (!fileRemoved) {
            console.error(`File with ID "${ID}" not found.`);
        } else {
            await setdb("remove file");
            eventBusWorker.deliver({
                "type": "memory",
                "event": "update",
                "id": "removeFile",
                "key": fileParent[name]
            });
        }
    } catch (error) {
        console.error("Error fetching or updating data:", error);
    }
}
async function remfolder(folderPath) {
    try {
        await updateMemoryData();
        let parts = folderPath.split('/').filter(part => part);
        let current = memory.root;
        let parent = null;
        let key = null;
        for (let i = 0; i < parts.length; i++) {
            let part = parts[i] + '/';
            if (current.hasOwnProperty(part)) {
                parent = current;
                key = part;
                current = current[part];
            } else {
                console.error(`Folder "${folderPath}" not found.`);
                return;
            }
        }
        async function removeAllFiles(folder) {
            for (const [name, content] of Object.entries(folder)) {
                if (name.endsWith('/')) {
                    await removeAllFiles(content);
                } else if (content.id) {
                    ctntMgr.remove(content.id);
                }
            }
        }
        await removeAllFiles(current);
        if (parent && key) {
            delete parent[key];
            console.log(`Folder Eliminated: "${folderPath}"`);
        } else {
            console.error(`Unable to delete folder "${folderPath}".`);
            return;
        }
        await setdb("remove folder");
        eventBusWorker.deliver({
            "type": "memory",
            "event": "update",
            "id": "removeFolder",
            "key": folderPath
        });
    } catch (error) {
        console.error("Error removing folder:", error);
    }
}

async function updateFile(folderName, fileId, newData) {
    await updateMemoryData();

    function findFile(folder, fileId) {
        for (let key in folder) {
            if (typeof folder[key] === 'object' && folder[key] !== null) {
                if (folder[key].id === fileId) {
                    return { parent: folder, key: key };
                } else if (key.endsWith('/') && typeof folder[key] === 'object') {
                    let result = findFile(folder[key], fileId);
                    if (result) {
                        return result;
                    }
                }
            }
        }
        return null;
    }

    try {
        let targetFolder = memory.root;
        if (!folderName) {
            let filePath = await getFileById(fileId, "path");
            if (!filePath || !filePath.path) {
                throw new Error(`File with ID "${fileId}" not found.`);
            }
            folderName = filePath.path;
        }

        let folderNames = folderName.split('/');
        for (let name of folderNames) {
            if (name) {
                targetFolder = targetFolder[name + '/'];
                if (!targetFolder) {
                    throw new Error(`Folder "${name}" not found.`);
                }
            }
        }

        let fileLocation = findFile(targetFolder, fileId);
        if (fileLocation) {
            let fileToUpdate = fileLocation.parent[fileLocation.key];

            // Update metadata only if newData.metadata is defined and has properties
            if (newData.metadata && Object.keys(newData.metadata).length > 0) {
                fileToUpdate.metadata = newData.metadata;
            }

            // Update the fileName if provided; handle key change in the parent object
            if (newData.fileName && newData.fileName !== fileLocation.key) {
                fileToUpdate.fileName = newData.fileName;
                fileLocation.parent[newData.fileName] = fileToUpdate;
                delete fileLocation.parent[fileLocation.key];
            } else {
                fileToUpdate.fileName = fileLocation.key; // Keep the original key if no update
            }

            // Update type if provided
            if (newData.type) {
                fileToUpdate.type = newData.type;
            }

            // Update content if provided
            if (newData.content !== undefined) {
                await ctntMgr.set(fileId, newData.content);
            }
            await setdb("modify file");
            eventBusWorker.deliver({
                "type": "memory",
                "event": "update",
                "id": "updateFile"
            });
            console.log(`Modified: "${fileToUpdate.fileName}"`);
        } else {
            console.log(`Creating New: "${fileId}"`);
            targetFolder[newData.fileName || `NewFile_${fileId}`] = {
                id: fileId,
                metadata: newData.metadata ? JSON.stringify(newData.metadata) : '',
                type: newData.type || ''
            };

            await ctntMgr.set(fileId, newData.content || '');
            await setdb("create new file");
            eventBusWorker.deliver({
                "type": "memory",
                "event": "update",
                "id": "`createFile`"
            });
        }
    } catch (error) {
        console.error("Error updating file:", error);
    }
}
async function createFile(folderName, fileName, type, content, metadata = {}) {
    console.log("creating:", fileName, "in", folderName);

    folderName = folderName.endsWith('/') ? folderName : folderName + '/';
    const fileNameWithExtension = fileName.includes('.') ? fileName : `${fileName}.${type || ''}`.trim();
    if (!fileNameWithExtension) return null;

    const ext = fileNameWithExtension.split('.').pop().toLowerCase();
    const mimeType = await getMimeType(ext);
    const baseFileType = await getbaseflty(fileNameWithExtension);

    await updateMemoryData();
    await createFolder(folderName);

    const parts = folderName.split('/').filter(Boolean);
    let current = memory.root;
    for (const part of parts) {
        const folderKey = part + '/';
        if (!current[folderKey]) current[folderKey] = {};
        current = current[folderKey];
    }

    try {
        let fileData = content;

        if (!(content instanceof Blob) && !isBase64(content) && !["image", "video", "music", "audio"].includes(baseFileType)) {
            const blob = new Blob([content], { type: mimeType });
            const arrayBuffer = await blob.arrayBuffer();
            const binary = new Uint8Array(arrayBuffer);
            let binaryString = '';
            for (let i = 0; i < binary.length; i++) binaryString += String.fromCharCode(binary[i]);
            fileData = `data:${mimeType};base64,` + btoa(binaryString);
        }

        return await handleFile(current, folderName, fileNameWithExtension, fileData, type, metadata);
    } catch (error) {
        console.error("Error in createFile:", error);
        return null;
    }

    async function handleFile(folder, folderName, fileNameWithExtension, contentData, type, metadata) {
        metadata.datetime = getfourthdimension();

        const extIndex = fileNameWithExtension.lastIndexOf(".");
        if (extIndex !== -1) {
            fileNameWithExtension = fileNameWithExtension.slice(0, extIndex) + fileNameWithExtension.slice(extIndex).toLowerCase();
        }

        if (ext === "app") {
            const appData = await getFileByPath(`Apps/${fileNameWithExtension}`);
            if (appData) {
                await updateFile("Apps/", appData.id, { metadata, content: contentData, fileName: fileNameWithExtension, type });
                console.log(52084, fileNameWithExtension);
                await extractAndRegisterCapabilities(appData.id, contentData);
                return appData.id || null;
            }
        }

        const existingFile = Object.values(folder).find(file => file.fileName === fileNameWithExtension);
        if (existingFile) {
            await updateFile(folderName, existingFile.id, { metadata, content: contentData, fileName: fileNameWithExtension, type });
            folder[fileNameWithExtension] = { id: existingFile.id, type, metadata };
            return existingFile.id;
        } else {
            const uid = genUID();
            memory.root = { ...memory.root };
            folder[fileNameWithExtension] = { id: uid, type, metadata };
            await ctntMgr.set(uid, contentData);

            if (ext === "app") {
                await extractAndRegisterCapabilities(uid, contentData);
            }

            await setdb("handling file: " + fileNameWithExtension);
            eventBusWorker.deliver({ type: "memory", event: "update", id: "updateFile", key: folderName });
            return uid;
        }
    }

}

const createFolderQueue = [];
let isProcessingCreateFolderQueue = false;
async function createFolder(folderNames, folderData = {}) {
    return new Promise((resolve, reject) => {
        createFolderQueue.push({ folderNames, folderData, resolve, reject });
        processCreateFolderQueue();
    });
}

async function processCreateFolderQueue() {
    if (isProcessingCreateFolderQueue || createFolderQueue.length === 0) {
        return;
    }

    isProcessingCreateFolderQueue = true;
    const { folderNames, folderData, resolve, reject } = createFolderQueue.shift();

    try {
        await updateMemoryData();

        const folderList = Array.isArray(folderNames) || folderNames instanceof Set
            ? Array.from(folderNames)
            : [folderNames];

        for (const folderName of folderList) {
            const parts = folderName.split('/').filter(Boolean);
            let current = memory.root;

            for (let i = 0; i < parts.length; i++) {
                const folderKey = parts[i] + '/';
                current[folderKey] = current[folderKey] || {};
                current = current[folderKey];
            }

            const insertData = (target, data, seen = new WeakSet()) => {
                if (seen.has(data)) return;
                seen.add(data);

                for (const key in data) {
                    const value = data[key];
                    if (typeof value === 'object' && value !== null) {
                        target[key] = target[key] || {};
                        insertData(target[key], value, seen);
                    } else {
                        target[key] = value;
                    }
                }
            };

            if (folderData && typeof folderData === 'object') {
                insertData(current, folderData);
            }
        }

        await setdb("making folders");

        eventBusWorker.deliver({
            type: "memory",
            event: "update",
            id: "createFolder",
            key: folderList,
        });

        resolve(true);
    } catch (error) {
        console.error("Error creating folders and data:", error);
        reject(error);
    } finally {
        isProcessingCreateFolderQueue = false;
        processCreateFolderQueue();
    }
}

// other

function dragfl(ev, obj) {
    ev.dataTransfer.setData("Text", obj.getAttribute('unid'));
}
async function crashScreen(err) {
    closeallwindows();
    await say(`
        <h1>Your System is curropt.</h1>
        <p>Reload your lairOS to continue.<p>
        <code>${err}</code>
        `, "failed");
    if (badlaunch) { return }
    location.reload()
}