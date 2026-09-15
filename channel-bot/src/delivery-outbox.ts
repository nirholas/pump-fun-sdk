import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { PostKind } from './channel-policy.js';
import { log } from './logger.js';

export interface PendingChannelPost {
    id: string;
    kind: PostKind;
    caption: string;
    imageUrl: string | null;
    mint: string;
    txSignature: string;
    githubUserId?: string;
    createdAt: number;
    attempts: number;
}

const DEFAULT_PATH = join(process.env.DATA_DIR || join(process.cwd(), 'data'), 'delivery-outbox.json');

/** Durable, unique queue for posts that have not yet been acknowledged by Telegram. */
export class DeliveryOutbox {
    private posts = new Map<string, PendingChannelPost>();

    constructor(private readonly path: string | null = DEFAULT_PATH) {
        this.load();
    }

    enqueue(input: Omit<PendingChannelPost, 'createdAt' | 'attempts'>): PendingChannelPost {
        const existing = this.posts.get(input.id);
        if (existing) return existing;
        const post = { ...input, createdAt: Date.now(), attempts: 0 };
        this.posts.set(post.id, post);
        this.save();
        return post;
    }

    noteAttempt(id: string): void {
        const post = this.posts.get(id);
        if (!post) return;
        post.attempts++;
        this.save();
    }

    acknowledge(id: string): void {
        if (!this.posts.delete(id)) return;
        this.save();
    }

    hasPair(githubUserId: string, mint: string): boolean {
        return [...this.posts.values()].some((post) =>
            post.githubUserId === githubUserId && post.mint === mint,
        );
    }

    pending(): PendingChannelPost[] {
        return [...this.posts.values()].sort((a, b) => a.createdAt - b.createdAt);
    }

    get size(): number {
        return this.posts.size;
    }

    private load(): void {
        if (!this.path || !existsSync(this.path)) return;
        try {
            const parsed: unknown = JSON.parse(readFileSync(this.path, 'utf8'));
            if (!Array.isArray(parsed)) return;
            for (const item of parsed) {
                const post = item as PendingChannelPost;
                if (post?.id && post.caption && post.kind) this.posts.set(post.id, post);
            }
            if (this.posts.size) log.info('Delivery outbox: loaded %d pending post(s)', this.posts.size);
        } catch (err) {
            log.warn('Delivery outbox load failed: %s', err);
        }
    }

    private save(): void {
        if (!this.path) return;
        try {
            mkdirSync(dirname(this.path), { recursive: true });
            const temporary = `${this.path}.${process.pid}.tmp`;
            writeFileSync(temporary, JSON.stringify(this.pending()), { encoding: 'utf8', mode: 0o600 });
            renameSync(temporary, this.path);
        } catch (err) {
            log.warn('Delivery outbox persistence failed: %s', err);
            throw err;
        }
    }
}
