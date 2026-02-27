/*
 * Ultraviolet Config for PumpOS
 * Using public bare servers from the Titanium Network community
 */

self.__uv$config = {
  // Bare server
  bare: [
    "https://openbare.xyz/bare/",
  ],
  
  // Prefix for proxied URLs
  prefix: "/uv/service/",
  
  // URL encoding/decoding - use Ultraviolet codec if available, fallback to xor
  encodeUrl: typeof Ultraviolet !== 'undefined' ? Ultraviolet.codec.xor.encode : (str => {
    let result = '';
    for (let i = 0; i < str.length; i++) {
      if (i % 2) {
        result += String.fromCharCode(str.charCodeAt(i) ^ 2);
      } else {
        result += str.charAt(i);
      }
    }
    return encodeURIComponent(result);
  }),
  decodeUrl: typeof Ultraviolet !== 'undefined' ? Ultraviolet.codec.xor.decode : (str => {
    const decoded = decodeURIComponent(str);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      if (i % 2) {
        result += String.fromCharCode(decoded.charCodeAt(i) ^ 2);
      } else {
        result += decoded.charAt(i);
      }
    }
    return result;
  }),
  
  // Handler script path
  handler: "/uv/uv.handler.js",
  
  // Client bundle path
  client: "/uv/uv.client.js",
  
  // Service worker bundle path  
  sw: "/uv/uv.sw.js",
};
