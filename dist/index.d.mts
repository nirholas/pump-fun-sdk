import BN from 'bn.js';
import * as _solana_web3_js from '@solana/web3.js';
import { PublicKey, PublicKeyInitData, AccountInfo, TransactionInstruction, Connection } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';

/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/pump.json`.
 */
interface Pump {
    address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
    metadata: {
        name: "pump";
        version: "0.1.0";
        spec: "0.1.0";
        description: "Created with Anchor";
    };
    instructions: [
        {
            name: "adminSetCreator";
            docs: [
                "Allows Global::admin_set_creator_authority to override the bonding curve creator"
            ];
            discriminator: [69, 25, 171, 142, 57, 239, 13, 4];
            accounts: [
                {
                    name: "adminSetCreatorAuthority";
                    signer: true;
                    relations: ["global"];
                },
                {
                    name: "global";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "mint";
                },
                {
                    name: "bondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    98,
                                    111,
                                    110,
                                    100,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    117,
                                    114,
                                    118,
                                    101
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "creator";
                    type: "pubkey";
                }
            ];
        },
        {
            name: "adminSetIdlAuthority";
            discriminator: [8, 217, 96, 231, 144, 104, 192, 5];
            accounts: [
                {
                    name: "authority";
                    signer: true;
                    relations: ["global"];
                },
                {
                    name: "global";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "idlAccount";
                    writable: true;
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "programSigner";
                    pda: {
                        seeds: [];
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "idlAuthority";
                    type: "pubkey";
                }
            ];
        },
        {
            name: "adminUpdateTokenIncentives";
            discriminator: [209, 11, 115, 87, 213, 23, 124, 204];
            accounts: [
                {
                    name: "authority";
                    writable: true;
                    signer: true;
                    relations: ["global"];
                },
                {
                    name: "global";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "globalVolumeAccumulator";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "mint";
                },
                {
                    name: "globalIncentiveTokenAccount";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "globalVolumeAccumulator";
                            },
                            {
                                kind: "account";
                                path: "tokenProgram";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "associatedTokenProgram";
                    address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "tokenProgram";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "startTime";
                    type: "i64";
                },
                {
                    name: "endTime";
                    type: "i64";
                },
                {
                    name: "secondsInADay";
                    type: "i64";
                },
                {
                    name: "dayNumber";
                    type: "u64";
                },
                {
                    name: "pumpTokenSupplyPerDay";
                    type: "u64";
                }
            ];
        },
        {
            name: "buy";
            docs: ["Buys tokens from a bonding curve."];
            discriminator: [102, 6, 61, 18, 1, 218, 235, 234];
            accounts: [
                {
                    name: "global";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "feeRecipient";
                    writable: true;
                },
                {
                    name: "mint";
                },
                {
                    name: "bondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    98,
                                    111,
                                    110,
                                    100,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    117,
                                    114,
                                    118,
                                    101
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "associatedBondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "bondingCurve";
                            },
                            {
                                kind: "account";
                                path: "tokenProgram";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "associatedUser";
                    writable: true;
                },
                {
                    name: "user";
                    writable: true;
                    signer: true;
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "tokenProgram";
                },
                {
                    name: "creatorVault";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    99,
                                    114,
                                    101,
                                    97,
                                    116,
                                    111,
                                    114,
                                    45,
                                    118,
                                    97,
                                    117,
                                    108,
                                    116
                                ];
                            },
                            {
                                kind: "account";
                                path: "bonding_curve.creator";
                                account: "bondingCurve";
                            }
                        ];
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                    address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
                },
                {
                    name: "globalVolumeAccumulator";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "userVolumeAccumulator";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    117,
                                    115,
                                    101,
                                    114,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            },
                            {
                                kind: "account";
                                path: "user";
                            }
                        ];
                    };
                },
                {
                    name: "feeConfig";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [102, 101, 101, 95, 99, 111, 110, 102, 105, 103];
                            },
                            {
                                kind: "const";
                                value: [
                                    1,
                                    86,
                                    224,
                                    246,
                                    147,
                                    102,
                                    90,
                                    207,
                                    68,
                                    219,
                                    21,
                                    104,
                                    191,
                                    23,
                                    91,
                                    170,
                                    81,
                                    137,
                                    203,
                                    151,
                                    245,
                                    210,
                                    255,
                                    59,
                                    101,
                                    93,
                                    43,
                                    182,
                                    253,
                                    109,
                                    24,
                                    176
                                ];
                            }
                        ];
                        program: {
                            kind: "account";
                            path: "feeProgram";
                        };
                    };
                },
                {
                    name: "feeProgram";
                    address: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";
                }
            ];
            args: [
                {
                    name: "amount";
                    type: "u64";
                },
                {
                    name: "maxSolCost";
                    type: "u64";
                },
                {
                    name: "trackVolume";
                    type: {
                        defined: {
                            name: "optionBool";
                        };
                    };
                }
            ];
        },
        {
            name: "buyExactSolIn";
            docs: [
                "Given a budget of spendable SOL, buy at least min_tokens_out tokens.",
                "Fees are deducted from spendable_sol_in.",
                "",
                "# Quote formulas",
                "Where:",
                "- total_fee_bps = protocol_fee_bps + creator_fee_bps (creator_fee_bps is 0 if no creator)",
                "- floor(a/b) = a / b (integer division)",
                "- ceil(a/b) = (a + b - 1) / b",
                "",
                "SOL → tokens quote",
                "To calculate tokens_out for a given spendable_sol_in:",
                "1. net_sol = floor(spendable_sol_in * 10_000 / (10_000 + total_fee_bps))",
                "2. fees = ceil(net_sol * protocol_fee_bps / 10_000) + ceil(net_sol * creator_fee_bps / 10_000) (creator_fee_bps is 0 if no creator)",
                "3. if net_sol + fees > spendable_sol_in: net_sol = net_sol - (net_sol + fees - spendable_sol_in)",
                "4. tokens_out = floor((net_sol - 1) * virtual_token_reserves / (virtual_sol_reserves + net_sol - 1))",
                "",
                "Reverse quote (tokens → SOL)",
                "To calculate spendable_sol_in for a desired number of tokens:",
                "1. net_sol = ceil(tokens * virtual_sol_reserves / (virtual_token_reserves - tokens)) + 1",
                "2. spendable_sol_in = ceil(net_sol * (10_000 + total_fee_bps) / 10_000)",
                "",
                "Rent",
                "Separately make sure the instruction's payer has enough SOL to cover rent for:",
                "- creator_vault: rent.minimum_balance(0)",
                "- user_volume_accumulator: rent.minimum_balance(UserVolumeAccumulator::LEN)"
            ];
            discriminator: [56, 252, 116, 8, 158, 223, 205, 95];
            accounts: [
                {
                    name: "global";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "feeRecipient";
                    writable: true;
                },
                {
                    name: "mint";
                },
                {
                    name: "bondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    98,
                                    111,
                                    110,
                                    100,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    117,
                                    114,
                                    118,
                                    101
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "associatedBondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "bondingCurve";
                            },
                            {
                                kind: "account";
                                path: "tokenProgram";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "associatedUser";
                    writable: true;
                },
                {
                    name: "user";
                    writable: true;
                    signer: true;
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "tokenProgram";
                },
                {
                    name: "creatorVault";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    99,
                                    114,
                                    101,
                                    97,
                                    116,
                                    111,
                                    114,
                                    45,
                                    118,
                                    97,
                                    117,
                                    108,
                                    116
                                ];
                            },
                            {
                                kind: "account";
                                path: "bonding_curve.creator";
                                account: "bondingCurve";
                            }
                        ];
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                    address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
                },
                {
                    name: "globalVolumeAccumulator";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "userVolumeAccumulator";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    117,
                                    115,
                                    101,
                                    114,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            },
                            {
                                kind: "account";
                                path: "user";
                            }
                        ];
                    };
                },
                {
                    name: "feeConfig";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [102, 101, 101, 95, 99, 111, 110, 102, 105, 103];
                            },
                            {
                                kind: "const";
                                value: [
                                    1,
                                    86,
                                    224,
                                    246,
                                    147,
                                    102,
                                    90,
                                    207,
                                    68,
                                    219,
                                    21,
                                    104,
                                    191,
                                    23,
                                    91,
                                    170,
                                    81,
                                    137,
                                    203,
                                    151,
                                    245,
                                    210,
                                    255,
                                    59,
                                    101,
                                    93,
                                    43,
                                    182,
                                    253,
                                    109,
                                    24,
                                    176
                                ];
                            }
                        ];
                        program: {
                            kind: "account";
                            path: "feeProgram";
                        };
                    };
                },
                {
                    name: "feeProgram";
                    address: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";
                }
            ];
            args: [
                {
                    name: "spendableSolIn";
                    type: "u64";
                },
                {
                    name: "minTokensOut";
                    type: "u64";
                },
                {
                    name: "trackVolume";
                    type: {
                        defined: {
                            name: "optionBool";
                        };
                    };
                }
            ];
        },
        {
            name: "claimCashback";
            discriminator: [37, 58, 35, 126, 190, 53, 228, 197];
            accounts: [
                {
                    name: "user";
                    writable: true;
                },
                {
                    name: "userVolumeAccumulator";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    117,
                                    115,
                                    101,
                                    114,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            },
                            {
                                kind: "account";
                                path: "user";
                            }
                        ];
                    };
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                    address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
                }
            ];
            args: [];
        },
        {
            name: "claimTokenIncentives";
            discriminator: [16, 4, 71, 28, 204, 1, 40, 27];
            accounts: [
                {
                    name: "user";
                },
                {
                    name: "userAta";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "user";
                            },
                            {
                                kind: "account";
                                path: "tokenProgram";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "globalVolumeAccumulator";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "globalIncentiveTokenAccount";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "globalVolumeAccumulator";
                            },
                            {
                                kind: "account";
                                path: "tokenProgram";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "userVolumeAccumulator";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    117,
                                    115,
                                    101,
                                    114,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            },
                            {
                                kind: "account";
                                path: "user";
                            }
                        ];
                    };
                },
                {
                    name: "mint";
                    relations: ["globalVolumeAccumulator"];
                },
                {
                    name: "tokenProgram";
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "associatedTokenProgram";
                    address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                    address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
                },
                {
                    name: "payer";
                    writable: true;
                    signer: true;
                }
            ];
            args: [];
        },
        {
            name: "closeUserVolumeAccumulator";
            discriminator: [249, 69, 164, 218, 150, 103, 84, 138];
            accounts: [
                {
                    name: "user";
                    writable: true;
                    signer: true;
                },
                {
                    name: "userVolumeAccumulator";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    117,
                                    115,
                                    101,
                                    114,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            },
                            {
                                kind: "account";
                                path: "user";
                            }
                        ];
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "collectCreatorFee";
            docs: [
                "Collects creator_fee from creator_vault to the coin creator account"
            ];
            discriminator: [20, 22, 86, 123, 198, 28, 219, 132];
            accounts: [
                {
                    name: "creator";
                    writable: true;
                },
                {
                    name: "creatorVault";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    99,
                                    114,
                                    101,
                                    97,
                                    116,
                                    111,
                                    114,
                                    45,
                                    118,
                                    97,
                                    117,
                                    108,
                                    116
                                ];
                            },
                            {
                                kind: "account";
                                path: "creator";
                            }
                        ];
                    };
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "create";
            docs: ["Creates a new coin and bonding curve."];
            discriminator: [24, 30, 200, 40, 5, 28, 7, 119];
            accounts: [
                {
                    name: "mint";
                    writable: true;
                    signer: true;
                },
                {
                    name: "mintAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    109,
                                    105,
                                    110,
                                    116,
                                    45,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "bondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    98,
                                    111,
                                    110,
                                    100,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    117,
                                    114,
                                    118,
                                    101
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "associatedBondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "bondingCurve";
                            },
                            {
                                kind: "const";
                                value: [
                                    6,
                                    221,
                                    246,
                                    225,
                                    215,
                                    101,
                                    161,
                                    147,
                                    217,
                                    203,
                                    225,
                                    70,
                                    206,
                                    235,
                                    121,
                                    172,
                                    28,
                                    180,
                                    133,
                                    237,
                                    95,
                                    91,
                                    55,
                                    145,
                                    58,
                                    140,
                                    245,
                                    133,
                                    126,
                                    255,
                                    0,
                                    169
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "global";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "mplTokenMetadata";
                    address: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
                },
                {
                    name: "metadata";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [109, 101, 116, 97, 100, 97, 116, 97];
                            },
                            {
                                kind: "const";
                                value: [
                                    11,
                                    112,
                                    101,
                                    177,
                                    227,
                                    209,
                                    124,
                                    69,
                                    56,
                                    157,
                                    82,
                                    127,
                                    107,
                                    4,
                                    195,
                                    205,
                                    88,
                                    184,
                                    108,
                                    115,
                                    26,
                                    160,
                                    253,
                                    181,
                                    73,
                                    182,
                                    209,
                                    188,
                                    3,
                                    248,
                                    41,
                                    70
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "account";
                            path: "mplTokenMetadata";
                        };
                    };
                },
                {
                    name: "user";
                    writable: true;
                    signer: true;
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "tokenProgram";
                    address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
                },
                {
                    name: "associatedTokenProgram";
                    address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
                },
                {
                    name: "rent";
                    address: "SysvarRent111111111111111111111111111111111";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "name";
                    type: "string";
                },
                {
                    name: "symbol";
                    type: "string";
                },
                {
                    name: "uri";
                    type: "string";
                },
                {
                    name: "creator";
                    type: "pubkey";
                }
            ];
        },
        {
            name: "createV2";
            docs: ["Creates a new spl-22 coin and bonding curve."];
            discriminator: [214, 144, 76, 236, 95, 139, 49, 180];
            accounts: [
                {
                    name: "mint";
                    writable: true;
                    signer: true;
                },
                {
                    name: "mintAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    109,
                                    105,
                                    110,
                                    116,
                                    45,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "bondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    98,
                                    111,
                                    110,
                                    100,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    117,
                                    114,
                                    118,
                                    101
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "associatedBondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "bondingCurve";
                            },
                            {
                                kind: "account";
                                path: "tokenProgram";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "global";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "user";
                    writable: true;
                    signer: true;
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "tokenProgram";
                    address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
                },
                {
                    name: "associatedTokenProgram";
                    address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
                },
                {
                    name: "mayhemProgramId";
                    writable: true;
                    address: "MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e";
                },
                {
                    name: "globalParams";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108,
                                    45,
                                    112,
                                    97,
                                    114,
                                    97,
                                    109,
                                    115
                                ];
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                5,
                                42,
                                229,
                                215,
                                167,
                                218,
                                167,
                                36,
                                166,
                                234,
                                176,
                                167,
                                41,
                                84,
                                145,
                                133,
                                90,
                                212,
                                160,
                                103,
                                22,
                                96,
                                103,
                                76,
                                78,
                                3,
                                69,
                                89,
                                128,
                                61,
                                101,
                                163
                            ];
                        };
                    };
                },
                {
                    name: "solVault";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [115, 111, 108, 45, 118, 97, 117, 108, 116];
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                5,
                                42,
                                229,
                                215,
                                167,
                                218,
                                167,
                                36,
                                166,
                                234,
                                176,
                                167,
                                41,
                                84,
                                145,
                                133,
                                90,
                                212,
                                160,
                                103,
                                22,
                                96,
                                103,
                                76,
                                78,
                                3,
                                69,
                                89,
                                128,
                                61,
                                101,
                                163
                            ];
                        };
                    };
                },
                {
                    name: "mayhemState";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    109,
                                    97,
                                    121,
                                    104,
                                    101,
                                    109,
                                    45,
                                    115,
                                    116,
                                    97,
                                    116,
                                    101
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                5,
                                42,
                                229,
                                215,
                                167,
                                218,
                                167,
                                36,
                                166,
                                234,
                                176,
                                167,
                                41,
                                84,
                                145,
                                133,
                                90,
                                212,
                                160,
                                103,
                                22,
                                96,
                                103,
                                76,
                                78,
                                3,
                                69,
                                89,
                                128,
                                61,
                                101,
                                163
                            ];
                        };
                    };
                },
                {
                    name: "mayhemTokenVault";
                    writable: true;
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "name";
                    type: "string";
                },
                {
                    name: "symbol";
                    type: "string";
                },
                {
                    name: "uri";
                    type: "string";
                },
                {
                    name: "creator";
                    type: "pubkey";
                },
                {
                    name: "isMayhemMode";
                    type: "bool";
                },
                {
                    name: "isCashbackEnabled";
                    type: {
                        defined: {
                            name: "optionBool";
                        };
                    };
                }
            ];
        },
        {
            name: "distributeCreatorFees";
            docs: [
                "Distributes creator fees to shareholders based on their share percentages",
                "The creator vault needs to have at least the minimum distributable amount to distribute fees",
                "This can be checked with the get_minimum_distributable_fee instruction"
            ];
            discriminator: [165, 114, 103, 0, 121, 206, 247, 81];
            accounts: [
                {
                    name: "mint";
                    relations: ["sharingConfig"];
                },
                {
                    name: "bondingCurve";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    98,
                                    111,
                                    110,
                                    100,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    117,
                                    114,
                                    118,
                                    101
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "sharingConfig";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    115,
                                    104,
                                    97,
                                    114,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                12,
                                53,
                                255,
                                169,
                                5,
                                90,
                                142,
                                86,
                                141,
                                168,
                                247,
                                188,
                                7,
                                86,
                                21,
                                39,
                                76,
                                241,
                                201,
                                44,
                                164,
                                31,
                                64,
                                0,
                                156,
                                81,
                                106,
                                164,
                                20,
                                194,
                                124,
                                112
                            ];
                        };
                    };
                },
                {
                    name: "creatorVault";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    99,
                                    114,
                                    101,
                                    97,
                                    116,
                                    111,
                                    114,
                                    45,
                                    118,
                                    97,
                                    117,
                                    108,
                                    116
                                ];
                            },
                            {
                                kind: "account";
                                path: "bonding_curve.creator";
                                account: "bondingCurve";
                            }
                        ];
                    };
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                    address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
                }
            ];
            args: [];
            returns: {
                defined: {
                    name: "distributeCreatorFeesEvent";
                };
            };
        },
        {
            name: "extendAccount";
            docs: ["Extends the size of program-owned accounts"];
            discriminator: [234, 102, 194, 203, 150, 72, 62, 229];
            accounts: [
                {
                    name: "account";
                    writable: true;
                },
                {
                    name: "user";
                    signer: true;
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "getMinimumDistributableFee";
            docs: [
                "Permissionless instruction to check the minimum required fees for distribution",
                "Returns the minimum required balance from the creator_vault and whether distribution can proceed"
            ];
            discriminator: [117, 225, 127, 202, 134, 95, 68, 35];
            accounts: [
                {
                    name: "mint";
                    relations: ["sharingConfig"];
                },
                {
                    name: "bondingCurve";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    98,
                                    111,
                                    110,
                                    100,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    117,
                                    114,
                                    118,
                                    101
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "sharingConfig";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    115,
                                    104,
                                    97,
                                    114,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                12,
                                53,
                                255,
                                169,
                                5,
                                90,
                                142,
                                86,
                                141,
                                168,
                                247,
                                188,
                                7,
                                86,
                                21,
                                39,
                                76,
                                241,
                                201,
                                44,
                                164,
                                31,
                                64,
                                0,
                                156,
                                81,
                                106,
                                164,
                                20,
                                194,
                                124,
                                112
                            ];
                        };
                    };
                },
                {
                    name: "creatorVault";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    99,
                                    114,
                                    101,
                                    97,
                                    116,
                                    111,
                                    114,
                                    45,
                                    118,
                                    97,
                                    117,
                                    108,
                                    116
                                ];
                            },
                            {
                                kind: "account";
                                path: "bonding_curve.creator";
                                account: "bondingCurve";
                            }
                        ];
                    };
                }
            ];
            args: [];
            returns: {
                defined: {
                    name: "minimumDistributableFeeEvent";
                };
            };
        },
        {
            name: "initUserVolumeAccumulator";
            discriminator: [94, 6, 202, 115, 255, 96, 232, 183];
            accounts: [
                {
                    name: "payer";
                    writable: true;
                    signer: true;
                },
                {
                    name: "user";
                },
                {
                    name: "userVolumeAccumulator";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    117,
                                    115,
                                    101,
                                    114,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            },
                            {
                                kind: "account";
                                path: "user";
                            }
                        ];
                    };
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "initialize";
            docs: ["Creates the global state."];
            discriminator: [175, 175, 109, 31, 13, 152, 155, 237];
            accounts: [
                {
                    name: "global";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "user";
                    writable: true;
                    signer: true;
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                }
            ];
            args: [];
        },
        {
            name: "migrate";
            docs: ["Migrates liquidity to pump_amm if the bonding curve is complete"];
            discriminator: [155, 234, 231, 146, 236, 158, 162, 30];
            accounts: [
                {
                    name: "global";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "withdrawAuthority";
                    writable: true;
                    relations: ["global"];
                },
                {
                    name: "mint";
                },
                {
                    name: "bondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    98,
                                    111,
                                    110,
                                    100,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    117,
                                    114,
                                    118,
                                    101
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "associatedBondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "bondingCurve";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "user";
                    signer: true;
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "tokenProgram";
                    address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
                },
                {
                    name: "pumpAmm";
                    address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
                },
                {
                    name: "pool";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [112, 111, 111, 108];
                            },
                            {
                                kind: "const";
                                value: [0, 0];
                            },
                            {
                                kind: "account";
                                path: "poolAuthority";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            },
                            {
                                kind: "account";
                                path: "wsolMint";
                            }
                        ];
                        program: {
                            kind: "account";
                            path: "pumpAmm";
                        };
                    };
                },
                {
                    name: "poolAuthority";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    112,
                                    111,
                                    111,
                                    108,
                                    45,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "poolAuthorityMintAccount";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "poolAuthority";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "account";
                            path: "associatedTokenProgram";
                        };
                    };
                },
                {
                    name: "poolAuthorityWsolAccount";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "poolAuthority";
                            },
                            {
                                kind: "account";
                                path: "tokenProgram";
                            },
                            {
                                kind: "account";
                                path: "wsolMint";
                            }
                        ];
                        program: {
                            kind: "account";
                            path: "associatedTokenProgram";
                        };
                    };
                },
                {
                    name: "ammGlobalConfig";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108,
                                    95,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            }
                        ];
                        program: {
                            kind: "account";
                            path: "pumpAmm";
                        };
                    };
                },
                {
                    name: "wsolMint";
                    address: "So11111111111111111111111111111111111111112";
                },
                {
                    name: "lpMint";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    112,
                                    111,
                                    111,
                                    108,
                                    95,
                                    108,
                                    112,
                                    95,
                                    109,
                                    105,
                                    110,
                                    116
                                ];
                            },
                            {
                                kind: "account";
                                path: "pool";
                            }
                        ];
                        program: {
                            kind: "account";
                            path: "pumpAmm";
                        };
                    };
                },
                {
                    name: "userPoolTokenAccount";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "poolAuthority";
                            },
                            {
                                kind: "account";
                                path: "token2022Program";
                            },
                            {
                                kind: "account";
                                path: "lpMint";
                            }
                        ];
                        program: {
                            kind: "account";
                            path: "associatedTokenProgram";
                        };
                    };
                },
                {
                    name: "poolBaseTokenAccount";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "pool";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "account";
                            path: "associatedTokenProgram";
                        };
                    };
                },
                {
                    name: "poolQuoteTokenAccount";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "pool";
                            },
                            {
                                kind: "account";
                                path: "tokenProgram";
                            },
                            {
                                kind: "account";
                                path: "wsolMint";
                            }
                        ];
                        program: {
                            kind: "account";
                            path: "associatedTokenProgram";
                        };
                    };
                },
                {
                    name: "token2022Program";
                    address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
                },
                {
                    name: "associatedTokenProgram";
                    address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
                },
                {
                    name: "pumpAmmEventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                        program: {
                            kind: "account";
                            path: "pumpAmm";
                        };
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "migrateBondingCurveCreator";
            discriminator: [87, 124, 52, 191, 52, 38, 214, 232];
            accounts: [
                {
                    name: "mint";
                    relations: ["sharingConfig"];
                },
                {
                    name: "bondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    98,
                                    111,
                                    110,
                                    100,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    117,
                                    114,
                                    118,
                                    101
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "sharingConfig";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    115,
                                    104,
                                    97,
                                    114,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                12,
                                53,
                                255,
                                169,
                                5,
                                90,
                                142,
                                86,
                                141,
                                168,
                                247,
                                188,
                                7,
                                86,
                                21,
                                39,
                                76,
                                241,
                                201,
                                44,
                                164,
                                31,
                                64,
                                0,
                                156,
                                81,
                                106,
                                164,
                                20,
                                194,
                                124,
                                112
                            ];
                        };
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "sell";
            docs: [
                "Sells tokens into a bonding curve.",
                "For cashback coins, optionally pass user_volume_accumulator as remaining_accounts[0].",
                "If provided and valid, creator_fee goes to user_volume_accumulator.",
                "Otherwise, falls back to transferring creator_fee to creator_vault."
            ];
            discriminator: [51, 230, 133, 164, 1, 127, 131, 173];
            accounts: [
                {
                    name: "global";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "feeRecipient";
                    writable: true;
                },
                {
                    name: "mint";
                },
                {
                    name: "bondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    98,
                                    111,
                                    110,
                                    100,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    117,
                                    114,
                                    118,
                                    101
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "associatedBondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "bondingCurve";
                            },
                            {
                                kind: "account";
                                path: "tokenProgram";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "associatedUser";
                    writable: true;
                },
                {
                    name: "user";
                    writable: true;
                    signer: true;
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "creatorVault";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    99,
                                    114,
                                    101,
                                    97,
                                    116,
                                    111,
                                    114,
                                    45,
                                    118,
                                    97,
                                    117,
                                    108,
                                    116
                                ];
                            },
                            {
                                kind: "account";
                                path: "bonding_curve.creator";
                                account: "bondingCurve";
                            }
                        ];
                    };
                },
                {
                    name: "tokenProgram";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                    address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
                },
                {
                    name: "feeConfig";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [102, 101, 101, 95, 99, 111, 110, 102, 105, 103];
                            },
                            {
                                kind: "const";
                                value: [
                                    1,
                                    86,
                                    224,
                                    246,
                                    147,
                                    102,
                                    90,
                                    207,
                                    68,
                                    219,
                                    21,
                                    104,
                                    191,
                                    23,
                                    91,
                                    170,
                                    81,
                                    137,
                                    203,
                                    151,
                                    245,
                                    210,
                                    255,
                                    59,
                                    101,
                                    93,
                                    43,
                                    182,
                                    253,
                                    109,
                                    24,
                                    176
                                ];
                            }
                        ];
                        program: {
                            kind: "account";
                            path: "feeProgram";
                        };
                    };
                },
                {
                    name: "feeProgram";
                    address: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";
                }
            ];
            args: [
                {
                    name: "amount";
                    type: "u64";
                },
                {
                    name: "minSolOutput";
                    type: "u64";
                }
            ];
        },
        {
            name: "setCreator";
            docs: [
                "Allows Global::set_creator_authority to set the bonding curve creator from Metaplex metadata or input argument"
            ];
            discriminator: [254, 148, 255, 112, 207, 142, 170, 165];
            accounts: [
                {
                    name: "setCreatorAuthority";
                    signer: true;
                    relations: ["global"];
                },
                {
                    name: "global";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "mint";
                },
                {
                    name: "metadata";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [109, 101, 116, 97, 100, 97, 116, 97];
                            },
                            {
                                kind: "const";
                                value: [
                                    11,
                                    112,
                                    101,
                                    177,
                                    227,
                                    209,
                                    124,
                                    69,
                                    56,
                                    157,
                                    82,
                                    127,
                                    107,
                                    4,
                                    195,
                                    205,
                                    88,
                                    184,
                                    108,
                                    115,
                                    26,
                                    160,
                                    253,
                                    181,
                                    73,
                                    182,
                                    209,
                                    188,
                                    3,
                                    248,
                                    41,
                                    70
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                11,
                                112,
                                101,
                                177,
                                227,
                                209,
                                124,
                                69,
                                56,
                                157,
                                82,
                                127,
                                107,
                                4,
                                195,
                                205,
                                88,
                                184,
                                108,
                                115,
                                26,
                                160,
                                253,
                                181,
                                73,
                                182,
                                209,
                                188,
                                3,
                                248,
                                41,
                                70
                            ];
                        };
                    };
                },
                {
                    name: "bondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    98,
                                    111,
                                    110,
                                    100,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    117,
                                    114,
                                    118,
                                    101
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "creator";
                    type: "pubkey";
                }
            ];
        },
        {
            name: "setMayhemVirtualParams";
            discriminator: [61, 169, 188, 191, 153, 149, 42, 97];
            accounts: [
                {
                    name: "solVaultAuthority";
                    writable: true;
                    signer: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [115, 111, 108, 45, 118, 97, 117, 108, 116];
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                5,
                                42,
                                229,
                                215,
                                167,
                                218,
                                167,
                                36,
                                166,
                                234,
                                176,
                                167,
                                41,
                                84,
                                145,
                                133,
                                90,
                                212,
                                160,
                                103,
                                22,
                                96,
                                103,
                                76,
                                78,
                                3,
                                69,
                                89,
                                128,
                                61,
                                101,
                                163
                            ];
                        };
                    };
                },
                {
                    name: "mayhemTokenVault";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "solVaultAuthority";
                            },
                            {
                                kind: "account";
                                path: "tokenProgram";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "mint";
                },
                {
                    name: "global";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "bondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    98,
                                    111,
                                    110,
                                    100,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    117,
                                    114,
                                    118,
                                    101
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "tokenProgram";
                    address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "setMetaplexCreator";
            docs: [
                "Syncs the bonding curve creator with the Metaplex metadata creator if it exists"
            ];
            discriminator: [138, 96, 174, 217, 48, 85, 197, 246];
            accounts: [
                {
                    name: "mint";
                },
                {
                    name: "metadata";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [109, 101, 116, 97, 100, 97, 116, 97];
                            },
                            {
                                kind: "const";
                                value: [
                                    11,
                                    112,
                                    101,
                                    177,
                                    227,
                                    209,
                                    124,
                                    69,
                                    56,
                                    157,
                                    82,
                                    127,
                                    107,
                                    4,
                                    195,
                                    205,
                                    88,
                                    184,
                                    108,
                                    115,
                                    26,
                                    160,
                                    253,
                                    181,
                                    73,
                                    182,
                                    209,
                                    188,
                                    3,
                                    248,
                                    41,
                                    70
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                11,
                                112,
                                101,
                                177,
                                227,
                                209,
                                124,
                                69,
                                56,
                                157,
                                82,
                                127,
                                107,
                                4,
                                195,
                                205,
                                88,
                                184,
                                108,
                                115,
                                26,
                                160,
                                253,
                                181,
                                73,
                                182,
                                209,
                                188,
                                3,
                                248,
                                41,
                                70
                            ];
                        };
                    };
                },
                {
                    name: "bondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    98,
                                    111,
                                    110,
                                    100,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    117,
                                    114,
                                    118,
                                    101
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "setParams";
            docs: ["Sets the global state parameters."];
            discriminator: [27, 234, 178, 52, 147, 2, 187, 141];
            accounts: [
                {
                    name: "global";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "authority";
                    writable: true;
                    signer: true;
                    relations: ["global"];
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "initialVirtualTokenReserves";
                    type: "u64";
                },
                {
                    name: "initialVirtualSolReserves";
                    type: "u64";
                },
                {
                    name: "initialRealTokenReserves";
                    type: "u64";
                },
                {
                    name: "tokenTotalSupply";
                    type: "u64";
                },
                {
                    name: "feeBasisPoints";
                    type: "u64";
                },
                {
                    name: "withdrawAuthority";
                    type: "pubkey";
                },
                {
                    name: "enableMigrate";
                    type: "bool";
                },
                {
                    name: "poolMigrationFee";
                    type: "u64";
                },
                {
                    name: "creatorFeeBasisPoints";
                    type: "u64";
                },
                {
                    name: "setCreatorAuthority";
                    type: "pubkey";
                },
                {
                    name: "adminSetCreatorAuthority";
                    type: "pubkey";
                }
            ];
        },
        {
            name: "setReservedFeeRecipients";
            discriminator: [111, 172, 162, 232, 114, 89, 213, 142];
            accounts: [
                {
                    name: "global";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "authority";
                    signer: true;
                    relations: ["global"];
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "whitelistPda";
                    type: "pubkey";
                }
            ];
        },
        {
            name: "syncUserVolumeAccumulator";
            discriminator: [86, 31, 192, 87, 163, 87, 79, 238];
            accounts: [
                {
                    name: "user";
                },
                {
                    name: "globalVolumeAccumulator";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "userVolumeAccumulator";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    117,
                                    115,
                                    101,
                                    114,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            },
                            {
                                kind: "account";
                                path: "user";
                            }
                        ];
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "toggleCashbackEnabled";
            discriminator: [115, 103, 224, 255, 189, 89, 86, 195];
            accounts: [
                {
                    name: "global";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "authority";
                    writable: true;
                    signer: true;
                    relations: ["global"];
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "enabled";
                    type: "bool";
                }
            ];
        },
        {
            name: "toggleCreateV2";
            discriminator: [28, 255, 230, 240, 172, 107, 203, 171];
            accounts: [
                {
                    name: "global";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "authority";
                    writable: true;
                    signer: true;
                    relations: ["global"];
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "enabled";
                    type: "bool";
                }
            ];
        },
        {
            name: "toggleMayhemMode";
            discriminator: [1, 9, 111, 208, 100, 31, 255, 163];
            accounts: [
                {
                    name: "global";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "authority";
                    writable: true;
                    signer: true;
                    relations: ["global"];
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "enabled";
                    type: "bool";
                }
            ];
        },
        {
            name: "updateGlobalAuthority";
            discriminator: [227, 181, 74, 196, 208, 21, 97, 213];
            accounts: [
                {
                    name: "global";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                    };
                },
                {
                    name: "authority";
                    signer: true;
                    relations: ["global"];
                },
                {
                    name: "newAuthority";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        }
    ];
    accounts: [
        {
            name: "bondingCurve";
            discriminator: [23, 183, 248, 55, 96, 216, 172, 96];
        },
        {
            name: "feeConfig";
            discriminator: [143, 52, 146, 187, 219, 123, 76, 155];
        },
        {
            name: "global";
            discriminator: [167, 232, 232, 177, 200, 108, 114, 127];
        },
        {
            name: "globalVolumeAccumulator";
            discriminator: [202, 42, 246, 43, 142, 190, 30, 255];
        },
        {
            name: "sharingConfig";
            discriminator: [216, 74, 9, 0, 56, 140, 93, 75];
        },
        {
            name: "userVolumeAccumulator";
            discriminator: [86, 255, 112, 14, 102, 53, 154, 250];
        }
    ];
    events: [
        {
            name: "adminSetCreatorEvent";
            discriminator: [64, 69, 192, 104, 29, 30, 25, 107];
        },
        {
            name: "adminSetIdlAuthorityEvent";
            discriminator: [245, 59, 70, 34, 75, 185, 109, 92];
        },
        {
            name: "adminUpdateTokenIncentivesEvent";
            discriminator: [147, 250, 108, 120, 247, 29, 67, 222];
        },
        {
            name: "claimCashbackEvent";
            discriminator: [226, 214, 246, 33, 7, 242, 147, 229];
        },
        {
            name: "claimTokenIncentivesEvent";
            discriminator: [79, 172, 246, 49, 205, 91, 206, 232];
        },
        {
            name: "closeUserVolumeAccumulatorEvent";
            discriminator: [146, 159, 189, 172, 146, 88, 56, 244];
        },
        {
            name: "collectCreatorFeeEvent";
            discriminator: [122, 2, 127, 1, 14, 191, 12, 175];
        },
        {
            name: "completeEvent";
            discriminator: [95, 114, 97, 156, 212, 46, 152, 8];
        },
        {
            name: "completePumpAmmMigrationEvent";
            discriminator: [189, 233, 93, 185, 92, 148, 234, 148];
        },
        {
            name: "createEvent";
            discriminator: [27, 114, 169, 77, 222, 235, 99, 118];
        },
        {
            name: "distributeCreatorFeesEvent";
            discriminator: [165, 55, 129, 112, 4, 179, 202, 40];
        },
        {
            name: "extendAccountEvent";
            discriminator: [97, 97, 215, 144, 93, 146, 22, 124];
        },
        {
            name: "initUserVolumeAccumulatorEvent";
            discriminator: [134, 36, 13, 72, 232, 101, 130, 216];
        },
        {
            name: "migrateBondingCurveCreatorEvent";
            discriminator: [155, 167, 104, 220, 213, 108, 243, 3];
        },
        {
            name: "minimumDistributableFeeEvent";
            discriminator: [168, 216, 132, 239, 235, 182, 49, 52];
        },
        {
            name: "reservedFeeRecipientsEvent";
            discriminator: [43, 188, 250, 18, 221, 75, 187, 95];
        },
        {
            name: "setCreatorEvent";
            discriminator: [237, 52, 123, 37, 245, 251, 72, 210];
        },
        {
            name: "setMetaplexCreatorEvent";
            discriminator: [142, 203, 6, 32, 127, 105, 191, 162];
        },
        {
            name: "setParamsEvent";
            discriminator: [223, 195, 159, 246, 62, 48, 143, 131];
        },
        {
            name: "syncUserVolumeAccumulatorEvent";
            discriminator: [197, 122, 167, 124, 116, 81, 91, 255];
        },
        {
            name: "tradeEvent";
            discriminator: [189, 219, 127, 211, 78, 230, 97, 238];
        },
        {
            name: "updateGlobalAuthorityEvent";
            discriminator: [182, 195, 137, 42, 35, 206, 207, 247];
        },
        {
            name: "updateMayhemVirtualParamsEvent";
            discriminator: [117, 123, 228, 182, 161, 168, 220, 214];
        }
    ];
    errors: [
        {
            code: 6000;
            name: "notAuthorized";
            msg: "The given account is not authorized to execute this instruction.";
        },
        {
            code: 6001;
            name: "alreadyInitialized";
            msg: "The program is already initialized.";
        },
        {
            code: 6002;
            name: "tooMuchSolRequired";
            msg: "slippage: Too much SOL required to buy the given amount of tokens.";
        },
        {
            code: 6003;
            name: "tooLittleSolReceived";
            msg: "slippage: Too little SOL received to sell the given amount of tokens.";
        },
        {
            code: 6004;
            name: "mintDoesNotMatchBondingCurve";
            msg: "The mint does not match the bonding curve.";
        },
        {
            code: 6005;
            name: "bondingCurveComplete";
            msg: "The bonding curve has completed and liquidity migrated to raydium.";
        },
        {
            code: 6006;
            name: "bondingCurveNotComplete";
            msg: "The bonding curve has not completed.";
        },
        {
            code: 6007;
            name: "notInitialized";
            msg: "The program is not initialized.";
        },
        {
            code: 6008;
            name: "withdrawTooFrequent";
            msg: "Withdraw too frequent";
        },
        {
            code: 6009;
            name: "newSizeShouldBeGreaterThanCurrentSize";
            msg: "new_size should be > current_size";
        },
        {
            code: 6010;
            name: "accountTypeNotSupported";
            msg: "Account type not supported";
        },
        {
            code: 6011;
            name: "initialRealTokenReservesShouldBeLessThanTokenTotalSupply";
            msg: "initial_real_token_reserves should be less than token_total_supply";
        },
        {
            code: 6012;
            name: "initialVirtualTokenReservesShouldBeGreaterThanInitialRealTokenReserves";
            msg: "initial_virtual_token_reserves should be greater than initial_real_token_reserves";
        },
        {
            code: 6013;
            name: "feeBasisPointsGreaterThanMaximum";
            msg: "fee_basis_points greater than maximum";
        },
        {
            code: 6014;
            name: "allZerosWithdrawAuthority";
            msg: "Withdraw authority cannot be set to System Program ID";
        },
        {
            code: 6015;
            name: "poolMigrationFeeShouldBeLessThanFinalRealSolReserves";
            msg: "pool_migration_fee should be less than final_real_sol_reserves";
        },
        {
            code: 6016;
            name: "poolMigrationFeeShouldBeGreaterThanCreatorFeePlusMaxMigrateFees";
            msg: "pool_migration_fee should be greater than creator_fee + MAX_MIGRATE_FEES";
        },
        {
            code: 6017;
            name: "disabledWithdraw";
            msg: "Migrate instruction is disabled";
        },
        {
            code: 6018;
            name: "disabledMigrate";
            msg: "Migrate instruction is disabled";
        },
        {
            code: 6019;
            name: "invalidCreator";
            msg: "Invalid creator pubkey";
        },
        {
            code: 6020;
            name: "buyZeroAmount";
            msg: "Buy zero amount";
        },
        {
            code: 6021;
            name: "notEnoughTokensToBuy";
            msg: "Not enough tokens to buy";
        },
        {
            code: 6022;
            name: "sellZeroAmount";
            msg: "Sell zero amount";
        },
        {
            code: 6023;
            name: "notEnoughTokensToSell";
            msg: "Not enough tokens to sell";
        },
        {
            code: 6024;
            name: "overflow";
            msg: "overflow";
        },
        {
            code: 6025;
            name: "truncation";
            msg: "truncation";
        },
        {
            code: 6026;
            name: "divisionByZero";
            msg: "Division by zero";
        },
        {
            code: 6027;
            name: "notEnoughRemainingAccounts";
            msg: "Not enough remaining accounts";
        },
        {
            code: 6028;
            name: "allFeeRecipientsShouldBeNonZero";
            msg: "All fee recipients should be non-zero";
        },
        {
            code: 6029;
            name: "unsortedNotUniqueFeeRecipients";
            msg: "Unsorted or not unique fee recipients";
        },
        {
            code: 6030;
            name: "creatorShouldNotBeZero";
            msg: "Creator should not be zero";
        },
        {
            code: 6031;
            name: "startTimeInThePast";
        },
        {
            code: 6032;
            name: "endTimeInThePast";
        },
        {
            code: 6033;
            name: "endTimeBeforeStartTime";
        },
        {
            code: 6034;
            name: "timeRangeTooLarge";
        },
        {
            code: 6035;
            name: "endTimeBeforeCurrentDay";
        },
        {
            code: 6036;
            name: "supplyUpdateForFinishedRange";
        },
        {
            code: 6037;
            name: "dayIndexAfterEndIndex";
        },
        {
            code: 6038;
            name: "dayInActiveRange";
        },
        {
            code: 6039;
            name: "invalidIncentiveMint";
        },
        {
            code: 6040;
            name: "buyNotEnoughSolToCoverRent";
            msg: "Buy: Not enough SOL to cover for rent exemption.";
        },
        {
            code: 6041;
            name: "buyNotEnoughSolToCoverFees";
            msg: "Buy: Not enough SOL to cover for fees.";
        },
        {
            code: 6042;
            name: "buySlippageBelowMinTokensOut";
            msg: "Slippage: Would buy less tokens than expected min_tokens_out";
        },
        {
            code: 6043;
            name: "nameTooLong";
        },
        {
            code: 6044;
            name: "symbolTooLong";
        },
        {
            code: 6045;
            name: "uriTooLong";
        },
        {
            code: 6046;
            name: "createV2Disabled";
        },
        {
            code: 6047;
            name: "cpitializeMayhemFailed";
        },
        {
            code: 6048;
            name: "mayhemModeDisabled";
        },
        {
            code: 6049;
            name: "creatorMigratedToSharingConfig";
            msg: "creator has been migrated to sharing config, use pump_fees::reset_fee_sharing_config instead";
        },
        {
            code: 6050;
            name: "unableToDistributeCreatorVaultMigratedToSharingConfig";
            msg: "creator_vault has been migrated to sharing config, use pump:distribute_creator_fees instead";
        },
        {
            code: 6051;
            name: "sharingConfigNotActive";
            msg: "Sharing config is not active";
        },
        {
            code: 6052;
            name: "unableToDistributeCreatorFeesToExecutableRecipient";
            msg: "The recipient account is executable, so it cannot receive lamports, remove it from the team first";
        },
        {
            code: 6053;
            name: "BondingCurveAndSharingConfigCreatorMismatch";
            msg: "Bonding curve creator does not match sharing config";
        },
        {
            code: 6054;
            name: "shareholdersAndRemainingAccountsMismatch";
            msg: "Remaining accounts do not match shareholders, make sure to pass exactly the same pubkeys in the same order";
        },
        {
            code: 6055;
            name: "invalidShareBps";
            msg: "Share bps must be greater than 0";
        },
        {
            code: 6056;
            name: "cashbackNotEnabled";
            msg: "Cashback is not enabled";
        }
    ];
    types: [
        {
            name: "adminSetCreatorEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "adminSetCreatorAuthority";
                        type: "pubkey";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "bondingCurve";
                        type: "pubkey";
                    },
                    {
                        name: "oldCreator";
                        type: "pubkey";
                    },
                    {
                        name: "newCreator";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "adminSetIdlAuthorityEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "idlAuthority";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "adminUpdateTokenIncentivesEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "startTime";
                        type: "i64";
                    },
                    {
                        name: "endTime";
                        type: "i64";
                    },
                    {
                        name: "dayNumber";
                        type: "u64";
                    },
                    {
                        name: "tokenSupplyPerDay";
                        type: "u64";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "secondsInADay";
                        type: "i64";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    }
                ];
            };
        },
        {
            name: "bondingCurve";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "virtualTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "virtualSolReserves";
                        type: "u64";
                    },
                    {
                        name: "realTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "realSolReserves";
                        type: "u64";
                    },
                    {
                        name: "tokenTotalSupply";
                        type: "u64";
                    },
                    {
                        name: "complete";
                        type: "bool";
                    },
                    {
                        name: "creator";
                        type: "pubkey";
                    },
                    {
                        name: "isMayhemMode";
                        type: "bool";
                    },
                    {
                        name: "isCashbackCoin";
                        type: "bool";
                    }
                ];
            };
        },
        {
            name: "claimCashbackEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "amount";
                        type: "u64";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "totalClaimed";
                        type: "u64";
                    },
                    {
                        name: "totalCashbackEarned";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "claimTokenIncentivesEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "amount";
                        type: "u64";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "totalClaimedTokens";
                        type: "u64";
                    },
                    {
                        name: "currentSolVolume";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "closeUserVolumeAccumulatorEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "totalUnclaimedTokens";
                        type: "u64";
                    },
                    {
                        name: "totalClaimedTokens";
                        type: "u64";
                    },
                    {
                        name: "currentSolVolume";
                        type: "u64";
                    },
                    {
                        name: "lastUpdateTimestamp";
                        type: "i64";
                    }
                ];
            };
        },
        {
            name: "collectCreatorFeeEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "creator";
                        type: "pubkey";
                    },
                    {
                        name: "creatorFee";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "completeEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "bondingCurve";
                        type: "pubkey";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    }
                ];
            };
        },
        {
            name: "completePumpAmmMigrationEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "mintAmount";
                        type: "u64";
                    },
                    {
                        name: "solAmount";
                        type: "u64";
                    },
                    {
                        name: "poolMigrationFee";
                        type: "u64";
                    },
                    {
                        name: "bondingCurve";
                        type: "pubkey";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "pool";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "configStatus";
            type: {
                kind: "enum";
                variants: [
                    {
                        name: "paused";
                    },
                    {
                        name: "active";
                    }
                ];
            };
        },
        {
            name: "createEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "name";
                        type: "string";
                    },
                    {
                        name: "symbol";
                        type: "string";
                    },
                    {
                        name: "uri";
                        type: "string";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "bondingCurve";
                        type: "pubkey";
                    },
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "creator";
                        type: "pubkey";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "virtualTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "virtualSolReserves";
                        type: "u64";
                    },
                    {
                        name: "realTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "tokenTotalSupply";
                        type: "u64";
                    },
                    {
                        name: "tokenProgram";
                        type: "pubkey";
                    },
                    {
                        name: "isMayhemMode";
                        type: "bool";
                    },
                    {
                        name: "isCashbackEnabled";
                        type: "bool";
                    }
                ];
            };
        },
        {
            name: "distributeCreatorFeesEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "bondingCurve";
                        type: "pubkey";
                    },
                    {
                        name: "sharingConfig";
                        type: "pubkey";
                    },
                    {
                        name: "admin";
                        type: "pubkey";
                    },
                    {
                        name: "shareholders";
                        type: {
                            vec: {
                                defined: {
                                    name: "shareholder";
                                };
                            };
                        };
                    },
                    {
                        name: "distributed";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "extendAccountEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "account";
                        type: "pubkey";
                    },
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "currentSize";
                        type: "u64";
                    },
                    {
                        name: "newSize";
                        type: "u64";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    }
                ];
            };
        },
        {
            name: "feeConfig";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "bump";
                        type: "u8";
                    },
                    {
                        name: "admin";
                        type: "pubkey";
                    },
                    {
                        name: "flatFees";
                        type: {
                            defined: {
                                name: "fees";
                            };
                        };
                    },
                    {
                        name: "feeTiers";
                        type: {
                            vec: {
                                defined: {
                                    name: "feeTier";
                                };
                            };
                        };
                    }
                ];
            };
        },
        {
            name: "feeTier";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "marketCapLamportsThreshold";
                        type: "u128";
                    },
                    {
                        name: "fees";
                        type: {
                            defined: {
                                name: "fees";
                            };
                        };
                    }
                ];
            };
        },
        {
            name: "fees";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "lpFeeBps";
                        type: "u64";
                    },
                    {
                        name: "protocolFeeBps";
                        type: "u64";
                    },
                    {
                        name: "creatorFeeBps";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "global";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "initialized";
                        docs: ["Unused"];
                        type: "bool";
                    },
                    {
                        name: "authority";
                        type: "pubkey";
                    },
                    {
                        name: "feeRecipient";
                        type: "pubkey";
                    },
                    {
                        name: "initialVirtualTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "initialVirtualSolReserves";
                        type: "u64";
                    },
                    {
                        name: "initialRealTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "tokenTotalSupply";
                        type: "u64";
                    },
                    {
                        name: "feeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "withdrawAuthority";
                        type: "pubkey";
                    },
                    {
                        name: "enableMigrate";
                        docs: ["Unused"];
                        type: "bool";
                    },
                    {
                        name: "poolMigrationFee";
                        type: "u64";
                    },
                    {
                        name: "creatorFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "feeRecipients";
                        type: {
                            array: ["pubkey", 7];
                        };
                    },
                    {
                        name: "setCreatorAuthority";
                        type: "pubkey";
                    },
                    {
                        name: "adminSetCreatorAuthority";
                        type: "pubkey";
                    },
                    {
                        name: "createV2Enabled";
                        type: "bool";
                    },
                    {
                        name: "whitelistPda";
                        type: "pubkey";
                    },
                    {
                        name: "reservedFeeRecipient";
                        type: "pubkey";
                    },
                    {
                        name: "mayhemModeEnabled";
                        type: "bool";
                    },
                    {
                        name: "reservedFeeRecipients";
                        type: {
                            array: ["pubkey", 7];
                        };
                    },
                    {
                        name: "isCashbackEnabled";
                        type: "bool";
                    }
                ];
            };
        },
        {
            name: "globalVolumeAccumulator";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "startTime";
                        type: "i64";
                    },
                    {
                        name: "endTime";
                        type: "i64";
                    },
                    {
                        name: "secondsInADay";
                        type: "i64";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "totalTokenSupply";
                        type: {
                            array: ["u64", 30];
                        };
                    },
                    {
                        name: "solVolumes";
                        type: {
                            array: ["u64", 30];
                        };
                    }
                ];
            };
        },
        {
            name: "initUserVolumeAccumulatorEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "payer";
                        type: "pubkey";
                    },
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    }
                ];
            };
        },
        {
            name: "migrateBondingCurveCreatorEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "bondingCurve";
                        type: "pubkey";
                    },
                    {
                        name: "sharingConfig";
                        type: "pubkey";
                    },
                    {
                        name: "oldCreator";
                        type: "pubkey";
                    },
                    {
                        name: "newCreator";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "minimumDistributableFeeEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "minimumRequired";
                        type: "u64";
                    },
                    {
                        name: "distributableFees";
                        type: "u64";
                    },
                    {
                        name: "canDistribute";
                        type: "bool";
                    }
                ];
            };
        },
        {
            name: "optionBool";
            type: {
                kind: "struct";
                fields: ["bool"];
            };
        },
        {
            name: "reservedFeeRecipientsEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "reservedFeeRecipient";
                        type: "pubkey";
                    },
                    {
                        name: "reservedFeeRecipients";
                        type: {
                            array: ["pubkey", 7];
                        };
                    }
                ];
            };
        },
        {
            name: "setCreatorEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "bondingCurve";
                        type: "pubkey";
                    },
                    {
                        name: "creator";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "setMetaplexCreatorEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "bondingCurve";
                        type: "pubkey";
                    },
                    {
                        name: "metadata";
                        type: "pubkey";
                    },
                    {
                        name: "creator";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "setParamsEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "initialVirtualTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "initialVirtualSolReserves";
                        type: "u64";
                    },
                    {
                        name: "initialRealTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "finalRealSolReserves";
                        type: "u64";
                    },
                    {
                        name: "tokenTotalSupply";
                        type: "u64";
                    },
                    {
                        name: "feeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "withdrawAuthority";
                        type: "pubkey";
                    },
                    {
                        name: "enableMigrate";
                        type: "bool";
                    },
                    {
                        name: "poolMigrationFee";
                        type: "u64";
                    },
                    {
                        name: "creatorFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "feeRecipients";
                        type: {
                            array: ["pubkey", 8];
                        };
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "setCreatorAuthority";
                        type: "pubkey";
                    },
                    {
                        name: "adminSetCreatorAuthority";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "shareholder";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "address";
                        type: "pubkey";
                    },
                    {
                        name: "shareBps";
                        type: "u16";
                    }
                ];
            };
        },
        {
            name: "sharingConfig";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "bump";
                        type: "u8";
                    },
                    {
                        name: "version";
                        type: "u8";
                    },
                    {
                        name: "status";
                        type: {
                            defined: {
                                name: "configStatus";
                            };
                        };
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "admin";
                        type: "pubkey";
                    },
                    {
                        name: "adminRevoked";
                        type: "bool";
                    },
                    {
                        name: "shareholders";
                        type: {
                            vec: {
                                defined: {
                                    name: "shareholder";
                                };
                            };
                        };
                    }
                ];
            };
        },
        {
            name: "syncUserVolumeAccumulatorEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "totalClaimedTokensBefore";
                        type: "u64";
                    },
                    {
                        name: "totalClaimedTokensAfter";
                        type: "u64";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    }
                ];
            };
        },
        {
            name: "tradeEvent";
            docs: ['ix_name: "buy" | "sell" | "buy_exact_sol_in"'];
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "solAmount";
                        type: "u64";
                    },
                    {
                        name: "tokenAmount";
                        type: "u64";
                    },
                    {
                        name: "isBuy";
                        type: "bool";
                    },
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "virtualSolReserves";
                        type: "u64";
                    },
                    {
                        name: "virtualTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "realSolReserves";
                        type: "u64";
                    },
                    {
                        name: "realTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "feeRecipient";
                        type: "pubkey";
                    },
                    {
                        name: "feeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "fee";
                        type: "u64";
                    },
                    {
                        name: "creator";
                        type: "pubkey";
                    },
                    {
                        name: "creatorFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "creatorFee";
                        type: "u64";
                    },
                    {
                        name: "trackVolume";
                        type: "bool";
                    },
                    {
                        name: "totalUnclaimedTokens";
                        type: "u64";
                    },
                    {
                        name: "totalClaimedTokens";
                        type: "u64";
                    },
                    {
                        name: "currentSolVolume";
                        type: "u64";
                    },
                    {
                        name: "lastUpdateTimestamp";
                        type: "i64";
                    },
                    {
                        name: "ixName";
                        type: "string";
                    },
                    {
                        name: "mayhemMode";
                        type: "bool";
                    },
                    {
                        name: "cashbackFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "cashback";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "updateGlobalAuthorityEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "global";
                        type: "pubkey";
                    },
                    {
                        name: "authority";
                        type: "pubkey";
                    },
                    {
                        name: "newAuthority";
                        type: "pubkey";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    }
                ];
            };
        },
        {
            name: "updateMayhemVirtualParamsEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "virtualTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "virtualSolReserves";
                        type: "u64";
                    },
                    {
                        name: "newVirtualTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "newVirtualSolReserves";
                        type: "u64";
                    },
                    {
                        name: "realTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "realSolReserves";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "userVolumeAccumulator";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "needsClaim";
                        type: "bool";
                    },
                    {
                        name: "totalUnclaimedTokens";
                        type: "u64";
                    },
                    {
                        name: "totalClaimedTokens";
                        type: "u64";
                    },
                    {
                        name: "currentSolVolume";
                        type: "u64";
                    },
                    {
                        name: "lastUpdateTimestamp";
                        type: "i64";
                    },
                    {
                        name: "hasTotalClaimedTokens";
                        type: "bool";
                    },
                    {
                        name: "cashbackEarned";
                        type: "u64";
                    },
                    {
                        name: "totalCashbackClaimed";
                        type: "u64";
                    }
                ];
            };
        }
    ];
}

var address = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
var metadata = {
	name: "pump",
	version: "0.1.0",
	spec: "0.1.0",
	description: "Created with Anchor"
};
var instructions = [
	{
		name: "admin_set_creator",
		docs: [
			"Allows Global::admin_set_creator_authority to override the bonding curve creator"
		],
		discriminator: [
			69,
			25,
			171,
			142,
			57,
			239,
			13,
			4
		],
		accounts: [
			{
				name: "admin_set_creator_authority",
				signer: true,
				relations: [
					"global"
				]
			},
			{
				name: "global",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "mint"
			},
			{
				name: "bonding_curve",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								98,
								111,
								110,
								100,
								105,
								110,
								103,
								45,
								99,
								117,
								114,
								118,
								101
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					]
				}
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
			{
				name: "creator",
				type: "pubkey"
			}
		]
	},
	{
		name: "admin_set_idl_authority",
		discriminator: [
			8,
			217,
			96,
			231,
			144,
			104,
			192,
			5
		],
		accounts: [
			{
				name: "authority",
				signer: true,
				relations: [
					"global"
				]
			},
			{
				name: "global",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "idl_account",
				writable: true
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			},
			{
				name: "program_signer",
				pda: {
					seeds: [
					]
				}
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
			{
				name: "idl_authority",
				type: "pubkey"
			}
		]
	},
	{
		name: "admin_update_token_incentives",
		discriminator: [
			209,
			11,
			115,
			87,
			213,
			23,
			124,
			204
		],
		accounts: [
			{
				name: "authority",
				writable: true,
				signer: true,
				relations: [
					"global"
				]
			},
			{
				name: "global",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "global_volume_accumulator",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108,
								95,
								118,
								111,
								108,
								117,
								109,
								101,
								95,
								97,
								99,
								99,
								117,
								109,
								117,
								108,
								97,
								116,
								111,
								114
							]
						}
					]
				}
			},
			{
				name: "mint"
			},
			{
				name: "global_incentive_token_account",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "account",
							path: "global_volume_accumulator"
						},
						{
							kind: "account",
							path: "token_program"
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "const",
						value: [
							140,
							151,
							37,
							143,
							78,
							36,
							137,
							241,
							187,
							61,
							16,
							41,
							20,
							142,
							13,
							131,
							11,
							90,
							19,
							153,
							218,
							255,
							16,
							132,
							4,
							142,
							123,
							216,
							219,
							233,
							248,
							89
						]
					}
				}
			},
			{
				name: "associated_token_program",
				address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			},
			{
				name: "token_program"
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
			{
				name: "start_time",
				type: "i64"
			},
			{
				name: "end_time",
				type: "i64"
			},
			{
				name: "seconds_in_a_day",
				type: "i64"
			},
			{
				name: "day_number",
				type: "u64"
			},
			{
				name: "pump_token_supply_per_day",
				type: "u64"
			}
		]
	},
	{
		name: "buy",
		docs: [
			"Buys tokens from a bonding curve."
		],
		discriminator: [
			102,
			6,
			61,
			18,
			1,
			218,
			235,
			234
		],
		accounts: [
			{
				name: "global",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "fee_recipient",
				writable: true
			},
			{
				name: "mint"
			},
			{
				name: "bonding_curve",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								98,
								111,
								110,
								100,
								105,
								110,
								103,
								45,
								99,
								117,
								114,
								118,
								101
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					]
				}
			},
			{
				name: "associated_bonding_curve",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "account",
							path: "bonding_curve"
						},
						{
							kind: "account",
							path: "token_program"
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "const",
						value: [
							140,
							151,
							37,
							143,
							78,
							36,
							137,
							241,
							187,
							61,
							16,
							41,
							20,
							142,
							13,
							131,
							11,
							90,
							19,
							153,
							218,
							255,
							16,
							132,
							4,
							142,
							123,
							216,
							219,
							233,
							248,
							89
						]
					}
				}
			},
			{
				name: "associated_user",
				writable: true
			},
			{
				name: "user",
				writable: true,
				signer: true
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			},
			{
				name: "token_program"
			},
			{
				name: "creator_vault",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								99,
								114,
								101,
								97,
								116,
								111,
								114,
								45,
								118,
								97,
								117,
								108,
								116
							]
						},
						{
							kind: "account",
							path: "bonding_curve.creator",
							account: "BondingCurve"
						}
					]
				}
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program",
				address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
			},
			{
				name: "global_volume_accumulator",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108,
								95,
								118,
								111,
								108,
								117,
								109,
								101,
								95,
								97,
								99,
								99,
								117,
								109,
								117,
								108,
								97,
								116,
								111,
								114
							]
						}
					]
				}
			},
			{
				name: "user_volume_accumulator",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								117,
								115,
								101,
								114,
								95,
								118,
								111,
								108,
								117,
								109,
								101,
								95,
								97,
								99,
								99,
								117,
								109,
								117,
								108,
								97,
								116,
								111,
								114
							]
						},
						{
							kind: "account",
							path: "user"
						}
					]
				}
			},
			{
				name: "fee_config",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								102,
								101,
								101,
								95,
								99,
								111,
								110,
								102,
								105,
								103
							]
						},
						{
							kind: "const",
							value: [
								1,
								86,
								224,
								246,
								147,
								102,
								90,
								207,
								68,
								219,
								21,
								104,
								191,
								23,
								91,
								170,
								81,
								137,
								203,
								151,
								245,
								210,
								255,
								59,
								101,
								93,
								43,
								182,
								253,
								109,
								24,
								176
							]
						}
					],
					program: {
						kind: "account",
						path: "fee_program"
					}
				}
			},
			{
				name: "fee_program",
				address: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ"
			}
		],
		args: [
			{
				name: "amount",
				type: "u64"
			},
			{
				name: "max_sol_cost",
				type: "u64"
			},
			{
				name: "track_volume",
				type: {
					defined: {
						name: "OptionBool"
					}
				}
			}
		]
	},
	{
		name: "buy_exact_sol_in",
		docs: [
			"Given a budget of spendable SOL, buy at least min_tokens_out tokens.",
			"Fees are deducted from spendable_sol_in.",
			"",
			"# Quote formulas",
			"Where:",
			"- total_fee_bps = protocol_fee_bps + creator_fee_bps (creator_fee_bps is 0 if no creator)",
			"- floor(a/b) = a / b (integer division)",
			"- ceil(a/b) = (a + b - 1) / b",
			"",
			"SOL → tokens quote",
			"To calculate tokens_out for a given spendable_sol_in:",
			"1. net_sol = floor(spendable_sol_in * 10_000 / (10_000 + total_fee_bps))",
			"2. fees = ceil(net_sol * protocol_fee_bps / 10_000) + ceil(net_sol * creator_fee_bps / 10_000) (creator_fee_bps is 0 if no creator)",
			"3. if net_sol + fees > spendable_sol_in: net_sol = net_sol - (net_sol + fees - spendable_sol_in)",
			"4. tokens_out = floor((net_sol - 1) * virtual_token_reserves / (virtual_sol_reserves + net_sol - 1))",
			"",
			"Reverse quote (tokens → SOL)",
			"To calculate spendable_sol_in for a desired number of tokens:",
			"1. net_sol = ceil(tokens * virtual_sol_reserves / (virtual_token_reserves - tokens)) + 1",
			"2. spendable_sol_in = ceil(net_sol * (10_000 + total_fee_bps) / 10_000)",
			"",
			"Rent",
			"Separately make sure the instruction's payer has enough SOL to cover rent for:",
			"- creator_vault: rent.minimum_balance(0)",
			"- user_volume_accumulator: rent.minimum_balance(UserVolumeAccumulator::LEN)"
		],
		discriminator: [
			56,
			252,
			116,
			8,
			158,
			223,
			205,
			95
		],
		accounts: [
			{
				name: "global",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "fee_recipient",
				writable: true
			},
			{
				name: "mint"
			},
			{
				name: "bonding_curve",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								98,
								111,
								110,
								100,
								105,
								110,
								103,
								45,
								99,
								117,
								114,
								118,
								101
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					]
				}
			},
			{
				name: "associated_bonding_curve",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "account",
							path: "bonding_curve"
						},
						{
							kind: "account",
							path: "token_program"
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "const",
						value: [
							140,
							151,
							37,
							143,
							78,
							36,
							137,
							241,
							187,
							61,
							16,
							41,
							20,
							142,
							13,
							131,
							11,
							90,
							19,
							153,
							218,
							255,
							16,
							132,
							4,
							142,
							123,
							216,
							219,
							233,
							248,
							89
						]
					}
				}
			},
			{
				name: "associated_user",
				writable: true
			},
			{
				name: "user",
				writable: true,
				signer: true
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			},
			{
				name: "token_program"
			},
			{
				name: "creator_vault",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								99,
								114,
								101,
								97,
								116,
								111,
								114,
								45,
								118,
								97,
								117,
								108,
								116
							]
						},
						{
							kind: "account",
							path: "bonding_curve.creator",
							account: "BondingCurve"
						}
					]
				}
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program",
				address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
			},
			{
				name: "global_volume_accumulator",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108,
								95,
								118,
								111,
								108,
								117,
								109,
								101,
								95,
								97,
								99,
								99,
								117,
								109,
								117,
								108,
								97,
								116,
								111,
								114
							]
						}
					]
				}
			},
			{
				name: "user_volume_accumulator",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								117,
								115,
								101,
								114,
								95,
								118,
								111,
								108,
								117,
								109,
								101,
								95,
								97,
								99,
								99,
								117,
								109,
								117,
								108,
								97,
								116,
								111,
								114
							]
						},
						{
							kind: "account",
							path: "user"
						}
					]
				}
			},
			{
				name: "fee_config",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								102,
								101,
								101,
								95,
								99,
								111,
								110,
								102,
								105,
								103
							]
						},
						{
							kind: "const",
							value: [
								1,
								86,
								224,
								246,
								147,
								102,
								90,
								207,
								68,
								219,
								21,
								104,
								191,
								23,
								91,
								170,
								81,
								137,
								203,
								151,
								245,
								210,
								255,
								59,
								101,
								93,
								43,
								182,
								253,
								109,
								24,
								176
							]
						}
					],
					program: {
						kind: "account",
						path: "fee_program"
					}
				}
			},
			{
				name: "fee_program",
				address: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ"
			}
		],
		args: [
			{
				name: "spendable_sol_in",
				type: "u64"
			},
			{
				name: "min_tokens_out",
				type: "u64"
			},
			{
				name: "track_volume",
				type: {
					defined: {
						name: "OptionBool"
					}
				}
			}
		]
	},
	{
		name: "claim_cashback",
		discriminator: [
			37,
			58,
			35,
			126,
			190,
			53,
			228,
			197
		],
		accounts: [
			{
				name: "user",
				writable: true
			},
			{
				name: "user_volume_accumulator",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								117,
								115,
								101,
								114,
								95,
								118,
								111,
								108,
								117,
								109,
								101,
								95,
								97,
								99,
								99,
								117,
								109,
								117,
								108,
								97,
								116,
								111,
								114
							]
						},
						{
							kind: "account",
							path: "user"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program",
				address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
			}
		],
		args: [
		]
	},
	{
		name: "claim_token_incentives",
		discriminator: [
			16,
			4,
			71,
			28,
			204,
			1,
			40,
			27
		],
		accounts: [
			{
				name: "user"
			},
			{
				name: "user_ata",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "account",
							path: "user"
						},
						{
							kind: "account",
							path: "token_program"
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "const",
						value: [
							140,
							151,
							37,
							143,
							78,
							36,
							137,
							241,
							187,
							61,
							16,
							41,
							20,
							142,
							13,
							131,
							11,
							90,
							19,
							153,
							218,
							255,
							16,
							132,
							4,
							142,
							123,
							216,
							219,
							233,
							248,
							89
						]
					}
				}
			},
			{
				name: "global_volume_accumulator",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108,
								95,
								118,
								111,
								108,
								117,
								109,
								101,
								95,
								97,
								99,
								99,
								117,
								109,
								117,
								108,
								97,
								116,
								111,
								114
							]
						}
					]
				}
			},
			{
				name: "global_incentive_token_account",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "account",
							path: "global_volume_accumulator"
						},
						{
							kind: "account",
							path: "token_program"
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "const",
						value: [
							140,
							151,
							37,
							143,
							78,
							36,
							137,
							241,
							187,
							61,
							16,
							41,
							20,
							142,
							13,
							131,
							11,
							90,
							19,
							153,
							218,
							255,
							16,
							132,
							4,
							142,
							123,
							216,
							219,
							233,
							248,
							89
						]
					}
				}
			},
			{
				name: "user_volume_accumulator",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								117,
								115,
								101,
								114,
								95,
								118,
								111,
								108,
								117,
								109,
								101,
								95,
								97,
								99,
								99,
								117,
								109,
								117,
								108,
								97,
								116,
								111,
								114
							]
						},
						{
							kind: "account",
							path: "user"
						}
					]
				}
			},
			{
				name: "mint",
				relations: [
					"global_volume_accumulator"
				]
			},
			{
				name: "token_program"
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			},
			{
				name: "associated_token_program",
				address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program",
				address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
			},
			{
				name: "payer",
				writable: true,
				signer: true
			}
		],
		args: [
		]
	},
	{
		name: "close_user_volume_accumulator",
		discriminator: [
			249,
			69,
			164,
			218,
			150,
			103,
			84,
			138
		],
		accounts: [
			{
				name: "user",
				writable: true,
				signer: true
			},
			{
				name: "user_volume_accumulator",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								117,
								115,
								101,
								114,
								95,
								118,
								111,
								108,
								117,
								109,
								101,
								95,
								97,
								99,
								99,
								117,
								109,
								117,
								108,
								97,
								116,
								111,
								114
							]
						},
						{
							kind: "account",
							path: "user"
						}
					]
				}
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
		]
	},
	{
		name: "collect_creator_fee",
		docs: [
			"Collects creator_fee from creator_vault to the coin creator account"
		],
		discriminator: [
			20,
			22,
			86,
			123,
			198,
			28,
			219,
			132
		],
		accounts: [
			{
				name: "creator",
				writable: true
			},
			{
				name: "creator_vault",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								99,
								114,
								101,
								97,
								116,
								111,
								114,
								45,
								118,
								97,
								117,
								108,
								116
							]
						},
						{
							kind: "account",
							path: "creator"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
		]
	},
	{
		name: "create",
		docs: [
			"Creates a new coin and bonding curve."
		],
		discriminator: [
			24,
			30,
			200,
			40,
			5,
			28,
			7,
			119
		],
		accounts: [
			{
				name: "mint",
				writable: true,
				signer: true
			},
			{
				name: "mint_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								109,
								105,
								110,
								116,
								45,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "bonding_curve",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								98,
								111,
								110,
								100,
								105,
								110,
								103,
								45,
								99,
								117,
								114,
								118,
								101
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					]
				}
			},
			{
				name: "associated_bonding_curve",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "account",
							path: "bonding_curve"
						},
						{
							kind: "const",
							value: [
								6,
								221,
								246,
								225,
								215,
								101,
								161,
								147,
								217,
								203,
								225,
								70,
								206,
								235,
								121,
								172,
								28,
								180,
								133,
								237,
								95,
								91,
								55,
								145,
								58,
								140,
								245,
								133,
								126,
								255,
								0,
								169
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "const",
						value: [
							140,
							151,
							37,
							143,
							78,
							36,
							137,
							241,
							187,
							61,
							16,
							41,
							20,
							142,
							13,
							131,
							11,
							90,
							19,
							153,
							218,
							255,
							16,
							132,
							4,
							142,
							123,
							216,
							219,
							233,
							248,
							89
						]
					}
				}
			},
			{
				name: "global",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "mpl_token_metadata",
				address: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
			},
			{
				name: "metadata",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								109,
								101,
								116,
								97,
								100,
								97,
								116,
								97
							]
						},
						{
							kind: "const",
							value: [
								11,
								112,
								101,
								177,
								227,
								209,
								124,
								69,
								56,
								157,
								82,
								127,
								107,
								4,
								195,
								205,
								88,
								184,
								108,
								115,
								26,
								160,
								253,
								181,
								73,
								182,
								209,
								188,
								3,
								248,
								41,
								70
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "account",
						path: "mpl_token_metadata"
					}
				}
			},
			{
				name: "user",
				writable: true,
				signer: true
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			},
			{
				name: "token_program",
				address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
			},
			{
				name: "associated_token_program",
				address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
			},
			{
				name: "rent",
				address: "SysvarRent111111111111111111111111111111111"
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
			{
				name: "name",
				type: "string"
			},
			{
				name: "symbol",
				type: "string"
			},
			{
				name: "uri",
				type: "string"
			},
			{
				name: "creator",
				type: "pubkey"
			}
		]
	},
	{
		name: "create_v2",
		docs: [
			"Creates a new spl-22 coin and bonding curve."
		],
		discriminator: [
			214,
			144,
			76,
			236,
			95,
			139,
			49,
			180
		],
		accounts: [
			{
				name: "mint",
				writable: true,
				signer: true
			},
			{
				name: "mint_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								109,
								105,
								110,
								116,
								45,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "bonding_curve",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								98,
								111,
								110,
								100,
								105,
								110,
								103,
								45,
								99,
								117,
								114,
								118,
								101
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					]
				}
			},
			{
				name: "associated_bonding_curve",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "account",
							path: "bonding_curve"
						},
						{
							kind: "account",
							path: "token_program"
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "const",
						value: [
							140,
							151,
							37,
							143,
							78,
							36,
							137,
							241,
							187,
							61,
							16,
							41,
							20,
							142,
							13,
							131,
							11,
							90,
							19,
							153,
							218,
							255,
							16,
							132,
							4,
							142,
							123,
							216,
							219,
							233,
							248,
							89
						]
					}
				}
			},
			{
				name: "global",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "user",
				writable: true,
				signer: true
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			},
			{
				name: "token_program",
				address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
			},
			{
				name: "associated_token_program",
				address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
			},
			{
				name: "mayhem_program_id",
				writable: true,
				address: "MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e"
			},
			{
				name: "global_params",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108,
								45,
								112,
								97,
								114,
								97,
								109,
								115
							]
						}
					],
					program: {
						kind: "const",
						value: [
							5,
							42,
							229,
							215,
							167,
							218,
							167,
							36,
							166,
							234,
							176,
							167,
							41,
							84,
							145,
							133,
							90,
							212,
							160,
							103,
							22,
							96,
							103,
							76,
							78,
							3,
							69,
							89,
							128,
							61,
							101,
							163
						]
					}
				}
			},
			{
				name: "sol_vault",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								111,
								108,
								45,
								118,
								97,
								117,
								108,
								116
							]
						}
					],
					program: {
						kind: "const",
						value: [
							5,
							42,
							229,
							215,
							167,
							218,
							167,
							36,
							166,
							234,
							176,
							167,
							41,
							84,
							145,
							133,
							90,
							212,
							160,
							103,
							22,
							96,
							103,
							76,
							78,
							3,
							69,
							89,
							128,
							61,
							101,
							163
						]
					}
				}
			},
			{
				name: "mayhem_state",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								109,
								97,
								121,
								104,
								101,
								109,
								45,
								115,
								116,
								97,
								116,
								101
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "const",
						value: [
							5,
							42,
							229,
							215,
							167,
							218,
							167,
							36,
							166,
							234,
							176,
							167,
							41,
							84,
							145,
							133,
							90,
							212,
							160,
							103,
							22,
							96,
							103,
							76,
							78,
							3,
							69,
							89,
							128,
							61,
							101,
							163
						]
					}
				}
			},
			{
				name: "mayhem_token_vault",
				writable: true
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
			{
				name: "name",
				type: "string"
			},
			{
				name: "symbol",
				type: "string"
			},
			{
				name: "uri",
				type: "string"
			},
			{
				name: "creator",
				type: "pubkey"
			},
			{
				name: "is_mayhem_mode",
				type: "bool"
			},
			{
				name: "is_cashback_enabled",
				type: {
					defined: {
						name: "OptionBool"
					}
				}
			}
		]
	},
	{
		name: "distribute_creator_fees",
		docs: [
			"Distributes creator fees to shareholders based on their share percentages",
			"The creator vault needs to have at least the minimum distributable amount to distribute fees",
			"This can be checked with the get_minimum_distributable_fee instruction"
		],
		discriminator: [
			165,
			114,
			103,
			0,
			121,
			206,
			247,
			81
		],
		accounts: [
			{
				name: "mint",
				relations: [
					"sharing_config"
				]
			},
			{
				name: "bonding_curve",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								98,
								111,
								110,
								100,
								105,
								110,
								103,
								45,
								99,
								117,
								114,
								118,
								101
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					]
				}
			},
			{
				name: "sharing_config",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								104,
								97,
								114,
								105,
								110,
								103,
								45,
								99,
								111,
								110,
								102,
								105,
								103
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "const",
						value: [
							12,
							53,
							255,
							169,
							5,
							90,
							142,
							86,
							141,
							168,
							247,
							188,
							7,
							86,
							21,
							39,
							76,
							241,
							201,
							44,
							164,
							31,
							64,
							0,
							156,
							81,
							106,
							164,
							20,
							194,
							124,
							112
						]
					}
				}
			},
			{
				name: "creator_vault",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								99,
								114,
								101,
								97,
								116,
								111,
								114,
								45,
								118,
								97,
								117,
								108,
								116
							]
						},
						{
							kind: "account",
							path: "bonding_curve.creator",
							account: "BondingCurve"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program",
				address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
			}
		],
		args: [
		],
		returns: {
			defined: {
				name: "DistributeCreatorFeesEvent"
			}
		}
	},
	{
		name: "extend_account",
		docs: [
			"Extends the size of program-owned accounts"
		],
		discriminator: [
			234,
			102,
			194,
			203,
			150,
			72,
			62,
			229
		],
		accounts: [
			{
				name: "account",
				writable: true
			},
			{
				name: "user",
				signer: true
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
		]
	},
	{
		name: "get_minimum_distributable_fee",
		docs: [
			"Permissionless instruction to check the minimum required fees for distribution",
			"Returns the minimum required balance from the creator_vault and whether distribution can proceed"
		],
		discriminator: [
			117,
			225,
			127,
			202,
			134,
			95,
			68,
			35
		],
		accounts: [
			{
				name: "mint",
				relations: [
					"sharing_config"
				]
			},
			{
				name: "bonding_curve",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								98,
								111,
								110,
								100,
								105,
								110,
								103,
								45,
								99,
								117,
								114,
								118,
								101
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					]
				}
			},
			{
				name: "sharing_config",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								104,
								97,
								114,
								105,
								110,
								103,
								45,
								99,
								111,
								110,
								102,
								105,
								103
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "const",
						value: [
							12,
							53,
							255,
							169,
							5,
							90,
							142,
							86,
							141,
							168,
							247,
							188,
							7,
							86,
							21,
							39,
							76,
							241,
							201,
							44,
							164,
							31,
							64,
							0,
							156,
							81,
							106,
							164,
							20,
							194,
							124,
							112
						]
					}
				}
			},
			{
				name: "creator_vault",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								99,
								114,
								101,
								97,
								116,
								111,
								114,
								45,
								118,
								97,
								117,
								108,
								116
							]
						},
						{
							kind: "account",
							path: "bonding_curve.creator",
							account: "BondingCurve"
						}
					]
				}
			}
		],
		args: [
		],
		returns: {
			defined: {
				name: "MinimumDistributableFeeEvent"
			}
		}
	},
	{
		name: "init_user_volume_accumulator",
		discriminator: [
			94,
			6,
			202,
			115,
			255,
			96,
			232,
			183
		],
		accounts: [
			{
				name: "payer",
				writable: true,
				signer: true
			},
			{
				name: "user"
			},
			{
				name: "user_volume_accumulator",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								117,
								115,
								101,
								114,
								95,
								118,
								111,
								108,
								117,
								109,
								101,
								95,
								97,
								99,
								99,
								117,
								109,
								117,
								108,
								97,
								116,
								111,
								114
							]
						},
						{
							kind: "account",
							path: "user"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
		]
	},
	{
		name: "initialize",
		docs: [
			"Creates the global state."
		],
		discriminator: [
			175,
			175,
			109,
			31,
			13,
			152,
			155,
			237
		],
		accounts: [
			{
				name: "global",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "user",
				writable: true,
				signer: true
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
		]
	},
	{
		name: "migrate",
		docs: [
			"Migrates liquidity to pump_amm if the bonding curve is complete"
		],
		discriminator: [
			155,
			234,
			231,
			146,
			236,
			158,
			162,
			30
		],
		accounts: [
			{
				name: "global",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "withdraw_authority",
				writable: true,
				relations: [
					"global"
				]
			},
			{
				name: "mint"
			},
			{
				name: "bonding_curve",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								98,
								111,
								110,
								100,
								105,
								110,
								103,
								45,
								99,
								117,
								114,
								118,
								101
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					]
				}
			},
			{
				name: "associated_bonding_curve",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "account",
							path: "bonding_curve"
						},
						{
							kind: "account",
							path: "mint"
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "const",
						value: [
							140,
							151,
							37,
							143,
							78,
							36,
							137,
							241,
							187,
							61,
							16,
							41,
							20,
							142,
							13,
							131,
							11,
							90,
							19,
							153,
							218,
							255,
							16,
							132,
							4,
							142,
							123,
							216,
							219,
							233,
							248,
							89
						]
					}
				}
			},
			{
				name: "user",
				signer: true
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			},
			{
				name: "token_program",
				address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
			},
			{
				name: "pump_amm",
				address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"
			},
			{
				name: "pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "const",
							value: [
								0,
								0
							]
						},
						{
							kind: "account",
							path: "pool_authority"
						},
						{
							kind: "account",
							path: "mint"
						},
						{
							kind: "account",
							path: "wsol_mint"
						}
					],
					program: {
						kind: "account",
						path: "pump_amm"
					}
				}
			},
			{
				name: "pool_authority",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								112,
								111,
								111,
								108,
								45,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					]
				}
			},
			{
				name: "pool_authority_mint_account",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "account",
							path: "pool_authority"
						},
						{
							kind: "account",
							path: "mint"
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "account",
						path: "associated_token_program"
					}
				}
			},
			{
				name: "pool_authority_wsol_account",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "account",
							path: "pool_authority"
						},
						{
							kind: "account",
							path: "token_program"
						},
						{
							kind: "account",
							path: "wsol_mint"
						}
					],
					program: {
						kind: "account",
						path: "associated_token_program"
					}
				}
			},
			{
				name: "amm_global_config",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108,
								95,
								99,
								111,
								110,
								102,
								105,
								103
							]
						}
					],
					program: {
						kind: "account",
						path: "pump_amm"
					}
				}
			},
			{
				name: "wsol_mint",
				address: "So11111111111111111111111111111111111111112"
			},
			{
				name: "lp_mint",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								112,
								111,
								111,
								108,
								95,
								108,
								112,
								95,
								109,
								105,
								110,
								116
							]
						},
						{
							kind: "account",
							path: "pool"
						}
					],
					program: {
						kind: "account",
						path: "pump_amm"
					}
				}
			},
			{
				name: "user_pool_token_account",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "account",
							path: "pool_authority"
						},
						{
							kind: "account",
							path: "token_2022_program"
						},
						{
							kind: "account",
							path: "lp_mint"
						}
					],
					program: {
						kind: "account",
						path: "associated_token_program"
					}
				}
			},
			{
				name: "pool_base_token_account",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "account",
							path: "pool"
						},
						{
							kind: "account",
							path: "mint"
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "account",
						path: "associated_token_program"
					}
				}
			},
			{
				name: "pool_quote_token_account",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "account",
							path: "pool"
						},
						{
							kind: "account",
							path: "token_program"
						},
						{
							kind: "account",
							path: "wsol_mint"
						}
					],
					program: {
						kind: "account",
						path: "associated_token_program"
					}
				}
			},
			{
				name: "token_2022_program",
				address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
			},
			{
				name: "associated_token_program",
				address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
			},
			{
				name: "pump_amm_event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					],
					program: {
						kind: "account",
						path: "pump_amm"
					}
				}
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
		]
	},
	{
		name: "migrate_bonding_curve_creator",
		discriminator: [
			87,
			124,
			52,
			191,
			52,
			38,
			214,
			232
		],
		accounts: [
			{
				name: "mint",
				relations: [
					"sharing_config"
				]
			},
			{
				name: "bonding_curve",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								98,
								111,
								110,
								100,
								105,
								110,
								103,
								45,
								99,
								117,
								114,
								118,
								101
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					]
				}
			},
			{
				name: "sharing_config",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								104,
								97,
								114,
								105,
								110,
								103,
								45,
								99,
								111,
								110,
								102,
								105,
								103
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "const",
						value: [
							12,
							53,
							255,
							169,
							5,
							90,
							142,
							86,
							141,
							168,
							247,
							188,
							7,
							86,
							21,
							39,
							76,
							241,
							201,
							44,
							164,
							31,
							64,
							0,
							156,
							81,
							106,
							164,
							20,
							194,
							124,
							112
						]
					}
				}
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
		]
	},
	{
		name: "sell",
		docs: [
			"Sells tokens into a bonding curve.",
			"For cashback coins, optionally pass user_volume_accumulator as remaining_accounts[0].",
			"If provided and valid, creator_fee goes to user_volume_accumulator.",
			"Otherwise, falls back to transferring creator_fee to creator_vault."
		],
		discriminator: [
			51,
			230,
			133,
			164,
			1,
			127,
			131,
			173
		],
		accounts: [
			{
				name: "global",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "fee_recipient",
				writable: true
			},
			{
				name: "mint"
			},
			{
				name: "bonding_curve",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								98,
								111,
								110,
								100,
								105,
								110,
								103,
								45,
								99,
								117,
								114,
								118,
								101
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					]
				}
			},
			{
				name: "associated_bonding_curve",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "account",
							path: "bonding_curve"
						},
						{
							kind: "account",
							path: "token_program"
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "const",
						value: [
							140,
							151,
							37,
							143,
							78,
							36,
							137,
							241,
							187,
							61,
							16,
							41,
							20,
							142,
							13,
							131,
							11,
							90,
							19,
							153,
							218,
							255,
							16,
							132,
							4,
							142,
							123,
							216,
							219,
							233,
							248,
							89
						]
					}
				}
			},
			{
				name: "associated_user",
				writable: true
			},
			{
				name: "user",
				writable: true,
				signer: true
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			},
			{
				name: "creator_vault",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								99,
								114,
								101,
								97,
								116,
								111,
								114,
								45,
								118,
								97,
								117,
								108,
								116
							]
						},
						{
							kind: "account",
							path: "bonding_curve.creator",
							account: "BondingCurve"
						}
					]
				}
			},
			{
				name: "token_program"
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program",
				address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
			},
			{
				name: "fee_config",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								102,
								101,
								101,
								95,
								99,
								111,
								110,
								102,
								105,
								103
							]
						},
						{
							kind: "const",
							value: [
								1,
								86,
								224,
								246,
								147,
								102,
								90,
								207,
								68,
								219,
								21,
								104,
								191,
								23,
								91,
								170,
								81,
								137,
								203,
								151,
								245,
								210,
								255,
								59,
								101,
								93,
								43,
								182,
								253,
								109,
								24,
								176
							]
						}
					],
					program: {
						kind: "account",
						path: "fee_program"
					}
				}
			},
			{
				name: "fee_program",
				address: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ"
			}
		],
		args: [
			{
				name: "amount",
				type: "u64"
			},
			{
				name: "min_sol_output",
				type: "u64"
			}
		]
	},
	{
		name: "set_creator",
		docs: [
			"Allows Global::set_creator_authority to set the bonding curve creator from Metaplex metadata or input argument"
		],
		discriminator: [
			254,
			148,
			255,
			112,
			207,
			142,
			170,
			165
		],
		accounts: [
			{
				name: "set_creator_authority",
				signer: true,
				relations: [
					"global"
				]
			},
			{
				name: "global",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "mint"
			},
			{
				name: "metadata",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								109,
								101,
								116,
								97,
								100,
								97,
								116,
								97
							]
						},
						{
							kind: "const",
							value: [
								11,
								112,
								101,
								177,
								227,
								209,
								124,
								69,
								56,
								157,
								82,
								127,
								107,
								4,
								195,
								205,
								88,
								184,
								108,
								115,
								26,
								160,
								253,
								181,
								73,
								182,
								209,
								188,
								3,
								248,
								41,
								70
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "const",
						value: [
							11,
							112,
							101,
							177,
							227,
							209,
							124,
							69,
							56,
							157,
							82,
							127,
							107,
							4,
							195,
							205,
							88,
							184,
							108,
							115,
							26,
							160,
							253,
							181,
							73,
							182,
							209,
							188,
							3,
							248,
							41,
							70
						]
					}
				}
			},
			{
				name: "bonding_curve",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								98,
								111,
								110,
								100,
								105,
								110,
								103,
								45,
								99,
								117,
								114,
								118,
								101
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					]
				}
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
			{
				name: "creator",
				type: "pubkey"
			}
		]
	},
	{
		name: "set_mayhem_virtual_params",
		discriminator: [
			61,
			169,
			188,
			191,
			153,
			149,
			42,
			97
		],
		accounts: [
			{
				name: "sol_vault_authority",
				writable: true,
				signer: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								111,
								108,
								45,
								118,
								97,
								117,
								108,
								116
							]
						}
					],
					program: {
						kind: "const",
						value: [
							5,
							42,
							229,
							215,
							167,
							218,
							167,
							36,
							166,
							234,
							176,
							167,
							41,
							84,
							145,
							133,
							90,
							212,
							160,
							103,
							22,
							96,
							103,
							76,
							78,
							3,
							69,
							89,
							128,
							61,
							101,
							163
						]
					}
				}
			},
			{
				name: "mayhem_token_vault",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "account",
							path: "sol_vault_authority"
						},
						{
							kind: "account",
							path: "token_program"
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "const",
						value: [
							140,
							151,
							37,
							143,
							78,
							36,
							137,
							241,
							187,
							61,
							16,
							41,
							20,
							142,
							13,
							131,
							11,
							90,
							19,
							153,
							218,
							255,
							16,
							132,
							4,
							142,
							123,
							216,
							219,
							233,
							248,
							89
						]
					}
				}
			},
			{
				name: "mint"
			},
			{
				name: "global",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "bonding_curve",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								98,
								111,
								110,
								100,
								105,
								110,
								103,
								45,
								99,
								117,
								114,
								118,
								101
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					]
				}
			},
			{
				name: "token_program",
				address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
		]
	},
	{
		name: "set_metaplex_creator",
		docs: [
			"Syncs the bonding curve creator with the Metaplex metadata creator if it exists"
		],
		discriminator: [
			138,
			96,
			174,
			217,
			48,
			85,
			197,
			246
		],
		accounts: [
			{
				name: "mint"
			},
			{
				name: "metadata",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								109,
								101,
								116,
								97,
								100,
								97,
								116,
								97
							]
						},
						{
							kind: "const",
							value: [
								11,
								112,
								101,
								177,
								227,
								209,
								124,
								69,
								56,
								157,
								82,
								127,
								107,
								4,
								195,
								205,
								88,
								184,
								108,
								115,
								26,
								160,
								253,
								181,
								73,
								182,
								209,
								188,
								3,
								248,
								41,
								70
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					],
					program: {
						kind: "const",
						value: [
							11,
							112,
							101,
							177,
							227,
							209,
							124,
							69,
							56,
							157,
							82,
							127,
							107,
							4,
							195,
							205,
							88,
							184,
							108,
							115,
							26,
							160,
							253,
							181,
							73,
							182,
							209,
							188,
							3,
							248,
							41,
							70
						]
					}
				}
			},
			{
				name: "bonding_curve",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								98,
								111,
								110,
								100,
								105,
								110,
								103,
								45,
								99,
								117,
								114,
								118,
								101
							]
						},
						{
							kind: "account",
							path: "mint"
						}
					]
				}
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
		]
	},
	{
		name: "set_params",
		docs: [
			"Sets the global state parameters."
		],
		discriminator: [
			27,
			234,
			178,
			52,
			147,
			2,
			187,
			141
		],
		accounts: [
			{
				name: "global",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "authority",
				writable: true,
				signer: true,
				relations: [
					"global"
				]
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
			{
				name: "initial_virtual_token_reserves",
				type: "u64"
			},
			{
				name: "initial_virtual_sol_reserves",
				type: "u64"
			},
			{
				name: "initial_real_token_reserves",
				type: "u64"
			},
			{
				name: "token_total_supply",
				type: "u64"
			},
			{
				name: "fee_basis_points",
				type: "u64"
			},
			{
				name: "withdraw_authority",
				type: "pubkey"
			},
			{
				name: "enable_migrate",
				type: "bool"
			},
			{
				name: "pool_migration_fee",
				type: "u64"
			},
			{
				name: "creator_fee_basis_points",
				type: "u64"
			},
			{
				name: "set_creator_authority",
				type: "pubkey"
			},
			{
				name: "admin_set_creator_authority",
				type: "pubkey"
			}
		]
	},
	{
		name: "set_reserved_fee_recipients",
		discriminator: [
			111,
			172,
			162,
			232,
			114,
			89,
			213,
			142
		],
		accounts: [
			{
				name: "global",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "authority",
				signer: true,
				relations: [
					"global"
				]
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
			{
				name: "whitelist_pda",
				type: "pubkey"
			}
		]
	},
	{
		name: "sync_user_volume_accumulator",
		discriminator: [
			86,
			31,
			192,
			87,
			163,
			87,
			79,
			238
		],
		accounts: [
			{
				name: "user"
			},
			{
				name: "global_volume_accumulator",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108,
								95,
								118,
								111,
								108,
								117,
								109,
								101,
								95,
								97,
								99,
								99,
								117,
								109,
								117,
								108,
								97,
								116,
								111,
								114
							]
						}
					]
				}
			},
			{
				name: "user_volume_accumulator",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								117,
								115,
								101,
								114,
								95,
								118,
								111,
								108,
								117,
								109,
								101,
								95,
								97,
								99,
								99,
								117,
								109,
								117,
								108,
								97,
								116,
								111,
								114
							]
						},
						{
							kind: "account",
							path: "user"
						}
					]
				}
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
		]
	},
	{
		name: "toggle_cashback_enabled",
		discriminator: [
			115,
			103,
			224,
			255,
			189,
			89,
			86,
			195
		],
		accounts: [
			{
				name: "global",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "authority",
				writable: true,
				signer: true,
				relations: [
					"global"
				]
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
			{
				name: "enabled",
				type: "bool"
			}
		]
	},
	{
		name: "toggle_create_v2",
		discriminator: [
			28,
			255,
			230,
			240,
			172,
			107,
			203,
			171
		],
		accounts: [
			{
				name: "global",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "authority",
				writable: true,
				signer: true,
				relations: [
					"global"
				]
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
			{
				name: "enabled",
				type: "bool"
			}
		]
	},
	{
		name: "toggle_mayhem_mode",
		discriminator: [
			1,
			9,
			111,
			208,
			100,
			31,
			255,
			163
		],
		accounts: [
			{
				name: "global",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "authority",
				writable: true,
				signer: true,
				relations: [
					"global"
				]
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
			{
				name: "enabled",
				type: "bool"
			}
		]
	},
	{
		name: "update_global_authority",
		discriminator: [
			227,
			181,
			74,
			196,
			208,
			21,
			97,
			213
		],
		accounts: [
			{
				name: "global",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								103,
								108,
								111,
								98,
								97,
								108
							]
						}
					]
				}
			},
			{
				name: "authority",
				signer: true,
				relations: [
					"global"
				]
			},
			{
				name: "new_authority"
			},
			{
				name: "event_authority",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								95,
								95,
								101,
								118,
								101,
								110,
								116,
								95,
								97,
								117,
								116,
								104,
								111,
								114,
								105,
								116,
								121
							]
						}
					]
				}
			},
			{
				name: "program"
			}
		],
		args: [
		]
	}
];
var accounts = [
	{
		name: "BondingCurve",
		discriminator: [
			23,
			183,
			248,
			55,
			96,
			216,
			172,
			96
		]
	},
	{
		name: "FeeConfig",
		discriminator: [
			143,
			52,
			146,
			187,
			219,
			123,
			76,
			155
		]
	},
	{
		name: "Global",
		discriminator: [
			167,
			232,
			232,
			177,
			200,
			108,
			114,
			127
		]
	},
	{
		name: "GlobalVolumeAccumulator",
		discriminator: [
			202,
			42,
			246,
			43,
			142,
			190,
			30,
			255
		]
	},
	{
		name: "SharingConfig",
		discriminator: [
			216,
			74,
			9,
			0,
			56,
			140,
			93,
			75
		]
	},
	{
		name: "UserVolumeAccumulator",
		discriminator: [
			86,
			255,
			112,
			14,
			102,
			53,
			154,
			250
		]
	}
];
var events = [
	{
		name: "AdminSetCreatorEvent",
		discriminator: [
			64,
			69,
			192,
			104,
			29,
			30,
			25,
			107
		]
	},
	{
		name: "AdminSetIdlAuthorityEvent",
		discriminator: [
			245,
			59,
			70,
			34,
			75,
			185,
			109,
			92
		]
	},
	{
		name: "AdminUpdateTokenIncentivesEvent",
		discriminator: [
			147,
			250,
			108,
			120,
			247,
			29,
			67,
			222
		]
	},
	{
		name: "ClaimCashbackEvent",
		discriminator: [
			226,
			214,
			246,
			33,
			7,
			242,
			147,
			229
		]
	},
	{
		name: "ClaimTokenIncentivesEvent",
		discriminator: [
			79,
			172,
			246,
			49,
			205,
			91,
			206,
			232
		]
	},
	{
		name: "CloseUserVolumeAccumulatorEvent",
		discriminator: [
			146,
			159,
			189,
			172,
			146,
			88,
			56,
			244
		]
	},
	{
		name: "CollectCreatorFeeEvent",
		discriminator: [
			122,
			2,
			127,
			1,
			14,
			191,
			12,
			175
		]
	},
	{
		name: "CompleteEvent",
		discriminator: [
			95,
			114,
			97,
			156,
			212,
			46,
			152,
			8
		]
	},
	{
		name: "CompletePumpAmmMigrationEvent",
		discriminator: [
			189,
			233,
			93,
			185,
			92,
			148,
			234,
			148
		]
	},
	{
		name: "CreateEvent",
		discriminator: [
			27,
			114,
			169,
			77,
			222,
			235,
			99,
			118
		]
	},
	{
		name: "DistributeCreatorFeesEvent",
		discriminator: [
			165,
			55,
			129,
			112,
			4,
			179,
			202,
			40
		]
	},
	{
		name: "ExtendAccountEvent",
		discriminator: [
			97,
			97,
			215,
			144,
			93,
			146,
			22,
			124
		]
	},
	{
		name: "InitUserVolumeAccumulatorEvent",
		discriminator: [
			134,
			36,
			13,
			72,
			232,
			101,
			130,
			216
		]
	},
	{
		name: "MigrateBondingCurveCreatorEvent",
		discriminator: [
			155,
			167,
			104,
			220,
			213,
			108,
			243,
			3
		]
	},
	{
		name: "MinimumDistributableFeeEvent",
		discriminator: [
			168,
			216,
			132,
			239,
			235,
			182,
			49,
			52
		]
	},
	{
		name: "ReservedFeeRecipientsEvent",
		discriminator: [
			43,
			188,
			250,
			18,
			221,
			75,
			187,
			95
		]
	},
	{
		name: "SetCreatorEvent",
		discriminator: [
			237,
			52,
			123,
			37,
			245,
			251,
			72,
			210
		]
	},
	{
		name: "SetMetaplexCreatorEvent",
		discriminator: [
			142,
			203,
			6,
			32,
			127,
			105,
			191,
			162
		]
	},
	{
		name: "SetParamsEvent",
		discriminator: [
			223,
			195,
			159,
			246,
			62,
			48,
			143,
			131
		]
	},
	{
		name: "SyncUserVolumeAccumulatorEvent",
		discriminator: [
			197,
			122,
			167,
			124,
			116,
			81,
			91,
			255
		]
	},
	{
		name: "TradeEvent",
		discriminator: [
			189,
			219,
			127,
			211,
			78,
			230,
			97,
			238
		]
	},
	{
		name: "UpdateGlobalAuthorityEvent",
		discriminator: [
			182,
			195,
			137,
			42,
			35,
			206,
			207,
			247
		]
	},
	{
		name: "UpdateMayhemVirtualParamsEvent",
		discriminator: [
			117,
			123,
			228,
			182,
			161,
			168,
			220,
			214
		]
	}
];
var errors = [
	{
		code: 6000,
		name: "NotAuthorized",
		msg: "The given account is not authorized to execute this instruction."
	},
	{
		code: 6001,
		name: "AlreadyInitialized",
		msg: "The program is already initialized."
	},
	{
		code: 6002,
		name: "TooMuchSolRequired",
		msg: "slippage: Too much SOL required to buy the given amount of tokens."
	},
	{
		code: 6003,
		name: "TooLittleSolReceived",
		msg: "slippage: Too little SOL received to sell the given amount of tokens."
	},
	{
		code: 6004,
		name: "MintDoesNotMatchBondingCurve",
		msg: "The mint does not match the bonding curve."
	},
	{
		code: 6005,
		name: "BondingCurveComplete",
		msg: "The bonding curve has completed and liquidity migrated to raydium."
	},
	{
		code: 6006,
		name: "BondingCurveNotComplete",
		msg: "The bonding curve has not completed."
	},
	{
		code: 6007,
		name: "NotInitialized",
		msg: "The program is not initialized."
	},
	{
		code: 6008,
		name: "WithdrawTooFrequent",
		msg: "Withdraw too frequent"
	},
	{
		code: 6009,
		name: "NewSizeShouldBeGreaterThanCurrentSize",
		msg: "new_size should be > current_size"
	},
	{
		code: 6010,
		name: "AccountTypeNotSupported",
		msg: "Account type not supported"
	},
	{
		code: 6011,
		name: "InitialRealTokenReservesShouldBeLessThanTokenTotalSupply",
		msg: "initial_real_token_reserves should be less than token_total_supply"
	},
	{
		code: 6012,
		name: "InitialVirtualTokenReservesShouldBeGreaterThanInitialRealTokenReserves",
		msg: "initial_virtual_token_reserves should be greater than initial_real_token_reserves"
	},
	{
		code: 6013,
		name: "FeeBasisPointsGreaterThanMaximum",
		msg: "fee_basis_points greater than maximum"
	},
	{
		code: 6014,
		name: "AllZerosWithdrawAuthority",
		msg: "Withdraw authority cannot be set to System Program ID"
	},
	{
		code: 6015,
		name: "PoolMigrationFeeShouldBeLessThanFinalRealSolReserves",
		msg: "pool_migration_fee should be less than final_real_sol_reserves"
	},
	{
		code: 6016,
		name: "PoolMigrationFeeShouldBeGreaterThanCreatorFeePlusMaxMigrateFees",
		msg: "pool_migration_fee should be greater than creator_fee + MAX_MIGRATE_FEES"
	},
	{
		code: 6017,
		name: "DisabledWithdraw",
		msg: "Migrate instruction is disabled"
	},
	{
		code: 6018,
		name: "DisabledMigrate",
		msg: "Migrate instruction is disabled"
	},
	{
		code: 6019,
		name: "InvalidCreator",
		msg: "Invalid creator pubkey"
	},
	{
		code: 6020,
		name: "BuyZeroAmount",
		msg: "Buy zero amount"
	},
	{
		code: 6021,
		name: "NotEnoughTokensToBuy",
		msg: "Not enough tokens to buy"
	},
	{
		code: 6022,
		name: "SellZeroAmount",
		msg: "Sell zero amount"
	},
	{
		code: 6023,
		name: "NotEnoughTokensToSell",
		msg: "Not enough tokens to sell"
	},
	{
		code: 6024,
		name: "Overflow",
		msg: "Overflow"
	},
	{
		code: 6025,
		name: "Truncation",
		msg: "Truncation"
	},
	{
		code: 6026,
		name: "DivisionByZero",
		msg: "Division by zero"
	},
	{
		code: 6027,
		name: "NotEnoughRemainingAccounts",
		msg: "Not enough remaining accounts"
	},
	{
		code: 6028,
		name: "AllFeeRecipientsShouldBeNonZero",
		msg: "All fee recipients should be non-zero"
	},
	{
		code: 6029,
		name: "UnsortedNotUniqueFeeRecipients",
		msg: "Unsorted or not unique fee recipients"
	},
	{
		code: 6030,
		name: "CreatorShouldNotBeZero",
		msg: "Creator should not be zero"
	},
	{
		code: 6031,
		name: "StartTimeInThePast"
	},
	{
		code: 6032,
		name: "EndTimeInThePast"
	},
	{
		code: 6033,
		name: "EndTimeBeforeStartTime"
	},
	{
		code: 6034,
		name: "TimeRangeTooLarge"
	},
	{
		code: 6035,
		name: "EndTimeBeforeCurrentDay"
	},
	{
		code: 6036,
		name: "SupplyUpdateForFinishedRange"
	},
	{
		code: 6037,
		name: "DayIndexAfterEndIndex"
	},
	{
		code: 6038,
		name: "DayInActiveRange"
	},
	{
		code: 6039,
		name: "InvalidIncentiveMint"
	},
	{
		code: 6040,
		name: "BuyNotEnoughSolToCoverRent",
		msg: "Buy: Not enough SOL to cover for rent exemption."
	},
	{
		code: 6041,
		name: "BuyNotEnoughSolToCoverFees",
		msg: "Buy: Not enough SOL to cover for fees."
	},
	{
		code: 6042,
		name: "BuySlippageBelowMinTokensOut",
		msg: "Slippage: Would buy less tokens than expected min_tokens_out"
	},
	{
		code: 6043,
		name: "NameTooLong"
	},
	{
		code: 6044,
		name: "SymbolTooLong"
	},
	{
		code: 6045,
		name: "UriTooLong"
	},
	{
		code: 6046,
		name: "CreateV2Disabled"
	},
	{
		code: 6047,
		name: "CpitializeMayhemFailed"
	},
	{
		code: 6048,
		name: "MayhemModeDisabled"
	},
	{
		code: 6049,
		name: "CreatorMigratedToSharingConfig",
		msg: "creator has been migrated to sharing config, use pump_fees::reset_fee_sharing_config instead"
	},
	{
		code: 6050,
		name: "UnableToDistributeCreatorVaultMigratedToSharingConfig",
		msg: "creator_vault has been migrated to sharing config, use pump:distribute_creator_fees instead"
	},
	{
		code: 6051,
		name: "SharingConfigNotActive",
		msg: "Sharing config is not active"
	},
	{
		code: 6052,
		name: "UnableToDistributeCreatorFeesToExecutableRecipient",
		msg: "The recipient account is executable, so it cannot receive lamports, remove it from the team first"
	},
	{
		code: 6053,
		name: "BondingCurveAndSharingConfigCreatorMismatch",
		msg: "Bonding curve creator does not match sharing config"
	},
	{
		code: 6054,
		name: "ShareholdersAndRemainingAccountsMismatch",
		msg: "Remaining accounts do not match shareholders, make sure to pass exactly the same pubkeys in the same order"
	},
	{
		code: 6055,
		name: "InvalidShareBps",
		msg: "Share bps must be greater than 0"
	},
	{
		code: 6056,
		name: "CashbackNotEnabled",
		msg: "Cashback is not enabled"
	}
];
var types = [
	{
		name: "AdminSetCreatorEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "timestamp",
					type: "i64"
				},
				{
					name: "admin_set_creator_authority",
					type: "pubkey"
				},
				{
					name: "mint",
					type: "pubkey"
				},
				{
					name: "bonding_curve",
					type: "pubkey"
				},
				{
					name: "old_creator",
					type: "pubkey"
				},
				{
					name: "new_creator",
					type: "pubkey"
				}
			]
		}
	},
	{
		name: "AdminSetIdlAuthorityEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "idl_authority",
					type: "pubkey"
				}
			]
		}
	},
	{
		name: "AdminUpdateTokenIncentivesEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "start_time",
					type: "i64"
				},
				{
					name: "end_time",
					type: "i64"
				},
				{
					name: "day_number",
					type: "u64"
				},
				{
					name: "token_supply_per_day",
					type: "u64"
				},
				{
					name: "mint",
					type: "pubkey"
				},
				{
					name: "seconds_in_a_day",
					type: "i64"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "BondingCurve",
		type: {
			kind: "struct",
			fields: [
				{
					name: "virtual_token_reserves",
					type: "u64"
				},
				{
					name: "virtual_sol_reserves",
					type: "u64"
				},
				{
					name: "real_token_reserves",
					type: "u64"
				},
				{
					name: "real_sol_reserves",
					type: "u64"
				},
				{
					name: "token_total_supply",
					type: "u64"
				},
				{
					name: "complete",
					type: "bool"
				},
				{
					name: "creator",
					type: "pubkey"
				},
				{
					name: "is_mayhem_mode",
					type: "bool"
				},
				{
					name: "is_cashback_coin",
					type: "bool"
				}
			]
		}
	},
	{
		name: "ClaimCashbackEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "user",
					type: "pubkey"
				},
				{
					name: "amount",
					type: "u64"
				},
				{
					name: "timestamp",
					type: "i64"
				},
				{
					name: "total_claimed",
					type: "u64"
				},
				{
					name: "total_cashback_earned",
					type: "u64"
				}
			]
		}
	},
	{
		name: "ClaimTokenIncentivesEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "user",
					type: "pubkey"
				},
				{
					name: "mint",
					type: "pubkey"
				},
				{
					name: "amount",
					type: "u64"
				},
				{
					name: "timestamp",
					type: "i64"
				},
				{
					name: "total_claimed_tokens",
					type: "u64"
				},
				{
					name: "current_sol_volume",
					type: "u64"
				}
			]
		}
	},
	{
		name: "CloseUserVolumeAccumulatorEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "user",
					type: "pubkey"
				},
				{
					name: "timestamp",
					type: "i64"
				},
				{
					name: "total_unclaimed_tokens",
					type: "u64"
				},
				{
					name: "total_claimed_tokens",
					type: "u64"
				},
				{
					name: "current_sol_volume",
					type: "u64"
				},
				{
					name: "last_update_timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "CollectCreatorFeeEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "timestamp",
					type: "i64"
				},
				{
					name: "creator",
					type: "pubkey"
				},
				{
					name: "creator_fee",
					type: "u64"
				}
			]
		}
	},
	{
		name: "CompleteEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "user",
					type: "pubkey"
				},
				{
					name: "mint",
					type: "pubkey"
				},
				{
					name: "bonding_curve",
					type: "pubkey"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "CompletePumpAmmMigrationEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "user",
					type: "pubkey"
				},
				{
					name: "mint",
					type: "pubkey"
				},
				{
					name: "mint_amount",
					type: "u64"
				},
				{
					name: "sol_amount",
					type: "u64"
				},
				{
					name: "pool_migration_fee",
					type: "u64"
				},
				{
					name: "bonding_curve",
					type: "pubkey"
				},
				{
					name: "timestamp",
					type: "i64"
				},
				{
					name: "pool",
					type: "pubkey"
				}
			]
		}
	},
	{
		name: "ConfigStatus",
		type: {
			kind: "enum",
			variants: [
				{
					name: "Paused"
				},
				{
					name: "Active"
				}
			]
		}
	},
	{
		name: "CreateEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "name",
					type: "string"
				},
				{
					name: "symbol",
					type: "string"
				},
				{
					name: "uri",
					type: "string"
				},
				{
					name: "mint",
					type: "pubkey"
				},
				{
					name: "bonding_curve",
					type: "pubkey"
				},
				{
					name: "user",
					type: "pubkey"
				},
				{
					name: "creator",
					type: "pubkey"
				},
				{
					name: "timestamp",
					type: "i64"
				},
				{
					name: "virtual_token_reserves",
					type: "u64"
				},
				{
					name: "virtual_sol_reserves",
					type: "u64"
				},
				{
					name: "real_token_reserves",
					type: "u64"
				},
				{
					name: "token_total_supply",
					type: "u64"
				},
				{
					name: "token_program",
					type: "pubkey"
				},
				{
					name: "is_mayhem_mode",
					type: "bool"
				},
				{
					name: "is_cashback_enabled",
					type: "bool"
				}
			]
		}
	},
	{
		name: "DistributeCreatorFeesEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "timestamp",
					type: "i64"
				},
				{
					name: "mint",
					type: "pubkey"
				},
				{
					name: "bonding_curve",
					type: "pubkey"
				},
				{
					name: "sharing_config",
					type: "pubkey"
				},
				{
					name: "admin",
					type: "pubkey"
				},
				{
					name: "shareholders",
					type: {
						vec: {
							defined: {
								name: "Shareholder"
							}
						}
					}
				},
				{
					name: "distributed",
					type: "u64"
				}
			]
		}
	},
	{
		name: "ExtendAccountEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "account",
					type: "pubkey"
				},
				{
					name: "user",
					type: "pubkey"
				},
				{
					name: "current_size",
					type: "u64"
				},
				{
					name: "new_size",
					type: "u64"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "FeeConfig",
		type: {
			kind: "struct",
			fields: [
				{
					name: "bump",
					type: "u8"
				},
				{
					name: "admin",
					type: "pubkey"
				},
				{
					name: "flat_fees",
					type: {
						defined: {
							name: "Fees"
						}
					}
				},
				{
					name: "fee_tiers",
					type: {
						vec: {
							defined: {
								name: "FeeTier"
							}
						}
					}
				}
			]
		}
	},
	{
		name: "FeeTier",
		type: {
			kind: "struct",
			fields: [
				{
					name: "market_cap_lamports_threshold",
					type: "u128"
				},
				{
					name: "fees",
					type: {
						defined: {
							name: "Fees"
						}
					}
				}
			]
		}
	},
	{
		name: "Fees",
		type: {
			kind: "struct",
			fields: [
				{
					name: "lp_fee_bps",
					type: "u64"
				},
				{
					name: "protocol_fee_bps",
					type: "u64"
				},
				{
					name: "creator_fee_bps",
					type: "u64"
				}
			]
		}
	},
	{
		name: "Global",
		type: {
			kind: "struct",
			fields: [
				{
					name: "initialized",
					docs: [
						"Unused"
					],
					type: "bool"
				},
				{
					name: "authority",
					type: "pubkey"
				},
				{
					name: "fee_recipient",
					type: "pubkey"
				},
				{
					name: "initial_virtual_token_reserves",
					type: "u64"
				},
				{
					name: "initial_virtual_sol_reserves",
					type: "u64"
				},
				{
					name: "initial_real_token_reserves",
					type: "u64"
				},
				{
					name: "token_total_supply",
					type: "u64"
				},
				{
					name: "fee_basis_points",
					type: "u64"
				},
				{
					name: "withdraw_authority",
					type: "pubkey"
				},
				{
					name: "enable_migrate",
					docs: [
						"Unused"
					],
					type: "bool"
				},
				{
					name: "pool_migration_fee",
					type: "u64"
				},
				{
					name: "creator_fee_basis_points",
					type: "u64"
				},
				{
					name: "fee_recipients",
					type: {
						array: [
							"pubkey",
							7
						]
					}
				},
				{
					name: "set_creator_authority",
					type: "pubkey"
				},
				{
					name: "admin_set_creator_authority",
					type: "pubkey"
				},
				{
					name: "create_v2_enabled",
					type: "bool"
				},
				{
					name: "whitelist_pda",
					type: "pubkey"
				},
				{
					name: "reserved_fee_recipient",
					type: "pubkey"
				},
				{
					name: "mayhem_mode_enabled",
					type: "bool"
				},
				{
					name: "reserved_fee_recipients",
					type: {
						array: [
							"pubkey",
							7
						]
					}
				},
				{
					name: "is_cashback_enabled",
					type: "bool"
				}
			]
		}
	},
	{
		name: "GlobalVolumeAccumulator",
		type: {
			kind: "struct",
			fields: [
				{
					name: "start_time",
					type: "i64"
				},
				{
					name: "end_time",
					type: "i64"
				},
				{
					name: "seconds_in_a_day",
					type: "i64"
				},
				{
					name: "mint",
					type: "pubkey"
				},
				{
					name: "total_token_supply",
					type: {
						array: [
							"u64",
							30
						]
					}
				},
				{
					name: "sol_volumes",
					type: {
						array: [
							"u64",
							30
						]
					}
				}
			]
		}
	},
	{
		name: "InitUserVolumeAccumulatorEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "payer",
					type: "pubkey"
				},
				{
					name: "user",
					type: "pubkey"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "MigrateBondingCurveCreatorEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "timestamp",
					type: "i64"
				},
				{
					name: "mint",
					type: "pubkey"
				},
				{
					name: "bonding_curve",
					type: "pubkey"
				},
				{
					name: "sharing_config",
					type: "pubkey"
				},
				{
					name: "old_creator",
					type: "pubkey"
				},
				{
					name: "new_creator",
					type: "pubkey"
				}
			]
		}
	},
	{
		name: "MinimumDistributableFeeEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "minimum_required",
					type: "u64"
				},
				{
					name: "distributable_fees",
					type: "u64"
				},
				{
					name: "can_distribute",
					type: "bool"
				}
			]
		}
	},
	{
		name: "OptionBool",
		type: {
			kind: "struct",
			fields: [
				"bool"
			]
		}
	},
	{
		name: "ReservedFeeRecipientsEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "timestamp",
					type: "i64"
				},
				{
					name: "reserved_fee_recipient",
					type: "pubkey"
				},
				{
					name: "reserved_fee_recipients",
					type: {
						array: [
							"pubkey",
							7
						]
					}
				}
			]
		}
	},
	{
		name: "SetCreatorEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "timestamp",
					type: "i64"
				},
				{
					name: "mint",
					type: "pubkey"
				},
				{
					name: "bonding_curve",
					type: "pubkey"
				},
				{
					name: "creator",
					type: "pubkey"
				}
			]
		}
	},
	{
		name: "SetMetaplexCreatorEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "timestamp",
					type: "i64"
				},
				{
					name: "mint",
					type: "pubkey"
				},
				{
					name: "bonding_curve",
					type: "pubkey"
				},
				{
					name: "metadata",
					type: "pubkey"
				},
				{
					name: "creator",
					type: "pubkey"
				}
			]
		}
	},
	{
		name: "SetParamsEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "initial_virtual_token_reserves",
					type: "u64"
				},
				{
					name: "initial_virtual_sol_reserves",
					type: "u64"
				},
				{
					name: "initial_real_token_reserves",
					type: "u64"
				},
				{
					name: "final_real_sol_reserves",
					type: "u64"
				},
				{
					name: "token_total_supply",
					type: "u64"
				},
				{
					name: "fee_basis_points",
					type: "u64"
				},
				{
					name: "withdraw_authority",
					type: "pubkey"
				},
				{
					name: "enable_migrate",
					type: "bool"
				},
				{
					name: "pool_migration_fee",
					type: "u64"
				},
				{
					name: "creator_fee_basis_points",
					type: "u64"
				},
				{
					name: "fee_recipients",
					type: {
						array: [
							"pubkey",
							8
						]
					}
				},
				{
					name: "timestamp",
					type: "i64"
				},
				{
					name: "set_creator_authority",
					type: "pubkey"
				},
				{
					name: "admin_set_creator_authority",
					type: "pubkey"
				}
			]
		}
	},
	{
		name: "Shareholder",
		type: {
			kind: "struct",
			fields: [
				{
					name: "address",
					type: "pubkey"
				},
				{
					name: "share_bps",
					type: "u16"
				}
			]
		}
	},
	{
		name: "SharingConfig",
		type: {
			kind: "struct",
			fields: [
				{
					name: "bump",
					type: "u8"
				},
				{
					name: "version",
					type: "u8"
				},
				{
					name: "status",
					type: {
						defined: {
							name: "ConfigStatus"
						}
					}
				},
				{
					name: "mint",
					type: "pubkey"
				},
				{
					name: "admin",
					type: "pubkey"
				},
				{
					name: "admin_revoked",
					type: "bool"
				},
				{
					name: "shareholders",
					type: {
						vec: {
							defined: {
								name: "Shareholder"
							}
						}
					}
				}
			]
		}
	},
	{
		name: "SyncUserVolumeAccumulatorEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "user",
					type: "pubkey"
				},
				{
					name: "total_claimed_tokens_before",
					type: "u64"
				},
				{
					name: "total_claimed_tokens_after",
					type: "u64"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "TradeEvent",
		docs: [
			"ix_name: \"buy\" | \"sell\" | \"buy_exact_sol_in\""
		],
		type: {
			kind: "struct",
			fields: [
				{
					name: "mint",
					type: "pubkey"
				},
				{
					name: "sol_amount",
					type: "u64"
				},
				{
					name: "token_amount",
					type: "u64"
				},
				{
					name: "is_buy",
					type: "bool"
				},
				{
					name: "user",
					type: "pubkey"
				},
				{
					name: "timestamp",
					type: "i64"
				},
				{
					name: "virtual_sol_reserves",
					type: "u64"
				},
				{
					name: "virtual_token_reserves",
					type: "u64"
				},
				{
					name: "real_sol_reserves",
					type: "u64"
				},
				{
					name: "real_token_reserves",
					type: "u64"
				},
				{
					name: "fee_recipient",
					type: "pubkey"
				},
				{
					name: "fee_basis_points",
					type: "u64"
				},
				{
					name: "fee",
					type: "u64"
				},
				{
					name: "creator",
					type: "pubkey"
				},
				{
					name: "creator_fee_basis_points",
					type: "u64"
				},
				{
					name: "creator_fee",
					type: "u64"
				},
				{
					name: "track_volume",
					type: "bool"
				},
				{
					name: "total_unclaimed_tokens",
					type: "u64"
				},
				{
					name: "total_claimed_tokens",
					type: "u64"
				},
				{
					name: "current_sol_volume",
					type: "u64"
				},
				{
					name: "last_update_timestamp",
					type: "i64"
				},
				{
					name: "ix_name",
					type: "string"
				},
				{
					name: "mayhem_mode",
					type: "bool"
				},
				{
					name: "cashback_fee_basis_points",
					type: "u64"
				},
				{
					name: "cashback",
					type: "u64"
				}
			]
		}
	},
	{
		name: "UpdateGlobalAuthorityEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "global",
					type: "pubkey"
				},
				{
					name: "authority",
					type: "pubkey"
				},
				{
					name: "new_authority",
					type: "pubkey"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "UpdateMayhemVirtualParamsEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "timestamp",
					type: "i64"
				},
				{
					name: "mint",
					type: "pubkey"
				},
				{
					name: "virtual_token_reserves",
					type: "u64"
				},
				{
					name: "virtual_sol_reserves",
					type: "u64"
				},
				{
					name: "new_virtual_token_reserves",
					type: "u64"
				},
				{
					name: "new_virtual_sol_reserves",
					type: "u64"
				},
				{
					name: "real_token_reserves",
					type: "u64"
				},
				{
					name: "real_sol_reserves",
					type: "u64"
				}
			]
		}
	},
	{
		name: "UserVolumeAccumulator",
		type: {
			kind: "struct",
			fields: [
				{
					name: "user",
					type: "pubkey"
				},
				{
					name: "needs_claim",
					type: "bool"
				},
				{
					name: "total_unclaimed_tokens",
					type: "u64"
				},
				{
					name: "total_claimed_tokens",
					type: "u64"
				},
				{
					name: "current_sol_volume",
					type: "u64"
				},
				{
					name: "last_update_timestamp",
					type: "i64"
				},
				{
					name: "has_total_claimed_tokens",
					type: "bool"
				},
				{
					name: "cashback_earned",
					type: "u64"
				},
				{
					name: "total_cashback_claimed",
					type: "u64"
				}
			]
		}
	}
];
var pump = {
	address: address,
	metadata: metadata,
	instructions: instructions,
	accounts: accounts,
	events: events,
	errors: errors,
	types: types
};

/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/pump_fees.json`.
 */
