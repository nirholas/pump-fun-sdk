import { z } from 'zod';
declare const BASE58_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export declare const Base58Schema: z.ZodString;
export declare const SolanaAddressSchema: z.ZodString;
export declare const PrefixSchema: z.ZodString;
export declare const SuffixSchema: z.ZodString;
export declare const PrivateKeySchema: z.ZodString;
export declare const SeedPhraseSchema: z.ZodEffects<z.ZodString, string, string>;
export declare function isValidBase58(str: string): boolean;
export declare function isValidSolanaAddress(address: string): boolean;
export declare function sanitizeInput(input: string): string;
export declare function validatePrefix(prefix: string): {
    valid: boolean;
    error?: string;
};
export declare function validateSuffix(suffix: string): {
    valid: boolean;
    error?: string;
};
export { BASE58_CHARS };
//# sourceMappingURL=validation.d.ts.map