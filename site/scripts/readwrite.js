let dbCache = null;
let cryptoKeyCache = null;
const key = 'dataStore';

async function openDB(CurrentUsername = "Admin", version) {
    console.log(`Opening DB for user: ${CurrentUsername}, version: ${version}`);
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(CurrentUsername, version);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains('contentpool')) {
                db.createObjectStore('contentpool', { keyPath: 'key' });
            }

            if (!db.objectStoreNames.contains('memory')) {
                db.createObjectStore('memory', { keyPath: 'key' });
            }
        };

        request.onsuccess = async (event) => {
            const db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => reject(event.target.error);
    });
}

async function openSharedDB(version = 1) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('sharedDB', version);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('data')) {
                db.createObjectStore('data', { keyPath: 'key' });
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

window.sharedStore = {
    async get(username, key) {
        if (username === 0 || username === undefined) username = CurrentUsername;
        const db = await openSharedDB();
        const tx = db.transaction('data', 'readonly');
        const store = tx.objectStore('data');
        const request = store.get(username);
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const data = request.result ? request.result.value : {};
                resolve(key ? data[key] : data);
            };
            request.onerror = () => reject(request.error);
        });
    },

    async set(username, key, value) {
        if (username === 0 || username === undefined) username = CurrentUsername;
        const db = await openSharedDB();
        const tx = db.transaction('data', 'readwrite');
        const store = tx.objectStore('data');
        const getRequest = store.get(username);
        return new Promise((resolve, reject) => {
            getRequest.onsuccess = () => {
                const data = getRequest.result ? getRequest.result.value : {};
                data[key] = value;
                const putRequest = store.put({ key: username, value: data });
                putRequest.onsuccess = resolve;
                putRequest.onerror = () => reject(putRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    },

    async remove(username, key) {
        if (username === 0 || username === undefined) username = CurrentUsername;
        const db = await openSharedDB();
        const tx = db.transaction('data', 'readwrite');
        const store = tx.objectStore('data');
        const getRequest = store.get(username);
        return new Promise((resolve, reject) => {
            getRequest.onsuccess = () => {
                const data = getRequest.result ? getRequest.result.value : {};
                if (key in data) {
                    delete data[key];
                    const putRequest = store.put({ key: username, value: data });
                    putRequest.onsuccess = resolve;
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve();
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    },

    async deleteUser(username) {
        if (username === 0 || username === undefined) username = CurrentUsername;
        const db = await openSharedDB();
        const tx = db.transaction('data', 'readwrite');
        const store = tx.objectStore('data');
        const request = store.delete(username);
        return new Promise((resolve, reject) => {
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
        });
    },

    async getAllUsers() {
        const db = await openSharedDB();
        const tx = db.transaction('data', 'readonly');
        const store = tx.objectStore('data');
        const request = store.getAllKeys();
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const keys = request.result.filter(key => key !== 'userList');
                resolve(keys);
            };
            request.onerror = () => reject(request.error);
        });
    }
};

async function flushDB(value) {
    if (!dbCache) dbCache = await openDB(CurrentUsername, 1);
    if (!cryptoKeyCache) cryptoKeyCache = await getKey(password);

    const transaction = dbCache.transaction('memory', 'readwrite');
    const store = transaction.objectStore('memory');
    const request = store.put({ key: 'memory', memory: value.memory });

    return new Promise((resolve, reject) => {
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
    });
}

async function getdb() {
    if (!dbCache) dbCache = await openDB(CurrentUsername, 1);
    if (!cryptoKeyCache) cryptoKeyCache = await getKey(password);

    const transaction = dbCache.transaction('memory', 'readonly');
    const store = transaction.objectStore('memory');
    const request = store.get('memory');

    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            memory = request.result ? request.result.memory : null;
            resolve(memory);
        };
        request.onerror = () => reject(request.error);
    });
}

function setdb(x) {
    const value = {
        memory: { ...memory }
    };

    return flushDB(value)
        .catch(error => console.error("Error during setdb execution:", error));
}

let requestQueue = [];
let isProcessing = false;

async function processQueue() {
    if (isProcessing || requestQueue.length === 0) {
        return;
    }

    isProcessing = true;

    while (requestQueue.length > 0) {
        const { resolve, reject, action, args } = requestQueue.shift();
        try {
            const result = await action(...args);
            resolve(result);
        } catch (error) {
            reject(error);
        }
    }

    isProcessing = false;
}

async function enqueueRequest(action, args) {
    return new Promise((resolve, reject) => {
        requestQueue.push({ resolve, reject, action, args });
        processQueue();
    });
}

const workerScript = `

async function getKey(password) {
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: encoder.encode("salt"),
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}
function bufferToBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}
async function encryptData(key, data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    let encoded;

    if (typeof data === 'string') {
        encoded = new TextEncoder().encode(data);
    } else if (data instanceof Blob) {
        encoded = new Uint8Array(await data.arrayBuffer());
    } else if (data instanceof Uint8Array || ArrayBuffer.isView(data)) {
        encoded = new Uint8Array(data.buffer);
    } else {
        throw new Error("Unsupported data type for encryption");
    }

    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoded
    );

    return {
        iv: iv.buffer,
        data: encrypted
    };
}

async function decryptData(key, encryptedData) {
    try {
        const iv = new Uint8Array(encryptedData.iv);
        const data = encryptedData.data;

        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            data
        );

        try {
            return new TextDecoder().decode(decrypted);
        } catch {
            return new Uint8Array(decrypted);
        }
    } catch (error) {
        console.error("Decryption failed:", error);
        throw new Error('Incorrect password or corrupted data');
    }
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    try {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    } catch (e) {
        console.error("Invalid base64 input:", base64);
        throw e;
    }
}


self.addEventListener('message', async (e) => {
    const { type, content, key } = e.data;
    try {
        let result;
        switch (type) {
            case 'encrypt':
                result = await encryptData(key, content);
                break;
            case 'decrypt':
                result = await decryptData(key, content);
                break;
            default:
                throw new Error('Unknown operation');
        }
        self.postMessage({ success: true, result }, 
            result && result.data instanceof ArrayBuffer && result.iv instanceof ArrayBuffer
                ? [result.data, result.iv]
                : []
        );
    } catch (err) {
        self.postMessage({ success: false, error: err.message });
    }
});
`;
const worker = new Worker(URL.createObjectURL(new Blob([workerScript], { type: 'application/javascript' })));

function runWorker(type, content, key) {
    return new Promise((resolve, reject) => {
        worker.onmessage = (e) => {
            const { success, result, error } = e.data;
            success ? resolve(result) : reject(new Error(error));
        };

        worker.onerror = (err) => {
            reject(err);
        };

        const transferables = [];
        if (type === 'encrypt' && content instanceof Uint8Array) {
            transferables.push(content.buffer);
        } else if (type === 'decrypt') {
            if (content.data instanceof ArrayBuffer) transferables.push(content.data);
            if (content.iv instanceof ArrayBuffer) transferables.push(content.iv);
        }

        worker.postMessage({ type, content, key }, transferables);
    });
}

async function getFileContents(id) {
    if (!dbCache) dbCache = await openDB(CurrentUsername, 1);
    if (!cryptoKeyCache) cryptoKeyCache = await getKey(password);

    const transaction = dbCache.transaction('contentpool', 'readonly');
    const store = transaction.objectStore('contentpool');
    const request = store.get(id);

    return new Promise((resolve, reject) => {
        request.onsuccess = async () => {
            if (request.result) {
                const { value } = request.result;
                try {
                    const result = await runWorker('decrypt', value, cryptoKeyCache);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            } else {
                reject(new Error('File not found'));
            }
        };
        request.onerror = () => reject(request.error);
    });
}

async function setFileContents(id, content) {
    if (!dbCache) dbCache = await openDB(CurrentUsername, 1);
    if (!cryptoKeyCache) cryptoKeyCache = await getKey(password);

    const dataToStore = await runWorker('encrypt', content, cryptoKeyCache);

    const transaction = dbCache.transaction('contentpool', 'readwrite');
    const store = transaction.objectStore('contentpool');
    const request = store.put({ key: id, value: dataToStore });

    return new Promise((resolve, reject) => {
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
    });
}

async function removeFileContents(id) {
    if (!dbCache) dbCache = await openDB(CurrentUsername, 1);

    const transaction = dbCache.transaction('contentpool', 'readwrite');
    const store = transaction.objectStore('contentpool');
    const request = store.delete(id);

    return new Promise((resolve, reject) => {
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
    });
}

const ctntMgr = {
    async get(id) {
        try {
            return await enqueueRequest(getFileContents, [id]);
        } catch (error) {
            throw error;
        }
    },

    async set(id, content) {
        try {
            return await enqueueRequest(setFileContents, [id, content]);
        } catch (error) {
            throw error;
        }
    },

    async remove(id) {
        try {
            return await enqueueRequest(removeFileContents, [id]);
        } catch (error) {
            throw error;
        }
    }
};