interface PumpFees {
    address: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";
    metadata: {
        name: "pumpFees";
        version: "0.1.0";
        spec: "0.1.0";
        description: "Created with Anchor";
    };
    instructions: [
        {
            name: "claimSocialFeePda";
            discriminator: [225, 21, 251, 133, 161, 30, 199, 226];
            accounts: [
                {
                    name: "recipient";
                    writable: true;
                },
                {
                    name: "socialFeePda";
                    writable: true;
                },
                {
                    name: "feeProgramGlobal";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    102,
                                    101,
                                    101,
                                    45,
                                    112,
                                    114,
                                    111,
                                    103,
                                    114,
                                    97,
                                    109,
                                    45,
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "socialClaimAuthority";
                    signer: true;
                    relations: ["feeProgramGlobal"];
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "userId";
                    type: "string";
                },
                {
                    name: "platform";
                    type: "u8";
                }
            ];
            returns: {
                option: {
                    defined: {
                        name: "socialFeePdaClaimed";
                    };
                };
            };
        },
        {
            name: "createFeeSharingConfig";
            docs: ["Create Fee Sharing Config"];
            discriminator: [195, 78, 86, 76, 111, 52, 251, 213];
            accounts: [
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                    address: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";
                },
                {
                    name: "payer";
                    writable: true;
                    signer: true;
                },
                {
                    name: "global";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                1,
                                86,
                                224,
                                246,
                                147,
                                102,
                                90,
                                207,
                                68,
                                219,
                                21,
                                104,
                                191,
                                23,
                                91,
                                170,
                                81,
                                137,
                                203,
                                151,
                                245,
                                210,
                                255,
                                59,
                                101,
                                93,
                                43,
                                182,
                                253,
                                109,
                                24,
                                176
                            ];
                        };
                    };
                },
                {
                    name: "mint";
                },
                {
                    name: "sharingConfig";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    115,
                                    104,
                                    97,
                                    114,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "bondingCurve";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    98,
                                    111,
                                    110,
                                    100,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    117,
                                    114,
                                    118,
                                    101
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                1,
                                86,
                                224,
                                246,
                                147,
                                102,
                                90,
                                207,
                                68,
                                219,
                                21,
                                104,
                                191,
                                23,
                                91,
                                170,
                                81,
                                137,
                                203,
                                151,
                                245,
                                210,
                                255,
                                59,
                                101,
                                93,
                                43,
                                182,
                                253,
                                109,
                                24,
                                176
                            ];
                        };
                    };
                },
                {
                    name: "pumpProgram";
                    address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
                },
                {
                    name: "pumpEventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                1,
                                86,
                                224,
                                246,
                                147,
                                102,
                                90,
                                207,
                                68,
                                219,
                                21,
                                104,
                                191,
                                23,
                                91,
                                170,
                                81,
                                137,
                                203,
                                151,
                                245,
                                210,
                                255,
                                59,
                                101,
                                93,
                                43,
                                182,
                                253,
                                109,
                                24,
                                176
                            ];
                        };
                    };
                },
                {
                    name: "pool";
                    writable: true;
                    optional: true;
                },
                {
                    name: "pumpAmmProgram";
                    optional: true;
                    address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
                },
                {
                    name: "pumpAmmEventAuthority";
                    optional: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                12,
                                20,
                                222,
                                252,
                                130,
                                94,
                                198,
                                118,
                                148,
                                37,
                                8,
                                24,
                                187,
                                101,
                                64,
                                101,
                                244,
                                41,
                                141,
                                49,
                                86,
                                213,
                                113,
                                180,
                                212,
                                248,
                                9,
                                12,
                                24,
                                233,
                                168,
                                99
                            ];
                        };
                    };
                }
            ];
            args: [];
        },
        {
            name: "createSocialFeePda";
            discriminator: [144, 224, 59, 211, 78, 248, 202, 220];
            accounts: [
                {
                    name: "payer";
                    writable: true;
                    signer: true;
                },
                {
                    name: "socialFeePda";
                    writable: true;
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "feeProgramGlobal";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    102,
                                    101,
                                    101,
                                    45,
                                    112,
                                    114,
                                    111,
                                    103,
                                    114,
                                    97,
                                    109,
                                    45,
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "userId";
                    type: "string";
                },
                {
                    name: "platform";
                    type: "u8";
                }
            ];
        },
        {
            name: "getFees";
            docs: ["Get Fees"];
            discriminator: [231, 37, 126, 85, 207, 91, 63, 52];
            accounts: [
                {
                    name: "feeConfig";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [102, 101, 101, 95, 99, 111, 110, 102, 105, 103];
                            },
                            {
                                kind: "account";
                                path: "configProgramId";
                            }
                        ];
                    };
                },
                {
                    name: "configProgramId";
                }
            ];
            args: [
                {
                    name: "isPumpPool";
                    type: "bool";
                },
                {
                    name: "marketCapLamports";
                    type: "u128";
                },
                {
                    name: "tradeSizeLamports";
                    type: "u64";
                }
            ];
            returns: {
                defined: {
                    name: "fees";
                };
            };
        },
        {
            name: "initializeFeeConfig";
            docs: ["Initialize FeeConfig admin"];
            discriminator: [62, 162, 20, 133, 121, 65, 145, 27];
            accounts: [
                {
                    name: "admin";
                    writable: true;
                    signer: true;
                    address: "8LWu7QM2dGR1G8nKDHthckea57bkCzXyBTAKPJUBDHo8";
                },
                {
                    name: "feeConfig";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [102, 101, 101, 95, 99, 111, 110, 102, 105, 103];
                            },
                            {
                                kind: "account";
                                path: "configProgramId";
                            }
                        ];
                    };
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "configProgramId";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "initializeFeeProgramGlobal";
            discriminator: [35, 215, 130, 84, 233, 56, 124, 167];
            accounts: [
                {
                    name: "authority";
                    writable: true;
                    signer: true;
                    relations: ["pumpGlobal"];
                },
                {
                    name: "pumpGlobal";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                1,
                                86,
                                224,
                                246,
                                147,
                                102,
                                90,
                                207,
                                68,
                                219,
                                21,
                                104,
                                191,
                                23,
                                91,
                                170,
                                81,
                                137,
                                203,
                                151,
                                245,
                                210,
                                255,
                                59,
                                101,
                                93,
                                43,
                                182,
                                253,
                                109,
                                24,
                                176
                            ];
                        };
                    };
                },
                {
                    name: "feeProgramGlobal";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    102,
                                    101,
                                    101,
                                    45,
                                    112,
                                    114,
                                    111,
                                    103,
                                    114,
                                    97,
                                    109,
                                    45,
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "socialClaimAuthority";
                    type: "pubkey";
                },
                {
                    name: "disableFlags";
                    type: "u8";
                },
                {
                    name: "claimRateLimit";
                    type: "u64";
                }
            ];
        },
        {
            name: "resetFeeSharingConfig";
            docs: [
                "Reset Fee Sharing Config, make sure to distribute all the fees before calling this"
            ];
            discriminator: [10, 2, 182, 95, 16, 127, 129, 186];
            accounts: [
                {
                    name: "authority";
                    signer: true;
                },
                {
                    name: "global";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                1,
                                86,
                                224,
                                246,
                                147,
                                102,
                                90,
                                207,
                                68,
                                219,
                                21,
                                104,
                                191,
                                23,
                                91,
                                170,
                                81,
                                137,
                                203,
                                151,
                                245,
                                210,
                                255,
                                59,
                                101,
                                93,
                                43,
                                182,
                                253,
                                109,
                                24,
                                176
                            ];
                        };
                    };
                },
                {
                    name: "newAdmin";
                },
                {
                    name: "mint";
                    relations: ["sharingConfig"];
                },
                {
                    name: "sharingConfig";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    115,
                                    104,
                                    97,
                                    114,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "revokeFeeSharingAuthority";
            docs: ["Revoke Fee Sharing Authority"];
            discriminator: [18, 233, 158, 39, 185, 207, 58, 104];
            accounts: [
                {
                    name: "authority";
                    signer: true;
                },
                {
                    name: "global";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                1,
                                86,
                                224,
                                246,
                                147,
                                102,
                                90,
                                207,
                                68,
                                219,
                                21,
                                104,
                                191,
                                23,
                                91,
                                170,
                                81,
                                137,
                                203,
                                151,
                                245,
                                210,
                                255,
                                59,
                                101,
                                93,
                                43,
                                182,
                                253,
                                109,
                                24,
                                176
                            ];
                        };
                    };
                },
                {
                    name: "mint";
                    relations: ["sharingConfig"];
                },
                {
                    name: "sharingConfig";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    115,
                                    104,
                                    97,
                                    114,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "setAuthority";
            discriminator: [133, 250, 37, 21, 110, 163, 26, 121];
            accounts: [
                {
                    name: "authority";
                    writable: true;
                    signer: true;
                    relations: ["feeProgramGlobal"];
                },
                {
                    name: "feeProgramGlobal";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    102,
                                    101,
                                    101,
                                    45,
                                    112,
                                    114,
                                    111,
                                    103,
                                    114,
                                    97,
                                    109,
                                    45,
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "newAuthority";
                    type: "pubkey";
                }
            ];
        },
        {
            name: "setClaimRateLimit";
            discriminator: [185, 211, 159, 174, 212, 49, 88, 4];
            accounts: [
                {
                    name: "authority";
                    writable: true;
                    signer: true;
                    relations: ["feeProgramGlobal"];
                },
                {
                    name: "feeProgramGlobal";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    102,
                                    101,
                                    101,
                                    45,
                                    112,
                                    114,
                                    111,
                                    103,
                                    114,
                                    97,
                                    109,
                                    45,
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "claimRateLimit";
                    type: "u64";
                }
            ];
        },
        {
            name: "setDisableFlags";
            discriminator: [194, 217, 112, 35, 114, 222, 51, 190];
            accounts: [
                {
                    name: "authority";
                    writable: true;
                    signer: true;
                    relations: ["feeProgramGlobal"];
                },
                {
                    name: "feeProgramGlobal";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    102,
                                    101,
                                    101,
                                    45,
                                    112,
                                    114,
                                    111,
                                    103,
                                    114,
                                    97,
                                    109,
                                    45,
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "disableFlags";
                    type: "u8";
                }
            ];
        },
        {
            name: "setSocialClaimAuthority";
            discriminator: [147, 54, 184, 154, 136, 237, 185, 153];
            accounts: [
                {
                    name: "authority";
                    writable: true;
                    signer: true;
                    relations: ["feeProgramGlobal"];
                },
                {
                    name: "feeProgramGlobal";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    102,
                                    101,
                                    101,
                                    45,
                                    112,
                                    114,
                                    111,
                                    103,
                                    114,
                                    97,
                                    109,
                                    45,
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "socialClaimAuthority";
                    type: "pubkey";
                }
            ];
        },
        {
            name: "transferFeeSharingAuthority";
            docs: ["Transfer Fee Sharing Authority"];
            discriminator: [202, 10, 75, 200, 164, 34, 210, 96];
            accounts: [
                {
                    name: "authority";
                    signer: true;
                },
                {
                    name: "global";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                1,
                                86,
                                224,
                                246,
                                147,
                                102,
                                90,
                                207,
                                68,
                                219,
                                21,
                                104,
                                191,
                                23,
                                91,
                                170,
                                81,
                                137,
                                203,
                                151,
                                245,
                                210,
                                255,
                                59,
                                101,
                                93,
                                43,
                                182,
                                253,
                                109,
                                24,
                                176
                            ];
                        };
                    };
                },
                {
                    name: "mint";
                    relations: ["sharingConfig"];
                },
                {
                    name: "sharingConfig";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    115,
                                    104,
                                    97,
                                    114,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "newAdmin";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "updateAdmin";
            docs: ["Update admin (only callable by admin)"];
            discriminator: [161, 176, 40, 213, 60, 184, 179, 228];
            accounts: [
                {
                    name: "admin";
                    signer: true;
                    relations: ["feeConfig"];
                },
                {
                    name: "feeConfig";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [102, 101, 101, 95, 99, 111, 110, 102, 105, 103];
                            },
                            {
                                kind: "account";
                                path: "configProgramId";
                            }
                        ];
                    };
                },
                {
                    name: "newAdmin";
                },
                {
                    name: "configProgramId";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "updateFeeConfig";
            docs: ["Set/Replace fee parameters entirely (only callable by admin)"];
            discriminator: [104, 184, 103, 242, 88, 151, 107, 20];
            accounts: [
                {
                    name: "feeConfig";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [102, 101, 101, 95, 99, 111, 110, 102, 105, 103];
                            },
                            {
                                kind: "account";
                                path: "configProgramId";
                            }
                        ];
                    };
                },
                {
                    name: "admin";
                    signer: true;
                    relations: ["feeConfig"];
                },
                {
                    name: "configProgramId";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "feeTiers";
                    type: {
                        vec: {
                            defined: {
                                name: "feeTier";
                            };
                        };
                    };
                },
                {
                    name: "flatFees";
                    type: {
                        defined: {
                            name: "fees";
                        };
                    };
                }
            ];
        },
        {
            name: "updateFeeShares";
            docs: [
                "Update Fee Shares, make sure to distribute all the fees before calling this"
            ];
            discriminator: [189, 13, 136, 99, 187, 164, 237, 35];
            accounts: [
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                    address: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";
                },
                {
                    name: "authority";
                    signer: true;
                },
                {
                    name: "global";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [103, 108, 111, 98, 97, 108];
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                1,
                                86,
                                224,
                                246,
                                147,
                                102,
                                90,
                                207,
                                68,
                                219,
                                21,
                                104,
                                191,
                                23,
                                91,
                                170,
                                81,
                                137,
                                203,
                                151,
                                245,
                                210,
                                255,
                                59,
                                101,
                                93,
                                43,
                                182,
                                253,
                                109,
                                24,
                                176
                            ];
                        };
                    };
                },
                {
                    name: "mint";
                    relations: ["sharingConfig"];
                },
                {
                    name: "sharingConfig";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    115,
                                    104,
                                    97,
                                    114,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                    };
                },
                {
                    name: "bondingCurve";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    98,
                                    111,
                                    110,
                                    100,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    117,
                                    114,
                                    118,
                                    101
                                ];
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                1,
                                86,
                                224,
                                246,
                                147,
                                102,
                                90,
                                207,
                                68,
                                219,
                                21,
                                104,
                                191,
                                23,
                                91,
                                170,
                                81,
                                137,
                                203,
                                151,
                                245,
                                210,
                                255,
                                59,
                                101,
                                93,
                                43,
                                182,
                                253,
                                109,
                                24,
                                176
                            ];
                        };
                    };
                },
                {
                    name: "pumpCreatorVault";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    99,
                                    114,
                                    101,
                                    97,
                                    116,
                                    111,
                                    114,
                                    45,
                                    118,
                                    97,
                                    117,
                                    108,
                                    116
                                ];
                            },
                            {
                                kind: "account";
                                path: "sharingConfig";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                1,
                                86,
                                224,
                                246,
                                147,
                                102,
                                90,
                                207,
                                68,
                                219,
                                21,
                                104,
                                191,
                                23,
                                91,
                                170,
                                81,
                                137,
                                203,
                                151,
                                245,
                                210,
                                255,
                                59,
                                101,
                                93,
                                43,
                                182,
                                253,
                                109,
                                24,
                                176
                            ];
                        };
                    };
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "pumpProgram";
                    address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
                },
                {
                    name: "pumpEventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                1,
                                86,
                                224,
                                246,
                                147,
                                102,
                                90,
                                207,
                                68,
                                219,
                                21,
                                104,
                                191,
                                23,
                                91,
                                170,
                                81,
                                137,
                                203,
                                151,
                                245,
                                210,
                                255,
                                59,
                                101,
                                93,
                                43,
                                182,
                                253,
                                109,
                                24,
                                176
                            ];
                        };
                    };
                },
                {
                    name: "pumpAmmProgram";
                    address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
                },
                {
                    name: "ammEventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                12,
                                20,
                                222,
                                252,
                                130,
                                94,
                                198,
                                118,
                                148,
                                37,
                                8,
                                24,
                                187,
                                101,
                                64,
                                101,
                                244,
                                41,
                                141,
                                49,
                                86,
                                213,
                                113,
                                180,
                                212,
                                248,
                                9,
                                12,
                                24,
                                233,
                                168,
                                99
                            ];
                        };
                    };
                },
                {
                    name: "wsolMint";
                    address: "So11111111111111111111111111111111111111112";
                },
                {
                    name: "tokenProgram";
                    address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
                },
                {
                    name: "associatedTokenProgram";
                    address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
                },
                {
                    name: "coinCreatorVaultAuthority";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    99,
                                    114,
                                    101,
                                    97,
                                    116,
                                    111,
                                    114,
                                    95,
                                    118,
                                    97,
                                    117,
                                    108,
                                    116
                                ];
                            },
                            {
                                kind: "account";
                                path: "sharingConfig";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                12,
                                20,
                                222,
                                252,
                                130,
                                94,
                                198,
                                118,
                                148,
                                37,
                                8,
                                24,
                                187,
                                101,
                                64,
                                101,
                                244,
                                41,
                                141,
                                49,
                                86,
                                213,
                                113,
                                180,
                                212,
                                248,
                                9,
                                12,
                                24,
                                233,
                                168,
                                99
                            ];
                        };
                    };
                },
                {
                    name: "coinCreatorVaultAta";
                    writable: true;
                }
            ];
            args: [
                {
                    name: "shareholders";
                    type: {
                        vec: {
                            defined: {
                                name: "shareholder";
                            };
                        };
                    };
                }
            ];
        },
        {
            name: "upsertFeeTiers";
            docs: ["Update or expand fee tiers (only callable by admin)"];
            discriminator: [227, 23, 150, 12, 77, 86, 94, 4];
            accounts: [
                {
                    name: "feeConfig";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [102, 101, 101, 95, 99, 111, 110, 102, 105, 103];
                            },
                            {
                                kind: "account";
                                path: "configProgramId";
                            }
                        ];
                    };
                },
                {
                    name: "admin";
                    signer: true;
                    relations: ["feeConfig"];
                },
                {
                    name: "configProgramId";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "feeTiers";
                    type: {
                        vec: {
                            defined: {
                                name: "feeTier";
                            };
                        };
                    };
                },
                {
                    name: "offset";
                    type: "u8";
                }
            ];
        }
    ];
    accounts: [
        {
            name: "bondingCurve";
            discriminator: [23, 183, 248, 55, 96, 216, 172, 96];
        },
        {
            name: "feeConfig";
            discriminator: [143, 52, 146, 187, 219, 123, 76, 155];
        },
        {
            name: "feeProgramGlobal";
            discriminator: [162, 165, 245, 49, 29, 37, 55, 242];
        },
        {
            name: "global";
            discriminator: [167, 232, 232, 177, 200, 108, 114, 127];
        },
        {
            name: "pool";
            discriminator: [241, 154, 109, 4, 17, 177, 109, 188];
        },
        {
            name: "sharingConfig";
            discriminator: [216, 74, 9, 0, 56, 140, 93, 75];
        },
        {
            name: "socialFeePda";
            discriminator: [139, 96, 53, 17, 42, 169, 206, 150];
        }
    ];
    events: [
        {
            name: "createFeeSharingConfigEvent";
            discriminator: [133, 105, 170, 200, 184, 116, 251, 88];
        },
        {
            name: "initializeFeeConfigEvent";
            discriminator: [89, 138, 244, 230, 10, 56, 226, 126];
        },
        {
            name: "initializeFeeProgramGlobalEvent";
            discriminator: [40, 233, 156, 78, 95, 0, 8, 199];
        },
        {
            name: "resetFeeSharingConfigEvent";
            discriminator: [203, 204, 151, 226, 120, 55, 214, 243];
        },
        {
            name: "revokeFeeSharingAuthorityEvent";
            discriminator: [114, 23, 101, 60, 14, 190, 153, 62];
        },
        {
            name: "setAuthorityEvent";
            discriminator: [18, 175, 132, 66, 208, 201, 87, 242];
        },
        {
            name: "setClaimRateLimitEvent";
            discriminator: [13, 143, 143, 235, 181, 19, 51, 40];
        },
        {
            name: "setDisableFlagsEvent";
            discriminator: [5, 8, 179, 65, 49, 55, 145, 126];
        },
        {
            name: "setSocialClaimAuthorityEvent";
            discriminator: [60, 118, 127, 132, 239, 52, 254, 14];
        },
        {
            name: "socialFeePdaClaimed";
            discriminator: [50, 18, 193, 65, 237, 210, 234, 236];
        },
        {
            name: "socialFeePdaCreated";
            discriminator: [183, 183, 218, 147, 24, 124, 137, 169];
        },
        {
            name: "transferFeeSharingAuthorityEvent";
            discriminator: [124, 143, 198, 245, 77, 184, 8, 236];
        },
        {
            name: "updateAdminEvent";
            discriminator: [225, 152, 171, 87, 246, 63, 66, 234];
        },
        {
            name: "updateFeeConfigEvent";
            discriminator: [90, 23, 65, 35, 62, 244, 188, 208];
        },
        {
            name: "updateFeeSharesEvent";
            discriminator: [21, 186, 196, 184, 91, 228, 225, 203];
        },
        {
            name: "upsertFeeTiersEvent";
            discriminator: [171, 89, 169, 187, 122, 186, 33, 204];
        }
    ];
    errors: [
        {
            code: 6000;
            name: "unauthorizedProgram";
            msg: "Only Pump and PumpSwap programs can call this instruction";
        },
        {
            code: 6001;
            name: "invalidAdmin";
            msg: "Invalid admin";
        },
        {
            code: 6002;
            name: "noFeeTiers";
            msg: "No fee tiers provided";
        },
        {
            code: 6003;
            name: "tooManyFeeTiers";
            msg: "format";
        },
        {
            code: 6004;
            name: "offsetNotContinuous";
            msg: "The offset should be <= fee_config.fee_tiers.len()";
        },
        {
            code: 6005;
            name: "feeTiersNotSorted";
            msg: "Fee tiers must be sorted by market cap threshold (ascending)";
        },
        {
            code: 6006;
            name: "invalidFeeTotal";
            msg: "Fee total must not exceed 10_000bps";
        },
        {
            code: 6007;
            name: "invalidSharingConfig";
            msg: "Invalid Sharing Config";
        },
        {
            code: 6008;
            name: "invalidPool";
            msg: "Invalid Pool";
        },
        {
            code: 6009;
            name: "sharingConfigAdminRevoked";
            msg: "Sharing config admin has been revoked";
        },
        {
            code: 6010;
            name: "noShareholders";
            msg: "No shareholders provided";
        },
        {
            code: 6011;
            name: "tooManyShareholders";
            msg: "format";
        },
        {
            code: 6012;
            name: "duplicateShareholder";
            msg: "Duplicate shareholder address";
        },
        {
            code: 6013;
            name: "notEnoughRemainingAccounts";
            msg: "Not enough remaining accounts";
        },
        {
            code: 6014;
            name: "invalidShareTotal";
            msg: "Invalid share total - must equal 10_000 basis points";
        },
        {
            code: 6015;
            name: "shareCalculationOverflow";
            msg: "Share calculation overflow";
        },
        {
            code: 6016;
            name: "notAuthorized";
            msg: "The given account is not authorized to execute this instruction.";
        },
        {
            code: 6017;
            name: "zeroShareNotAllowed";
            msg: "Shareholder cannot have zero share";
        },
        {
            code: 6018;
            name: "sharingConfigNotActive";
            msg: "Fee sharing config is not active";
        },
        {
            code: 6019;
            name: "ammAccountsRequiredForGraduatedCoin";
            msg: "AMM accounts are required for graduated coins";
        },
        {
            code: 6020;
            name: "shareholderAccountMismatch";
            msg: "Remaining account key doesn't match shareholder address";
        },
        {
            code: 6021;
            name: "featureDeactivated";
            msg: "Feature is currently deactivated";
        },
        {
            code: 6022;
            name: "userIdTooLong";
            msg: "User ID exceeds maximum length";
        }
    ];
    types: [
        {
            name: "bondingCurve";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "virtualTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "virtualSolReserves";
                        type: "u64";
                    },
                    {
                        name: "realTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "realSolReserves";
                        type: "u64";
                    },
                    {
                        name: "tokenTotalSupply";
                        type: "u64";
                    },
                    {
                        name: "complete";
                        type: "bool";
                    },
                    {
                        name: "creator";
                        type: "pubkey";
                    },
                    {
                        name: "isMayhemMode";
                        type: "bool";
                    }
                ];
            };
        },
        {
            name: "configStatus";
            type: {
                kind: "enum";
                variants: [
                    {
                        name: "paused";
                    },
                    {
                        name: "active";
                    }
                ];
            };
        },
        {
            name: "createFeeSharingConfigEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "bondingCurve";
                        type: "pubkey";
                    },
                    {
                        name: "pool";
                        type: {
                            option: "pubkey";
                        };
                    },
                    {
                        name: "sharingConfig";
                        type: "pubkey";
                    },
                    {
                        name: "admin";
                        type: "pubkey";
                    },
                    {
                        name: "initialShareholders";
                        type: {
                            vec: {
                                defined: {
                                    name: "shareholder";
                                };
                            };
                        };
                    },
                    {
                        name: "status";
                        type: {
                            defined: {
                                name: "configStatus";
                            };
                        };
                    }
                ];
            };
        },
        {
            name: "feeConfig";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "bump";
                        docs: ["The bump for the PDA"];
                        type: "u8";
                    },
                    {
                        name: "admin";
                        docs: ["The admin account that can update the fee config"];
                        type: "pubkey";
                    },
                    {
                        name: "flatFees";
                        docs: ["The flat fees for non-pump pools"];
                        type: {
                            defined: {
                                name: "fees";
                            };
                        };
                    },
                    {
                        name: "feeTiers";
                        docs: ["The fee tiers"];
                        type: {
                            vec: {
                                defined: {
                                    name: "feeTier";
                                };
                            };
                        };
                    }
                ];
            };
        },
        {
            name: "feeProgramGlobal";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "bump";
                        type: "u8";
                    },
                    {
                        name: "authority";
                        type: "pubkey";
                    },
                    {
                        name: "disableFlags";
                        type: "u8";
                    },
                    {
                        name: "socialClaimAuthority";
                        type: "pubkey";
                    },
                    {
                        name: "claimRateLimit";
                        type: "u64";
                    },
                    {
                        name: "reserved";
                        type: {
                            array: ["u8", 256];
                        };
                    }
                ];
            };
        },
        {
            name: "feeTier";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "marketCapLamportsThreshold";
                        type: "u128";
                    },
                    {
                        name: "fees";
                        type: {
                            defined: {
                                name: "fees";
                            };
                        };
                    }
                ];
            };
        },
        {
            name: "fees";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "lpFeeBps";
                        type: "u64";
                    },
                    {
                        name: "protocolFeeBps";
                        type: "u64";
                    },
                    {
                        name: "creatorFeeBps";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "global";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "initialized";
                        type: "bool";
                    },
                    {
                        name: "authority";
                        type: "pubkey";
                    },
                    {
                        name: "feeRecipient";
                        type: "pubkey";
                    },
                    {
                        name: "initialVirtualTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "initialVirtualSolReserves";
                        type: "u64";
                    },
                    {
                        name: "initialRealTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "tokenTotalSupply";
                        type: "u64";
                    },
                    {
                        name: "feeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "withdrawAuthority";
                        type: "pubkey";
                    },
                    {
                        name: "enableMigrate";
                        type: "bool";
                    },
                    {
                        name: "poolMigrationFee";
                        type: "u64";
                    },
                    {
                        name: "creatorFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "feeRecipients";
                        type: {
                            array: ["pubkey", 7];
                        };
                    },
                    {
                        name: "setCreatorAuthority";
                        type: "pubkey";
                    },
                    {
                        name: "adminSetCreatorAuthority";
                        type: "pubkey";
                    },
                    {
                        name: "createV2Enabled";
                        type: "bool";
                    },
                    {
                        name: "whitelistPda";
                        type: "pubkey";
                    },
                    {
                        name: "reservedFeeRecipient";
                        type: "pubkey";
                    },
                    {
                        name: "mayhemModeEnabled";
                        type: "bool";
                    },
                    {
                        name: "reservedFeeRecipients";
                        type: {
                            array: ["pubkey", 7];
                        };
                    }
                ];
            };
        },
        {
            name: "initializeFeeConfigEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "admin";
                        type: "pubkey";
                    },
                    {
                        name: "feeConfig";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "initializeFeeProgramGlobalEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "authority";
                        type: "pubkey";
                    },
                    {
                        name: "socialClaimAuthority";
                        type: "pubkey";
                    },
                    {
                        name: "disableFlags";
                        type: "u8";
                    },
                    {
                        name: "claimRateLimit";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "pool";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "poolBump";
                        type: "u8";
                    },
                    {
                        name: "index";
                        type: "u16";
                    },
                    {
                        name: "creator";
                        type: "pubkey";
                    },
                    {
                        name: "baseMint";
                        type: "pubkey";
                    },
                    {
                        name: "quoteMint";
                        type: "pubkey";
                    },
                    {
                        name: "lpMint";
                        type: "pubkey";
                    },
                    {
                        name: "poolBaseTokenAccount";
                        type: "pubkey";
                    },
                    {
                        name: "poolQuoteTokenAccount";
                        type: "pubkey";
                    },
                    {
                        name: "lpSupply";
                        type: "u64";
                    },
                    {
                        name: "coinCreator";
                        type: "pubkey";
                    },
                    {
                        name: "isMayhemMode";
                        type: "bool";
                    }
                ];
            };
        },
        {
            name: "resetFeeSharingConfigEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "sharingConfig";
                        type: "pubkey";
                    },
                    {
                        name: "oldAdmin";
                        type: "pubkey";
                    },
                    {
                        name: "oldShareholders";
                        type: {
                            vec: {
                                defined: {
                                    name: "shareholder";
                                };
                            };
                        };
                    },
                    {
                        name: "newAdmin";
                        type: "pubkey";
                    },
                    {
                        name: "newShareholders";
                        type: {
                            vec: {
                                defined: {
                                    name: "shareholder";
                                };
                            };
                        };
                    }
                ];
            };
        },
        {
            name: "revokeFeeSharingAuthorityEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "sharingConfig";
                        type: "pubkey";
                    },
                    {
                        name: "admin";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "setAuthorityEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "oldAuthority";
                        type: "pubkey";
                    },
                    {
                        name: "newAuthority";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "setClaimRateLimitEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "claimRateLimit";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "setDisableFlagsEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "disableFlags";
                        type: "u8";
                    }
                ];
            };
        },
        {
            name: "setSocialClaimAuthorityEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "socialClaimAuthority";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "shareholder";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "address";
                        type: "pubkey";
                    },
                    {
                        name: "shareBps";
                        type: "u16";
                    }
                ];
            };
        },
        {
            name: "sharingConfig";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "bump";
                        type: "u8";
                    },
                    {
                        name: "version";
                        type: "u8";
                    },
                    {
                        name: "status";
                        type: {
                            defined: {
                                name: "configStatus";
                            };
                        };
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "admin";
                        type: "pubkey";
                    },
                    {
                        name: "adminRevoked";
                        type: "bool";
                    },
                    {
                        name: "shareholders";
                        type: {
                            vec: {
                                defined: {
                                    name: "shareholder";
                                };
                            };
                        };
                    }
                ];
            };
        },
        {
            name: "socialFeePda";
            docs: ["Platform identifier: 0=pump, 1=twitter, etc."];
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "bump";
                        type: "u8";
                    },
                    {
                        name: "version";
                        type: "u8";
                    },
                    {
                        name: "userId";
                        docs: [
                            "Max 20 characters to fit u64::MAX (18,446,744,073,709,551,615) as a string.",
                            "Actual storage: 4 bytes (length prefix) + 20 bytes (content) = 24 bytes."
                        ];
                        type: "string";
                    },
                    {
                        name: "platform";
                        type: "u8";
                    },
                    {
                        name: "totalClaimed";
                        type: "u64";
                    },
                    {
                        name: "lastClaimed";
                        type: "u64";
                    },
                    {
                        name: "reserved";
                        type: {
                            array: ["u8", 128];
                        };
                    }
                ];
            };
        },
        {
            name: "socialFeePdaClaimed";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "userId";
                        type: "string";
                    },
                    {
                        name: "platform";
                        type: "u8";
                    },
                    {
                        name: "socialFeePda";
                        type: "pubkey";
                    },
                    {
                        name: "recipient";
                        type: "pubkey";
                    },
                    {
                        name: "socialClaimAuthority";
                        type: "pubkey";
                    },
                    {
                        name: "amountClaimed";
                        type: "u64";
                    },
                    {
                        name: "claimableBefore";
                        type: "u64";
                    },
                    {
                        name: "lifetimeClaimed";
                        type: "u64";
                    },
                    {
                        name: "recipientBalanceBefore";
                        type: "u64";
                    },
                    {
                        name: "recipientBalanceAfter";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "socialFeePdaCreated";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "userId";
                        type: "string";
                    },
                    {
                        name: "platform";
                        type: "u8";
                    },
                    {
                        name: "socialFeePda";
                        type: "pubkey";
                    },
                    {
                        name: "createdBy";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "transferFeeSharingAuthorityEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "sharingConfig";
                        type: "pubkey";
                    },
                    {
                        name: "oldAdmin";
                        type: "pubkey";
                    },
                    {
                        name: "newAdmin";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "updateAdminEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "oldAdmin";
                        type: "pubkey";
                    },
                    {
                        name: "newAdmin";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "updateFeeConfigEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "admin";
                        type: "pubkey";
                    },
                    {
                        name: "feeConfig";
                        type: "pubkey";
                    },
                    {
                        name: "feeTiers";
                        type: {
                            vec: {
                                defined: {
                                    name: "feeTier";
                                };
                            };
                        };
                    },
                    {
                        name: "flatFees";
                        type: {
                            defined: {
                                name: "fees";
                            };
                        };
                    }
                ];
            };
        },
        {
            name: "updateFeeSharesEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "sharingConfig";
                        type: "pubkey";
                    },
                    {
                        name: "admin";
                        type: "pubkey";
                    },
                    {
                        name: "newShareholders";
                        type: {
                            vec: {
                                defined: {
                                    name: "shareholder";
                                };
                            };
                        };
                    }
                ];
            };
        },
        {
            name: "upsertFeeTiersEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "admin";
                        type: "pubkey";
                    },
                    {
                        name: "feeConfig";
                        type: "pubkey";
                    },
                    {
                        name: "feeTiers";
                        type: {
                            vec: {
                                defined: {
                                    name: "feeTier";
                                };
                            };
                        };
                    },
                    {
                        name: "offset";
                        type: "u8";
                    }
                ];
            };
        }
    ];
    constants: [
        {
            name: "feeConfigSeed";
            type: "bytes";
            value: "[102, 101, 101, 95, 99, 111, 110, 102, 105, 103]";
        },
        {
            name: "feeProgramGlobalSeed";
            type: {
                array: ["u8", 18];
            };
            value: "[102, 101, 101, 45, 112, 114, 111, 103, 114, 97, 109, 45, 103, 108, 111, 98, 97, 108]";
        },
        {
            name: "pumpGlobalSeed";
            docs: ["Bonding Curve Program Global Seed"];
            type: {
                array: ["u8", 6];
            };
            value: "[103, 108, 111, 98, 97, 108]";
        },
        {
            name: "sharingConfigSeed";
            type: {
                array: ["u8", 14];
            };
            value: "[115, 104, 97, 114, 105, 110, 103, 45, 99, 111, 110, 102, 105, 103]";
        },
        {
            name: "socialFeePdaSeed";
            type: {
                array: ["u8", 14];
            };
            value: "[115, 111, 99, 105, 97, 108, 45, 102, 101, 101, 45, 112, 100, 97]";
        }
    ];
}

