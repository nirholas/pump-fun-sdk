import { PublicKey } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';

import { SocialFeeIndex, UPDATE_FEE_SHARES_EVENT_DISC } from '../social-fee-index.js';

const MINT = 'BfLgqS6vhUpAqTW5EofEB34xeo6KbBXdqRMDXbUepump';
const OLD_PDA = 'GVZwypRf6VEs65p3dbbAW1dbJmjjiaTqVQam6aAeCzPc';
const NEW_PDA = '6t8LvTB1dEyyTjFBkqMWPxBHAj3n2actRKbTRJLAJmBQ';

function updateEvent(addresses: string[]): Buffer {
    const bytes = Buffer.alloc(112 + 4 + addresses.length * 34);
    Buffer.from(UPDATE_FEE_SHARES_EVENT_DISC, 'hex').copy(bytes, 0);
    new PublicKey(MINT).toBuffer().copy(bytes, 16);
    // sharing_config and admin may be zeroed; the index intentionally skips them.
    bytes.writeUInt32LE(addresses.length, 112);
    let offset = 116;
    for (const address of addresses) {
        new PublicKey(address).toBuffer().copy(bytes, offset);
        bytes.writeUInt16LE(10_000 / addresses.length, offset + 32);
        offset += 34;
    }
    return bytes;
}

describe('SocialFeeIndex current mappings', () => {
    it('removes superseded shareholders instead of retaining stale candidates', () => {
        const index = new SocialFeeIndex();
        index.updateFromUpdateSharesEvent(updateEvent([OLD_PDA]));
        expect(index.lookupAll(OLD_PDA)).toEqual([MINT]);

        index.updateFromUpdateSharesEvent(updateEvent([NEW_PDA]));
        expect(index.lookupAll(OLD_PDA)).toEqual([]);
        expect(index.lookupAll(NEW_PDA)).toEqual([MINT]);
    });
});
