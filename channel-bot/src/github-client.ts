/**
 * PumpFun Channel Bot — GitHub API Client
 *
 * Fetches repo metadata (stars, language, last commit, description)
 * for GitHub URLs found in token descriptions.
 */

import { log } from './logger.js';

const GITHUB_API = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? '';

// ============================================================================
// Types
// ============================================================================

export interface GitHubRepoInfo {
    /** Full repo name: owner/repo */
    fullName: string;
    description: string;
    language: string | null;
    stars: number;
    forks: number;
    openIssues: number;
    /** ISO date of last push */
    lastPush: string;
    /** Time ago string for last push */
    lastPushAgo: string;
    /** ISO date of repo creation */
    createdAt: string;
    /** Default branch name */
    defaultBranch: string;
    /** Is it a fork? */
    isFork: boolean;
    /** Topics / tags */
    topics: string[];
    /** HTML URL for linking */
    htmlUrl: string;
    /** Owner avatar URL */
    ownerAvatar: string;
    /** Total commits on default branch (approximate — from contributor stats) */
    commitCount: number | null;
}

export interface GitHubUserInfo {
    /** GitHub login/username */
    login: string;
    /** Display name */
    name: string | null;
    /** Bio */
    bio: string | null;
    /** Profile URL */
    htmlUrl: string;
    /** Avatar URL */
    avatarUrl: string;
    /** Public repos count */
    publicRepos: number;
    /** Followers count */
    followers: number;
    /** Following count */
    following: number;
    /** Company */
    company: string | null;
    /** Location */
    location: string | null;
    /** Blog/website URL */
    blog: string | null;
    /** Twitter/X username */
    twitterUsername: string | null;
    /** Account creation date */
    createdAt: string;
    /** Is hireable? */
    hireable: boolean;
}

// ============================================================================
// Cache
// ============================================================================

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const REPO_CACHE_TTL = 600_000; // 10 minutes
const repoCache = new Map<string, CacheEntry<GitHubRepoInfo | null>>();
const userCache = new Map<string, CacheEntry<GitHubUserInfo | null>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return undefined;
    }
    return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, ttl: number): void {
    cache.set(key, { data, expiresAt: Date.now() + ttl });
    if (cache.size > 200) {
        const now = Date.now();
        for (const [k, v] of cache) {
            if (now > v.expiresAt) cache.delete(k);
        }
    }
}

// ============================================================================
// URL Parsing
// ============================================================================

/**
 * Extract owner/repo from a GitHub URL.
 * Handles: https://github.com/owner/repo, https://github.com/owner/repo/tree/...
 */
export function parseGitHubRepo(url: string): { owner: string; repo: string } | null {
    try {
        const parsed = new URL(url);
        if (parsed.hostname !== 'github.com') return null;
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length < 2) return null;
        return { owner: parts[0]!, repo: parts[1]! };
    } catch {
        return null;
    }
}

// ============================================================================
// API
// ============================================================================

function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    };
    if (GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }
    return headers;
}

/** Fetch GitHub repo metadata. Returns null if repo not found or API fails. */
export async function fetchGitHubRepo(owner: string, repo: string): Promise<GitHubRepoInfo | null> {
    const key = `${owner}/${repo}`.toLowerCase();
    const cached = getCached(repoCache, key);
    if (cached !== undefined) return cached;

    try {
        const resp = await fetch(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
            headers: authHeaders(),
            signal: AbortSignal.timeout(8_000),
        });

        if (!resp.ok) {
            if (resp.status === 404) {
                setCache(repoCache, key, null, REPO_CACHE_TTL);
                return null;
            }
            if (resp.status === 403 || resp.status === 429) {
                log.warn('GitHub API rate limited (%d) for %s/%s', resp.status, owner, repo);
                setCache(repoCache, key, null, 30_000); // short cooldown to avoid hammering
                return null;
            }
            log.warn('GitHub API %d for %s/%s', resp.status, owner, repo);
            return null;
        }

        const raw = (await resp.json()) as Record<string, unknown>;

        const lastPush = String(raw.pushed_at ?? '');

        const info: GitHubRepoInfo = {
            fullName: String(raw.full_name ?? `${owner}/${repo}`),
            description: String(raw.description ?? ''),
            language: raw.language ? String(raw.language) : null,
            stars: Number(raw.stargazers_count ?? 0),
            forks: Number(raw.forks_count ?? 0),
            openIssues: Number(raw.open_issues_count ?? 0),
            lastPush,
            lastPushAgo: lastPush ? timeAgo(new Date(lastPush).getTime() / 1000) : 'unknown',
            createdAt: String(raw.created_at ?? ''),
            defaultBranch: String(raw.default_branch ?? 'main'),
            isFork: Boolean(raw.fork),
            topics: Array.isArray(raw.topics) ? (raw.topics as string[]).slice(0, 5) : [],
            htmlUrl: String(raw.html_url ?? `https://github.com/${owner}/${repo}`),
            ownerAvatar: String((raw.owner as Record<string, unknown>)?.avatar_url ?? ''),
            commitCount: null,
        };

        setCache(repoCache, key, info, REPO_CACHE_TTL);
        return info;
    } catch (err) {
        log.error('GitHub fetch failed for %s/%s: %s', owner, repo, err);
        return null;
    }
}

/**
 * Fetch repo info for the first valid GitHub URL in a list.
 * Returns null if no URLs are valid repos.
 */
export async function fetchRepoFromUrls(githubUrls: string[]): Promise<GitHubRepoInfo | null> {
    for (const url of githubUrls.slice(0, 2)) {
        const parsed = parseGitHubRepo(url);
        if (!parsed) continue;
        const info = await fetchGitHubRepo(parsed.owner, parsed.repo);
        if (info) return info;
    }
    return null;
}