interface Global {
    initialized: boolean;
    authority: PublicKey;
    feeRecipient: PublicKey;
    initialVirtualTokenReserves: BN;
    initialVirtualSolReserves: BN;
    initialRealTokenReserves: BN;
    tokenTotalSupply: BN;
    feeBasisPoints: BN;
    withdrawAuthority: PublicKey;
    enableMigrate: boolean;
    poolMigrationFee: BN;
    creatorFeeBasisPoints: BN;
    feeRecipients: PublicKey[];
    setCreatorAuthority: PublicKey;
    adminSetCreatorAuthority: PublicKey;
    createV2Enabled: boolean;
    whitelistPda: PublicKey;
    reservedFeeRecipient: PublicKey;
    mayhemModeEnabled: boolean;
    reservedFeeRecipients: PublicKey[];
}
interface BondingCurve {
    virtualTokenReserves: BN;
    virtualSolReserves: BN;
    realTokenReserves: BN;
    realSolReserves: BN;
    tokenTotalSupply: BN;
    complete: boolean;
    creator: PublicKey;
    isMayhemMode: boolean;
}
interface GlobalVolumeAccumulator {
    startTime: BN;
    endTime: BN;
    secondsInADay: BN;
    mint: PublicKey;
    totalTokenSupply: BN[];
    solVolumes: BN[];
}
interface UserVolumeAccumulator {
    user: PublicKey;
    needsClaim: boolean;
    totalUnclaimedTokens: BN;
    totalClaimedTokens: BN;
    currentSolVolume: BN;
    lastUpdateTimestamp: BN;
}
interface UserVolumeAccumulatorTotalStats {
    totalUnclaimedTokens: BN;
    totalClaimedTokens: BN;
    currentSolVolume: BN;
}
interface FeeConfig {
    admin: PublicKey;
    flatFees: Fees;
    feeTiers: FeeTier[];
}
interface FeeTier {
    marketCapLamportsThreshold: BN;
    fees: Fees;
}
interface Fees {
    lpFeeBps: BN;
    protocolFeeBps: BN;
    creatorFeeBps: BN;
}
interface Shareholder {
    address: PublicKey;
    shareBps: number;
}
interface SharingConfig {
    version: number;
    mint: PublicKey;
    admin: PublicKey;
    adminRevoked: boolean;
    shareholders: Shareholder[];
}
interface DistributeCreatorFeesEvent {
    timestamp: BN;
    mint: PublicKey;
    sharingConfig: PublicKey;
    admin: PublicKey;
    shareholders: Shareholder[];
    distributed: BN;
}
interface MinimumDistributableFeeEvent {
    minimumRequired: BN;
    distributableFees: BN;
    canDistribute: boolean;
}

