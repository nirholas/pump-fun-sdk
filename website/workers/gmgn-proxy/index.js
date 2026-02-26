/**
 * Cloudflare Worker - GMGN Proxy
 * Bypasses Cloudflare protection for GMGN API requests
 * 
 * Deploy to Cloudflare Workers:
 * 1. npx wrangler init gmgn-proxy
 * 2. Copy this file to src/index.js
 * 3. npx wrangler publish
 */

// GMGN Base URL
const GMGN_BASE = 'https://gmgn.ai/defi/quotation/v1';

// Rate limiting (requests per minute per IP)
const RATE_LIMIT = 30;
const rateLimitMap = new Map();

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
};

// Browser-like headers to bypass Cloudflare
const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Origin': 'https://gmgn.ai',
    'Referer': 'https://gmgn.ai/',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin'
};

/**
 * Check rate limit
 */
function checkRateLimit(ip) {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    let requests = rateLimitMap.get(ip) || [];
    requests = requests.filter(t => t > windowStart);
    
    if (requests.length >= RATE_LIMIT) {
        return false;
    }

    requests.push(now);
    rateLimitMap.set(ip, requests);
    return true;
}

/**
 * Handle CORS preflight
 */
function handleOptions() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders
    });
}

/**
 * Proxy request to GMGN
 */
async function proxyToGMGN(request, env) {
    const url = new URL(request.url);
    const endpoint = url.searchParams.get('endpoint');

    if (!endpoint) {
        return new Response(JSON.stringify({ 
            error: 'Missing endpoint parameter',
            usage: '?endpoint=/rank/sol/swaps/7d&limit=50'
        }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Build GMGN URL
    const gmgnUrl = new URL(GMGN_BASE + endpoint);
    
    // Forward query params (except 'endpoint')
    for (const [key, value] of url.searchParams) {
        if (key !== 'endpoint') {
            gmgnUrl.searchParams.set(key, value);
        }
    }

    try {
        // Fetch from GMGN with browser-like headers
        const response = await fetch(gmgnUrl.toString(), {
            method: 'GET',
            headers: {
                ...browserHeaders,
                // Add session cookies if stored (for Cloudflare bypass)
                ...(env.GMGN_COOKIES ? { 'Cookie': env.GMGN_COOKIES } : {})
            }
        });

        // Check if we got blocked
        const contentType = response.headers.get('content-type') || '';
        
        if (!contentType.includes('application/json')) {
            // Likely got a Cloudflare challenge page
            return new Response(JSON.stringify({
                error: 'GMGN returned non-JSON response (likely blocked)',
                status: response.status,
                suggestion: 'Session cookies may need to be refreshed'
            }), {
                status: 503,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const data = await response.json();

        return new Response(JSON.stringify(data), {
            status: response.status,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=30' // 30s cache
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to fetch from GMGN',
            message: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

/**
 * Main handler
 */
export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return handleOptions();
        }

        // Get client IP for rate limiting
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

        // Check rate limit
        if (!checkRateLimit(clientIP)) {
            return new Response(JSON.stringify({
                error: 'Rate limit exceeded',
                limit: `${RATE_LIMIT} requests per minute`
            }), {
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Route handling
        const url = new URL(request.url);
        const path = url.pathname;

        switch (path) {
            case '/':
            case '/health':
                return new Response(JSON.stringify({
                    status: 'ok',
                    service: 'GMGN Proxy',
                    endpoints: {
                        '/proxy': 'Proxy GMGN API requests',
                        '/health': 'Health check'
                    },
                    usage: '/proxy?endpoint=/rank/sol/swaps/7d&limit=50'
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });

            case '/proxy':
                return proxyToGMGN(request, env);

            default:
                return new Response(JSON.stringify({ error: 'Not found' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
        }
    }
};