/**
 * Fetch GitHub user profile for the owner of the first valid GitHub URL.
 */
export async function fetchGitHubUserFromUrls(githubUrls: string[]): Promise<GitHubUserInfo | null> {
    for (const url of githubUrls.slice(0, 2)) {
        const parsed = parseGitHubRepo(url);
        if (!parsed) continue;
        const user = await fetchGitHubUser(parsed.owner);
        if (user) return user;
    }
    return null;
}

/** Fetch GitHub user profile. Returns null if user not found or API fails. */
export async function fetchGitHubUser(username: string): Promise<GitHubUserInfo | null> {
    const key = username.toLowerCase();
    const cached = getCached(userCache, key);
    if (cached !== undefined) return cached;

    try {
        const resp = await fetch(`${GITHUB_API}/users/${encodeURIComponent(username)}`, {
            headers: authHeaders(),
            signal: AbortSignal.timeout(8_000),
        });

        if (!resp.ok) {
            if (resp.status === 404) {
                setCache(userCache, key, null, REPO_CACHE_TTL);
                return null;
            }
            if (resp.status === 403 || resp.status === 429) {
                log.warn('GitHub API rate limited (%d) for user %s', resp.status, username);
                setCache(userCache, key, null, 30_000); // short cooldown to avoid hammering
                return null;
            }
            log.warn('GitHub API %d for user %s', resp.status, username);
            return null;
        }

        const raw = (await resp.json()) as Record<string, unknown>;
        const info = parseUserResponse(raw, username);

        setCache(userCache, key, info, REPO_CACHE_TTL);
        return info;
    } catch (err) {
        log.error('GitHub user fetch failed for %s: %s', username, err);
        return null;
    }
}

/** Parse a raw GitHub API user response into GitHubUserInfo. */
function parseUserResponse(raw: Record<string, unknown>, fallbackLogin = ''): GitHubUserInfo {
    return {
        login: String(raw.login ?? fallbackLogin),
        name: raw.name ? String(raw.name) : null,
        bio: raw.bio ? String(raw.bio) : null,
        htmlUrl: String(raw.html_url ?? ''),
        avatarUrl: String(raw.avatar_url ?? ''),
        publicRepos: Number(raw.public_repos ?? 0),
        followers: Number(raw.followers ?? 0),
        following: Number(raw.following ?? 0),
        company: raw.company ? String(raw.company) : null,
        location: raw.location ? String(raw.location) : null,
        blog: raw.blog ? String(raw.blog) : null,
        twitterUsername: raw.twitter_username ? String(raw.twitter_username) : null,
        createdAt: String(raw.created_at ?? ''),
        hireable: Boolean(raw.hireable),
    };
}

/**
 * Fallback: resolve a numeric GitHub user ID to a username via the public
 * list-users endpoint (GET /users?since=<id-1>&per_page=1).
 * No auth required, but only returns login/id/avatar — then we fetch full profile.
 */
async function resolveUserIdViaList(userId: string): Promise<GitHubUserInfo | null> {
    const numId = Number(userId);
    if (!Number.isInteger(numId) || numId <= 0) return null;

    try {
        const since = numId - 1;
        const resp = await fetch(`${GITHUB_API}/users?since=${since}&per_page=1`, {
            headers: authHeaders(),
            signal: AbortSignal.timeout(8_000),
        });
        if (!resp.ok) return null;
        const list = (await resp.json()) as Array<Record<string, unknown>>;
        const match = list.find((u) => Number(u.id) === numId);
        if (!match?.login) return null;
        // Now fetch the full profile by username (public endpoint)
        return await fetchGitHubUser(String(match.login));
    } catch {
        return null;
    }
}

/** Fetch GitHub user profile by numeric user ID. Returns null if not found. */
export async function fetchGitHubUserById(userId: string): Promise<GitHubUserInfo | null> {
    const cacheKey = `id:${userId}`;
    const cached = getCached(userCache, cacheKey);
    if (cached !== undefined) return cached;

    try {
        // GET /user/{account_id} requires authentication
        const resp = await fetch(`${GITHUB_API}/user/${encodeURIComponent(userId)}`, {
            headers: authHeaders(),
            signal: AbortSignal.timeout(8_000),
        });

        if (!resp.ok) {
            if (resp.status === 404) {
                setCache(userCache, cacheKey, null, REPO_CACHE_TTL);
                return null;
            }
            if (resp.status === 403 || resp.status === 429) {
                log.warn('GitHub API rate limited (%d) for user ID %s', resp.status, userId);
                setCache(userCache, cacheKey, null, 30_000);
                return null;
            }
            // 401 = no/bad token, 422 = invalid ID format, other unexpected errors
            log.warn('GitHub API %d for user ID %s — falling back to list endpoint (token set: %s)',
                resp.status, userId, GITHUB_TOKEN ? 'yes' : 'no');

            // Fallback: resolve via public list-users endpoint
            const fallback = await resolveUserIdViaList(userId);
            if (fallback) {
                setCache(userCache, cacheKey, fallback, REPO_CACHE_TTL);
            }
            return fallback;
        }

        const raw = (await resp.json()) as Record<string, unknown>;
        const info = parseUserResponse(raw);

        setCache(userCache, cacheKey, info, REPO_CACHE_TTL);
        return info;
    } catch (err) {
        log.error('GitHub user fetch by ID failed for %s: %s', userId, err);
        return null;
    }
}

// ============================================================================
// Utilities
// ============================================================================

function timeAgo(unixSeconds: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - unixSeconds;
    if (diff < 0) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
    return `${Math.floor(diff / 2592000)}mo ago`;
}