declare function newBondingCurve(global: Global): BondingCurve;
declare function getBuyTokenAmountFromSolAmount({ global, feeConfig, mintSupply, bondingCurve, amount, }: {
    global: Global;
    feeConfig: FeeConfig | null;
    mintSupply: BN | null;
    bondingCurve: BondingCurve | null;
    amount: BN;
}): BN;
declare function getBuySolAmountFromTokenAmount({ global, feeConfig, mintSupply, bondingCurve, amount, }: {
    global: Global;
    feeConfig: FeeConfig | null;
    mintSupply: BN | null;
    bondingCurve: BondingCurve | null;
    amount: BN;
}): BN;
declare function getSellSolAmountFromTokenAmount({ global, feeConfig, mintSupply, bondingCurve, amount, }: {
    global: Global;
    feeConfig: FeeConfig | null;
    mintSupply: BN;
    bondingCurve: BondingCurve;
    amount: BN;
}): BN;
declare function bondingCurveMarketCap({ mintSupply, virtualSolReserves, virtualTokenReserves, }: {
    mintSupply: BN;
    virtualSolReserves: BN;
    virtualTokenReserves: BN;
}): BN;

declare const GLOBAL_PDA: PublicKey;
declare const AMM_GLOBAL_PDA: PublicKey;
declare const PUMP_FEE_CONFIG_PDA: PublicKey;
declare const GLOBAL_VOLUME_ACCUMULATOR_PDA: PublicKey;
declare const AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA: PublicKey;
declare const PUMP_EVENT_AUTHORITY_PDA: PublicKey;
declare const PUMP_AMM_EVENT_AUTHORITY_PDA: PublicKey;
declare const PUMP_FEE_EVENT_AUTHORITY_PDA: PublicKey;
declare function getEventAuthorityPda(programId: PublicKey): PublicKey;
declare function bondingCurvePda(mint: PublicKeyInitData): PublicKey;
declare function creatorVaultPda(creator: PublicKey): PublicKey;
declare function pumpPoolAuthorityPda(mint: PublicKey): PublicKey;
declare const CANONICAL_POOL_INDEX = 0;
declare function canonicalPumpPoolPda(mint: PublicKey): PublicKey;
declare function userVolumeAccumulatorPda(user: PublicKey): PublicKey;
declare const getGlobalParamsPda: () => PublicKey;
declare const getMayhemStatePda: (mint: PublicKey) => PublicKey;
declare const getSolVaultPda: () => PublicKey;
declare const getTokenVaultPda: (mintPubkey: PublicKey) => PublicKey;
declare const feeSharingConfigPda: (mint: PublicKey) => PublicKey;
declare const ammCreatorVaultPda: (creator: PublicKey) => PublicKey;

