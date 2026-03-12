/**
 * Tests for GitHub API client
 *
 * Tests URL parsing, cache behavior, and API response handling.
 * Uses mocked fetch to avoid real API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseGitHubRepo, fetchGitHubRepo, fetchGitHubUser, fetchRepoFromUrls, fetchGitHubUserFromUrls } from '../github-client.js';

// ── parseGitHubRepo ──────────────────────────────────────────────────────────

describe('parseGitHubRepo', () => {
    it('parses standard GitHub repo URL', () => {
        const result = parseGitHubRepo('https://github.com/nirholas/pump-fun-sdk');
        expect(result).toEqual({ owner: 'nirholas', repo: 'pump-fun-sdk' });
    });

    it('parses URL with trailing slash', () => {
        const result = parseGitHubRepo('https://github.com/owner/repo/');
        expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('parses URL with tree path', () => {
        const result = parseGitHubRepo('https://github.com/owner/repo/tree/main/src');
        expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('parses URL with blob path', () => {
        const result = parseGitHubRepo('https://github.com/owner/repo/blob/main/README.md');
        expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('returns null for non-GitHub URL', () => {
        expect(parseGitHubRepo('https://gitlab.com/owner/repo')).toBeNull();
    });

    it('returns null for GitHub profile URL (no repo)', () => {
        expect(parseGitHubRepo('https://github.com/owner')).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(parseGitHubRepo('')).toBeNull();
    });

    it('returns null for invalid URL', () => {
        expect(parseGitHubRepo('not-a-url')).toBeNull();
    });

    it('returns null for GitHub root URL', () => {
        expect(parseGitHubRepo('https://github.com/')).toBeNull();
    });

    it('handles http (not https) URLs', () => {
        // URL constructor handles this, but hostname won't match
        const result = parseGitHubRepo('http://github.com/owner/repo');
        expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });
});

// ── fetchGitHubRepo ──────────────────────────────────────────────────────────

describe('fetchGitHubRepo', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('returns null on 404', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            text: () => Promise.resolve('Not Found'),
        });

        const result = await fetchGitHubRepo('nonexistent', 'repo');
        expect(result).toBeNull();
    });

    it('returns null on 403 rate limit', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            text: () => Promise.resolve('Rate limited'),
        });

        const result = await fetchGitHubRepo('ratelimited', 'repo');
        expect(result).toBeNull();
    });

    it('returns repo info on success', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                full_name: 'testdev/pump-token',
                description: 'A test repo',
                language: 'TypeScript',
                stargazers_count: 150,
                forks_count: 23,
                open_issues_count: 5,
                pushed_at: '2026-03-10T10:00:00Z',
                created_at: '2025-01-01T00:00:00Z',
                default_branch: 'main',
                fork: false,
                topics: ['solana', 'defi'],
                html_url: 'https://github.com/testdev/pump-token',
                owner: { avatar_url: 'https://avatars.githubusercontent.com/u/123' },
            }),
        });

        const result = await fetchGitHubRepo('fresh-owner-1', 'fresh-repo-1');
        expect(result).not.toBeNull();
        expect(result!.fullName).toBe('testdev/pump-token');
        expect(result!.language).toBe('TypeScript');
        expect(result!.stars).toBe(150);
        expect(result!.forks).toBe(23);
        expect(result!.isFork).toBe(false);
        expect(result!.topics).toEqual(['solana', 'defi']);
    });

    it('handles fetch errors gracefully', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await fetchGitHubRepo('error-owner', 'error-repo');
        expect(result).toBeNull();
    });
});

// ── fetchGitHubUser ──────────────────────────────────────────────────────────

describe('fetchGitHubUser', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('returns null on 404', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            text: () => Promise.resolve('Not Found'),
        });

        const result = await fetchGitHubUser('nonexistent-user-1');
        expect(result).toBeNull();
    });

    it('returns user info on success', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                login: 'testdev',
                name: 'Test Developer',
                bio: 'Building on Solana',
                html_url: 'https://github.com/testdev',
                avatar_url: 'https://avatars.githubusercontent.com/u/123',
                public_repos: 42,
                followers: 150,
                following: 30,
                company: 'TestCorp',
                location: 'San Francisco',
                blog: 'https://testdev.io',
                twitter_username: 'testdev_x',
                created_at: '2020-06-15T00:00:00Z',
                hireable: false,
            }),
        });

        const result = await fetchGitHubUser('fresh-user-1');
        expect(result).not.toBeNull();
        expect(result!.login).toBe('testdev');
        expect(result!.followers).toBe(150);
        expect(result!.publicRepos).toBe(42);
        expect(result!.twitterUsername).toBe('testdev_x');
    });
});

// ── fetchRepoFromUrls ────────────────────────────────────────────────────────

describe('fetchRepoFromUrls', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('returns null for empty URL list', async () => {
        const result = await fetchRepoFromUrls([]);
        expect(result).toBeNull();
    });

    it('returns null for invalid URLs', async () => {
        const result = await fetchRepoFromUrls(['https://gitlab.com/test/repo', 'not-a-url']);
        expect(result).toBeNull();
    });

    it('tries first 2 URLs only', async () => {
        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 404, text: () => Promise.resolve('') })
            .mockResolvedValueOnce({ ok: false, status: 404, text: () => Promise.resolve('') });

        const urls = [
            'https://github.com/a1/b1',
            'https://github.com/a2/b2',
            'https://github.com/a3/b3',
        ];
        const result = await fetchRepoFromUrls(urls);
        expect(result).toBeNull();
    });
});

// ── fetchGitHubUserFromUrls ──────────────────────────────────────────────────

describe('fetchGitHubUserFromUrls', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('returns null for empty URL list', async () => {
        const result = await fetchGitHubUserFromUrls([]);
        expect(result).toBeNull();
    });

    it('returns null for non-GitHub URLs', async () => {
        const result = await fetchGitHubUserFromUrls(['https://example.com']);
        expect(result).toBeNull();
    });
});
