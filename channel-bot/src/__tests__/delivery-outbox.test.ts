import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DeliveryOutbox } from '../delivery-outbox.js';

describe('DeliveryOutbox', () => {
    it('persists, deduplicates, and acknowledges pending posts', () => {
        const path = join(mkdtempSync(join(tmpdir(), 'claims-outbox-')), 'outbox.json');
        const first = new DeliveryOutbox(path);
        const input = {
            id: 'github:123:mint:tx', kind: 'github_first_claim' as const,
            caption: 'claim', imageUrl: null, mint: 'mint', txSignature: 'tx', githubUserId: '123',
        };
        first.enqueue(input);
        first.enqueue(input);
        expect(first.size).toBe(1);
        expect(first.hasPair('123', 'mint')).toBe(true);

        const recovered = new DeliveryOutbox(path);
        expect(recovered.pending()).toHaveLength(1);
        recovered.noteAttempt(input.id);
        expect(recovered.pending()[0]?.attempts).toBe(1);
        recovered.acknowledge(input.id);
        expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual([]);
    });
});