/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/pump_amm.json`.
 */
interface PumpAmm {
    address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
    metadata: {
        name: "pumpAmm";
        version: "0.1.0";
        spec: "0.1.0";
        description: "Created with Anchor";
    };
    instructions: [
        {
            name: "adminSetCoinCreator";
            docs: ["Overrides the coin creator for a canonical pump pool"];
            discriminator: [242, 40, 117, 145, 73, 96, 105, 104];
            accounts: [
                {
                    name: "adminSetCoinCreatorAuthority";
                    signer: true;
                    relations: ["globalConfig"];
                },
                {
                    name: "globalConfig";
                },
                {
                    name: "pool";
                    writable: true;
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "coinCreator";
                    type: "pubkey";
                }
            ];
        },
        {
            name: "adminUpdateTokenIncentives";
            discriminator: [209, 11, 115, 87, 213, 23, 124, 204];
            accounts: [
                {
                    name: "admin";
                    writable: true;
                    signer: true;
                    relations: ["globalConfig"];
                },
                {
                    name: "globalConfig";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108,
                                    95,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "globalVolumeAccumulator";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "mint";
                },
                {
                    name: "globalIncentiveTokenAccount";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "globalVolumeAccumulator";
                            },
                            {
                                kind: "account";
                                path: "tokenProgram";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "associatedTokenProgram";
                    address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "tokenProgram";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "startTime";
                    type: "i64";
                },
                {
                    name: "endTime";
                    type: "i64";
                },
                {
                    name: "secondsInADay";
                    type: "i64";
                },
                {
                    name: "dayNumber";
                    type: "u64";
                },
                {
                    name: "tokenSupplyPerDay";
                    type: "u64";
                }
            ];
        },
        {
            name: "buy";
            docs: [
                "For cashback coins, optionally pass user_volume_accumulator_wsol_ata as remaining_accounts[0].",
                "If provided and valid, the ATA will be initialized if needed."
            ];
            discriminator: [102, 6, 61, 18, 1, 218, 235, 234];
            accounts: [
                {
                    name: "pool";
                    writable: true;
                },
                {
                    name: "user";
                    writable: true;
                    signer: true;
                },
                {
                    name: "globalConfig";
                },
                {
                    name: "baseMint";
                    relations: ["pool"];
                },
                {
                    name: "quoteMint";
                    relations: ["pool"];
                },
                {
                    name: "userBaseTokenAccount";
                    writable: true;
                },
                {
                    name: "userQuoteTokenAccount";
                    writable: true;
                },
                {
                    name: "poolBaseTokenAccount";
                    writable: true;
                    relations: ["pool"];
                },
                {
                    name: "poolQuoteTokenAccount";
                    writable: true;
                    relations: ["pool"];
                },
                {
                    name: "protocolFeeRecipient";
                },
                {
                    name: "protocolFeeRecipientTokenAccount";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "protocolFeeRecipient";
                            },
                            {
                                kind: "account";
                                path: "quoteTokenProgram";
                            },
                            {
                                kind: "account";
                                path: "quoteMint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "baseTokenProgram";
                },
                {
                    name: "quoteTokenProgram";
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "associatedTokenProgram";
                    address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                    address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
                },
                {
                    name: "coinCreatorVaultAta";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "coinCreatorVaultAuthority";
                            },
                            {
                                kind: "account";
                                path: "quoteTokenProgram";
                            },
                            {
                                kind: "account";
                                path: "quoteMint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "coinCreatorVaultAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    99,
                                    114,
                                    101,
                                    97,
                                    116,
                                    111,
                                    114,
                                    95,
                                    118,
                                    97,
                                    117,
                                    108,
                                    116
                                ];
                            },
                            {
                                kind: "account";
                                path: "pool.coin_creator";
                                account: "pool";
                            }
                        ];
                    };
                },
                {
                    name: "globalVolumeAccumulator";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "userVolumeAccumulator";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    117,
                                    115,
                                    101,
                                    114,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            },
                            {
                                kind: "account";
                                path: "user";
                            }
                        ];
                    };
                },
                {
                    name: "feeConfig";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [102, 101, 101, 95, 99, 111, 110, 102, 105, 103];
                            },
                            {
                                kind: "const";
                                value: [
                                    12,
                                    20,
                                    222,
                                    252,
                                    130,
                                    94,
                                    198,
                                    118,
                                    148,
                                    37,
                                    8,
                                    24,
                                    187,
                                    101,
                                    64,
                                    101,
                                    244,
                                    41,
                                    141,
                                    49,
                                    86,
                                    213,
                                    113,
                                    180,
                                    212,
                                    248,
                                    9,
                                    12,
                                    24,
                                    233,
                                    168,
                                    99
                                ];
                            }
                        ];
                        program: {
                            kind: "account";
                            path: "feeProgram";
                        };
                    };
                },
                {
                    name: "feeProgram";
                    address: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";
                }
            ];
            args: [
                {
                    name: "baseAmountOut";
                    type: "u64";
                },
                {
                    name: "maxQuoteAmountIn";
                    type: "u64";
                },
                {
                    name: "trackVolume";
                    type: {
                        defined: {
                            name: "optionBool";
                        };
                    };
                }
            ];
        },
        {
            name: "buyExactQuoteIn";
            docs: [
                "Given a budget of spendable_quote_in, buy at least min_base_amount_out",
                "Fees will be deducted from spendable_quote_in",
                "",
                "f(quote) = tokens, where tokens >= min_base_amount_out",
                "",
                "Make sure the payer has enough SOL to cover creation of the following accounts (unless already created):",
                "- protocol_fee_recipient_token_account: rent.minimum_balance(TokenAccount::LEN)",
                "- coin_creator_vault_ata: rent.minimum_balance(TokenAccount::LEN)",
                "- user_volume_accumulator: rent.minimum_balance(UserVolumeAccumulator::LEN)",
                "",
                "For cashback coins, optionally pass user_volume_accumulator_wsol_ata as remaining_accounts[0].",
                "If provided and valid, the ATA will be initialized if needed."
            ];
            discriminator: [198, 46, 21, 82, 180, 217, 232, 112];
            accounts: [
                {
                    name: "pool";
                    writable: true;
                },
                {
                    name: "user";
                    writable: true;
                    signer: true;
                },
                {
                    name: "globalConfig";
                },
                {
                    name: "baseMint";
                    relations: ["pool"];
                },
                {
                    name: "quoteMint";
                    relations: ["pool"];
                },
                {
                    name: "userBaseTokenAccount";
                    writable: true;
                },
                {
                    name: "userQuoteTokenAccount";
                    writable: true;
                },
                {
                    name: "poolBaseTokenAccount";
                    writable: true;
                    relations: ["pool"];
                },
                {
                    name: "poolQuoteTokenAccount";
                    writable: true;
                    relations: ["pool"];
                },
                {
                    name: "protocolFeeRecipient";
                },
                {
                    name: "protocolFeeRecipientTokenAccount";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "protocolFeeRecipient";
                            },
                            {
                                kind: "account";
                                path: "quoteTokenProgram";
                            },
                            {
                                kind: "account";
                                path: "quoteMint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "baseTokenProgram";
                },
                {
                    name: "quoteTokenProgram";
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "associatedTokenProgram";
                    address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                    address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
                },
                {
                    name: "coinCreatorVaultAta";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "coinCreatorVaultAuthority";
                            },
                            {
                                kind: "account";
                                path: "quoteTokenProgram";
                            },
                            {
                                kind: "account";
                                path: "quoteMint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "coinCreatorVaultAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    99,
                                    114,
                                    101,
                                    97,
                                    116,
                                    111,
                                    114,
                                    95,
                                    118,
                                    97,
                                    117,
                                    108,
                                    116
                                ];
                            },
                            {
                                kind: "account";
                                path: "pool.coin_creator";
                                account: "pool";
                            }
                        ];
                    };
                },
                {
                    name: "globalVolumeAccumulator";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "userVolumeAccumulator";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    117,
                                    115,
                                    101,
                                    114,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            },
                            {
                                kind: "account";
                                path: "user";
                            }
                        ];
                    };
                },
                {
                    name: "feeConfig";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [102, 101, 101, 95, 99, 111, 110, 102, 105, 103];
                            },
                            {
                                kind: "const";
                                value: [
                                    12,
                                    20,
                                    222,
                                    252,
                                    130,
                                    94,
                                    198,
                                    118,
                                    148,
                                    37,
                                    8,
                                    24,
                                    187,
                                    101,
                                    64,
                                    101,
                                    244,
                                    41,
                                    141,
                                    49,
                                    86,
                                    213,
                                    113,
                                    180,
                                    212,
                                    248,
                                    9,
                                    12,
                                    24,
                                    233,
                                    168,
                                    99
                                ];
                            }
                        ];
                        program: {
                            kind: "account";
                            path: "feeProgram";
                        };
                    };
                },
                {
                    name: "feeProgram";
                    address: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";
                }
            ];
            args: [
                {
                    name: "spendableQuoteIn";
                    type: "u64";
                },
                {
                    name: "minBaseAmountOut";
                    type: "u64";
                },
                {
                    name: "trackVolume";
                    type: {
                        defined: {
                            name: "optionBool";
                        };
                    };
                }
            ];
        },
        {
            name: "claimCashback";
            discriminator: [37, 58, 35, 126, 190, 53, 228, 197];
            accounts: [
                {
                    name: "user";
                    writable: true;
                },
                {
                    name: "userVolumeAccumulator";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    117,
                                    115,
                                    101,
                                    114,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            },
                            {
                                kind: "account";
                                path: "user";
                            }
                        ];
                    };
                },
                {
                    name: "quoteMint";
                },
                {
                    name: "quoteTokenProgram";
                },
                {
                    name: "userVolumeAccumulatorWsolTokenAccount";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "userVolumeAccumulator";
                            },
                            {
                                kind: "account";
                                path: "quoteTokenProgram";
                            },
                            {
                                kind: "account";
                                path: "quoteMint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "userWsolTokenAccount";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "user";
                            },
                            {
                                kind: "account";
                                path: "quoteTokenProgram";
                            },
                            {
                                kind: "account";
                                path: "quoteMint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                    address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
                }
            ];
            args: [];
        },
        {
            name: "claimTokenIncentives";
            discriminator: [16, 4, 71, 28, 204, 1, 40, 27];
            accounts: [
                {
                    name: "user";
                },
                {
                    name: "userAta";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "user";
                            },
                            {
                                kind: "account";
                                path: "tokenProgram";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "globalVolumeAccumulator";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "globalIncentiveTokenAccount";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "globalVolumeAccumulator";
                            },
                            {
                                kind: "account";
                                path: "tokenProgram";
                            },
                            {
                                kind: "account";
                                path: "mint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "userVolumeAccumulator";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    117,
                                    115,
                                    101,
                                    114,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            },
                            {
                                kind: "account";
                                path: "user";
                            }
                        ];
                    };
                },
                {
                    name: "mint";
                    relations: ["globalVolumeAccumulator"];
                },
                {
                    name: "tokenProgram";
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "associatedTokenProgram";
                    address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                    address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
                },
                {
                    name: "payer";
                    writable: true;
                    signer: true;
                }
            ];
            args: [];
        },
        {
            name: "closeUserVolumeAccumulator";
            discriminator: [249, 69, 164, 218, 150, 103, 84, 138];
            accounts: [
                {
                    name: "user";
                    writable: true;
                    signer: true;
                },
                {
                    name: "userVolumeAccumulator";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    117,
                                    115,
                                    101,
                                    114,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            },
                            {
                                kind: "account";
                                path: "user";
                            }
                        ];
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "collectCoinCreatorFee";
            discriminator: [160, 57, 89, 42, 181, 139, 43, 66];
            accounts: [
                {
                    name: "quoteMint";
                },
                {
                    name: "quoteTokenProgram";
                },
                {
                    name: "coinCreator";
                },
                {
                    name: "coinCreatorVaultAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    99,
                                    114,
                                    101,
                                    97,
                                    116,
                                    111,
                                    114,
                                    95,
                                    118,
                                    97,
                                    117,
                                    108,
                                    116
                                ];
                            },
                            {
                                kind: "account";
                                path: "coinCreator";
                            }
                        ];
                    };
                },
                {
                    name: "coinCreatorVaultAta";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "coinCreatorVaultAuthority";
                            },
                            {
                                kind: "account";
                                path: "quoteTokenProgram";
                            },
                            {
                                kind: "account";
                                path: "quoteMint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "coinCreatorTokenAccount";
                    writable: true;
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "createConfig";
            discriminator: [201, 207, 243, 114, 75, 111, 47, 189];
            accounts: [
                {
                    name: "admin";
                    writable: true;
                    signer: true;
                    address: "8LWu7QM2dGR1G8nKDHthckea57bkCzXyBTAKPJUBDHo8";
                },
                {
                    name: "globalConfig";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108,
                                    95,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "lpFeeBasisPoints";
                    type: "u64";
                },
                {
                    name: "protocolFeeBasisPoints";
                    type: "u64";
                },
                {
                    name: "protocolFeeRecipients";
                    type: {
                        array: ["pubkey", 8];
                    };
                },
                {
                    name: "coinCreatorFeeBasisPoints";
                    type: "u64";
                },
                {
                    name: "adminSetCoinCreatorAuthority";
                    type: "pubkey";
                }
            ];
        },
        {
            name: "createPool";
            discriminator: [233, 146, 209, 142, 207, 104, 64, 188];
            accounts: [
                {
                    name: "pool";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [112, 111, 111, 108];
                            },
                            {
                                kind: "arg";
                                path: "index";
                            },
                            {
                                kind: "account";
                                path: "creator";
                            },
                            {
                                kind: "account";
                                path: "baseMint";
                            },
                            {
                                kind: "account";
                                path: "quoteMint";
                            }
                        ];
                    };
                },
                {
                    name: "globalConfig";
                },
                {
                    name: "creator";
                    writable: true;
                    signer: true;
                },
                {
                    name: "baseMint";
                },
                {
                    name: "quoteMint";
                },
                {
                    name: "lpMint";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    112,
                                    111,
                                    111,
                                    108,
                                    95,
                                    108,
                                    112,
                                    95,
                                    109,
                                    105,
                                    110,
                                    116
                                ];
                            },
                            {
                                kind: "account";
                                path: "pool";
                            }
                        ];
                    };
                },
                {
                    name: "userBaseTokenAccount";
                    writable: true;
                },
                {
                    name: "userQuoteTokenAccount";
                    writable: true;
                },
                {
                    name: "userPoolTokenAccount";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "creator";
                            },
                            {
                                kind: "account";
                                path: "token2022Program";
                            },
                            {
                                kind: "account";
                                path: "lpMint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "poolBaseTokenAccount";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "pool";
                            },
                            {
                                kind: "account";
                                path: "baseTokenProgram";
                            },
                            {
                                kind: "account";
                                path: "baseMint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "poolQuoteTokenAccount";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "pool";
                            },
                            {
                                kind: "account";
                                path: "quoteTokenProgram";
                            },
                            {
                                kind: "account";
                                path: "quoteMint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "token2022Program";
                    address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
                },
                {
                    name: "baseTokenProgram";
                },
                {
                    name: "quoteTokenProgram";
                },
                {
                    name: "associatedTokenProgram";
                    address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "index";
                    type: "u16";
                },
                {
                    name: "baseAmountIn";
                    type: "u64";
                },
                {
                    name: "quoteAmountIn";
                    type: "u64";
                },
                {
                    name: "coinCreator";
                    type: "pubkey";
                },
                {
                    name: "isMayhemMode";
                    type: "bool";
                },
                {
                    name: "isCashbackCoin";
                    type: {
                        defined: {
                            name: "optionBool";
                        };
                    };
                }
            ];
        },
        {
            name: "deposit";
            discriminator: [242, 35, 198, 137, 82, 225, 242, 182];
            accounts: [
                {
                    name: "pool";
                    writable: true;
                },
                {
                    name: "globalConfig";
                },
                {
                    name: "user";
                    signer: true;
                },
                {
                    name: "baseMint";
                    relations: ["pool"];
                },
                {
                    name: "quoteMint";
                    relations: ["pool"];
                },
                {
                    name: "lpMint";
                    writable: true;
                    relations: ["pool"];
                },
                {
                    name: "userBaseTokenAccount";
                    writable: true;
                },
                {
                    name: "userQuoteTokenAccount";
                    writable: true;
                },
                {
                    name: "userPoolTokenAccount";
                    writable: true;
                },
                {
                    name: "poolBaseTokenAccount";
                    writable: true;
                    relations: ["pool"];
                },
                {
                    name: "poolQuoteTokenAccount";
                    writable: true;
                    relations: ["pool"];
                },
                {
                    name: "tokenProgram";
                    address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
                },
                {
                    name: "token2022Program";
                    address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "lpTokenAmountOut";
                    type: "u64";
                },
                {
                    name: "maxBaseAmountIn";
                    type: "u64";
                },
                {
                    name: "maxQuoteAmountIn";
                    type: "u64";
                }
            ];
        },
        {
            name: "disable";
            discriminator: [185, 173, 187, 90, 216, 15, 238, 233];
            accounts: [
                {
                    name: "admin";
                    signer: true;
                    relations: ["globalConfig"];
                },
                {
                    name: "globalConfig";
                    writable: true;
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "disableCreatePool";
                    type: "bool";
                },
                {
                    name: "disableDeposit";
                    type: "bool";
                },
                {
                    name: "disableWithdraw";
                    type: "bool";
                },
                {
                    name: "disableBuy";
                    type: "bool";
                },
                {
                    name: "disableSell";
                    type: "bool";
                }
            ];
        },
        {
            name: "extendAccount";
            discriminator: [234, 102, 194, 203, 150, 72, 62, 229];
            accounts: [
                {
                    name: "account";
                    writable: true;
                },
                {
                    name: "user";
                    signer: true;
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "initUserVolumeAccumulator";
            discriminator: [94, 6, 202, 115, 255, 96, 232, 183];
            accounts: [
                {
                    name: "payer";
                    writable: true;
                    signer: true;
                },
                {
                    name: "user";
                },
                {
                    name: "userVolumeAccumulator";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    117,
                                    115,
                                    101,
                                    114,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            },
                            {
                                kind: "account";
                                path: "user";
                            }
                        ];
                    };
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "migratePoolCoinCreator";
            docs: ["Migrate Pool Coin Creator to Sharing Config"];
            discriminator: [208, 8, 159, 4, 74, 175, 16, 58];
            accounts: [
                {
                    name: "pool";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [112, 111, 111, 108];
                            },
                            {
                                kind: "account";
                                path: "pool.index";
                                account: "pool";
                            },
                            {
                                kind: "account";
                                path: "pool.creator";
                                account: "pool";
                            },
                            {
                                kind: "account";
                                path: "pool.base_mint";
                                account: "pool";
                            },
                            {
                                kind: "account";
                                path: "pool.quote_mint";
                                account: "pool";
                            }
                        ];
                    };
                },
                {
                    name: "sharingConfig";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    115,
                                    104,
                                    97,
                                    114,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            },
                            {
                                kind: "account";
                                path: "pool.base_mint";
                                account: "pool";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                12,
                                53,
                                255,
                                169,
                                5,
                                90,
                                142,
                                86,
                                141,
                                168,
                                247,
                                188,
                                7,
                                86,
                                21,
                                39,
                                76,
                                241,
                                201,
                                44,
                                164,
                                31,
                                64,
                                0,
                                156,
                                81,
                                106,
                                164,
                                20,
                                194,
                                124,
                                112
                            ];
                        };
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "sell";
            discriminator: [51, 230, 133, 164, 1, 127, 131, 173];
            accounts: [
                {
                    name: "pool";
                    writable: true;
                },
                {
                    name: "user";
                    writable: true;
                    signer: true;
                },
                {
                    name: "globalConfig";
                },
                {
                    name: "baseMint";
                    relations: ["pool"];
                },
                {
                    name: "quoteMint";
                    relations: ["pool"];
                },
                {
                    name: "userBaseTokenAccount";
                    writable: true;
                },
                {
                    name: "userQuoteTokenAccount";
                    writable: true;
                },
                {
                    name: "poolBaseTokenAccount";
                    writable: true;
                    relations: ["pool"];
                },
                {
                    name: "poolQuoteTokenAccount";
                    writable: true;
                    relations: ["pool"];
                },
                {
                    name: "protocolFeeRecipient";
                },
                {
                    name: "protocolFeeRecipientTokenAccount";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "protocolFeeRecipient";
                            },
                            {
                                kind: "account";
                                path: "quoteTokenProgram";
                            },
                            {
                                kind: "account";
                                path: "quoteMint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "baseTokenProgram";
                },
                {
                    name: "quoteTokenProgram";
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "associatedTokenProgram";
                    address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                    address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
                },
                {
                    name: "coinCreatorVaultAta";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "coinCreatorVaultAuthority";
                            },
                            {
                                kind: "account";
                                path: "quoteTokenProgram";
                            },
                            {
                                kind: "account";
                                path: "quoteMint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "coinCreatorVaultAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    99,
                                    114,
                                    101,
                                    97,
                                    116,
                                    111,
                                    114,
                                    95,
                                    118,
                                    97,
                                    117,
                                    108,
                                    116
                                ];
                            },
                            {
                                kind: "account";
                                path: "pool.coin_creator";
                                account: "pool";
                            }
                        ];
                    };
                },
                {
                    name: "feeConfig";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [102, 101, 101, 95, 99, 111, 110, 102, 105, 103];
                            },
                            {
                                kind: "const";
                                value: [
                                    12,
                                    20,
                                    222,
                                    252,
                                    130,
                                    94,
                                    198,
                                    118,
                                    148,
                                    37,
                                    8,
                                    24,
                                    187,
                                    101,
                                    64,
                                    101,
                                    244,
                                    41,
                                    141,
                                    49,
                                    86,
                                    213,
                                    113,
                                    180,
                                    212,
                                    248,
                                    9,
                                    12,
                                    24,
                                    233,
                                    168,
                                    99
                                ];
                            }
                        ];
                        program: {
                            kind: "account";
                            path: "feeProgram";
                        };
                    };
                },
                {
                    name: "feeProgram";
                    address: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";
                }
            ];
            args: [
                {
                    name: "baseAmountIn";
                    type: "u64";
                },
                {
                    name: "minQuoteAmountOut";
                    type: "u64";
                }
            ];
        },
        {
            name: "setCoinCreator";
            docs: [
                "Sets Pool::coin_creator from Metaplex metadata creator or BondingCurve::creator"
            ];
            discriminator: [210, 149, 128, 45, 188, 58, 78, 175];
            accounts: [
                {
                    name: "pool";
                    writable: true;
                },
                {
                    name: "metadata";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [109, 101, 116, 97, 100, 97, 116, 97];
                            },
                            {
                                kind: "const";
                                value: [
                                    11,
                                    112,
                                    101,
                                    177,
                                    227,
                                    209,
                                    124,
                                    69,
                                    56,
                                    157,
                                    82,
                                    127,
                                    107,
                                    4,
                                    195,
                                    205,
                                    88,
                                    184,
                                    108,
                                    115,
                                    26,
                                    160,
                                    253,
                                    181,
                                    73,
                                    182,
                                    209,
                                    188,
                                    3,
                                    248,
                                    41,
                                    70
                                ];
                            },
                            {
                                kind: "account";
                                path: "pool.base_mint";
                                account: "pool";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                11,
                                112,
                                101,
                                177,
                                227,
                                209,
                                124,
                                69,
                                56,
                                157,
                                82,
                                127,
                                107,
                                4,
                                195,
                                205,
                                88,
                                184,
                                108,
                                115,
                                26,
                                160,
                                253,
                                181,
                                73,
                                182,
                                209,
                                188,
                                3,
                                248,
                                41,
                                70
                            ];
                        };
                    };
                },
                {
                    name: "bondingCurve";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    98,
                                    111,
                                    110,
                                    100,
                                    105,
                                    110,
                                    103,
                                    45,
                                    99,
                                    117,
                                    114,
                                    118,
                                    101
                                ];
                            },
                            {
                                kind: "account";
                                path: "pool.base_mint";
                                account: "pool";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                1,
                                86,
                                224,
                                246,
                                147,
                                102,
                                90,
                                207,
                                68,
                                219,
                                21,
                                104,
                                191,
                                23,
                                91,
                                170,
                                81,
                                137,
                                203,
                                151,
                                245,
                                210,
                                255,
                                59,
                                101,
                                93,
                                43,
                                182,
                                253,
                                109,
                                24,
                                176
                            ];
                        };
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "setReservedFeeRecipients";
            discriminator: [111, 172, 162, 232, 114, 89, 213, 142];
            accounts: [
                {
                    name: "globalConfig";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108,
                                    95,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "admin";
                    signer: true;
                    relations: ["globalConfig"];
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "whitelistPda";
                    type: "pubkey";
                }
            ];
        },
        {
            name: "syncUserVolumeAccumulator";
            discriminator: [86, 31, 192, 87, 163, 87, 79, 238];
            accounts: [
                {
                    name: "user";
                },
                {
                    name: "globalVolumeAccumulator";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    103,
                                    108,
                                    111,
                                    98,
                                    97,
                                    108,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "userVolumeAccumulator";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    117,
                                    115,
                                    101,
                                    114,
                                    95,
                                    118,
                                    111,
                                    108,
                                    117,
                                    109,
                                    101,
                                    95,
                                    97,
                                    99,
                                    99,
                                    117,
                                    109,
                                    117,
                                    108,
                                    97,
                                    116,
                                    111,
                                    114
                                ];
                            },
                            {
                                kind: "account";
                                path: "user";
                            }
                        ];
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "toggleCashbackEnabled";
            discriminator: [115, 103, 224, 255, 189, 89, 86, 195];
            accounts: [
                {
                    name: "admin";
                    signer: true;
                    relations: ["globalConfig"];
                },
                {
                    name: "globalConfig";
                    writable: true;
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "enabled";
                    type: "bool";
                }
            ];
        },
        {
            name: "toggleMayhemMode";
            discriminator: [1, 9, 111, 208, 100, 31, 255, 163];
            accounts: [
                {
                    name: "admin";
                    signer: true;
                    relations: ["globalConfig"];
                },
                {
                    name: "globalConfig";
                    writable: true;
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "enabled";
                    type: "bool";
                }
            ];
        },
        {
            name: "transferCreatorFeesToPump";
            docs: [
                "Transfer creator fees to pump creator vault",
                "If coin creator fees are currently below rent.minimum_balance(TokenAccount::LEN)",
                "The transfer will be skipped"
            ];
            discriminator: [139, 52, 134, 85, 228, 229, 108, 241];
            accounts: [
                {
                    name: "wsolMint";
                    docs: ["Pump Canonical Pool are quoted in wSOL"];
                },
                {
                    name: "tokenProgram";
                },
                {
                    name: "systemProgram";
                    address: "11111111111111111111111111111111";
                },
                {
                    name: "associatedTokenProgram";
                    address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
                },
                {
                    name: "coinCreator";
                },
                {
                    name: "coinCreatorVaultAuthority";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    99,
                                    114,
                                    101,
                                    97,
                                    116,
                                    111,
                                    114,
                                    95,
                                    118,
                                    97,
                                    117,
                                    108,
                                    116
                                ];
                            },
                            {
                                kind: "account";
                                path: "coinCreator";
                            }
                        ];
                    };
                },
                {
                    name: "coinCreatorVaultAta";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "account";
                                path: "coinCreatorVaultAuthority";
                            },
                            {
                                kind: "account";
                                path: "tokenProgram";
                            },
                            {
                                kind: "account";
                                path: "wsolMint";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                140,
                                151,
                                37,
                                143,
                                78,
                                36,
                                137,
                                241,
                                187,
                                61,
                                16,
                                41,
                                20,
                                142,
                                13,
                                131,
                                11,
                                90,
                                19,
                                153,
                                218,
                                255,
                                16,
                                132,
                                4,
                                142,
                                123,
                                216,
                                219,
                                233,
                                248,
                                89
                            ];
                        };
                    };
                },
                {
                    name: "pumpCreatorVault";
                    writable: true;
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    99,
                                    114,
                                    101,
                                    97,
                                    116,
                                    111,
                                    114,
                                    45,
                                    118,
                                    97,
                                    117,
                                    108,
                                    116
                                ];
                            },
                            {
                                kind: "account";
                                path: "coinCreator";
                            }
                        ];
                        program: {
                            kind: "const";
                            value: [
                                1,
                                86,
                                224,
                                246,
                                147,
                                102,
                                90,
                                207,
                                68,
                                219,
                                21,
                                104,
                                191,
                                23,
                                91,
                                170,
                                81,
                                137,
                                203,
                                151,
                                245,
                                210,
                                255,
                                59,
                                101,
                                93,
                                43,
                                182,
                                253,
                                109,
                                24,
                                176
                            ];
                        };
                    };
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "updateAdmin";
            discriminator: [161, 176, 40, 213, 60, 184, 179, 228];
            accounts: [
                {
                    name: "admin";
                    signer: true;
                    relations: ["globalConfig"];
                },
                {
                    name: "globalConfig";
                    writable: true;
                },
                {
                    name: "newAdmin";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [];
        },
        {
            name: "updateFeeConfig";
            discriminator: [104, 184, 103, 242, 88, 151, 107, 20];
            accounts: [
                {
                    name: "admin";
                    signer: true;
                    relations: ["globalConfig"];
                },
                {
                    name: "globalConfig";
                    writable: true;
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "lpFeeBasisPoints";
                    type: "u64";
                },
                {
                    name: "protocolFeeBasisPoints";
                    type: "u64";
                },
                {
                    name: "protocolFeeRecipients";
                    type: {
                        array: ["pubkey", 8];
                    };
                },
                {
                    name: "coinCreatorFeeBasisPoints";
                    type: "u64";
                },
                {
                    name: "adminSetCoinCreatorAuthority";
                    type: "pubkey";
                }
            ];
        },
        {
            name: "withdraw";
            discriminator: [183, 18, 70, 156, 148, 109, 161, 34];
            accounts: [
                {
                    name: "pool";
                    writable: true;
                },
                {
                    name: "globalConfig";
                },
                {
                    name: "user";
                    signer: true;
                },
                {
                    name: "baseMint";
                    relations: ["pool"];
                },
                {
                    name: "quoteMint";
                    relations: ["pool"];
                },
                {
                    name: "lpMint";
                    writable: true;
                    relations: ["pool"];
                },
                {
                    name: "userBaseTokenAccount";
                    writable: true;
                },
                {
                    name: "userQuoteTokenAccount";
                    writable: true;
                },
                {
                    name: "userPoolTokenAccount";
                    writable: true;
                },
                {
                    name: "poolBaseTokenAccount";
                    writable: true;
                    relations: ["pool"];
                },
                {
                    name: "poolQuoteTokenAccount";
                    writable: true;
                    relations: ["pool"];
                },
                {
                    name: "tokenProgram";
                    address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
                },
                {
                    name: "token2022Program";
                    address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
                },
                {
                    name: "eventAuthority";
                    pda: {
                        seeds: [
                            {
                                kind: "const";
                                value: [
                                    95,
                                    95,
                                    101,
                                    118,
                                    101,
                                    110,
                                    116,
                                    95,
                                    97,
                                    117,
                                    116,
                                    104,
                                    111,
                                    114,
                                    105,
                                    116,
                                    121
                                ];
                            }
                        ];
                    };
                },
                {
                    name: "program";
                }
            ];
            args: [
                {
                    name: "lpTokenAmountIn";
                    type: "u64";
                },
                {
                    name: "minBaseAmountOut";
                    type: "u64";
                },
                {
                    name: "minQuoteAmountOut";
                    type: "u64";
                }
            ];
        }
    ];
    accounts: [
        {
            name: "bondingCurve";
            discriminator: [23, 183, 248, 55, 96, 216, 172, 96];
        },
        {
            name: "feeConfig";
            discriminator: [143, 52, 146, 187, 219, 123, 76, 155];
        },
        {
            name: "globalConfig";
            discriminator: [149, 8, 156, 202, 160, 252, 176, 217];
        },
        {
            name: "globalVolumeAccumulator";
            discriminator: [202, 42, 246, 43, 142, 190, 30, 255];
        },
        {
            name: "pool";
            discriminator: [241, 154, 109, 4, 17, 177, 109, 188];
        },
        {
            name: "sharingConfig";
            discriminator: [216, 74, 9, 0, 56, 140, 93, 75];
        },
        {
            name: "userVolumeAccumulator";
            discriminator: [86, 255, 112, 14, 102, 53, 154, 250];
        }
    ];
    events: [
        {
            name: "adminSetCoinCreatorEvent";
            discriminator: [45, 220, 93, 24, 25, 97, 172, 104];
        },
        {
            name: "adminUpdateTokenIncentivesEvent";
            discriminator: [147, 250, 108, 120, 247, 29, 67, 222];
        },
        {
            name: "buyEvent";
            discriminator: [103, 244, 82, 31, 44, 245, 119, 119];
        },
        {
            name: "claimCashbackEvent";
            discriminator: [226, 214, 246, 33, 7, 242, 147, 229];
        },
        {
            name: "claimTokenIncentivesEvent";
            discriminator: [79, 172, 246, 49, 205, 91, 206, 232];
        },
        {
            name: "closeUserVolumeAccumulatorEvent";
            discriminator: [146, 159, 189, 172, 146, 88, 56, 244];
        },
        {
            name: "collectCoinCreatorFeeEvent";
            discriminator: [232, 245, 194, 238, 234, 218, 58, 89];
        },
        {
            name: "createConfigEvent";
            discriminator: [107, 52, 89, 129, 55, 226, 81, 22];
        },
        {
            name: "createPoolEvent";
            discriminator: [177, 49, 12, 210, 160, 118, 167, 116];
        },
        {
            name: "depositEvent";
            discriminator: [120, 248, 61, 83, 31, 142, 107, 144];
        },
        {
            name: "disableEvent";
            discriminator: [107, 253, 193, 76, 228, 202, 27, 104];
        },
        {
            name: "extendAccountEvent";
            discriminator: [97, 97, 215, 144, 93, 146, 22, 124];
        },
        {
            name: "initUserVolumeAccumulatorEvent";
            discriminator: [134, 36, 13, 72, 232, 101, 130, 216];
        },
        {
            name: "migratePoolCoinCreatorEvent";
            discriminator: [170, 221, 82, 199, 147, 165, 247, 46];
        },
        {
            name: "reservedFeeRecipientsEvent";
            discriminator: [43, 188, 250, 18, 221, 75, 187, 95];
        },
        {
            name: "sellEvent";
            discriminator: [62, 47, 55, 10, 165, 3, 220, 42];
        },
        {
            name: "setBondingCurveCoinCreatorEvent";
            discriminator: [242, 231, 235, 102, 65, 99, 189, 211];
        },
        {
            name: "setMetaplexCoinCreatorEvent";
            discriminator: [150, 107, 199, 123, 124, 207, 102, 228];
        },
        {
            name: "syncUserVolumeAccumulatorEvent";
            discriminator: [197, 122, 167, 124, 116, 81, 91, 255];
        },
        {
            name: "updateAdminEvent";
            discriminator: [225, 152, 171, 87, 246, 63, 66, 234];
        },
        {
            name: "updateFeeConfigEvent";
            discriminator: [90, 23, 65, 35, 62, 244, 188, 208];
        },
        {
            name: "withdrawEvent";
            discriminator: [22, 9, 133, 26, 160, 44, 71, 192];
        }
    ];
    errors: [
        {
            code: 6000;
            name: "feeBasisPointsExceedsMaximum";
        },
        {
            code: 6001;
            name: "zeroBaseAmount";
        },
        {
            code: 6002;
            name: "zeroQuoteAmount";
        },
        {
            code: 6003;
            name: "tooLittlePoolTokenLiquidity";
        },
        {
            code: 6004;
            name: "exceededSlippage";
        },
        {
            code: 6005;
            name: "invalidAdmin";
        },
        {
            code: 6006;
            name: "unsupportedBaseMint";
        },
        {
            code: 6007;
            name: "unsupportedQuoteMint";
        },
        {
            code: 6008;
            name: "invalidBaseMint";
        },
        {
            code: 6009;
            name: "invalidQuoteMint";
        },
        {
            code: 6010;
            name: "invalidLpMint";
        },
        {
            code: 6011;
            name: "allProtocolFeeRecipientsShouldBeNonZero";
        },
        {
            code: 6012;
            name: "unsortedNotUniqueProtocolFeeRecipients";
        },
        {
            code: 6013;
            name: "invalidProtocolFeeRecipient";
        },
        {
            code: 6014;
            name: "invalidPoolBaseTokenAccount";
        },
        {
            code: 6015;
            name: "invalidPoolQuoteTokenAccount";
        },
        {
            code: 6016;
            name: "buyMoreBaseAmountThanPoolReserves";
        },
        {
            code: 6017;
            name: "disabledCreatePool";
        },
        {
            code: 6018;
            name: "disabledDeposit";
        },
        {
            code: 6019;
            name: "disabledWithdraw";
        },
        {
            code: 6020;
            name: "disabledBuy";
        },
        {
            code: 6021;
            name: "disabledSell";
        },
        {
            code: 6022;
            name: "sameMint";
        },
        {
            code: 6023;
            name: "overflow";
        },
        {
            code: 6024;
            name: "truncation";
        },
        {
            code: 6025;
            name: "divisionByZero";
        },
        {
            code: 6026;
            name: "newSizeLessThanCurrentSize";
        },
        {
            code: 6027;
            name: "accountTypeNotSupported";
        },
        {
            code: 6028;
            name: "onlyCanonicalPumpPoolsCanHaveCoinCreator";
        },
        {
            code: 6029;
            name: "invalidAdminSetCoinCreatorAuthority";
        },
        {
            code: 6030;
            name: "startTimeInThePast";
        },
        {
            code: 6031;
            name: "endTimeInThePast";
        },
        {
            code: 6032;
            name: "endTimeBeforeStartTime";
        },
        {
            code: 6033;
            name: "timeRangeTooLarge";
        },
        {
            code: 6034;
            name: "endTimeBeforeCurrentDay";
        },
        {
            code: 6035;
            name: "supplyUpdateForFinishedRange";
        },
        {
            code: 6036;
            name: "dayIndexAfterEndIndex";
        },
        {
            code: 6037;
            name: "dayInActiveRange";
        },
        {
            code: 6038;
            name: "invalidIncentiveMint";
        },
        {
            code: 6039;
            name: "buyNotEnoughQuoteTokensToCoverFees";
            msg: "buy: Not enough quote tokens to cover for fees.";
        },
        {
            code: 6040;
            name: "buySlippageBelowMinBaseAmountOut";
            msg: "buy: slippage - would buy less tokens than expected min_base_amount_out";
        },
        {
            code: 6041;
            name: "mayhemModeDisabled";
        },
        {
            code: 6042;
            name: "onlyPumpPoolsMayhemMode";
        },
        {
            code: 6043;
            name: "mayhemModeInDesiredState";
        },
        {
            code: 6044;
            name: "notEnoughRemainingAccounts";
        },
        {
            code: 6045;
            name: "invalidSharingConfigBaseMint";
        },
        {
            code: 6046;
            name: "invalidSharingConfigCoinCreator";
        },
        {
            code: 6047;
            name: "coinCreatorMigratedToSharingConfig";
            msg: "coin creator has been migrated to sharing config, use pump_fees::reset_fee_sharing_config instead";
        },
        {
            code: 6048;
            name: "creatorVaultMigratedToSharingConfig";
            msg: "creator_vault has been migrated to sharing config, use pump:distribute_creator_fees instead";
        },
        {
            code: 6049;
            name: "cashbackNotEnabled";
            msg: "Cashback is disabled";
        },
        {
            code: 6050;
            name: "onlyPumpPoolsCashback";
        },
        {
            code: 6051;
            name: "cashbackNotInDesiredState";
        },
        {
            code: 6052;
            name: "cashbackEarnedDoesNotMatchTokenInVault";
        }
    ];
    types: [
        {
            name: "adminSetCoinCreatorEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "adminSetCoinCreatorAuthority";
                        type: "pubkey";
                    },
                    {
                        name: "baseMint";
                        type: "pubkey";
                    },
                    {
                        name: "pool";
                        type: "pubkey";
                    },
                    {
                        name: "oldCoinCreator";
                        type: "pubkey";
                    },
                    {
                        name: "newCoinCreator";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "adminUpdateTokenIncentivesEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "startTime";
                        type: "i64";
                    },
                    {
                        name: "endTime";
                        type: "i64";
                    },
                    {
                        name: "dayNumber";
                        type: "u64";
                    },
                    {
                        name: "tokenSupplyPerDay";
                        type: "u64";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "secondsInADay";
                        type: "i64";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    }
                ];
            };
        },
        {
            name: "bondingCurve";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "virtualTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "virtualSolReserves";
                        type: "u64";
                    },
                    {
                        name: "realTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "realSolReserves";
                        type: "u64";
                    },
                    {
                        name: "tokenTotalSupply";
                        type: "u64";
                    },
                    {
                        name: "complete";
                        type: "bool";
                    },
                    {
                        name: "creator";
                        type: "pubkey";
                    },
                    {
                        name: "isMayhemMode";
                        type: "bool";
                    },
                    {
                        name: "isCashbackCoin";
                        type: "bool";
                    }
                ];
            };
        },
        {
            name: "buyEvent";
            docs: ['ix_name: "buy" | "buy_exact_quote_in"'];
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "baseAmountOut";
                        type: "u64";
                    },
                    {
                        name: "maxQuoteAmountIn";
                        type: "u64";
                    },
                    {
                        name: "userBaseTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "userQuoteTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "poolBaseTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "poolQuoteTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "quoteAmountIn";
                        type: "u64";
                    },
                    {
                        name: "lpFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "lpFee";
                        type: "u64";
                    },
                    {
                        name: "protocolFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "protocolFee";
                        type: "u64";
                    },
                    {
                        name: "quoteAmountInWithLpFee";
                        type: "u64";
                    },
                    {
                        name: "userQuoteAmountIn";
                        type: "u64";
                    },
                    {
                        name: "pool";
                        type: "pubkey";
                    },
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "userBaseTokenAccount";
                        type: "pubkey";
                    },
                    {
                        name: "userQuoteTokenAccount";
                        type: "pubkey";
                    },
                    {
                        name: "protocolFeeRecipient";
                        type: "pubkey";
                    },
                    {
                        name: "protocolFeeRecipientTokenAccount";
                        type: "pubkey";
                    },
                    {
                        name: "coinCreator";
                        type: "pubkey";
                    },
                    {
                        name: "coinCreatorFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "coinCreatorFee";
                        type: "u64";
                    },
                    {
                        name: "trackVolume";
                        type: "bool";
                    },
                    {
                        name: "totalUnclaimedTokens";
                        type: "u64";
                    },
                    {
                        name: "totalClaimedTokens";
                        type: "u64";
                    },
                    {
                        name: "currentSolVolume";
                        type: "u64";
                    },
                    {
                        name: "lastUpdateTimestamp";
                        type: "i64";
                    },
                    {
                        name: "minBaseAmountOut";
                        type: "u64";
                    },
                    {
                        name: "ixName";
                        type: "string";
                    },
                    {
                        name: "cashbackFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "cashback";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "claimCashbackEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "amount";
                        type: "u64";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "totalClaimed";
                        type: "u64";
                    },
                    {
                        name: "totalCashbackEarned";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "claimTokenIncentivesEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "amount";
                        type: "u64";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "totalClaimedTokens";
                        type: "u64";
                    },
                    {
                        name: "currentSolVolume";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "closeUserVolumeAccumulatorEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "totalUnclaimedTokens";
                        type: "u64";
                    },
                    {
                        name: "totalClaimedTokens";
                        type: "u64";
                    },
                    {
                        name: "currentSolVolume";
                        type: "u64";
                    },
                    {
                        name: "lastUpdateTimestamp";
                        type: "i64";
                    }
                ];
            };
        },
        {
            name: "collectCoinCreatorFeeEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "coinCreator";
                        type: "pubkey";
                    },
                    {
                        name: "coinCreatorFee";
                        type: "u64";
                    },
                    {
                        name: "coinCreatorVaultAta";
                        type: "pubkey";
                    },
                    {
                        name: "coinCreatorTokenAccount";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "configStatus";
            type: {
                kind: "enum";
                variants: [
                    {
                        name: "paused";
                    },
                    {
                        name: "active";
                    }
                ];
            };
        },
        {
            name: "createConfigEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "admin";
                        type: "pubkey";
                    },
                    {
                        name: "lpFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "protocolFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "protocolFeeRecipients";
                        type: {
                            array: ["pubkey", 8];
                        };
                    },
                    {
                        name: "coinCreatorFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "adminSetCoinCreatorAuthority";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "createPoolEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "index";
                        type: "u16";
                    },
                    {
                        name: "creator";
                        type: "pubkey";
                    },
                    {
                        name: "baseMint";
                        type: "pubkey";
                    },
                    {
                        name: "quoteMint";
                        type: "pubkey";
                    },
                    {
                        name: "baseMintDecimals";
                        type: "u8";
                    },
                    {
                        name: "quoteMintDecimals";
                        type: "u8";
                    },
                    {
                        name: "baseAmountIn";
                        type: "u64";
                    },
                    {
                        name: "quoteAmountIn";
                        type: "u64";
                    },
                    {
                        name: "poolBaseAmount";
                        type: "u64";
                    },
                    {
                        name: "poolQuoteAmount";
                        type: "u64";
                    },
                    {
                        name: "minimumLiquidity";
                        type: "u64";
                    },
                    {
                        name: "initialLiquidity";
                        type: "u64";
                    },
                    {
                        name: "lpTokenAmountOut";
                        type: "u64";
                    },
                    {
                        name: "poolBump";
                        type: "u8";
                    },
                    {
                        name: "pool";
                        type: "pubkey";
                    },
                    {
                        name: "lpMint";
                        type: "pubkey";
                    },
                    {
                        name: "userBaseTokenAccount";
                        type: "pubkey";
                    },
                    {
                        name: "userQuoteTokenAccount";
                        type: "pubkey";
                    },
                    {
                        name: "coinCreator";
                        type: "pubkey";
                    },
                    {
                        name: "isMayhemMode";
                        type: "bool";
                    }
                ];
            };
        },
        {
            name: "depositEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "lpTokenAmountOut";
                        type: "u64";
                    },
                    {
                        name: "maxBaseAmountIn";
                        type: "u64";
                    },
                    {
                        name: "maxQuoteAmountIn";
                        type: "u64";
                    },
                    {
                        name: "userBaseTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "userQuoteTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "poolBaseTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "poolQuoteTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "baseAmountIn";
                        type: "u64";
                    },
                    {
                        name: "quoteAmountIn";
                        type: "u64";
                    },
                    {
                        name: "lpMintSupply";
                        type: "u64";
                    },
                    {
                        name: "pool";
                        type: "pubkey";
                    },
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "userBaseTokenAccount";
                        type: "pubkey";
                    },
                    {
                        name: "userQuoteTokenAccount";
                        type: "pubkey";
                    },
                    {
                        name: "userPoolTokenAccount";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "disableEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "admin";
                        type: "pubkey";
                    },
                    {
                        name: "disableCreatePool";
                        type: "bool";
                    },
                    {
                        name: "disableDeposit";
                        type: "bool";
                    },
                    {
                        name: "disableWithdraw";
                        type: "bool";
                    },
                    {
                        name: "disableBuy";
                        type: "bool";
                    },
                    {
                        name: "disableSell";
                        type: "bool";
                    }
                ];
            };
        },
        {
            name: "extendAccountEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "account";
                        type: "pubkey";
                    },
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "currentSize";
                        type: "u64";
                    },
                    {
                        name: "newSize";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "feeConfig";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "bump";
                        type: "u8";
                    },
                    {
                        name: "admin";
                        type: "pubkey";
                    },
                    {
                        name: "flatFees";
                        type: {
                            defined: {
                                name: "fees";
                            };
                        };
                    },
                    {
                        name: "feeTiers";
                        type: {
                            vec: {
                                defined: {
                                    name: "feeTier";
                                };
                            };
                        };
                    }
                ];
            };
        },
        {
            name: "feeTier";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "marketCapLamportsThreshold";
                        type: "u128";
                    },
                    {
                        name: "fees";
                        type: {
                            defined: {
                                name: "fees";
                            };
                        };
                    }
                ];
            };
        },
        {
            name: "fees";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "lpFeeBps";
                        type: "u64";
                    },
                    {
                        name: "protocolFeeBps";
                        type: "u64";
                    },
                    {
                        name: "creatorFeeBps";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "globalConfig";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "admin";
                        docs: ["The admin pubkey"];
                        type: "pubkey";
                    },
                    {
                        name: "lpFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "protocolFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "disableFlags";
                        docs: [
                            "Flags to disable certain functionality",
                            "bit 0 - Disable create pool",
                            "bit 1 - Disable deposit",
                            "bit 2 - Disable withdraw",
                            "bit 3 - Disable buy",
                            "bit 4 - Disable sell"
                        ];
                        type: "u8";
                    },
                    {
                        name: "protocolFeeRecipients";
                        docs: ["Addresses of the protocol fee recipients"];
                        type: {
                            array: ["pubkey", 8];
                        };
                    },
                    {
                        name: "coinCreatorFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "adminSetCoinCreatorAuthority";
                        docs: ["The admin authority for setting coin creators"];
                        type: "pubkey";
                    },
                    {
                        name: "whitelistPda";
                        type: "pubkey";
                    },
                    {
                        name: "reservedFeeRecipient";
                        type: "pubkey";
                    },
                    {
                        name: "mayhemModeEnabled";
                        type: "bool";
                    },
                    {
                        name: "reservedFeeRecipients";
                        type: {
                            array: ["pubkey", 7];
                        };
                    },
                    {
                        name: "isCashbackEnabled";
                        type: "bool";
                    }
                ];
            };
        },
        {
            name: "globalVolumeAccumulator";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "startTime";
                        type: "i64";
                    },
                    {
                        name: "endTime";
                        type: "i64";
                    },
                    {
                        name: "secondsInADay";
                        type: "i64";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "totalTokenSupply";
                        type: {
                            array: ["u64", 30];
                        };
                    },
                    {
                        name: "solVolumes";
                        type: {
                            array: ["u64", 30];
                        };
                    }
                ];
            };
        },
        {
            name: "initUserVolumeAccumulatorEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "payer";
                        type: "pubkey";
                    },
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    }
                ];
            };
        },
        {
            name: "migratePoolCoinCreatorEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "baseMint";
                        type: "pubkey";
                    },
                    {
                        name: "pool";
                        type: "pubkey";
                    },
                    {
                        name: "sharingConfig";
                        type: "pubkey";
                    },
                    {
                        name: "oldCoinCreator";
                        type: "pubkey";
                    },
                    {
                        name: "newCoinCreator";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "optionBool";
            type: {
                kind: "struct";
                fields: ["bool"];
            };
        },
        {
            name: "pool";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "poolBump";
                        type: "u8";
                    },
                    {
                        name: "index";
                        type: "u16";
                    },
                    {
                        name: "creator";
                        type: "pubkey";
                    },
                    {
                        name: "baseMint";
                        type: "pubkey";
                    },
                    {
                        name: "quoteMint";
                        type: "pubkey";
                    },
                    {
                        name: "lpMint";
                        type: "pubkey";
                    },
                    {
                        name: "poolBaseTokenAccount";
                        type: "pubkey";
                    },
                    {
                        name: "poolQuoteTokenAccount";
                        type: "pubkey";
                    },
                    {
                        name: "lpSupply";
                        docs: ["True circulating supply without burns and lock-ups"];
                        type: "u64";
                    },
                    {
                        name: "coinCreator";
                        type: "pubkey";
                    },
                    {
                        name: "isMayhemMode";
                        type: "bool";
                    },
                    {
                        name: "isCashbackCoin";
                        type: "bool";
                    }
                ];
            };
        },
        {
            name: "reservedFeeRecipientsEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "reservedFeeRecipient";
                        type: "pubkey";
                    },
                    {
                        name: "reservedFeeRecipients";
                        type: {
                            array: ["pubkey", 7];
                        };
                    }
                ];
            };
        },
        {
            name: "sellEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "baseAmountIn";
                        type: "u64";
                    },
                    {
                        name: "minQuoteAmountOut";
                        type: "u64";
                    },
                    {
                        name: "userBaseTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "userQuoteTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "poolBaseTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "poolQuoteTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "quoteAmountOut";
                        type: "u64";
                    },
                    {
                        name: "lpFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "lpFee";
                        type: "u64";
                    },
                    {
                        name: "protocolFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "protocolFee";
                        type: "u64";
                    },
                    {
                        name: "quoteAmountOutWithoutLpFee";
                        type: "u64";
                    },
                    {
                        name: "userQuoteAmountOut";
                        type: "u64";
                    },
                    {
                        name: "pool";
                        type: "pubkey";
                    },
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "userBaseTokenAccount";
                        type: "pubkey";
                    },
                    {
                        name: "userQuoteTokenAccount";
                        type: "pubkey";
                    },
                    {
                        name: "protocolFeeRecipient";
                        type: "pubkey";
                    },
                    {
                        name: "protocolFeeRecipientTokenAccount";
                        type: "pubkey";
                    },
                    {
                        name: "coinCreator";
                        type: "pubkey";
                    },
                    {
                        name: "coinCreatorFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "coinCreatorFee";
                        type: "u64";
                    },
                    {
                        name: "cashbackFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "cashback";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "setBondingCurveCoinCreatorEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "baseMint";
                        type: "pubkey";
                    },
                    {
                        name: "pool";
                        type: "pubkey";
                    },
                    {
                        name: "bondingCurve";
                        type: "pubkey";
                    },
                    {
                        name: "coinCreator";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "setMetaplexCoinCreatorEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "baseMint";
                        type: "pubkey";
                    },
                    {
                        name: "pool";
                        type: "pubkey";
                    },
                    {
                        name: "metadata";
                        type: "pubkey";
                    },
                    {
                        name: "coinCreator";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "shareholder";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "address";
                        type: "pubkey";
                    },
                    {
                        name: "shareBps";
                        type: "u16";
                    }
                ];
            };
        },
        {
            name: "sharingConfig";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "bump";
                        type: "u8";
                    },
                    {
                        name: "version";
                        type: "u8";
                    },
                    {
                        name: "status";
                        type: {
                            defined: {
                                name: "configStatus";
                            };
                        };
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "admin";
                        type: "pubkey";
                    },
                    {
                        name: "adminRevoked";
                        type: "bool";
                    },
                    {
                        name: "shareholders";
                        type: {
                            vec: {
                                defined: {
                                    name: "shareholder";
                                };
                            };
                        };
                    }
                ];
            };
        },
        {
            name: "syncUserVolumeAccumulatorEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "totalClaimedTokensBefore";
                        type: "u64";
                    },
                    {
                        name: "totalClaimedTokensAfter";
                        type: "u64";
                    },
                    {
                        name: "timestamp";
                        type: "i64";
                    }
                ];
            };
        },
        {
            name: "updateAdminEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "admin";
                        type: "pubkey";
                    },
                    {
                        name: "newAdmin";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "updateFeeConfigEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "admin";
                        type: "pubkey";
                    },
                    {
                        name: "lpFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "protocolFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "protocolFeeRecipients";
                        type: {
                            array: ["pubkey", 8];
                        };
                    },
                    {
                        name: "coinCreatorFeeBasisPoints";
                        type: "u64";
                    },
                    {
                        name: "adminSetCoinCreatorAuthority";
                        type: "pubkey";
                    }
                ];
            };
        },
        {
            name: "userVolumeAccumulator";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "needsClaim";
                        type: "bool";
                    },
                    {
                        name: "totalUnclaimedTokens";
                        type: "u64";
                    },
                    {
                        name: "totalClaimedTokens";
                        type: "u64";
                    },
                    {
                        name: "currentSolVolume";
                        type: "u64";
                    },
                    {
                        name: "lastUpdateTimestamp";
                        type: "i64";
                    },
                    {
                        name: "hasTotalClaimedTokens";
                        type: "bool";
                    },
                    {
                        name: "cashbackEarned";
                        type: "u64";
                    },
                    {
                        name: "totalCashbackClaimed";
                        type: "u64";
                    }
                ];
            };
        },
        {
            name: "withdrawEvent";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "timestamp";
                        type: "i64";
                    },
                    {
                        name: "lpTokenAmountIn";
                        type: "u64";
                    },
                    {
                        name: "minBaseAmountOut";
                        type: "u64";
                    },
                    {
                        name: "minQuoteAmountOut";
                        type: "u64";
                    },
                    {
                        name: "userBaseTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "userQuoteTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "poolBaseTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "poolQuoteTokenReserves";
                        type: "u64";
                    },
                    {
                        name: "baseAmountOut";
                        type: "u64";
                    },
                    {
                        name: "quoteAmountOut";
                        type: "u64";
                    },
                    {
                        name: "lpMintSupply";
                        type: "u64";
                    },
                    {
                        name: "pool";
                        type: "pubkey";
                    },
                    {
                        name: "user";
                        type: "pubkey";
                    },
                    {
                        name: "userBaseTokenAccount";
                        type: "pubkey";
                    },
                    {
                        name: "userQuoteTokenAccount";
                        type: "pubkey";
                    },
                    {
                        name: "userPoolTokenAccount";
                        type: "pubkey";
                    }
                ];
            };
        }
    ];
}

declare function getPumpProgram(connection: Connection): Program<Pump>;
declare const PUMP_PROGRAM_ID: PublicKey;
declare function getPumpAmmProgram(connection: Connection): Program<PumpAmm>;
declare function getPumpFeeProgram(connection: Connection): Program<PumpFees>;
declare const PUMP_AMM_PROGRAM_ID: PublicKey;
declare const MAYHEM_PROGRAM_ID: PublicKey;
declare const PUMP_FEE_PROGRAM_ID: PublicKey;
declare const BONDING_CURVE_NEW_SIZE = 151;
declare class PumpSdk {
    private readonly offlinePumpProgram;
    private readonly offlinePumpFeeProgram;
    private readonly offlinePumpAmmProgram;
    constructor();
    decodeGlobal(accountInfo: AccountInfo<Buffer>): Global;
    decodeFeeConfig(accountInfo: AccountInfo<Buffer>): FeeConfig;
    decodeBondingCurve(accountInfo: AccountInfo<Buffer>): BondingCurve;
    decodeBondingCurveNullable(accountInfo: AccountInfo<Buffer>): BondingCurve | null;
    decodeGlobalVolumeAccumulator(accountInfo: AccountInfo<Buffer>): GlobalVolumeAccumulator;
    decodeUserVolumeAccumulator(accountInfo: AccountInfo<Buffer>): UserVolumeAccumulator;
    decodeUserVolumeAccumulatorNullable(accountInfo: AccountInfo<Buffer>): UserVolumeAccumulator | null;
    decodeSharingConfig(accountInfo: AccountInfo<Buffer>): SharingConfig;
    /**
     * @deprecated Use `createInstructionV2` instead.
     */
    createInstruction({ mint, name, symbol, uri, creator, user, }: {
        mint: PublicKey;
        name: string;
        symbol: string;
        uri: string;
        creator: PublicKey;
        user: PublicKey;
    }): Promise<TransactionInstruction>;
    createV2Instruction({ mint, name, symbol, uri, creator, user, mayhemMode, cashback, }: {
        mint: PublicKey;
        name: string;
        symbol: string;
        uri: string;
        creator: PublicKey;
        user: PublicKey;
        mayhemMode: boolean;
        cashback?: boolean;
    }): Promise<TransactionInstruction>;
    buyInstructions({ global, bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo, mint, user, amount, solAmount, slippage, tokenProgram, }: {
        global: Global;
        bondingCurveAccountInfo: AccountInfo<Buffer>;
        bondingCurve: BondingCurve;
        associatedUserAccountInfo: AccountInfo<Buffer> | null;
        mint: PublicKey;
        user: PublicKey;
        amount: BN;
        solAmount: BN;
        slippage: number;
        tokenProgram: PublicKey;
    }): Promise<TransactionInstruction[]>;
    createV2AndBuyInstructions({ global, mint, name, symbol, uri, creator, user, amount, solAmount, mayhemMode, cashback, }: {
        global: Global;
        mint: PublicKey;
        name: string;
        symbol: string;
        uri: string;
        creator: PublicKey;
        user: PublicKey;
        amount: BN;
        solAmount: BN;
        mayhemMode: boolean;
        cashback?: boolean;
    }): Promise<TransactionInstruction[]>;
    /**
     * @deprecated Use `createV2AndBuyInstructions` instead.
     */
    createAndBuyInstructions({ global, mint, name, symbol, uri, creator, user, amount, solAmount, }: {
        global: Global;
        mint: PublicKey;
        name: string;
        symbol: string;
        uri: string;
        creator: PublicKey;
        user: PublicKey;
        amount: BN;
        solAmount: BN;
    }): Promise<TransactionInstruction[]>;
    private buyInstruction;
    sellInstructions({ global, bondingCurveAccountInfo, bondingCurve, mint, user, amount, solAmount, slippage, tokenProgram, mayhemMode, cashback, }: {
        global: Global;
        bondingCurveAccountInfo: AccountInfo<Buffer>;
        bondingCurve: BondingCurve;
        mint: PublicKey;
        user: PublicKey;
        amount: BN;
        solAmount: BN;
        slippage: number;
        tokenProgram: PublicKey;
        mayhemMode: boolean;
        cashback?: boolean;
    }): Promise<TransactionInstruction[]>;
    extendAccountInstruction({ account, user, }: {
        account: PublicKey;
        user: PublicKey;
    }): Promise<TransactionInstruction>;
    migrateInstruction({ withdrawAuthority, mint, user, tokenProgram, }: {
        withdrawAuthority: PublicKey;
        mint: PublicKey;
        user: PublicKey;
        tokenProgram: PublicKey;
    }): Promise<TransactionInstruction>;
    syncUserVolumeAccumulator(user: PublicKey): Promise<TransactionInstruction>;
    setCreator({ mint, setCreatorAuthority, creator, }: {
        mint: PublicKey;
        setCreatorAuthority: PublicKey;
        creator: PublicKey;
    }): Promise<TransactionInstruction>;
    initUserVolumeAccumulator({ payer, user, }: {
        payer: PublicKey;
        user: PublicKey;
    }): Promise<TransactionInstruction>;
    closeUserVolumeAccumulator(user: PublicKey): Promise<TransactionInstruction>;
    getBuyInstructionRaw({ user, mint, creator, amount, solAmount, feeRecipient, tokenProgram, }: {
        user: PublicKey;
        mint: PublicKey;
        creator: PublicKey;
        amount: BN;
        solAmount: BN;
        feeRecipient: PublicKey;
        tokenProgram?: PublicKey;
    }): Promise<TransactionInstruction>;
    private getBuyInstructionInternal;
    getSellInstructionRaw({ user, mint, creator, amount, solAmount, feeRecipient, tokenProgram, cashback, }: {
        user: PublicKey;
        mint: PublicKey;
        creator: PublicKey;
        amount: BN;
        solAmount: BN;
        feeRecipient: PublicKey;
        tokenProgram: PublicKey;
        cashback?: boolean;
    }): Promise<TransactionInstruction>;
    private getSellInstructionInternal;
    /**
     * Creates a fee sharing configuration for a token.
     *
     * @param params - Parameters for creating a fee sharing configuration
     * @param params.creator - The creator of the token
     * @param params.mint - The mint address of the token
     * @param params.pool - The pool address of the token (null for ungraduated coins)
     */
    createFeeSharingConfig({ creator, mint, pool, }: {
        creator: PublicKey;
        mint: PublicKey;
        pool: PublicKey | null;
    }): Promise<TransactionInstruction>;
    /**
     * Updates the fee shares for a token's creator fee distribution.
     *
     * @param params - Parameters for updating fee shares
     * @param params.authority - The current authority that can modify the fee sharing config
     * @param params.mint - The mint address of the token
     * @param params.curShareholders - Array of current shareholders
     * @param params.newShareholders - Array of new shareholders and their share percentages
     * @requirements for newShareholders:
     * - Must contain at least 1 shareholder (cannot be empty)
     * - Maximum of 10 shareholders allowed
     * - Each shareholder must have a positive share (shareBps > 0)
     * - Total shares must equal exactly 10,000 basis points (100%)
     * - No duplicate addresses allowed
     * - shareBps is in basis points where 1 bps = 0.01% (e.g., 1500 = 15%)
     * @throws {NoShareholdersError} If shareholders array is empty
     * @throws {TooManyShareholdersError} If more than 10 shareholders
     * @throws {ZeroShareError} If any shareholder has zero or negative shares
     * @throws {InvalidShareTotalError} If total shares don't equal 10,000 basis points
     * @throws {DuplicateShareholderError} If duplicate addresses are found
     * @example
     * ```typescript
     * const instruction = await PUMP_SDK.updateFeeShares({
     *   authority: authorityPublicKey,
     *   mint: mintPublicKey,
     *   curShareholders: [wallet1, wallet2, wallet3],
     *   newShareholders: [
     *     { address: wallet1, shareBps: 5000 }, // 50%
     *     { address: wallet2, shareBps: 3000 }, // 30%
     *     { address: wallet3, shareBps: 2000 }, // 20%
     *   ]
     * });
     * ```
     */
    updateFeeShares({ authority, mint, currentShareholders, newShareholders, }: {
        authority: PublicKey;
        mint: PublicKey;
        currentShareholders: PublicKey[];
        newShareholders: Shareholder[];
    }): Promise<TransactionInstruction>;
    decodeDistributeCreatorFeesEvent(data: Buffer): DistributeCreatorFeesEvent;
    distributeCreatorFees({ mint, sharingConfig, sharingConfigAddress, }: {
        mint: PublicKey;
        sharingConfig: SharingConfig;
        sharingConfigAddress: PublicKey;
    }): Promise<TransactionInstruction>;
    decodeMinimumDistributableFee(data: Buffer): MinimumDistributableFeeEvent;
    getMinimumDistributableFee({ mint, sharingConfig, sharingConfigAddress, }: {
        mint: PublicKey;
        sharingConfig: SharingConfig;
        sharingConfigAddress: PublicKey;
    }): Promise<TransactionInstruction>;
    claimCashbackInstruction({ user, }: {
        user: PublicKey;
    }): Promise<TransactionInstruction>;
}
declare const PUMP_SDK: PumpSdk;
/**
 * Checks if a creator has upgraded to using a fee sharing configuration.
 *
 * When a creator sets up fee sharing, the creator address in the BondingCurve or Pool
 * is replaced with the fee sharing config PDA address. This function checks if that
 * upgrade has occurred.
 *
 * @param params - Parameters for checking upgrade status
 * @param params.mint - The mint address of the token
 * @param params.creator - The creator address to check
 *                         - For ungraduated coins: use BondingCurve.creator
 *                         - For graduated coins: use Pool.coinCreator (from AMM pool)
 * @returns true if the creator has migrated to fee sharing config, false otherwise
 * @example
 * ```typescript
 * import { isCreatorUsingSharingConfig } from "@pump-fun/sdk";
 *
 * // For an ungraduated coin
 * const bondingCurve = await program.account.bondingCurve.fetch(bondingCurvePda(mint));
 * const hasMigrated = isCreatorUsingSharingConfig({
 *   mint,
 *   creator: bondingCurve.creator
 * });
 *
 * // For a graduated coin
 * const pool = await ammProgram.account.pool.fetch(poolAddress);
 * const hasMigrated = isCreatorUsingSharingConfig({
 *   mint,
 *   creator: pool.coinCreator
 * });
 *
 * if (hasMigrated) {
 *   // Creator fees are distributed according to fee sharing config
 * } else {
 *   // Creator fees go directly to the creator address
 * }
 * ```
 */
declare function isCreatorUsingSharingConfig({ mint, creator, }: {
    mint: PublicKey;
    creator: PublicKey;
}): boolean;

declare class OnlinePumpSdk {
    private readonly connection;
    private readonly pumpProgram;
    private readonly offlinePumpProgram;
    private readonly pumpAmmProgram;
    private readonly pumpAmmSdk;
    private readonly pumpAmmAdminSdk;
    constructor(connection: Connection);
    fetchGlobal(): Promise<Global>;
    fetchFeeConfig(): Promise<FeeConfig>;
    fetchBondingCurve(mint: PublicKeyInitData): Promise<BondingCurve>;
    fetchBuyState(mint: PublicKey, user: PublicKey, tokenProgram?: PublicKey): Promise<{
        bondingCurveAccountInfo: _solana_web3_js.AccountInfo<Buffer<ArrayBufferLike>>;
        bondingCurve: BondingCurve;
        associatedUserAccountInfo: _solana_web3_js.AccountInfo<Buffer<ArrayBufferLike>> | null;
    }>;
    fetchSellState(mint: PublicKey, user: PublicKey, tokenProgram?: PublicKey): Promise<{
        bondingCurveAccountInfo: _solana_web3_js.AccountInfo<Buffer<ArrayBufferLike>>;
        bondingCurve: BondingCurve;
    }>;
    fetchGlobalVolumeAccumulator(): Promise<GlobalVolumeAccumulator>;
    fetchUserVolumeAccumulator(user: PublicKey): Promise<UserVolumeAccumulator | null>;
    fetchUserVolumeAccumulatorTotalStats(user: PublicKey): Promise<UserVolumeAccumulatorTotalStats>;
    collectCoinCreatorFeeInstructions(coinCreator: PublicKey, feePayer?: PublicKey): Promise<TransactionInstruction[]>;
    adminSetCoinCreatorInstructions(newCoinCreator: PublicKey, mint: PublicKey): Promise<TransactionInstruction[]>;
    getCreatorVaultBalance(creator: PublicKey): Promise<BN>;
    getCreatorVaultBalanceBothPrograms(creator: PublicKey): Promise<BN>;
    adminUpdateTokenIncentives(startTime: BN, endTime: BN, dayNumber: BN, tokenSupplyPerDay: BN, secondsInADay?: BN, mint?: PublicKey, tokenProgram?: PublicKey): Promise<TransactionInstruction>;
    adminUpdateTokenIncentivesBothPrograms(startTime: BN, endTime: BN, dayNumber: BN, tokenSupplyPerDay: BN, secondsInADay?: BN, mint?: PublicKey, tokenProgram?: PublicKey): Promise<TransactionInstruction[]>;
    claimTokenIncentives(user: PublicKey, payer: PublicKey): Promise<TransactionInstruction[]>;
    claimTokenIncentivesBothPrograms(user: PublicKey, payer: PublicKey): Promise<TransactionInstruction[]>;
    getTotalUnclaimedTokens(user: PublicKey): Promise<BN>;
    getTotalUnclaimedTokensBothPrograms(user: PublicKey): Promise<BN>;
    getCurrentDayTokens(user: PublicKey): Promise<BN>;
    getCurrentDayTokensBothPrograms(user: PublicKey): Promise<BN>;
    syncUserVolumeAccumulatorBothPrograms(user: PublicKey): Promise<TransactionInstruction[]>;
    /**
     * Gets the minimum distributable fee for a token's fee sharing configuration.
     *
     * This method handles both graduated (AMM) and non-graduated (bonding curve) tokens.
     * For graduated tokens, it automatically consolidates fees from the AMM vault before
     * calculating the minimum distributable fee.
     *
     * @param mint - The mint address of the token
     * @param simulationSigner - Optional signer address for transaction simulation.
     *                           Must have a non-zero SOL balance. Defaults to a known funded address.
     * @returns The minimum distributable fee information including whether distribution is possible
     */
    getMinimumDistributableFee(mint: PublicKey, simulationSigner?: PublicKey): Promise<MinimumDistributableFeeResult>;
    /**
     * Gets the instructions to distribute creator fees for a token's fee sharing configuration.
     *
     * This method handles both graduated (AMM) and non-graduated (bonding curve) tokens.
     * For graduated tokens, it automatically includes an instruction to consolidate fees
     * from the AMM vault before distributing.
     *
     * @param mint - The mint address of the token
     * @returns The instructions to distribute creator fees and whether the token is graduated
     */
    buildDistributeCreatorFeesInstructions(mint: PublicKey): Promise<DistributeCreatorFeeResult>;
}
interface MinimumDistributableFeeResult extends MinimumDistributableFeeEvent {
    isGraduated: boolean;
}
interface DistributeCreatorFeeResult {
    instructions: TransactionInstruction[];
    isGraduated: boolean;
}

declare function totalUnclaimedTokens(globalVolumeAccumulator: GlobalVolumeAccumulator, userVolumeAccumulator: UserVolumeAccumulator, currentTimestamp?: number): BN;
declare function currentDayTokens(globalVolumeAccumulator: GlobalVolumeAccumulator, userVolumeAccumulator: UserVolumeAccumulator, currentTimestamp?: number): BN;

/**
 * Custom error types for the Pump SDK
 */
declare class NoShareholdersError extends Error {
    constructor();
}
declare class TooManyShareholdersError extends Error {
    count: number;
    max: number;
    constructor(count: number, max: number);
}
declare class ZeroShareError extends Error {
    address: string;
    constructor(address: string);
}
declare class ShareCalculationOverflowError extends Error {
    constructor();
}
declare class InvalidShareTotalError extends Error {
    total: number;
    constructor(total: number);
}
declare class DuplicateShareholderError extends Error {
    constructor();
}
declare class PoolRequiredForGraduatedError extends Error {
    constructor();
}

export { AMM_GLOBAL_PDA, AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA, BONDING_CURVE_NEW_SIZE, type BondingCurve, CANONICAL_POOL_INDEX, type DistributeCreatorFeeResult, type DistributeCreatorFeesEvent, DuplicateShareholderError, type FeeConfig, GLOBAL_PDA, GLOBAL_VOLUME_ACCUMULATOR_PDA, type Global, type GlobalVolumeAccumulator, InvalidShareTotalError, MAYHEM_PROGRAM_ID, type MinimumDistributableFeeEvent, type MinimumDistributableFeeResult, NoShareholdersError, OnlinePumpSdk, PUMP_AMM_EVENT_AUTHORITY_PDA, PUMP_AMM_PROGRAM_ID, PUMP_EVENT_AUTHORITY_PDA, PUMP_FEE_CONFIG_PDA, PUMP_FEE_EVENT_AUTHORITY_PDA, PUMP_FEE_PROGRAM_ID, PUMP_PROGRAM_ID, PUMP_SDK, PoolRequiredForGraduatedError, type Pump, type PumpFees, PumpSdk, ShareCalculationOverflowError, type Shareholder, type SharingConfig, TooManyShareholdersError, type UserVolumeAccumulator, type UserVolumeAccumulatorTotalStats, ZeroShareError, ammCreatorVaultPda, bondingCurveMarketCap, bondingCurvePda, canonicalPumpPoolPda, creatorVaultPda, currentDayTokens, feeSharingConfigPda, getBuySolAmountFromTokenAmount, getBuyTokenAmountFromSolAmount, getEventAuthorityPda, getGlobalParamsPda, getMayhemStatePda, getPumpAmmProgram, getPumpFeeProgram, getPumpProgram, getSellSolAmountFromTokenAmount, getSolVaultPda, getTokenVaultPda, isCreatorUsingSharingConfig, newBondingCurve, pump as pumpIdl, pumpPoolAuthorityPda, totalUnclaimedTokens, userVolumeAccumulatorPda };
