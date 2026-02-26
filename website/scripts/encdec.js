
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
