"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/fees.ts
function getFee({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount,
  isNewBondingCurve
}) {
  const { virtualSolReserves, virtualTokenReserves, isMayhemMode } = bondingCurve;
  const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
    global,
    feeConfig,
    mintSupply: isMayhemMode ? mintSupply : ONE_BILLION_SUPPLY,
    virtualSolReserves,
    virtualTokenReserves
  });
  return fee(amount, protocolFeeBps).add(
    isNewBondingCurve || !import_web3.PublicKey.default.equals(bondingCurve.creator) ? fee(amount, creatorFeeBps) : new import_bn.default(0)
  );
}
function computeFeesBps({
  global,
  feeConfig,
  mintSupply,
  virtualSolReserves,
  virtualTokenReserves
}) {
  if (feeConfig != null) {
    const marketCap = bondingCurveMarketCap({
      mintSupply,
      virtualSolReserves,
      virtualTokenReserves
    });
    return calculateFeeTier({
      feeTiers: feeConfig.feeTiers,
      marketCap
    });
  }
  return {
    protocolFeeBps: global.feeBasisPoints,
    creatorFeeBps: global.creatorFeeBasisPoints
  };
}
function calculateFeeTier({
  feeTiers,
  marketCap
}) {
  const firstTier = feeTiers[0];
  if (!firstTier) {
    throw new Error("feeTiers must not be empty");
  }
  if (marketCap.lt(firstTier.marketCapLamportsThreshold)) {
    return firstTier.fees;
  }
  for (const tier of feeTiers.slice().reverse()) {
    if (marketCap.gte(tier.marketCapLamportsThreshold)) {
      return tier.fees;
    }
  }
  return firstTier.fees;
}
function fee(amount, feeBasisPoints) {
  return ceilDiv(amount.mul(feeBasisPoints), new import_bn.default(1e4));
}
function ceilDiv(a, b) {
  return a.add(b.subn(1)).div(b);
}
function getFeeRecipient(global, mayhemMode) {
  if (mayhemMode) {
    const feeRecipients2 = [
      global.reservedFeeRecipient,
      ...global.reservedFeeRecipients
    ];
    return feeRecipients2[Math.floor(Math.random() * feeRecipients2.length)];
  }
  const feeRecipients = [global.feeRecipient, ...global.feeRecipients];
  return feeRecipients[Math.floor(Math.random() * feeRecipients.length)];
}
var import_web3, import_bn, ONE_BILLION_SUPPLY;
var init_fees = __esm({
  "src/fees.ts"() {
    "use strict";
    import_web3 = require("@solana/web3.js");
    import_bn = __toESM(require("bn.js"));
    init_bondingCurve();
    ONE_BILLION_SUPPLY = new import_bn.default(1e15);
  }
});

// src/bondingCurve.ts
var bondingCurve_exports = {};
__export(bondingCurve_exports, {
  bondingCurveMarketCap: () => bondingCurveMarketCap,
  getBuySolAmountFromTokenAmount: () => getBuySolAmountFromTokenAmount,
  getBuyTokenAmountFromSolAmount: () => getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount: () => getSellSolAmountFromTokenAmount,
  getStaticRandomFeeRecipient: () => getStaticRandomFeeRecipient,
  newBondingCurve: () => newBondingCurve
});
function newBondingCurve(global) {
  return {
    virtualTokenReserves: global.initialVirtualTokenReserves,
    virtualSolReserves: global.initialVirtualSolReserves,
    realTokenReserves: global.initialRealTokenReserves,
    realSolReserves: new import_bn2.default(0),
    tokenTotalSupply: global.tokenTotalSupply,
    complete: false,
    creator: import_web32.PublicKey.default,
    isMayhemMode: global.mayhemModeEnabled
  };
}
function getBuySolAmountFromTokenAmountQuote({
  minAmount,
  virtualTokenReserves,
  virtualSolReserves
}) {
  return minAmount.mul(virtualSolReserves).div(virtualTokenReserves.sub(minAmount)).add(new import_bn2.default(1));
}
function getBuyTokenAmountFromSolAmountQuote({
  inputAmount,
  virtualTokenReserves,
  virtualSolReserves
}) {
  return inputAmount.mul(virtualTokenReserves).div(virtualSolReserves.add(inputAmount));
}
function getSellSolAmountFromTokenAmountQuote({
  inputAmount,
  virtualTokenReserves,
  virtualSolReserves
}) {
  return inputAmount.mul(virtualSolReserves).div(virtualTokenReserves.add(inputAmount));
}
function getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount
}) {
  if (amount.eq(new import_bn2.default(0))) {
    return new import_bn2.default(0);
  }
  let isNewBondingCurve = false;
  if (bondingCurve === null || mintSupply === null) {
    bondingCurve = newBondingCurve(global);
    mintSupply = global.tokenTotalSupply;
    isNewBondingCurve = true;
  }
  if (bondingCurve.virtualTokenReserves.eq(new import_bn2.default(0))) {
    return new import_bn2.default(0);
  }
  const { virtualSolReserves, virtualTokenReserves } = bondingCurve;
  const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
    global,
    feeConfig,
    mintSupply,
    virtualSolReserves,
    virtualTokenReserves
  });
  const totalFeeBasisPoints = protocolFeeBps.add(
    isNewBondingCurve || !import_web32.PublicKey.default.equals(bondingCurve.creator) ? creatorFeeBps : new import_bn2.default(0)
  );
  const inputAmount = amount.subn(1).muln(1e4).div(totalFeeBasisPoints.addn(1e4));
  const tokensReceived = getBuyTokenAmountFromSolAmountQuote({
    inputAmount,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
    virtualSolReserves: bondingCurve.virtualSolReserves
  });
  return import_bn2.default.min(tokensReceived, bondingCurve.realTokenReserves);
}
function getBuySolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount
}) {
  if (amount.eq(new import_bn2.default(0))) {
    return new import_bn2.default(0);
  }
  let isNewBondingCurve = false;
  if (bondingCurve === null || mintSupply === null) {
    bondingCurve = newBondingCurve(global);
    mintSupply = global.tokenTotalSupply;
    isNewBondingCurve = true;
  }
  if (bondingCurve.virtualTokenReserves.eq(new import_bn2.default(0))) {
    return new import_bn2.default(0);
  }
  const minAmount = import_bn2.default.min(amount, bondingCurve.realTokenReserves);
  const solCost = getBuySolAmountFromTokenAmountQuote({
    minAmount,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
    virtualSolReserves: bondingCurve.virtualSolReserves
  });
  return solCost.add(
    getFee({
      global,
      feeConfig,
      mintSupply,
      bondingCurve,
      amount: solCost,
      isNewBondingCurve
    })
  );
}
function getSellSolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount
}) {
  if (amount.eq(new import_bn2.default(0))) {
    return new import_bn2.default(0);
  }
  if (bondingCurve.virtualTokenReserves.eq(new import_bn2.default(0))) {
    return new import_bn2.default(0);
  }
  const solCost = getSellSolAmountFromTokenAmountQuote({
    inputAmount: amount,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
    virtualSolReserves: bondingCurve.virtualSolReserves
  });
  return solCost.sub(
    getFee({
      global,
      feeConfig,
      mintSupply,
      bondingCurve,
      amount: solCost,
      isNewBondingCurve: false
    })
  );
}
function getStaticRandomFeeRecipient() {
  const randomIndex = Math.floor(Math.random() * CURRENT_FEE_RECIPIENTS.length);
  const recipient = CURRENT_FEE_RECIPIENTS[randomIndex];
  return new import_web32.PublicKey(recipient);
}
function bondingCurveMarketCap({
  mintSupply,
  virtualSolReserves,
  virtualTokenReserves
}) {
  if (virtualTokenReserves.isZero()) {
    throw new Error("Division by zero: virtual token reserves cannot be zero");
  }
  return virtualSolReserves.mul(mintSupply).div(virtualTokenReserves);
}
var import_web32, import_bn2, CURRENT_FEE_RECIPIENTS;
var init_bondingCurve = __esm({
  "src/bondingCurve.ts"() {
    "use strict";
    import_web32 = require("@solana/web3.js");
    import_bn2 = __toESM(require("bn.js"));
    init_fees();
    CURRENT_FEE_RECIPIENTS = [
      "62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV",
      "7VtfL8fvgNfhz17qKRMjzQEXgbdpnHHHQRh54R9jP2RJ",
      "7hTckgnGnLQR6sdH7YkqFTAA7VwTfYFaZ6EhEsU3saCX",
      "9rPYyANsfQZw3DnDmKE3YCQF5E8oD89UXoHn9JFEhJUz",
      "AVmoTthdrX6tKt4nDjco2D775W2YK3sDhxPcMmzUAmTY",
      "CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM",
      "FWsW1xNtWscwNmKv6wVsU1iTzRN6wmmk3MjxRP5tT7hz",
      "G5UZAVbAf46s7cKWoyKu8kYTip9DGTpbLZ2qa9Aq69dP"
    ];
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AMM_GLOBAL_PDA: () => AMM_GLOBAL_PDA,
  AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA: () => AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA,
  BONDING_CURVE_NEW_SIZE: () => BONDING_CURVE_NEW_SIZE,
  CANONICAL_POOL_INDEX: () => CANONICAL_POOL_INDEX,
  DuplicateShareholderError: () => DuplicateShareholderError,
  GLOBAL_PDA: () => GLOBAL_PDA,
  GLOBAL_VOLUME_ACCUMULATOR_PDA: () => GLOBAL_VOLUME_ACCUMULATOR_PDA,
  InvalidShareTotalError: () => InvalidShareTotalError,
  MAX_SHAREHOLDERS: () => MAX_SHAREHOLDERS,
  MAYHEM_PROGRAM_ID: () => MAYHEM_PROGRAM_ID,
  NoShareholdersError: () => NoShareholdersError,
  OnlinePumpSdk: () => OnlinePumpSdk,
  PUMP_AMM_EVENT_AUTHORITY_PDA: () => PUMP_AMM_EVENT_AUTHORITY_PDA,
  PUMP_AMM_PROGRAM_ID: () => PUMP_AMM_PROGRAM_ID,
  PUMP_EVENT_AUTHORITY_PDA: () => PUMP_EVENT_AUTHORITY_PDA,
  PUMP_FEE_CONFIG_PDA: () => PUMP_FEE_CONFIG_PDA,
  PUMP_FEE_EVENT_AUTHORITY_PDA: () => PUMP_FEE_EVENT_AUTHORITY_PDA,
  PUMP_FEE_PROGRAM_ID: () => PUMP_FEE_PROGRAM_ID,
  PUMP_PROGRAM_ID: () => PUMP_PROGRAM_ID,
  PUMP_SDK: () => PUMP_SDK,
  PUMP_TOKEN_MINT: () => PUMP_TOKEN_MINT,
  PoolRequiredForGraduatedError: () => PoolRequiredForGraduatedError,
  PumpSdk: () => PumpSdk,
  ShareCalculationOverflowError: () => ShareCalculationOverflowError,
  TooManyShareholdersError: () => TooManyShareholdersError,
  ZeroShareError: () => ZeroShareError,
  ammCreatorVaultPda: () => ammCreatorVaultPda,
  bondingCurveMarketCap: () => bondingCurveMarketCap,
  bondingCurvePda: () => bondingCurvePda,
  calculateBuyPriceImpact: () => calculateBuyPriceImpact,
  calculateFeeTier: () => calculateFeeTier,
  calculateSellPriceImpact: () => calculateSellPriceImpact,
  canonicalPumpPoolPda: () => canonicalPumpPoolPda,
  computeFeesBps: () => computeFeesBps,
  creatorVaultPda: () => creatorVaultPda,
  currentDayTokens: () => currentDayTokens,
  feeSharingConfigPda: () => feeSharingConfigPda,
  getBondingCurveSummary: () => getBondingCurveSummary,
  getBuySolAmountFromTokenAmount: () => getBuySolAmountFromTokenAmount,
  getBuyTokenAmountFromSolAmount: () => getBuyTokenAmountFromSolAmount,
  getEventAuthorityPda: () => getEventAuthorityPda,
  getFee: () => getFee,
  getGlobalParamsPda: () => getGlobalParamsPda,
  getGraduationProgress: () => getGraduationProgress,
  getMayhemStatePda: () => getMayhemStatePda,
  getPumpAmmProgram: () => getPumpAmmProgram,
  getPumpFeeProgram: () => getPumpFeeProgram,
  getPumpProgram: () => getPumpProgram,
  getSellSolAmountFromTokenAmount: () => getSellSolAmountFromTokenAmount,
  getSolVaultPda: () => getSolVaultPda,
  getTokenPrice: () => getTokenPrice,
  getTokenVaultPda: () => getTokenVaultPda,
  isCreatorUsingSharingConfig: () => isCreatorUsingSharingConfig,
  newBondingCurve: () => newBondingCurve,
  pumpIdl: () => pump_default,
  pumpPoolAuthorityPda: () => pumpPoolAuthorityPda,
  totalUnclaimedTokens: () => totalUnclaimedTokens,
  userVolumeAccumulatorPda: () => userVolumeAccumulatorPda
});
module.exports = __toCommonJS(index_exports);

// src/idl/pump.json
var pump_default = {
  address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  metadata: {
    name: "pump",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Created with Anchor"
  },
  instructions: [
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
            seeds: []
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
        "SOL \u2192 tokens quote",
        "To calculate tokens_out for a given spendable_sol_in:",
        "1. net_sol = floor(spendable_sol_in * 10_000 / (10_000 + total_fee_bps))",
        "2. fees = ceil(net_sol * protocol_fee_bps / 10_000) + ceil(net_sol * creator_fee_bps / 10_000) (creator_fee_bps is 0 if no creator)",
        "3. if net_sol + fees > spendable_sol_in: net_sol = net_sol - (net_sol + fees - spendable_sol_in)",
        "4. tokens_out = floor((net_sol - 1) * virtual_token_reserves / (virtual_sol_reserves + net_sol - 1))",
        "",
        "Reverse quote (tokens \u2192 SOL)",
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
      args: []
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
      args: []
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
      args: []
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
      args: []
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
      args: [],
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
      args: []
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
      args: [],
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
      args: []
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
      args: []
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
      args: []
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
      args: []
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
      args: []
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
      args: []
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
      args: []
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
      args: []
    }
  ],
  accounts: [
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
  ],
  events: [
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
  ],
  errors: [
    {
      code: 6e3,
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
  ],
  types: [
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
        'ix_name: "buy" | "sell" | "buy_exact_sol_in"'
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
  ]
};

// src/index.ts
init_bondingCurve();

// src/pda.ts
var import_pump_swap_sdk3 = require("@pump-fun/pump-swap-sdk");
var import_spl_token3 = require("@solana/spl-token");
var import_web35 = require("@solana/web3.js");
var import_buffer = require("buffer");

// src/sdk.ts
var import_anchor = require("@coral-xyz/anchor");
var import_pump_swap_sdk2 = require("@pump-fun/pump-swap-sdk");
var import_spl_token2 = require("@solana/spl-token");
var import_web34 = require("@solana/web3.js");
var import_bn6 = __toESM(require("bn.js"));
init_bondingCurve();

// src/errors.ts
var NoShareholdersError = class extends Error {
  constructor() {
    super("No shareholders provided");
    this.name = "NoShareholdersError";
  }
};
var TooManyShareholdersError = class extends Error {
  constructor(count, max) {
    super(`Too many shareholders. Maximum allowed is ${max}, got ${count}`);
    this.count = count;
    this.max = max;
    this.name = "TooManyShareholdersError";
  }
};
var ZeroShareError = class extends Error {
  constructor(address) {
    super(`Zero or negative share not allowed for address ${address}`);
    this.address = address;
    this.name = "ZeroShareError";
  }
};
var ShareCalculationOverflowError = class extends Error {
  constructor() {
    super("Share calculation overflow - total shares exceed maximum value");
    this.name = "ShareCalculationOverflowError";
  }
};
var InvalidShareTotalError = class extends Error {
  constructor(total) {
    super(
      `Invalid share total. Must equal 10,000 basis points (100%). Got ${total}`
    );
    this.total = total;
    this.name = "InvalidShareTotalError";
  }
};
var DuplicateShareholderError = class extends Error {
  constructor() {
    super("Duplicate shareholder addresses not allowed");
    this.name = "DuplicateShareholderError";
  }
};
var PoolRequiredForGraduatedError = class extends Error {
  constructor() {
    super(
      "Pool parameter is required for graduated coins (bondingCurve.complete = true)"
    );
    this.name = "PoolRequiredForGraduatedError";
  }
};

// src/sdk.ts
init_fees();

// src/idl/pump_amm.json
var pump_amm_default = {
  address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
  metadata: {
    name: "pump_amm",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Created with Anchor"
  },
  instructions: [
    {
      name: "admin_set_coin_creator",
      docs: [
        "Overrides the coin creator for a canonical pump pool"
      ],
      discriminator: [
        242,
        40,
        117,
        145,
        73,
        96,
        105,
        104
      ],
      accounts: [
        {
          name: "admin_set_coin_creator_authority",
          signer: true,
          relations: [
            "global_config"
          ]
        },
        {
          name: "global_config"
        },
        {
          name: "pool",
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
          name: "coin_creator",
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
          name: "admin",
          writable: true,
          signer: true,
          relations: [
            "global_config"
          ]
        },
        {
          name: "global_config",
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
          name: "token_supply_per_day",
          type: "u64"
        }
      ]
    },
    {
      name: "buy",
      docs: [
        "For cashback coins, optionally pass user_volume_accumulator_wsol_ata as remaining_accounts[0].",
        "If provided and valid, the ATA will be initialized if needed."
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
          name: "pool",
          writable: true
        },
        {
          name: "user",
          writable: true,
          signer: true
        },
        {
          name: "global_config"
        },
        {
          name: "base_mint",
          relations: [
            "pool"
          ]
        },
        {
          name: "quote_mint",
          relations: [
            "pool"
          ]
        },
        {
          name: "user_base_token_account",
          writable: true
        },
        {
          name: "user_quote_token_account",
          writable: true
        },
        {
          name: "pool_base_token_account",
          writable: true,
          relations: [
            "pool"
          ]
        },
        {
          name: "pool_quote_token_account",
          writable: true,
          relations: [
            "pool"
          ]
        },
        {
          name: "protocol_fee_recipient"
        },
        {
          name: "protocol_fee_recipient_token_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "account",
                path: "protocol_fee_recipient"
              },
              {
                kind: "account",
                path: "quote_token_program"
              },
              {
                kind: "account",
                path: "quote_mint"
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
          name: "base_token_program"
        },
        {
          name: "quote_token_program"
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
          address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"
        },
        {
          name: "coin_creator_vault_ata",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "account",
                path: "coin_creator_vault_authority"
              },
              {
                kind: "account",
                path: "quote_token_program"
              },
              {
                kind: "account",
                path: "quote_mint"
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
          name: "coin_creator_vault_authority",
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
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                kind: "account",
                path: "pool.coin_creator",
                account: "Pool"
              }
            ]
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
          name: "base_amount_out",
          type: "u64"
        },
        {
          name: "max_quote_amount_in",
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
      name: "buy_exact_quote_in",
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
      ],
      discriminator: [
        198,
        46,
        21,
        82,
        180,
        217,
        232,
        112
      ],
      accounts: [
        {
          name: "pool",
          writable: true
        },
        {
          name: "user",
          writable: true,
          signer: true
        },
        {
          name: "global_config"
        },
        {
          name: "base_mint",
          relations: [
            "pool"
          ]
        },
        {
          name: "quote_mint",
          relations: [
            "pool"
          ]
        },
        {
          name: "user_base_token_account",
          writable: true
        },
        {
          name: "user_quote_token_account",
          writable: true
        },
        {
          name: "pool_base_token_account",
          writable: true,
          relations: [
            "pool"
          ]
        },
        {
          name: "pool_quote_token_account",
          writable: true,
          relations: [
            "pool"
          ]
        },
        {
          name: "protocol_fee_recipient"
        },
        {
          name: "protocol_fee_recipient_token_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "account",
                path: "protocol_fee_recipient"
              },
              {
                kind: "account",
                path: "quote_token_program"
              },
              {
                kind: "account",
                path: "quote_mint"
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
          name: "base_token_program"
        },
        {
          name: "quote_token_program"
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
          address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"
        },
        {
          name: "coin_creator_vault_ata",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "account",
                path: "coin_creator_vault_authority"
              },
              {
                kind: "account",
                path: "quote_token_program"
              },
              {
                kind: "account",
                path: "quote_mint"
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
          name: "coin_creator_vault_authority",
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
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                kind: "account",
                path: "pool.coin_creator",
                account: "Pool"
              }
            ]
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
          name: "spendable_quote_in",
          type: "u64"
        },
        {
          name: "min_base_amount_out",
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
          name: "quote_mint"
        },
        {
          name: "quote_token_program"
        },
        {
          name: "user_volume_accumulator_wsol_token_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "account",
                path: "user_volume_accumulator"
              },
              {
                kind: "account",
                path: "quote_token_program"
              },
              {
                kind: "account",
                path: "quote_mint"
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
          name: "user_wsol_token_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "account",
                path: "user"
              },
              {
                kind: "account",
                path: "quote_token_program"
              },
              {
                kind: "account",
                path: "quote_mint"
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
          address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"
        }
      ],
      args: []
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
          address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"
        },
        {
          name: "payer",
          writable: true,
          signer: true
        }
      ],
      args: []
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
      args: []
    },
    {
      name: "collect_coin_creator_fee",
      discriminator: [
        160,
        57,
        89,
        42,
        181,
        139,
        43,
        66
      ],
      accounts: [
        {
          name: "quote_mint"
        },
        {
          name: "quote_token_program"
        },
        {
          name: "coin_creator"
        },
        {
          name: "coin_creator_vault_authority",
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
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                kind: "account",
                path: "coin_creator"
              }
            ]
          }
        },
        {
          name: "coin_creator_vault_ata",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "account",
                path: "coin_creator_vault_authority"
              },
              {
                kind: "account",
                path: "quote_token_program"
              },
              {
                kind: "account",
                path: "quote_mint"
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
          name: "coin_creator_token_account",
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
      args: []
    },
    {
      name: "create_config",
      discriminator: [
        201,
        207,
        243,
        114,
        75,
        111,
        47,
        189
      ],
      accounts: [
        {
          name: "admin",
          writable: true,
          signer: true,
          address: "8LWu7QM2dGR1G8nKDHthckea57bkCzXyBTAKPJUBDHo8"
        },
        {
          name: "global_config",
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
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
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
        {
          name: "lp_fee_basis_points",
          type: "u64"
        },
        {
          name: "protocol_fee_basis_points",
          type: "u64"
        },
        {
          name: "protocol_fee_recipients",
          type: {
            array: [
              "pubkey",
              8
            ]
          }
        },
        {
          name: "coin_creator_fee_basis_points",
          type: "u64"
        },
        {
          name: "admin_set_coin_creator_authority",
          type: "pubkey"
        }
      ]
    },
    {
      name: "create_pool",
      discriminator: [
        233,
        146,
        209,
        142,
        207,
        104,
        64,
        188
      ],
      accounts: [
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
                kind: "arg",
                path: "index"
              },
              {
                kind: "account",
                path: "creator"
              },
              {
                kind: "account",
                path: "base_mint"
              },
              {
                kind: "account",
                path: "quote_mint"
              }
            ]
          }
        },
        {
          name: "global_config"
        },
        {
          name: "creator",
          writable: true,
          signer: true
        },
        {
          name: "base_mint"
        },
        {
          name: "quote_mint"
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
            ]
          }
        },
        {
          name: "user_base_token_account",
          writable: true
        },
        {
          name: "user_quote_token_account",
          writable: true
        },
        {
          name: "user_pool_token_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "account",
                path: "creator"
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
                path: "base_token_program"
              },
              {
                kind: "account",
                path: "base_mint"
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
                path: "quote_token_program"
              },
              {
                kind: "account",
                path: "quote_mint"
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
          name: "system_program",
          address: "11111111111111111111111111111111"
        },
        {
          name: "token_2022_program",
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          name: "base_token_program"
        },
        {
          name: "quote_token_program"
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
          name: "program"
        }
      ],
      args: [
        {
          name: "index",
          type: "u16"
        },
        {
          name: "base_amount_in",
          type: "u64"
        },
        {
          name: "quote_amount_in",
          type: "u64"
        },
        {
          name: "coin_creator",
          type: "pubkey"
        },
        {
          name: "is_mayhem_mode",
          type: "bool"
        },
        {
          name: "is_cashback_coin",
          type: {
            defined: {
              name: "OptionBool"
            }
          }
        }
      ]
    },
    {
      name: "deposit",
      discriminator: [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      accounts: [
        {
          name: "pool",
          writable: true
        },
        {
          name: "global_config"
        },
        {
          name: "user",
          signer: true
        },
        {
          name: "base_mint",
          relations: [
            "pool"
          ]
        },
        {
          name: "quote_mint",
          relations: [
            "pool"
          ]
        },
        {
          name: "lp_mint",
          writable: true,
          relations: [
            "pool"
          ]
        },
        {
          name: "user_base_token_account",
          writable: true
        },
        {
          name: "user_quote_token_account",
          writable: true
        },
        {
          name: "user_pool_token_account",
          writable: true
        },
        {
          name: "pool_base_token_account",
          writable: true,
          relations: [
            "pool"
          ]
        },
        {
          name: "pool_quote_token_account",
          writable: true,
          relations: [
            "pool"
          ]
        },
        {
          name: "token_program",
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          name: "token_2022_program",
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
        {
          name: "lp_token_amount_out",
          type: "u64"
        },
        {
          name: "max_base_amount_in",
          type: "u64"
        },
        {
          name: "max_quote_amount_in",
          type: "u64"
        }
      ]
    },
    {
      name: "disable",
      discriminator: [
        185,
        173,
        187,
        90,
        216,
        15,
        238,
        233
      ],
      accounts: [
        {
          name: "admin",
          signer: true,
          relations: [
            "global_config"
          ]
        },
        {
          name: "global_config",
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
          name: "disable_create_pool",
          type: "bool"
        },
        {
          name: "disable_deposit",
          type: "bool"
        },
        {
          name: "disable_withdraw",
          type: "bool"
        },
        {
          name: "disable_buy",
          type: "bool"
        },
        {
          name: "disable_sell",
          type: "bool"
        }
      ]
    },
    {
      name: "extend_account",
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
      args: []
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
      args: []
    },
    {
      name: "migrate_pool_coin_creator",
      docs: [
        "Migrate Pool Coin Creator to Sharing Config"
      ],
      discriminator: [
        208,
        8,
        159,
        4,
        74,
        175,
        16,
        58
      ],
      accounts: [
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
                kind: "account",
                path: "pool.index",
                account: "Pool"
              },
              {
                kind: "account",
                path: "pool.creator",
                account: "Pool"
              },
              {
                kind: "account",
                path: "pool.base_mint",
                account: "Pool"
              },
              {
                kind: "account",
                path: "pool.quote_mint",
                account: "Pool"
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
                path: "pool.base_mint",
                account: "Pool"
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
      args: []
    },
    {
      name: "sell",
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
          name: "pool",
          writable: true
        },
        {
          name: "user",
          writable: true,
          signer: true
        },
        {
          name: "global_config"
        },
        {
          name: "base_mint",
          relations: [
            "pool"
          ]
        },
        {
          name: "quote_mint",
          relations: [
            "pool"
          ]
        },
        {
          name: "user_base_token_account",
          writable: true
        },
        {
          name: "user_quote_token_account",
          writable: true
        },
        {
          name: "pool_base_token_account",
          writable: true,
          relations: [
            "pool"
          ]
        },
        {
          name: "pool_quote_token_account",
          writable: true,
          relations: [
            "pool"
          ]
        },
        {
          name: "protocol_fee_recipient"
        },
        {
          name: "protocol_fee_recipient_token_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "account",
                path: "protocol_fee_recipient"
              },
              {
                kind: "account",
                path: "quote_token_program"
              },
              {
                kind: "account",
                path: "quote_mint"
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
          name: "base_token_program"
        },
        {
          name: "quote_token_program"
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
          address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"
        },
        {
          name: "coin_creator_vault_ata",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "account",
                path: "coin_creator_vault_authority"
              },
              {
                kind: "account",
                path: "quote_token_program"
              },
              {
                kind: "account",
                path: "quote_mint"
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
          name: "coin_creator_vault_authority",
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
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                kind: "account",
                path: "pool.coin_creator",
                account: "Pool"
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
          name: "base_amount_in",
          type: "u64"
        },
        {
          name: "min_quote_amount_out",
          type: "u64"
        }
      ]
    },
    {
      name: "set_coin_creator",
      docs: [
        "Sets Pool::coin_creator from Metaplex metadata creator or BondingCurve::creator"
      ],
      discriminator: [
        210,
        149,
        128,
        45,
        188,
        58,
        78,
        175
      ],
      accounts: [
        {
          name: "pool",
          writable: true
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
                path: "pool.base_mint",
                account: "Pool"
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
                path: "pool.base_mint",
                account: "Pool"
              }
            ],
            program: {
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
      args: []
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
          name: "global_config",
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
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "admin",
          signer: true,
          relations: [
            "global_config"
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
      args: []
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
          name: "admin",
          signer: true,
          relations: [
            "global_config"
          ]
        },
        {
          name: "global_config",
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
          name: "admin",
          signer: true,
          relations: [
            "global_config"
          ]
        },
        {
          name: "global_config",
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
          name: "enabled",
          type: "bool"
        }
      ]
    },
    {
      name: "transfer_creator_fees_to_pump",
      docs: [
        "Transfer creator fees to pump creator vault",
        "If coin creator fees are currently below rent.minimum_balance(TokenAccount::LEN)",
        "The transfer will be skipped"
      ],
      discriminator: [
        139,
        52,
        134,
        85,
        228,
        229,
        108,
        241
      ],
      accounts: [
        {
          name: "wsol_mint",
          docs: [
            "Pump Canonical Pool are quoted in wSOL"
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
          name: "coin_creator"
        },
        {
          name: "coin_creator_vault_authority",
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
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                kind: "account",
                path: "coin_creator"
              }
            ]
          }
        },
        {
          name: "coin_creator_vault_ata",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "account",
                path: "coin_creator_vault_authority"
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
          name: "pump_creator_vault",
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
                path: "coin_creator"
              }
            ],
            program: {
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
      args: []
    },
    {
      name: "update_admin",
      discriminator: [
        161,
        176,
        40,
        213,
        60,
        184,
        179,
        228
      ],
      accounts: [
        {
          name: "admin",
          signer: true,
          relations: [
            "global_config"
          ]
        },
        {
          name: "global_config",
          writable: true
        },
        {
          name: "new_admin"
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
      args: []
    },
    {
      name: "update_fee_config",
      discriminator: [
        104,
        184,
        103,
        242,
        88,
        151,
        107,
        20
      ],
      accounts: [
        {
          name: "admin",
          signer: true,
          relations: [
            "global_config"
          ]
        },
        {
          name: "global_config",
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
          name: "lp_fee_basis_points",
          type: "u64"
        },
        {
          name: "protocol_fee_basis_points",
          type: "u64"
        },
        {
          name: "protocol_fee_recipients",
          type: {
            array: [
              "pubkey",
              8
            ]
          }
        },
        {
          name: "coin_creator_fee_basis_points",
          type: "u64"
        },
        {
          name: "admin_set_coin_creator_authority",
          type: "pubkey"
        }
      ]
    },
    {
      name: "withdraw",
      discriminator: [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      accounts: [
        {
          name: "pool",
          writable: true
        },
        {
          name: "global_config"
        },
        {
          name: "user",
          signer: true
        },
        {
          name: "base_mint",
          relations: [
            "pool"
          ]
        },
        {
          name: "quote_mint",
          relations: [
            "pool"
          ]
        },
        {
          name: "lp_mint",
          writable: true,
          relations: [
            "pool"
          ]
        },
        {
          name: "user_base_token_account",
          writable: true
        },
        {
          name: "user_quote_token_account",
          writable: true
        },
        {
          name: "user_pool_token_account",
          writable: true
        },
        {
          name: "pool_base_token_account",
          writable: true,
          relations: [
            "pool"
          ]
        },
        {
          name: "pool_quote_token_account",
          writable: true,
          relations: [
            "pool"
          ]
        },
        {
          name: "token_program",
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          name: "token_2022_program",
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
        {
          name: "lp_token_amount_in",
          type: "u64"
        },
        {
          name: "min_base_amount_out",
          type: "u64"
        },
        {
          name: "min_quote_amount_out",
          type: "u64"
        }
      ]
    }
  ],
  accounts: [
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
      name: "GlobalConfig",
      discriminator: [
        149,
        8,
        156,
        202,
        160,
        252,
        176,
        217
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
      name: "Pool",
      discriminator: [
        241,
        154,
        109,
        4,
        17,
        177,
        109,
        188
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
  ],
  events: [
    {
      name: "AdminSetCoinCreatorEvent",
      discriminator: [
        45,
        220,
        93,
        24,
        25,
        97,
        172,
        104
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
      name: "BuyEvent",
      discriminator: [
        103,
        244,
        82,
        31,
        44,
        245,
        119,
        119
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
      name: "CollectCoinCreatorFeeEvent",
      discriminator: [
        232,
        245,
        194,
        238,
        234,
        218,
        58,
        89
      ]
    },
    {
      name: "CreateConfigEvent",
      discriminator: [
        107,
        52,
        89,
        129,
        55,
        226,
        81,
        22
      ]
    },
    {
      name: "CreatePoolEvent",
      discriminator: [
        177,
        49,
        12,
        210,
        160,
        118,
        167,
        116
      ]
    },
    {
      name: "DepositEvent",
      discriminator: [
        120,
        248,
        61,
        83,
        31,
        142,
        107,
        144
      ]
    },
    {
      name: "DisableEvent",
      discriminator: [
        107,
        253,
        193,
        76,
        228,
        202,
        27,
        104
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
      name: "MigratePoolCoinCreatorEvent",
      discriminator: [
        170,
        221,
        82,
        199,
        147,
        165,
        247,
        46
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
      name: "SellEvent",
      discriminator: [
        62,
        47,
        55,
        10,
        165,
        3,
        220,
        42
      ]
    },
    {
      name: "SetBondingCurveCoinCreatorEvent",
      discriminator: [
        242,
        231,
        235,
        102,
        65,
        99,
        189,
        211
      ]
    },
    {
      name: "SetMetaplexCoinCreatorEvent",
      discriminator: [
        150,
        107,
        199,
        123,
        124,
        207,
        102,
        228
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
      name: "UpdateAdminEvent",
      discriminator: [
        225,
        152,
        171,
        87,
        246,
        63,
        66,
        234
      ]
    },
    {
      name: "UpdateFeeConfigEvent",
      discriminator: [
        90,
        23,
        65,
        35,
        62,
        244,
        188,
        208
      ]
    },
    {
      name: "WithdrawEvent",
      discriminator: [
        22,
        9,
        133,
        26,
        160,
        44,
        71,
        192
      ]
    }
  ],
  errors: [
    {
      code: 6e3,
      name: "FeeBasisPointsExceedsMaximum"
    },
    {
      code: 6001,
      name: "ZeroBaseAmount"
    },
    {
      code: 6002,
      name: "ZeroQuoteAmount"
    },
    {
      code: 6003,
      name: "TooLittlePoolTokenLiquidity"
    },
    {
      code: 6004,
      name: "ExceededSlippage"
    },
    {
      code: 6005,
      name: "InvalidAdmin"
    },
    {
      code: 6006,
      name: "UnsupportedBaseMint"
    },
    {
      code: 6007,
      name: "UnsupportedQuoteMint"
    },
    {
      code: 6008,
      name: "InvalidBaseMint"
    },
    {
      code: 6009,
      name: "InvalidQuoteMint"
    },
    {
      code: 6010,
      name: "InvalidLpMint"
    },
    {
      code: 6011,
      name: "AllProtocolFeeRecipientsShouldBeNonZero"
    },
    {
      code: 6012,
      name: "UnsortedNotUniqueProtocolFeeRecipients"
    },
    {
      code: 6013,
      name: "InvalidProtocolFeeRecipient"
    },
    {
      code: 6014,
      name: "InvalidPoolBaseTokenAccount"
    },
    {
      code: 6015,
      name: "InvalidPoolQuoteTokenAccount"
    },
    {
      code: 6016,
      name: "BuyMoreBaseAmountThanPoolReserves"
    },
    {
      code: 6017,
      name: "DisabledCreatePool"
    },
    {
      code: 6018,
      name: "DisabledDeposit"
    },
    {
      code: 6019,
      name: "DisabledWithdraw"
    },
    {
      code: 6020,
      name: "DisabledBuy"
    },
    {
      code: 6021,
      name: "DisabledSell"
    },
    {
      code: 6022,
      name: "SameMint"
    },
    {
      code: 6023,
      name: "Overflow"
    },
    {
      code: 6024,
      name: "Truncation"
    },
    {
      code: 6025,
      name: "DivisionByZero"
    },
    {
      code: 6026,
      name: "NewSizeLessThanCurrentSize"
    },
    {
      code: 6027,
      name: "AccountTypeNotSupported"
    },
    {
      code: 6028,
      name: "OnlyCanonicalPumpPoolsCanHaveCoinCreator"
    },
    {
      code: 6029,
      name: "InvalidAdminSetCoinCreatorAuthority"
    },
    {
      code: 6030,
      name: "StartTimeInThePast"
    },
    {
      code: 6031,
      name: "EndTimeInThePast"
    },
    {
      code: 6032,
      name: "EndTimeBeforeStartTime"
    },
    {
      code: 6033,
      name: "TimeRangeTooLarge"
    },
    {
      code: 6034,
      name: "EndTimeBeforeCurrentDay"
    },
    {
      code: 6035,
      name: "SupplyUpdateForFinishedRange"
    },
    {
      code: 6036,
      name: "DayIndexAfterEndIndex"
    },
    {
      code: 6037,
      name: "DayInActiveRange"
    },
    {
      code: 6038,
      name: "InvalidIncentiveMint"
    },
    {
      code: 6039,
      name: "BuyNotEnoughQuoteTokensToCoverFees",
      msg: "buy: Not enough quote tokens to cover for fees."
    },
    {
      code: 6040,
      name: "BuySlippageBelowMinBaseAmountOut",
      msg: "buy: slippage - would buy less tokens than expected min_base_amount_out"
    },
    {
      code: 6041,
      name: "MayhemModeDisabled"
    },
    {
      code: 6042,
      name: "OnlyPumpPoolsMayhemMode"
    },
    {
      code: 6043,
      name: "MayhemModeInDesiredState"
    },
    {
      code: 6044,
      name: "NotEnoughRemainingAccounts"
    },
    {
      code: 6045,
      name: "InvalidSharingConfigBaseMint"
    },
    {
      code: 6046,
      name: "InvalidSharingConfigCoinCreator"
    },
    {
      code: 6047,
      name: "CoinCreatorMigratedToSharingConfig",
      msg: "coin creator has been migrated to sharing config, use pump_fees::reset_fee_sharing_config instead"
    },
    {
      code: 6048,
      name: "CreatorVaultMigratedToSharingConfig",
      msg: "creator_vault has been migrated to sharing config, use pump:distribute_creator_fees instead"
    },
    {
      code: 6049,
      name: "CashbackNotEnabled",
      msg: "Cashback is disabled"
    },
    {
      code: 6050,
      name: "OnlyPumpPoolsCashback"
    },
    {
      code: 6051,
      name: "CashbackNotInDesiredState"
    },
    {
      code: 6052,
      name: "CashbackEarnedDoesNotMatchTokenInVault"
    }
  ],
  types: [
    {
      name: "AdminSetCoinCreatorEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "admin_set_coin_creator_authority",
            type: "pubkey"
          },
          {
            name: "base_mint",
            type: "pubkey"
          },
          {
            name: "pool",
            type: "pubkey"
          },
          {
            name: "old_coin_creator",
            type: "pubkey"
          },
          {
            name: "new_coin_creator",
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
      name: "BuyEvent",
      docs: [
        'ix_name: "buy" | "buy_exact_quote_in"'
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "base_amount_out",
            type: "u64"
          },
          {
            name: "max_quote_amount_in",
            type: "u64"
          },
          {
            name: "user_base_token_reserves",
            type: "u64"
          },
          {
            name: "user_quote_token_reserves",
            type: "u64"
          },
          {
            name: "pool_base_token_reserves",
            type: "u64"
          },
          {
            name: "pool_quote_token_reserves",
            type: "u64"
          },
          {
            name: "quote_amount_in",
            type: "u64"
          },
          {
            name: "lp_fee_basis_points",
            type: "u64"
          },
          {
            name: "lp_fee",
            type: "u64"
          },
          {
            name: "protocol_fee_basis_points",
            type: "u64"
          },
          {
            name: "protocol_fee",
            type: "u64"
          },
          {
            name: "quote_amount_in_with_lp_fee",
            type: "u64"
          },
          {
            name: "user_quote_amount_in",
            type: "u64"
          },
          {
            name: "pool",
            type: "pubkey"
          },
          {
            name: "user",
            type: "pubkey"
          },
          {
            name: "user_base_token_account",
            type: "pubkey"
          },
          {
            name: "user_quote_token_account",
            type: "pubkey"
          },
          {
            name: "protocol_fee_recipient",
            type: "pubkey"
          },
          {
            name: "protocol_fee_recipient_token_account",
            type: "pubkey"
          },
          {
            name: "coin_creator",
            type: "pubkey"
          },
          {
            name: "coin_creator_fee_basis_points",
            type: "u64"
          },
          {
            name: "coin_creator_fee",
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
            name: "min_base_amount_out",
            type: "u64"
          },
          {
            name: "ix_name",
            type: "string"
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
      name: "CollectCoinCreatorFeeEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "coin_creator",
            type: "pubkey"
          },
          {
            name: "coin_creator_fee",
            type: "u64"
          },
          {
            name: "coin_creator_vault_ata",
            type: "pubkey"
          },
          {
            name: "coin_creator_token_account",
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
      name: "CreateConfigEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "admin",
            type: "pubkey"
          },
          {
            name: "lp_fee_basis_points",
            type: "u64"
          },
          {
            name: "protocol_fee_basis_points",
            type: "u64"
          },
          {
            name: "protocol_fee_recipients",
            type: {
              array: [
                "pubkey",
                8
              ]
            }
          },
          {
            name: "coin_creator_fee_basis_points",
            type: "u64"
          },
          {
            name: "admin_set_coin_creator_authority",
            type: "pubkey"
          }
        ]
      }
    },
    {
      name: "CreatePoolEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "index",
            type: "u16"
          },
          {
            name: "creator",
            type: "pubkey"
          },
          {
            name: "base_mint",
            type: "pubkey"
          },
          {
            name: "quote_mint",
            type: "pubkey"
          },
          {
            name: "base_mint_decimals",
            type: "u8"
          },
          {
            name: "quote_mint_decimals",
            type: "u8"
          },
          {
            name: "base_amount_in",
            type: "u64"
          },
          {
            name: "quote_amount_in",
            type: "u64"
          },
          {
            name: "pool_base_amount",
            type: "u64"
          },
          {
            name: "pool_quote_amount",
            type: "u64"
          },
          {
            name: "minimum_liquidity",
            type: "u64"
          },
          {
            name: "initial_liquidity",
            type: "u64"
          },
          {
            name: "lp_token_amount_out",
            type: "u64"
          },
          {
            name: "pool_bump",
            type: "u8"
          },
          {
            name: "pool",
            type: "pubkey"
          },
          {
            name: "lp_mint",
            type: "pubkey"
          },
          {
            name: "user_base_token_account",
            type: "pubkey"
          },
          {
            name: "user_quote_token_account",
            type: "pubkey"
          },
          {
            name: "coin_creator",
            type: "pubkey"
          },
          {
            name: "is_mayhem_mode",
            type: "bool"
          }
        ]
      }
    },
    {
      name: "DepositEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "lp_token_amount_out",
            type: "u64"
          },
          {
            name: "max_base_amount_in",
            type: "u64"
          },
          {
            name: "max_quote_amount_in",
            type: "u64"
          },
          {
            name: "user_base_token_reserves",
            type: "u64"
          },
          {
            name: "user_quote_token_reserves",
            type: "u64"
          },
          {
            name: "pool_base_token_reserves",
            type: "u64"
          },
          {
            name: "pool_quote_token_reserves",
            type: "u64"
          },
          {
            name: "base_amount_in",
            type: "u64"
          },
          {
            name: "quote_amount_in",
            type: "u64"
          },
          {
            name: "lp_mint_supply",
            type: "u64"
          },
          {
            name: "pool",
            type: "pubkey"
          },
          {
            name: "user",
            type: "pubkey"
          },
          {
            name: "user_base_token_account",
            type: "pubkey"
          },
          {
            name: "user_quote_token_account",
            type: "pubkey"
          },
          {
            name: "user_pool_token_account",
            type: "pubkey"
          }
        ]
      }
    },
    {
      name: "DisableEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "admin",
            type: "pubkey"
          },
          {
            name: "disable_create_pool",
            type: "bool"
          },
          {
            name: "disable_deposit",
            type: "bool"
          },
          {
            name: "disable_withdraw",
            type: "bool"
          },
          {
            name: "disable_buy",
            type: "bool"
          },
          {
            name: "disable_sell",
            type: "bool"
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
            name: "timestamp",
            type: "i64"
          },
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
      name: "GlobalConfig",
      type: {
        kind: "struct",
        fields: [
          {
            name: "admin",
            docs: [
              "The admin pubkey"
            ],
            type: "pubkey"
          },
          {
            name: "lp_fee_basis_points",
            type: "u64"
          },
          {
            name: "protocol_fee_basis_points",
            type: "u64"
          },
          {
            name: "disable_flags",
            docs: [
              "Flags to disable certain functionality",
              "bit 0 - Disable create pool",
              "bit 1 - Disable deposit",
              "bit 2 - Disable withdraw",
              "bit 3 - Disable buy",
              "bit 4 - Disable sell"
            ],
            type: "u8"
          },
          {
            name: "protocol_fee_recipients",
            docs: [
              "Addresses of the protocol fee recipients"
            ],
            type: {
              array: [
                "pubkey",
                8
              ]
            }
          },
          {
            name: "coin_creator_fee_basis_points",
            type: "u64"
          },
          {
            name: "admin_set_coin_creator_authority",
            docs: [
              "The admin authority for setting coin creators"
            ],
            type: "pubkey"
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
      name: "MigratePoolCoinCreatorEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "base_mint",
            type: "pubkey"
          },
          {
            name: "pool",
            type: "pubkey"
          },
          {
            name: "sharing_config",
            type: "pubkey"
          },
          {
            name: "old_coin_creator",
            type: "pubkey"
          },
          {
            name: "new_coin_creator",
            type: "pubkey"
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
      name: "Pool",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pool_bump",
            type: "u8"
          },
          {
            name: "index",
            type: "u16"
          },
          {
            name: "creator",
            type: "pubkey"
          },
          {
            name: "base_mint",
            type: "pubkey"
          },
          {
            name: "quote_mint",
            type: "pubkey"
          },
          {
            name: "lp_mint",
            type: "pubkey"
          },
          {
            name: "pool_base_token_account",
            type: "pubkey"
          },
          {
            name: "pool_quote_token_account",
            type: "pubkey"
          },
          {
            name: "lp_supply",
            docs: [
              "True circulating supply without burns and lock-ups"
            ],
            type: "u64"
          },
          {
            name: "coin_creator",
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
      name: "SellEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "base_amount_in",
            type: "u64"
          },
          {
            name: "min_quote_amount_out",
            type: "u64"
          },
          {
            name: "user_base_token_reserves",
            type: "u64"
          },
          {
            name: "user_quote_token_reserves",
            type: "u64"
          },
          {
            name: "pool_base_token_reserves",
            type: "u64"
          },
          {
            name: "pool_quote_token_reserves",
            type: "u64"
          },
          {
            name: "quote_amount_out",
            type: "u64"
          },
          {
            name: "lp_fee_basis_points",
            type: "u64"
          },
          {
            name: "lp_fee",
            type: "u64"
          },
          {
            name: "protocol_fee_basis_points",
            type: "u64"
          },
          {
            name: "protocol_fee",
            type: "u64"
          },
          {
            name: "quote_amount_out_without_lp_fee",
            type: "u64"
          },
          {
            name: "user_quote_amount_out",
            type: "u64"
          },
          {
            name: "pool",
            type: "pubkey"
          },
          {
            name: "user",
            type: "pubkey"
          },
          {
            name: "user_base_token_account",
            type: "pubkey"
          },
          {
            name: "user_quote_token_account",
            type: "pubkey"
          },
          {
            name: "protocol_fee_recipient",
            type: "pubkey"
          },
          {
            name: "protocol_fee_recipient_token_account",
            type: "pubkey"
          },
          {
            name: "coin_creator",
            type: "pubkey"
          },
          {
            name: "coin_creator_fee_basis_points",
            type: "u64"
          },
          {
            name: "coin_creator_fee",
            type: "u64"
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
      name: "SetBondingCurveCoinCreatorEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "base_mint",
            type: "pubkey"
          },
          {
            name: "pool",
            type: "pubkey"
          },
          {
            name: "bonding_curve",
            type: "pubkey"
          },
          {
            name: "coin_creator",
            type: "pubkey"
          }
        ]
      }
    },
    {
      name: "SetMetaplexCoinCreatorEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "base_mint",
            type: "pubkey"
          },
          {
            name: "pool",
            type: "pubkey"
          },
          {
            name: "metadata",
            type: "pubkey"
          },
          {
            name: "coin_creator",
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
      name: "UpdateAdminEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "admin",
            type: "pubkey"
          },
          {
            name: "new_admin",
            type: "pubkey"
          }
        ]
      }
    },
    {
      name: "UpdateFeeConfigEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "admin",
            type: "pubkey"
          },
          {
            name: "lp_fee_basis_points",
            type: "u64"
          },
          {
            name: "protocol_fee_basis_points",
            type: "u64"
          },
          {
            name: "protocol_fee_recipients",
            type: {
              array: [
                "pubkey",
                8
              ]
            }
          },
          {
            name: "coin_creator_fee_basis_points",
            type: "u64"
          },
          {
            name: "admin_set_coin_creator_authority",
            type: "pubkey"
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
    },
    {
      name: "WithdrawEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "lp_token_amount_in",
            type: "u64"
          },
          {
            name: "min_base_amount_out",
            type: "u64"
          },
          {
            name: "min_quote_amount_out",
            type: "u64"
          },
          {
            name: "user_base_token_reserves",
            type: "u64"
          },
          {
            name: "user_quote_token_reserves",
            type: "u64"
          },
          {
            name: "pool_base_token_reserves",
            type: "u64"
          },
          {
            name: "pool_quote_token_reserves",
            type: "u64"
          },
          {
            name: "base_amount_out",
            type: "u64"
          },
          {
            name: "quote_amount_out",
            type: "u64"
          },
          {
            name: "lp_mint_supply",
            type: "u64"
          },
          {
            name: "pool",
            type: "pubkey"
          },
          {
            name: "user",
            type: "pubkey"
          },
          {
            name: "user_base_token_account",
            type: "pubkey"
          },
          {
            name: "user_quote_token_account",
            type: "pubkey"
          },
          {
            name: "user_pool_token_account",
            type: "pubkey"
          }
        ]
      }
    }
  ]
};

// src/idl/pump_fees.json
var pump_fees_default = {
  address: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ",
  metadata: {
    name: "pump_fees",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Created with Anchor"
  },
  instructions: [
    {
      name: "claim_social_fee_pda",
      discriminator: [
        225,
        21,
        251,
        133,
        161,
        30,
        199,
        226
      ],
      accounts: [
        {
          name: "recipient",
          writable: true
        },
        {
          name: "social_fee_pda",
          writable: true
        },
        {
          name: "fee_program_global",
          pda: {
            seeds: [
              {
                kind: "const",
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
                ]
              }
            ]
          }
        },
        {
          name: "social_claim_authority",
          signer: true,
          relations: [
            "fee_program_global"
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
          name: "user_id",
          type: "string"
        },
        {
          name: "platform",
          type: "u8"
        }
      ],
      returns: {
        option: {
          defined: {
            name: "SocialFeePdaClaimed"
          }
        }
      }
    },
    {
      name: "create_fee_sharing_config",
      docs: [
        "Create Fee Sharing Config"
      ],
      discriminator: [
        195,
        78,
        86,
        76,
        111,
        52,
        251,
        213
      ],
      accounts: [
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
          address: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ"
        },
        {
          name: "payer",
          writable: true,
          signer: true
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
            ],
            program: {
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
          }
        },
        {
          name: "mint"
        },
        {
          name: "sharing_config",
          writable: true,
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
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
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
            ],
            program: {
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
          }
        },
        {
          name: "pump_program",
          address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
        },
        {
          name: "pump_event_authority",
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
          }
        },
        {
          name: "pool",
          writable: true,
          optional: true
        },
        {
          name: "pump_amm_program",
          optional: true,
          address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"
        },
        {
          name: "pump_amm_event_authority",
          optional: true,
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
              kind: "const",
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
              ]
            }
          }
        }
      ],
      args: []
    },
    {
      name: "create_social_fee_pda",
      discriminator: [
        144,
        224,
        59,
        211,
        78,
        248,
        202,
        220
      ],
      accounts: [
        {
          name: "payer",
          writable: true,
          signer: true
        },
        {
          name: "social_fee_pda",
          writable: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        },
        {
          name: "fee_program_global",
          pda: {
            seeds: [
              {
                kind: "const",
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
                ]
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
          name: "user_id",
          type: "string"
        },
        {
          name: "platform",
          type: "u8"
        }
      ]
    },
    {
      name: "get_fees",
      docs: [
        "Get Fees"
      ],
      discriminator: [
        231,
        37,
        126,
        85,
        207,
        91,
        63,
        52
      ],
      accounts: [
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
                kind: "account",
                path: "config_program_id"
              }
            ]
          }
        },
        {
          name: "config_program_id"
        }
      ],
      args: [
        {
          name: "is_pump_pool",
          type: "bool"
        },
        {
          name: "market_cap_lamports",
          type: "u128"
        },
        {
          name: "trade_size_lamports",
          type: "u64"
        }
      ],
      returns: {
        defined: {
          name: "Fees"
        }
      }
    },
    {
      name: "initialize_fee_config",
      docs: [
        "Initialize FeeConfig admin"
      ],
      discriminator: [
        62,
        162,
        20,
        133,
        121,
        65,
        145,
        27
      ],
      accounts: [
        {
          name: "admin",
          writable: true,
          signer: true,
          address: "8LWu7QM2dGR1G8nKDHthckea57bkCzXyBTAKPJUBDHo8"
        },
        {
          name: "fee_config",
          writable: true,
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
                kind: "account",
                path: "config_program_id"
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        },
        {
          name: "config_program_id"
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
      args: []
    },
    {
      name: "initialize_fee_program_global",
      discriminator: [
        35,
        215,
        130,
        84,
        233,
        56,
        124,
        167
      ],
      accounts: [
        {
          name: "authority",
          writable: true,
          signer: true,
          relations: [
            "pump_global"
          ]
        },
        {
          name: "pump_global",
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
            ],
            program: {
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
          }
        },
        {
          name: "fee_program_global",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
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
                ]
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
        {
          name: "social_claim_authority",
          type: "pubkey"
        },
        {
          name: "disable_flags",
          type: "u8"
        },
        {
          name: "claim_rate_limit",
          type: "u64"
        }
      ]
    },
    {
      name: "reset_fee_sharing_config",
      docs: [
        "Reset Fee Sharing Config, make sure to distribute all the fees before calling this"
      ],
      discriminator: [
        10,
        2,
        182,
        95,
        16,
        127,
        129,
        186
      ],
      accounts: [
        {
          name: "authority",
          signer: true
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
            ],
            program: {
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
          }
        },
        {
          name: "new_admin"
        },
        {
          name: "mint",
          relations: [
            "sharing_config"
          ]
        },
        {
          name: "sharing_config",
          writable: true,
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
      args: []
    },
    {
      name: "revoke_fee_sharing_authority",
      docs: [
        "Revoke Fee Sharing Authority"
      ],
      discriminator: [
        18,
        233,
        158,
        39,
        185,
        207,
        58,
        104
      ],
      accounts: [
        {
          name: "authority",
          signer: true
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
            ],
            program: {
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
          }
        },
        {
          name: "mint",
          relations: [
            "sharing_config"
          ]
        },
        {
          name: "sharing_config",
          writable: true,
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
      args: []
    },
    {
      name: "set_authority",
      discriminator: [
        133,
        250,
        37,
        21,
        110,
        163,
        26,
        121
      ],
      accounts: [
        {
          name: "authority",
          writable: true,
          signer: true,
          relations: [
            "fee_program_global"
          ]
        },
        {
          name: "fee_program_global",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
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
                ]
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
          name: "new_authority",
          type: "pubkey"
        }
      ]
    },
    {
      name: "set_claim_rate_limit",
      discriminator: [
        185,
        211,
        159,
        174,
        212,
        49,
        88,
        4
      ],
      accounts: [
        {
          name: "authority",
          writable: true,
          signer: true,
          relations: [
            "fee_program_global"
          ]
        },
        {
          name: "fee_program_global",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
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
                ]
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
          name: "claim_rate_limit",
          type: "u64"
        }
      ]
    },
    {
      name: "set_disable_flags",
      discriminator: [
        194,
        217,
        112,
        35,
        114,
        222,
        51,
        190
      ],
      accounts: [
        {
          name: "authority",
          writable: true,
          signer: true,
          relations: [
            "fee_program_global"
          ]
        },
        {
          name: "fee_program_global",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
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
                ]
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
          name: "disable_flags",
          type: "u8"
        }
      ]
    },
    {
      name: "set_social_claim_authority",
      discriminator: [
        147,
        54,
        184,
        154,
        136,
        237,
        185,
        153
      ],
      accounts: [
        {
          name: "authority",
          writable: true,
          signer: true,
          relations: [
            "fee_program_global"
          ]
        },
        {
          name: "fee_program_global",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
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
                ]
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
          name: "social_claim_authority",
          type: "pubkey"
        }
      ]
    },
    {
      name: "transfer_fee_sharing_authority",
      docs: [
        "Transfer Fee Sharing Authority"
      ],
      discriminator: [
        202,
        10,
        75,
        200,
        164,
        34,
        210,
        96
      ],
      accounts: [
        {
          name: "authority",
          signer: true
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
            ],
            program: {
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
          }
        },
        {
          name: "mint",
          relations: [
            "sharing_config"
          ]
        },
        {
          name: "sharing_config",
          writable: true,
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
            ]
          }
        },
        {
          name: "new_admin"
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
      args: []
    },
    {
      name: "update_admin",
      docs: [
        "Update admin (only callable by admin)"
      ],
      discriminator: [
        161,
        176,
        40,
        213,
        60,
        184,
        179,
        228
      ],
      accounts: [
        {
          name: "admin",
          signer: true,
          relations: [
            "fee_config"
          ]
        },
        {
          name: "fee_config",
          writable: true,
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
                kind: "account",
                path: "config_program_id"
              }
            ]
          }
        },
        {
          name: "new_admin"
        },
        {
          name: "config_program_id"
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
      args: []
    },
    {
      name: "update_fee_config",
      docs: [
        "Set/Replace fee parameters entirely (only callable by admin)"
      ],
      discriminator: [
        104,
        184,
        103,
        242,
        88,
        151,
        107,
        20
      ],
      accounts: [
        {
          name: "fee_config",
          writable: true,
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
                kind: "account",
                path: "config_program_id"
              }
            ]
          }
        },
        {
          name: "admin",
          signer: true,
          relations: [
            "fee_config"
          ]
        },
        {
          name: "config_program_id"
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
          name: "fee_tiers",
          type: {
            vec: {
              defined: {
                name: "FeeTier"
              }
            }
          }
        },
        {
          name: "flat_fees",
          type: {
            defined: {
              name: "Fees"
            }
          }
        }
      ]
    },
    {
      name: "update_fee_shares",
      docs: [
        "Update Fee Shares, make sure to distribute all the fees before calling this"
      ],
      discriminator: [
        189,
        13,
        136,
        99,
        187,
        164,
        237,
        35
      ],
      accounts: [
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
          address: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ"
        },
        {
          name: "authority",
          signer: true
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
            ],
            program: {
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
          }
        },
        {
          name: "mint",
          relations: [
            "sharing_config"
          ]
        },
        {
          name: "sharing_config",
          writable: true,
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
            ]
          }
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
            ],
            program: {
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
          }
        },
        {
          name: "pump_creator_vault",
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
                path: "sharing_config"
              }
            ],
            program: {
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
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        },
        {
          name: "pump_program",
          address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
        },
        {
          name: "pump_event_authority",
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
          }
        },
        {
          name: "pump_amm_program",
          address: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"
        },
        {
          name: "amm_event_authority",
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
              kind: "const",
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
              ]
            }
          }
        },
        {
          name: "wsol_mint",
          address: "So11111111111111111111111111111111111111112"
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
          name: "coin_creator_vault_authority",
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
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                kind: "account",
                path: "sharing_config"
              }
            ],
            program: {
              kind: "const",
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
              ]
            }
          }
        },
        {
          name: "coin_creator_vault_ata",
          writable: true
        }
      ],
      args: [
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
    },
    {
      name: "upsert_fee_tiers",
      docs: [
        "Update or expand fee tiers (only callable by admin)"
      ],
      discriminator: [
        227,
        23,
        150,
        12,
        77,
        86,
        94,
        4
      ],
      accounts: [
        {
          name: "fee_config",
          writable: true,
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
                kind: "account",
                path: "config_program_id"
              }
            ]
          }
        },
        {
          name: "admin",
          signer: true,
          relations: [
            "fee_config"
          ]
        },
        {
          name: "config_program_id"
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
          name: "fee_tiers",
          type: {
            vec: {
              defined: {
                name: "FeeTier"
              }
            }
          }
        },
        {
          name: "offset",
          type: "u8"
        }
      ]
    }
  ],
  accounts: [
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
      name: "FeeProgramGlobal",
      discriminator: [
        162,
        165,
        245,
        49,
        29,
        37,
        55,
        242
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
      name: "Pool",
      discriminator: [
        241,
        154,
        109,
        4,
        17,
        177,
        109,
        188
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
      name: "SocialFeePda",
      discriminator: [
        139,
        96,
        53,
        17,
        42,
        169,
        206,
        150
      ]
    }
  ],
  events: [
    {
      name: "CreateFeeSharingConfigEvent",
      discriminator: [
        133,
        105,
        170,
        200,
        184,
        116,
        251,
        88
      ]
    },
    {
      name: "InitializeFeeConfigEvent",
      discriminator: [
        89,
        138,
        244,
        230,
        10,
        56,
        226,
        126
      ]
    },
    {
      name: "InitializeFeeProgramGlobalEvent",
      discriminator: [
        40,
        233,
        156,
        78,
        95,
        0,
        8,
        199
      ]
    },
    {
      name: "ResetFeeSharingConfigEvent",
      discriminator: [
        203,
        204,
        151,
        226,
        120,
        55,
        214,
        243
      ]
    },
    {
      name: "RevokeFeeSharingAuthorityEvent",
      discriminator: [
        114,
        23,
        101,
        60,
        14,
        190,
        153,
        62
      ]
    },
    {
      name: "SetAuthorityEvent",
      discriminator: [
        18,
        175,
        132,
        66,
        208,
        201,
        87,
        242
      ]
    },
    {
      name: "SetClaimRateLimitEvent",
      discriminator: [
        13,
        143,
        143,
        235,
        181,
        19,
        51,
        40
      ]
    },
    {
      name: "SetDisableFlagsEvent",
      discriminator: [
        5,
        8,
        179,
        65,
        49,
        55,
        145,
        126
      ]
    },
    {
      name: "SetSocialClaimAuthorityEvent",
      discriminator: [
        60,
        118,
        127,
        132,
        239,
        52,
        254,
        14
      ]
    },
    {
      name: "SocialFeePdaClaimed",
      discriminator: [
        50,
        18,
        193,
        65,
        237,
        210,
        234,
        236
      ]
    },
    {
      name: "SocialFeePdaCreated",
      discriminator: [
        183,
        183,
        218,
        147,
        24,
        124,
        137,
        169
      ]
    },
    {
      name: "TransferFeeSharingAuthorityEvent",
      discriminator: [
        124,
        143,
        198,
        245,
        77,
        184,
        8,
        236
      ]
    },
    {
      name: "UpdateAdminEvent",
      discriminator: [
        225,
        152,
        171,
        87,
        246,
        63,
        66,
        234
      ]
    },
    {
      name: "UpdateFeeConfigEvent",
      discriminator: [
        90,
        23,
        65,
        35,
        62,
        244,
        188,
        208
      ]
    },
    {
      name: "UpdateFeeSharesEvent",
      discriminator: [
        21,
        186,
        196,
        184,
        91,
        228,
        225,
        203
      ]
    },
    {
      name: "UpsertFeeTiersEvent",
      discriminator: [
        171,
        89,
        169,
        187,
        122,
        186,
        33,
        204
      ]
    }
  ],
  errors: [
    {
      code: 6e3,
      name: "UnauthorizedProgram",
      msg: "Only Pump and PumpSwap programs can call this instruction"
    },
    {
      code: 6001,
      name: "InvalidAdmin",
      msg: "Invalid admin"
    },
    {
      code: 6002,
      name: "NoFeeTiers",
      msg: "No fee tiers provided"
    },
    {
      code: 6003,
      name: "TooManyFeeTiers",
      msg: "format"
    },
    {
      code: 6004,
      name: "OffsetNotContinuous",
      msg: "The offset should be <= fee_config.fee_tiers.len()"
    },
    {
      code: 6005,
      name: "FeeTiersNotSorted",
      msg: "Fee tiers must be sorted by market cap threshold (ascending)"
    },
    {
      code: 6006,
      name: "InvalidFeeTotal",
      msg: "Fee total must not exceed 10_000bps"
    },
    {
      code: 6007,
      name: "InvalidSharingConfig",
      msg: "Invalid Sharing Config"
    },
    {
      code: 6008,
      name: "InvalidPool",
      msg: "Invalid Pool"
    },
    {
      code: 6009,
      name: "SharingConfigAdminRevoked",
      msg: "Sharing config admin has been revoked"
    },
    {
      code: 6010,
      name: "NoShareholders",
      msg: "No shareholders provided"
    },
    {
      code: 6011,
      name: "TooManyShareholders",
      msg: "format"
    },
    {
      code: 6012,
      name: "DuplicateShareholder",
      msg: "Duplicate shareholder address"
    },
    {
      code: 6013,
      name: "NotEnoughRemainingAccounts",
      msg: "Not enough remaining accounts"
    },
    {
      code: 6014,
      name: "InvalidShareTotal",
      msg: "Invalid share total - must equal 10_000 basis points"
    },
    {
      code: 6015,
      name: "ShareCalculationOverflow",
      msg: "Share calculation overflow"
    },
    {
      code: 6016,
      name: "NotAuthorized",
      msg: "The given account is not authorized to execute this instruction."
    },
    {
      code: 6017,
      name: "ZeroShareNotAllowed",
      msg: "Shareholder cannot have zero share"
    },
    {
      code: 6018,
      name: "SharingConfigNotActive",
      msg: "Fee sharing config is not active"
    },
    {
      code: 6019,
      name: "AmmAccountsRequiredForGraduatedCoin",
      msg: "AMM accounts are required for graduated coins"
    },
    {
      code: 6020,
      name: "ShareholderAccountMismatch",
      msg: "Remaining account key doesn't match shareholder address"
    },
    {
      code: 6021,
      name: "FeatureDeactivated",
      msg: "Feature is currently deactivated"
    },
    {
      code: 6022,
      name: "UserIdTooLong",
      msg: "User ID exceeds maximum length"
    }
  ],
  types: [
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
      name: "CreateFeeSharingConfigEvent",
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
            name: "pool",
            type: {
              option: "pubkey"
            }
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
            name: "initial_shareholders",
            type: {
              vec: {
                defined: {
                  name: "Shareholder"
                }
              }
            }
          },
          {
            name: "status",
            type: {
              defined: {
                name: "ConfigStatus"
              }
            }
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
            docs: [
              "The bump for the PDA"
            ],
            type: "u8"
          },
          {
            name: "admin",
            docs: [
              "The admin account that can update the fee config"
            ],
            type: "pubkey"
          },
          {
            name: "flat_fees",
            docs: [
              "The flat fees for non-pump pools"
            ],
            type: {
              defined: {
                name: "Fees"
              }
            }
          },
          {
            name: "fee_tiers",
            docs: [
              "The fee tiers"
            ],
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
      name: "FeeProgramGlobal",
      type: {
        kind: "struct",
        fields: [
          {
            name: "bump",
            type: "u8"
          },
          {
            name: "authority",
            type: "pubkey"
          },
          {
            name: "disable_flags",
            type: "u8"
          },
          {
            name: "social_claim_authority",
            type: "pubkey"
          },
          {
            name: "claim_rate_limit",
            type: "u64"
          },
          {
            name: "_reserved",
            type: {
              array: [
                "u8",
                256
              ]
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
          }
        ]
      }
    },
    {
      name: "InitializeFeeConfigEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "admin",
            type: "pubkey"
          },
          {
            name: "fee_config",
            type: "pubkey"
          }
        ]
      }
    },
    {
      name: "InitializeFeeProgramGlobalEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "authority",
            type: "pubkey"
          },
          {
            name: "social_claim_authority",
            type: "pubkey"
          },
          {
            name: "disable_flags",
            type: "u8"
          },
          {
            name: "claim_rate_limit",
            type: "u64"
          }
        ]
      }
    },
    {
      name: "Pool",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pool_bump",
            type: "u8"
          },
          {
            name: "index",
            type: "u16"
          },
          {
            name: "creator",
            type: "pubkey"
          },
          {
            name: "base_mint",
            type: "pubkey"
          },
          {
            name: "quote_mint",
            type: "pubkey"
          },
          {
            name: "lp_mint",
            type: "pubkey"
          },
          {
            name: "pool_base_token_account",
            type: "pubkey"
          },
          {
            name: "pool_quote_token_account",
            type: "pubkey"
          },
          {
            name: "lp_supply",
            type: "u64"
          },
          {
            name: "coin_creator",
            type: "pubkey"
          },
          {
            name: "is_mayhem_mode",
            type: "bool"
          }
        ]
      }
    },
    {
      name: "ResetFeeSharingConfigEvent",
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
            name: "sharing_config",
            type: "pubkey"
          },
          {
            name: "old_admin",
            type: "pubkey"
          },
          {
            name: "old_shareholders",
            type: {
              vec: {
                defined: {
                  name: "Shareholder"
                }
              }
            }
          },
          {
            name: "new_admin",
            type: "pubkey"
          },
          {
            name: "new_shareholders",
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
      name: "RevokeFeeSharingAuthorityEvent",
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
            name: "sharing_config",
            type: "pubkey"
          },
          {
            name: "admin",
            type: "pubkey"
          }
        ]
      }
    },
    {
      name: "SetAuthorityEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "old_authority",
            type: "pubkey"
          },
          {
            name: "new_authority",
            type: "pubkey"
          }
        ]
      }
    },
    {
      name: "SetClaimRateLimitEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "claim_rate_limit",
            type: "u64"
          }
        ]
      }
    },
    {
      name: "SetDisableFlagsEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "disable_flags",
            type: "u8"
          }
        ]
      }
    },
    {
      name: "SetSocialClaimAuthorityEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "social_claim_authority",
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
      name: "SocialFeePda",
      docs: [
        "Platform identifier: 0=pump, 1=twitter, etc."
      ],
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
            name: "user_id",
            docs: [
              "Max 20 characters to fit u64::MAX (18,446,744,073,709,551,615) as a string.",
              "Actual storage: 4 bytes (length prefix) + 20 bytes (content) = 24 bytes."
            ],
            type: "string"
          },
          {
            name: "platform",
            type: "u8"
          },
          {
            name: "total_claimed",
            type: "u64"
          },
          {
            name: "last_claimed",
            type: "u64"
          },
          {
            name: "_reserved",
            type: {
              array: [
                "u8",
                128
              ]
            }
          }
        ]
      }
    },
    {
      name: "SocialFeePdaClaimed",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "user_id",
            type: "string"
          },
          {
            name: "platform",
            type: "u8"
          },
          {
            name: "social_fee_pda",
            type: "pubkey"
          },
          {
            name: "recipient",
            type: "pubkey"
          },
          {
            name: "social_claim_authority",
            type: "pubkey"
          },
          {
            name: "amount_claimed",
            type: "u64"
          },
          {
            name: "claimable_before",
            type: "u64"
          },
          {
            name: "lifetime_claimed",
            type: "u64"
          },
          {
            name: "recipient_balance_before",
            type: "u64"
          },
          {
            name: "recipient_balance_after",
            type: "u64"
          }
        ]
      }
    },
    {
      name: "SocialFeePdaCreated",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "user_id",
            type: "string"
          },
          {
            name: "platform",
            type: "u8"
          },
          {
            name: "social_fee_pda",
            type: "pubkey"
          },
          {
            name: "created_by",
            type: "pubkey"
          }
        ]
      }
    },
    {
      name: "TransferFeeSharingAuthorityEvent",
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
            name: "sharing_config",
            type: "pubkey"
          },
          {
            name: "old_admin",
            type: "pubkey"
          },
          {
            name: "new_admin",
            type: "pubkey"
          }
        ]
      }
    },
    {
      name: "UpdateAdminEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "old_admin",
            type: "pubkey"
          },
          {
            name: "new_admin",
            type: "pubkey"
          }
        ]
      }
    },
    {
      name: "UpdateFeeConfigEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "admin",
            type: "pubkey"
          },
          {
            name: "fee_config",
            type: "pubkey"
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
          },
          {
            name: "flat_fees",
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
      name: "UpdateFeeSharesEvent",
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
            name: "sharing_config",
            type: "pubkey"
          },
          {
            name: "admin",
            type: "pubkey"
          },
          {
            name: "new_shareholders",
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
      name: "UpsertFeeTiersEvent",
      type: {
        kind: "struct",
        fields: [
          {
            name: "timestamp",
            type: "i64"
          },
          {
            name: "admin",
            type: "pubkey"
          },
          {
            name: "fee_config",
            type: "pubkey"
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
          },
          {
            name: "offset",
            type: "u8"
          }
        ]
      }
    }
  ],
  constants: [
    {
      name: "FEE_CONFIG_SEED",
      type: "bytes",
      value: "[102, 101, 101, 95, 99, 111, 110, 102, 105, 103]"
    },
    {
      name: "FEE_PROGRAM_GLOBAL_SEED",
      type: {
        array: [
          "u8",
          18
        ]
      },
      value: "[102, 101, 101, 45, 112, 114, 111, 103, 114, 97, 109, 45, 103, 108, 111, 98, 97, 108]"
    },
    {
      name: "PUMP_GLOBAL_SEED",
      docs: [
        "Bonding Curve Program Global Seed"
      ],
      type: {
        array: [
          "u8",
          6
        ]
      },
      value: "[103, 108, 111, 98, 97, 108]"
    },
    {
      name: "SHARING_CONFIG_SEED",
      type: {
        array: [
          "u8",
          14
        ]
      },
      value: "[115, 104, 97, 114, 105, 110, 103, 45, 99, 111, 110, 102, 105, 103]"
    },
    {
      name: "SOCIAL_FEE_PDA_SEED",
      type: {
        array: [
          "u8",
          14
        ]
      },
      value: "[115, 111, 99, 105, 97, 108, 45, 102, 101, 101, 45, 112, 100, 97]"
    }
  ]
};

// src/onlineSdk.ts
var import_pump_swap_sdk = require("@pump-fun/pump-swap-sdk");
var import_spl_token = require("@solana/spl-token");
var import_web33 = require("@solana/web3.js");
var import_bn5 = __toESM(require("bn.js"));

// src/analytics.ts
var import_bn3 = __toESM(require("bn.js"));
init_bondingCurve();
var LAMPORTS_PER_SOL = new import_bn3.default(1e9);
var ONE_TOKEN = new import_bn3.default(1e6);
function spotPrice(bondingCurve) {
  if (bondingCurve.virtualTokenReserves.isZero()) return new import_bn3.default(0);
  return bondingCurve.virtualSolReserves.mul(LAMPORTS_PER_SOL).div(bondingCurve.virtualTokenReserves);
}
function calculateBuyPriceImpact({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  solAmount
}) {
  const priceBefore = spotPrice(bondingCurve);
  const tokensReceived = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply,
    bondingCurve,
    amount: solAmount
  });
  const newVirtualSolReserves = bondingCurve.virtualSolReserves.add(solAmount);
  const newVirtualTokenReserves = bondingCurve.virtualTokenReserves.sub(tokensReceived);
  const priceAfter = newVirtualTokenReserves.isZero() ? new import_bn3.default(0) : newVirtualSolReserves.mul(LAMPORTS_PER_SOL).div(newVirtualTokenReserves);
  const impactBps = priceBefore.isZero() ? 0 : priceAfter.sub(priceBefore).muln(1e4).div(priceBefore).toNumber();
  return {
    priceBefore,
    priceAfter,
    impactBps,
    outputAmount: tokensReceived
  };
}
function calculateSellPriceImpact({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  tokenAmount
}) {
  const priceBefore = spotPrice(bondingCurve);
  const solReceived = getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply,
    bondingCurve,
    amount: tokenAmount
  });
  const newVirtualSolReserves = bondingCurve.virtualSolReserves.sub(solReceived);
  const newVirtualTokenReserves = bondingCurve.virtualTokenReserves.add(tokenAmount);
  const priceAfter = newVirtualTokenReserves.isZero() ? new import_bn3.default(0) : newVirtualSolReserves.mul(LAMPORTS_PER_SOL).div(newVirtualTokenReserves);
  const impactBps = priceBefore.isZero() ? 0 : priceBefore.sub(priceAfter).muln(1e4).div(priceBefore).toNumber();
  return {
    priceBefore,
    priceAfter,
    impactBps,
    outputAmount: solReceived
  };
}
function getGraduationProgress(global, bondingCurve) {
  if (bondingCurve.complete) {
    return {
      progressBps: 1e4,
      isGraduated: true,
      tokensRemaining: new import_bn3.default(0),
      tokensTotal: global.initialRealTokenReserves,
      solAccumulated: bondingCurve.realSolReserves
    };
  }
  const initialReal = global.initialRealTokenReserves;
  if (initialReal.isZero()) {
    return {
      progressBps: 0,
      isGraduated: false,
      tokensRemaining: new import_bn3.default(0),
      tokensTotal: new import_bn3.default(0),
      solAccumulated: new import_bn3.default(0)
    };
  }
  const tokensSold = initialReal.sub(bondingCurve.realTokenReserves);
  const progressBps = tokensSold.muln(1e4).div(initialReal).toNumber();
  return {
    progressBps,
    isGraduated: false,
    tokensRemaining: bondingCurve.realTokenReserves,
    tokensTotal: initialReal,
    solAccumulated: bondingCurve.realSolReserves
  };
}
function getTokenPrice({
  global,
  feeConfig,
  mintSupply,
  bondingCurve
}) {
  const buyPricePerToken = getBuySolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply,
    bondingCurve,
    amount: ONE_TOKEN
  });
  const sellPricePerToken = getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply,
    bondingCurve,
    amount: ONE_TOKEN
  });
  const marketCap = bondingCurveMarketCap({
    mintSupply,
    virtualSolReserves: bondingCurve.virtualSolReserves,
    virtualTokenReserves: bondingCurve.virtualTokenReserves
  });
  return {
    buyPricePerToken,
    sellPricePerToken,
    marketCap,
    isGraduated: bondingCurve.complete
  };
}
function getBondingCurveSummary({
  global,
  feeConfig,
  mintSupply,
  bondingCurve
}) {
  const progress = getGraduationProgress(global, bondingCurve);
  const price = getTokenPrice({ global, feeConfig, mintSupply, bondingCurve });
  return {
    marketCap: price.marketCap,
    progressBps: progress.progressBps,
    isGraduated: progress.isGraduated,
    buyPricePerToken: price.buyPricePerToken,
    sellPricePerToken: price.sellPricePerToken,
    realSolReserves: bondingCurve.realSolReserves,
    realTokenReserves: bondingCurve.realTokenReserves,
    virtualSolReserves: bondingCurve.virtualSolReserves,
    virtualTokenReserves: bondingCurve.virtualTokenReserves
  };
}

// src/tokenIncentives.ts
var import_bn4 = __toESM(require("bn.js"));
function totalUnclaimedTokens(globalVolumeAccumulator, userVolumeAccumulator, currentTimestamp = Date.now() / 1e3) {
  const { startTime, endTime, secondsInADay, totalTokenSupply, solVolumes } = globalVolumeAccumulator;
  const { totalUnclaimedTokens: totalUnclaimedTokens2, currentSolVolume, lastUpdateTimestamp } = userVolumeAccumulator;
  const result = totalUnclaimedTokens2;
  if (startTime.eqn(0) || endTime.eqn(0) || secondsInADay.eqn(0)) {
    return result;
  }
  const currentTimestampBn = new import_bn4.default(currentTimestamp);
  if (currentTimestampBn.lt(startTime)) {
    return result;
  }
  const currentDayIndex = currentTimestampBn.sub(startTime).div(secondsInADay).toNumber();
  if (lastUpdateTimestamp.lt(startTime)) {
    return result;
  }
  const lastUpdatedIndex = lastUpdateTimestamp.sub(startTime).div(secondsInADay).toNumber();
  if (endTime.lt(startTime)) {
    return result;
  }
  const endDayIndex = endTime.sub(startTime).div(secondsInADay).toNumber();
  if (currentDayIndex > lastUpdatedIndex && lastUpdatedIndex <= endDayIndex) {
    const lastUpdatedDayTokenSupply = totalTokenSupply[lastUpdatedIndex];
    const lastUpdatedDaySolVolume = solVolumes[lastUpdatedIndex];
    if (!lastUpdatedDaySolVolume || !lastUpdatedDayTokenSupply || lastUpdatedDaySolVolume.eqn(0)) {
      return result;
    }
    return result.add(
      currentSolVolume.mul(lastUpdatedDayTokenSupply).div(lastUpdatedDaySolVolume)
    );
  }
  return result;
}
function currentDayTokens(globalVolumeAccumulator, userVolumeAccumulator, currentTimestamp = Date.now() / 1e3) {
  const { startTime, endTime, secondsInADay, totalTokenSupply, solVolumes } = globalVolumeAccumulator;
  const { currentSolVolume, lastUpdateTimestamp } = userVolumeAccumulator;
  if (startTime.eqn(0) || endTime.eqn(0) || secondsInADay.eqn(0)) {
    return new import_bn4.default(0);
  }
  const currentTimestampBn = new import_bn4.default(currentTimestamp);
  if (currentTimestampBn.lt(startTime) || currentTimestampBn.gt(endTime)) {
    return new import_bn4.default(0);
  }
  const currentDayIndex = currentTimestampBn.sub(startTime).div(secondsInADay).toNumber();
  if (lastUpdateTimestamp.lt(startTime)) {
    return new import_bn4.default(0);
  }
  const lastUpdatedIndex = lastUpdateTimestamp.sub(startTime).div(secondsInADay).toNumber();
  if (endTime.lt(startTime)) {
    return new import_bn4.default(0);
  }
  if (currentDayIndex !== lastUpdatedIndex) {
    return new import_bn4.default(0);
  }
  const currentDayTokenSupply = totalTokenSupply[currentDayIndex];
  const currentDaySolVolume = solVolumes[currentDayIndex];
  if (!currentDaySolVolume || !currentDayTokenSupply || currentDaySolVolume.eqn(0)) {
    return new import_bn4.default(0);
  }
  return currentSolVolume.mul(currentDayTokenSupply).div(currentDaySolVolume);
}

// src/onlineSdk.ts
var OFFLINE_PUMP_PROGRAM = getPumpProgram(null);
var OnlinePumpSdk = class {
  constructor(connection) {
    this.connection = connection;
    this.pumpProgram = getPumpProgram(connection);
    this.offlinePumpProgram = OFFLINE_PUMP_PROGRAM;
    this.pumpAmmProgram = getPumpAmmProgram(connection);
    this.pumpAmmSdk = new import_pump_swap_sdk.OnlinePumpAmmSdk(connection);
    this.pumpAmmAdminSdk = new import_pump_swap_sdk.PumpAmmAdminSdk(connection);
  }
  async fetchGlobal() {
    return await this.pumpProgram.account.global.fetch(GLOBAL_PDA);
  }
  async fetchFeeConfig() {
    return await this.pumpProgram.account.feeConfig.fetch(PUMP_FEE_CONFIG_PDA);
  }
  async fetchBondingCurve(mint) {
    return await this.pumpProgram.account.bondingCurve.fetch(
      bondingCurvePda(mint)
    );
  }
  async fetchBuyState(mint, user, tokenProgram = import_spl_token.TOKEN_PROGRAM_ID) {
    const [bondingCurveAccountInfo, associatedUserAccountInfo] = await this.connection.getMultipleAccountsInfo([
      bondingCurvePda(mint),
      (0, import_spl_token.getAssociatedTokenAddressSync)(mint, user, true, tokenProgram)
    ]);
    if (!bondingCurveAccountInfo) {
      throw new Error(
        `Bonding curve account not found for mint: ${mint.toBase58()}`
      );
    }
    const bondingCurve = PUMP_SDK.decodeBondingCurve(bondingCurveAccountInfo);
    return { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo };
  }
  async fetchSellState(mint, user, tokenProgram = import_spl_token.TOKEN_PROGRAM_ID) {
    const [bondingCurveAccountInfo, associatedUserAccountInfo] = await this.connection.getMultipleAccountsInfo([
      bondingCurvePda(mint),
      (0, import_spl_token.getAssociatedTokenAddressSync)(mint, user, true, tokenProgram)
    ]);
    if (!bondingCurveAccountInfo) {
      throw new Error(
        `Bonding curve account not found for mint: ${mint.toBase58()}`
      );
    }
    if (!associatedUserAccountInfo) {
      throw new Error(
        `Associated token account not found for mint: ${mint.toBase58()} and user: ${user.toBase58()}`
      );
    }
    const bondingCurve = PUMP_SDK.decodeBondingCurve(bondingCurveAccountInfo);
    return { bondingCurveAccountInfo, bondingCurve };
  }
  async fetchGlobalVolumeAccumulator() {
    return await this.pumpProgram.account.globalVolumeAccumulator.fetch(
      GLOBAL_VOLUME_ACCUMULATOR_PDA
    );
  }
  async fetchUserVolumeAccumulator(user) {
    return await this.pumpProgram.account.userVolumeAccumulator.fetchNullable(
      userVolumeAccumulatorPda(user)
    );
  }
  async fetchUserVolumeAccumulatorTotalStats(user) {
    const userVolumeAccumulator = await this.fetchUserVolumeAccumulator(
      user
    ) ?? {
      totalUnclaimedTokens: new import_bn5.default(0),
      totalClaimedTokens: new import_bn5.default(0),
      currentSolVolume: new import_bn5.default(0)
    };
    const userVolumeAccumulatorAmm = await this.pumpAmmSdk.fetchUserVolumeAccumulator(user) ?? {
      totalUnclaimedTokens: new import_bn5.default(0),
      totalClaimedTokens: new import_bn5.default(0),
      currentSolVolume: new import_bn5.default(0)
    };
    return {
      totalUnclaimedTokens: userVolumeAccumulator.totalUnclaimedTokens.add(
        userVolumeAccumulatorAmm.totalUnclaimedTokens
      ),
      totalClaimedTokens: userVolumeAccumulator.totalClaimedTokens.add(
        userVolumeAccumulatorAmm.totalClaimedTokens
      ),
      currentSolVolume: userVolumeAccumulator.currentSolVolume.add(
        userVolumeAccumulatorAmm.currentSolVolume
      )
    };
  }
  async collectCoinCreatorFeeInstructions(coinCreator, feePayer) {
    const quoteMint = import_spl_token.NATIVE_MINT;
    const quoteTokenProgram = import_spl_token.TOKEN_PROGRAM_ID;
    const coinCreatorVaultAuthority = (0, import_pump_swap_sdk.coinCreatorVaultAuthorityPda)(coinCreator);
    const coinCreatorVaultAta = (0, import_pump_swap_sdk.coinCreatorVaultAtaPda)(
      coinCreatorVaultAuthority,
      quoteMint,
      quoteTokenProgram
    );
    const coinCreatorTokenAccount = (0, import_spl_token.getAssociatedTokenAddressSync)(
      quoteMint,
      coinCreator,
      true,
      quoteTokenProgram
    );
    const accountInfos = await this.connection.getMultipleAccountsInfo([
      coinCreatorVaultAta,
      coinCreatorTokenAccount
    ]);
    const coinCreatorVaultAtaAccountInfo = accountInfos[0] ?? null;
    const coinCreatorTokenAccountInfo = accountInfos[1] ?? null;
    return [
      await this.offlinePumpProgram.methods.collectCreatorFee().accountsPartial({
        creator: coinCreator
      }).instruction(),
      ...await import_pump_swap_sdk.PUMP_AMM_SDK.collectCoinCreatorFee(
        {
          coinCreator,
          quoteMint,
          quoteTokenProgram,
          coinCreatorVaultAuthority,
          coinCreatorVaultAta,
          coinCreatorTokenAccount,
          coinCreatorVaultAtaAccountInfo,
          coinCreatorTokenAccountInfo
        },
        feePayer
      )
    ];
  }
  async adminSetCoinCreatorInstructions(newCoinCreator, mint) {
    const global = await this.fetchGlobal();
    return [
      await this.offlinePumpProgram.methods.adminSetCreator(newCoinCreator).accountsPartial({
        adminSetCreatorAuthority: global.adminSetCreatorAuthority,
        mint
      }).instruction(),
      await this.pumpAmmAdminSdk.adminSetCoinCreator(mint, newCoinCreator)
    ];
  }
  async getCreatorVaultBalance(creator) {
    const creatorVault = creatorVaultPda(creator);
    const accountInfo = await this.connection.getAccountInfo(creatorVault);
    if (accountInfo === null) {
      return new import_bn5.default(0);
    }
    const rentExemptionLamports = await this.connection.getMinimumBalanceForRentExemption(
      accountInfo.data.length
    );
    if (accountInfo.lamports < rentExemptionLamports) {
      return new import_bn5.default(0);
    }
    return new import_bn5.default(accountInfo.lamports - rentExemptionLamports);
  }
  async getCreatorVaultBalanceBothPrograms(creator) {
    const balance = await this.getCreatorVaultBalance(creator);
    const ammBalance = await this.pumpAmmSdk.getCoinCreatorVaultBalance(creator);
    return balance.add(ammBalance);
  }
  async adminUpdateTokenIncentives(startTime, endTime, dayNumber, tokenSupplyPerDay, secondsInADay = new import_bn5.default(86400), mint = PUMP_TOKEN_MINT, tokenProgram = import_spl_token.TOKEN_2022_PROGRAM_ID) {
    const { authority } = await this.fetchGlobal();
    return await this.offlinePumpProgram.methods.adminUpdateTokenIncentives(
      startTime,
      endTime,
      secondsInADay,
      dayNumber,
      tokenSupplyPerDay
    ).accountsPartial({
      authority,
      mint,
      tokenProgram
    }).instruction();
  }
  async adminUpdateTokenIncentivesBothPrograms(startTime, endTime, dayNumber, tokenSupplyPerDay, secondsInADay = new import_bn5.default(86400), mint = PUMP_TOKEN_MINT, tokenProgram = import_spl_token.TOKEN_2022_PROGRAM_ID) {
    return [
      await this.adminUpdateTokenIncentives(
        startTime,
        endTime,
        dayNumber,
        tokenSupplyPerDay,
        secondsInADay,
        mint,
        tokenProgram
      ),
      await this.pumpAmmAdminSdk.adminUpdateTokenIncentives(
        startTime,
        endTime,
        dayNumber,
        tokenSupplyPerDay,
        secondsInADay,
        mint,
        tokenProgram
      )
    ];
  }
  async claimTokenIncentives(user, payer) {
    const { mint } = await this.fetchGlobalVolumeAccumulator();
    if (mint.equals(import_web33.PublicKey.default)) {
      return [];
    }
    const [mintAccountInfo, userAccumulatorAccountInfo] = await this.connection.getMultipleAccountsInfo([
      mint,
      userVolumeAccumulatorPda(user)
    ]);
    if (!mintAccountInfo) {
      return [];
    }
    if (!userAccumulatorAccountInfo) {
      return [];
    }
    return [
      await this.offlinePumpProgram.methods.claimTokenIncentives().accountsPartial({
        user,
        payer,
        mint,
        tokenProgram: mintAccountInfo.owner
      }).instruction()
    ];
  }
  async claimTokenIncentivesBothPrograms(user, payer) {
    return [
      ...await this.claimTokenIncentives(user, payer),
      ...await this.pumpAmmSdk.claimTokenIncentives(user, payer)
    ];
  }
  async getTotalUnclaimedTokens(user) {
    const [
      globalVolumeAccumulatorAccountInfo,
      userVolumeAccumulatorAccountInfo
    ] = await this.connection.getMultipleAccountsInfo([
      GLOBAL_VOLUME_ACCUMULATOR_PDA,
      userVolumeAccumulatorPda(user)
    ]);
    if (!globalVolumeAccumulatorAccountInfo || !userVolumeAccumulatorAccountInfo) {
      return new import_bn5.default(0);
    }
    const globalVolumeAccumulator = PUMP_SDK.decodeGlobalVolumeAccumulator(
      globalVolumeAccumulatorAccountInfo
    );
    const userVolumeAccumulator = PUMP_SDK.decodeUserVolumeAccumulator(
      userVolumeAccumulatorAccountInfo
    );
    return totalUnclaimedTokens(globalVolumeAccumulator, userVolumeAccumulator);
  }
  async getTotalUnclaimedTokensBothPrograms(user) {
    return (await this.getTotalUnclaimedTokens(user)).add(
      await this.pumpAmmSdk.getTotalUnclaimedTokens(user)
    );
  }
  async getCurrentDayTokens(user) {
    const [
      globalVolumeAccumulatorAccountInfo,
      userVolumeAccumulatorAccountInfo
    ] = await this.connection.getMultipleAccountsInfo([
      GLOBAL_VOLUME_ACCUMULATOR_PDA,
      userVolumeAccumulatorPda(user)
    ]);
    if (!globalVolumeAccumulatorAccountInfo || !userVolumeAccumulatorAccountInfo) {
      return new import_bn5.default(0);
    }
    const globalVolumeAccumulator = PUMP_SDK.decodeGlobalVolumeAccumulator(
      globalVolumeAccumulatorAccountInfo
    );
    const userVolumeAccumulator = PUMP_SDK.decodeUserVolumeAccumulator(
      userVolumeAccumulatorAccountInfo
    );
    return currentDayTokens(globalVolumeAccumulator, userVolumeAccumulator);
  }
  async getCurrentDayTokensBothPrograms(user) {
    return (await this.getCurrentDayTokens(user)).add(
      await this.pumpAmmSdk.getCurrentDayTokens(user)
    );
  }
  async syncUserVolumeAccumulatorBothPrograms(user) {
    return [
      await PUMP_SDK.syncUserVolumeAccumulator(user),
      await import_pump_swap_sdk.PUMP_AMM_SDK.syncUserVolumeAccumulator(user)
    ];
  }
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
  async getMinimumDistributableFee(mint, simulationSigner = new import_web33.PublicKey(
    "UqN2p5bAzBqYdHXcgB6WLtuVrdvmy9JSAtgqZb3CMKw"
  )) {
    const sharingConfigPubkey = feeSharingConfigPda(mint);
    const poolAddress = canonicalPumpPoolPda(mint);
    const coinCreatorVaultAuthority = (0, import_pump_swap_sdk.coinCreatorVaultAuthorityPda)(sharingConfigPubkey);
    const ammVaultAta = (0, import_pump_swap_sdk.coinCreatorVaultAtaPda)(
      coinCreatorVaultAuthority,
      import_spl_token.NATIVE_MINT,
      import_spl_token.TOKEN_PROGRAM_ID
    );
    const [sharingConfigAccountInfo, poolAccountInfo, ammVaultAtaInfo] = await this.connection.getMultipleAccountsInfo([
      sharingConfigPubkey,
      poolAddress,
      ammVaultAta
    ]);
    if (!sharingConfigAccountInfo) {
      throw new Error(`Sharing config not found for mint: ${mint.toBase58()}`);
    }
    const sharingConfig = PUMP_SDK.decodeSharingConfig(
      sharingConfigAccountInfo
    );
    const instructions = [];
    const isGraduated = poolAccountInfo !== null;
    if (isGraduated && ammVaultAtaInfo) {
      const transferCreatorFeesToPumpIx = await this.pumpAmmProgram.methods.transferCreatorFeesToPump().accountsPartial({
        wsolMint: import_spl_token.NATIVE_MINT,
        tokenProgram: import_spl_token.TOKEN_PROGRAM_ID,
        coinCreator: sharingConfigPubkey
      }).instruction();
      instructions.push(transferCreatorFeesToPumpIx);
    }
    const getMinFeeIx = await PUMP_SDK.getMinimumDistributableFee({
      mint,
      sharingConfig,
      sharingConfigAddress: sharingConfigPubkey
    });
    instructions.push(getMinFeeIx);
    const { blockhash } = await this.connection.getLatestBlockhash();
    const tx = new import_web33.VersionedTransaction(
      new import_web33.TransactionMessage({
        payerKey: simulationSigner,
        recentBlockhash: blockhash,
        instructions
      }).compileToV0Message()
    );
    const result = await this.connection.simulateTransaction(tx);
    let minimumDistributableFee = {
      minimumRequired: new import_bn5.default(0),
      distributableFees: new import_bn5.default(0),
      canDistribute: false
    };
    if (!result.value.err) {
      const [data, encoding] = result.value.returnData?.data ?? [];
      if (data) {
        const buffer = Buffer.from(data, encoding);
        minimumDistributableFee = PUMP_SDK.decodeMinimumDistributableFee(buffer);
      }
    }
    return {
      ...minimumDistributableFee,
      isGraduated
    };
  }
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
  async buildDistributeCreatorFeesInstructions(mint) {
    const sharingConfigPubkey = feeSharingConfigPda(mint);
    const poolAddress = canonicalPumpPoolPda(mint);
    const coinCreatorVaultAuthority = (0, import_pump_swap_sdk.coinCreatorVaultAuthorityPda)(sharingConfigPubkey);
    const ammVaultAta = (0, import_pump_swap_sdk.coinCreatorVaultAtaPda)(
      coinCreatorVaultAuthority,
      import_spl_token.NATIVE_MINT,
      import_spl_token.TOKEN_PROGRAM_ID
    );
    const [sharingConfigAccountInfo, poolAccountInfo, ammVaultAtaInfo] = await this.connection.getMultipleAccountsInfo([
      sharingConfigPubkey,
      poolAddress,
      ammVaultAta
    ]);
    if (!sharingConfigAccountInfo) {
      throw new Error(`Sharing config not found for mint: ${mint.toBase58()}`);
    }
    const sharingConfig = PUMP_SDK.decodeSharingConfig(
      sharingConfigAccountInfo
    );
    const instructions = [];
    const isGraduated = poolAccountInfo !== null;
    if (isGraduated && ammVaultAtaInfo) {
      const transferCreatorFeesToPumpIx = await this.pumpAmmProgram.methods.transferCreatorFeesToPump().accountsPartial({
        wsolMint: import_spl_token.NATIVE_MINT,
        tokenProgram: import_spl_token.TOKEN_PROGRAM_ID,
        coinCreator: sharingConfigPubkey
      }).instruction();
      instructions.push(transferCreatorFeesToPumpIx);
    }
    const distributeCreatorFeesIx = await PUMP_SDK.distributeCreatorFees({
      mint,
      sharingConfig,
      sharingConfigAddress: sharingConfigPubkey
    });
    instructions.push(distributeCreatorFeesIx);
    return {
      instructions,
      isGraduated
    };
  }
  // ── Analytics & Convenience ───────────────────────────────────────────
  /**
   * Fetch bonding curve state, global, and fee config, then return a full
   * summary including market cap, graduation progress, and token price.
   *
   * @param mint - The token mint address
   * @returns Comprehensive bonding curve summary
   */
  async fetchBondingCurveSummary(mint) {
    const mintPk = new import_web33.PublicKey(mint);
    const [global, feeConfig, bondingCurve] = await Promise.all([
      this.fetchGlobal(),
      this.fetchFeeConfig(),
      this.fetchBondingCurve(mintPk)
    ]);
    return getBondingCurveSummary({
      global,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve
    });
  }
  /**
   * Fetch graduation progress for a token — how close it is to moving to AMM.
   *
   * @param mint - The token mint address
   * @returns Graduation progress details (0-10000 bps)
   */
  async fetchGraduationProgress(mint) {
    const [global, bondingCurve] = await Promise.all([
      this.fetchGlobal(),
      this.fetchBondingCurve(mint)
    ]);
    return getGraduationProgress(global, bondingCurve);
  }
  /**
   * Fetch current token price (cost to buy/sell 1 whole token).
   *
   * @param mint - The token mint address
   * @returns Buy and sell price per token in lamports, plus market cap
   */
  async fetchTokenPrice(mint) {
    const mintPk = new import_web33.PublicKey(mint);
    const [global, feeConfig, bondingCurve] = await Promise.all([
      this.fetchGlobal(),
      this.fetchFeeConfig(),
      this.fetchBondingCurve(mintPk)
    ]);
    return getTokenPrice({
      global,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve
    });
  }
  /**
   * Calculate price impact for a buy trade on a specific token.
   *
   * @param mint - Token mint address
   * @param solAmount - SOL to spend in lamports
   * @returns Price impact details including before/after prices and impact in bps
   */
  async fetchBuyPriceImpact(mint, solAmount) {
    const mintPk = new import_web33.PublicKey(mint);
    const [global, feeConfig, bondingCurve] = await Promise.all([
      this.fetchGlobal(),
      this.fetchFeeConfig(),
      this.fetchBondingCurve(mintPk)
    ]);
    return calculateBuyPriceImpact({
      global,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve,
      solAmount
    });
  }
  /**
   * Calculate price impact for a sell trade on a specific token.
   *
   * @param mint - Token mint address
   * @param tokenAmount - Token amount to sell (raw units)
   * @returns Price impact details including before/after prices and impact in bps
   */
  async fetchSellPriceImpact(mint, tokenAmount) {
    const mintPk = new import_web33.PublicKey(mint);
    const [global, feeConfig, bondingCurve] = await Promise.all([
      this.fetchGlobal(),
      this.fetchFeeConfig(),
      this.fetchBondingCurve(mintPk)
    ]);
    return calculateSellPriceImpact({
      global,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve,
      tokenAmount
    });
  }
  /**
   * Build instructions to sell a user's entire token balance and close the ATA
   * to reclaim rent.
   *
   * @param mint - Token mint address
   * @param user - User wallet public key
   * @param slippage - Slippage tolerance in percent (default: 1%)
   * @param tokenProgram - Token program (default: TOKEN_PROGRAM_ID)
   * @returns Sell + close ATA instructions, or empty array if user has no balance
   */
  async sellAllInstructions({
    mint,
    user,
    slippage = 1,
    tokenProgram = import_spl_token.TOKEN_PROGRAM_ID
  }) {
    const associatedUser = (0, import_spl_token.getAssociatedTokenAddressSync)(
      mint,
      user,
      true,
      tokenProgram
    );
    const [bondingCurveAccountInfo, accountInfo, globalState] = await Promise.all([
      this.connection.getAccountInfo(bondingCurvePda(mint)),
      this.connection.getAccountInfo(associatedUser),
      this.fetchGlobal()
    ]);
    if (!bondingCurveAccountInfo) {
      throw new Error(
        `Bonding curve account not found for mint: ${mint.toBase58()}`
      );
    }
    if (!accountInfo) {
      return [];
    }
    const amount = new import_bn5.default(accountInfo.data.subarray(64, 72), "le");
    if (amount.isZero()) {
      return [
        (0, import_spl_token.createCloseAccountInstruction)(
          associatedUser,
          user,
          user,
          [],
          tokenProgram
        )
      ];
    }
    const bondingCurve = PUMP_SDK.decodeBondingCurve(bondingCurveAccountInfo);
    const feeConfig = await this.fetchFeeConfig();
    const solAmount = (await Promise.resolve().then(() => (init_bondingCurve(), bondingCurve_exports))).getSellSolAmountFromTokenAmount({
      global: globalState,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve,
      amount
    });
    const sellIxs = await PUMP_SDK.sellInstructions({
      global: globalState,
      bondingCurveAccountInfo,
      bondingCurve,
      mint,
      user,
      amount,
      solAmount,
      slippage,
      tokenProgram,
      mayhemMode: bondingCurve.isMayhemMode
    });
    sellIxs.push(
      (0, import_spl_token.createCloseAccountInstruction)(
        associatedUser,
        user,
        user,
        [],
        tokenProgram
      )
    );
    return sellIxs;
  }
  /**
   * Check if a token has graduated to the AMM by checking if its
   * canonical pool account exists on-chain.
   *
   * @param mint - Token mint address
   * @returns true if the token has a live AMM pool
   */
  async isGraduated(mint) {
    const poolAddress = canonicalPumpPoolPda(new import_web33.PublicKey(mint));
    const accountInfo = await this.connection.getAccountInfo(poolAddress);
    return accountInfo !== null;
  }
  /**
   * Get a user's token balance for a specific mint.
   *
   * @param mint - Token mint address
   * @param user - User wallet public key
   * @param tokenProgram - Token program (default: TOKEN_PROGRAM_ID)
   * @returns Token balance in raw units, or BN(0) if no account exists
   */
  async getTokenBalance(mint, user, tokenProgram = import_spl_token.TOKEN_PROGRAM_ID) {
    const ata = (0, import_spl_token.getAssociatedTokenAddressSync)(mint, user, true, tokenProgram);
    const accountInfo = await this.connection.getAccountInfo(ata);
    if (!accountInfo) return new import_bn5.default(0);
    return new import_bn5.default(accountInfo.data.subarray(64, 72), "le");
  }
};

// src/sdk.ts
function getPumpProgram(connection) {
  return new import_anchor.Program(
    pump_default,
    new import_anchor.AnchorProvider(connection, null, {})
  );
}
var PUMP_PROGRAM_ID = new import_web34.PublicKey(
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
);
function getPumpAmmProgram(connection) {
  return new import_anchor.Program(
    pump_amm_default,
    new import_anchor.AnchorProvider(connection, null, {})
  );
}
function getPumpFeeProgram(connection) {
  return new import_anchor.Program(
    pump_fees_default,
    new import_anchor.AnchorProvider(connection, null, {})
  );
}
var PUMP_AMM_PROGRAM_ID = new import_web34.PublicKey(
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"
);
var MAYHEM_PROGRAM_ID = new import_web34.PublicKey(
  "MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e"
);
var PUMP_FEE_PROGRAM_ID = new import_web34.PublicKey(
  "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ"
);
var BONDING_CURVE_NEW_SIZE = 151;
var PUMP_TOKEN_MINT = new import_web34.PublicKey(
  "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn"
);
var MAX_SHAREHOLDERS = 10;
var PumpSdk = class {
  constructor() {
    this.offlinePumpProgram = OFFLINE_PUMP_PROGRAM;
    this.offlinePumpFeeProgram = new import_anchor.Program(
      pump_fees_default,
      new import_anchor.AnchorProvider(null, null, {})
    );
    this.offlinePumpAmmProgram = new import_anchor.Program(
      pump_amm_default,
      new import_anchor.AnchorProvider(null, null, {})
    );
  }
  decodeGlobal(accountInfo) {
    return this.offlinePumpProgram.coder.accounts.decode(
      "global",
      accountInfo.data
    );
  }
  decodeFeeConfig(accountInfo) {
    return this.offlinePumpProgram.coder.accounts.decode(
      "feeConfig",
      accountInfo.data
    );
  }
  decodeBondingCurve(accountInfo) {
    return this.offlinePumpProgram.coder.accounts.decode(
      "bondingCurve",
      accountInfo.data
    );
  }
  decodeBondingCurveNullable(accountInfo) {
    try {
      const data = accountInfo.data;
      if (data.length < 82) {
        const padded = Buffer.alloc(82);
        data.copy(padded);
        accountInfo = {
          ...accountInfo,
          data: padded
        };
      }
      return this.decodeBondingCurve(accountInfo);
    } catch (error) {
      console.warn("Failed to decode bonding curve", error);
      return null;
    }
  }
  decodeGlobalVolumeAccumulator(accountInfo) {
    return this.offlinePumpProgram.coder.accounts.decode(
      "globalVolumeAccumulator",
      accountInfo.data
    );
  }
  decodeUserVolumeAccumulator(accountInfo) {
    return this.offlinePumpProgram.coder.accounts.decode(
      "userVolumeAccumulator",
      accountInfo.data
    );
  }
  decodeUserVolumeAccumulatorNullable(accountInfo) {
    try {
      return this.decodeUserVolumeAccumulator(accountInfo);
    } catch (error) {
      console.warn("Failed to decode user volume accumulator", error);
      return null;
    }
  }
  decodeSharingConfig(accountInfo) {
    return this.offlinePumpFeeProgram.coder.accounts.decode(
      "sharingConfig",
      accountInfo.data
    );
  }
  /**
   * @deprecated Use `createInstructionV2` instead.
   */
  async createInstruction({
    mint,
    name,
    symbol,
    uri,
    creator,
    user
  }) {
    return await this.offlinePumpProgram.methods.create(name, symbol, uri, creator).accountsPartial({
      mint,
      user,
      tokenProgram: import_spl_token2.TOKEN_PROGRAM_ID
    }).instruction();
  }
  async createV2Instruction({
    mint,
    name,
    symbol,
    uri,
    creator,
    user,
    mayhemMode,
    cashback = false
  }) {
    return await this.offlinePumpProgram.methods.createV2(name, symbol, uri, creator, mayhemMode, [cashback ?? false]).accountsPartial({
      mint,
      user,
      tokenProgram: import_spl_token2.TOKEN_2022_PROGRAM_ID,
      mayhemProgramId: MAYHEM_PROGRAM_ID,
      globalParams: getGlobalParamsPda(),
      solVault: getSolVaultPda(),
      mayhemState: getMayhemStatePda(mint),
      mayhemTokenVault: getTokenVaultPda(mint)
    }).instruction();
  }
  async buyInstructions({
    global,
    bondingCurveAccountInfo,
    bondingCurve,
    associatedUserAccountInfo,
    mint,
    user,
    amount,
    solAmount,
    slippage,
    tokenProgram = import_spl_token2.TOKEN_PROGRAM_ID
  }) {
    const instructions = [];
    if (bondingCurveAccountInfo.data.length < BONDING_CURVE_NEW_SIZE) {
      instructions.push(
        await this.extendAccountInstruction({
          account: bondingCurvePda(mint),
          user
        })
      );
    }
    const associatedUser = (0, import_spl_token2.getAssociatedTokenAddressSync)(
      mint,
      user,
      true,
      tokenProgram
    );
    if (!associatedUserAccountInfo) {
      instructions.push(
        (0, import_spl_token2.createAssociatedTokenAccountIdempotentInstruction)(
          user,
          associatedUser,
          user,
          mint,
          tokenProgram
        )
      );
    }
    instructions.push(
      await this.buyInstruction({
        global,
        mint,
        creator: bondingCurve.creator,
        user,
        associatedUser,
        amount,
        solAmount,
        slippage,
        tokenProgram,
        mayhemMode: bondingCurve.isMayhemMode
      })
    );
    return instructions;
  }
  async createV2AndBuyInstructions({
    global,
    mint,
    name,
    symbol,
    uri,
    creator,
    user,
    amount,
    solAmount,
    mayhemMode,
    cashback = false
  }) {
    const associatedUser = (0, import_spl_token2.getAssociatedTokenAddressSync)(
      mint,
      user,
      true,
      import_spl_token2.TOKEN_2022_PROGRAM_ID
    );
    return [
      await this.createV2Instruction({
        mint,
        name,
        symbol,
        uri,
        creator,
        user,
        mayhemMode,
        cashback
      }),
      await this.extendAccountInstruction({
        account: bondingCurvePda(mint),
        user
      }),
      (0, import_spl_token2.createAssociatedTokenAccountIdempotentInstruction)(
        user,
        associatedUser,
        user,
        mint,
        import_spl_token2.TOKEN_2022_PROGRAM_ID
      ),
      await this.buyInstruction({
        global,
        mint,
        creator,
        user,
        associatedUser,
        amount,
        solAmount,
        slippage: 1,
        tokenProgram: import_spl_token2.TOKEN_2022_PROGRAM_ID,
        mayhemMode
      })
    ];
  }
  /**
   * @deprecated Use `createV2AndBuyInstructions` instead.
   */
  async createAndBuyInstructions({
    global,
    mint,
    name,
    symbol,
    uri,
    creator,
    user,
    amount,
    solAmount
  }) {
    const associatedUser = (0, import_spl_token2.getAssociatedTokenAddressSync)(mint, user, true);
    return [
      await this.createInstruction({ mint, name, symbol, uri, creator, user }),
      await this.extendAccountInstruction({
        account: bondingCurvePda(mint),
        user
      }),
      (0, import_spl_token2.createAssociatedTokenAccountIdempotentInstruction)(
        user,
        associatedUser,
        user,
        mint
      ),
      await this.buyInstruction({
        global,
        mint,
        creator,
        user,
        associatedUser,
        amount,
        solAmount,
        slippage: 1,
        tokenProgram: import_spl_token2.TOKEN_PROGRAM_ID,
        mayhemMode: false
      })
    ];
  }
  async buyInstruction({
    global,
    mint,
    creator,
    user,
    associatedUser,
    amount,
    solAmount,
    slippage,
    tokenProgram = import_spl_token2.TOKEN_PROGRAM_ID,
    mayhemMode = false
  }) {
    return await this.getBuyInstructionInternal({
      user,
      associatedUser,
      mint,
      creator,
      feeRecipient: getFeeRecipient(global, mayhemMode),
      amount,
      solAmount: solAmount.add(
        solAmount.mul(new import_bn6.default(Math.floor(slippage * 10))).div(new import_bn6.default(1e3))
      ),
      tokenProgram
    });
  }
  async sellInstructions({
    global,
    bondingCurveAccountInfo,
    bondingCurve,
    mint,
    user,
    amount,
    solAmount,
    slippage,
    tokenProgram = import_spl_token2.TOKEN_PROGRAM_ID,
    mayhemMode = false,
    cashback = false
  }) {
    const instructions = [];
    if (bondingCurveAccountInfo.data.length < BONDING_CURVE_NEW_SIZE) {
      instructions.push(
        await this.extendAccountInstruction({
          account: bondingCurvePda(mint),
          user
        })
      );
    }
    instructions.push(
      await this.getSellInstructionInternal({
        user,
        mint,
        creator: bondingCurve.creator,
        feeRecipient: getFeeRecipient(global, mayhemMode),
        amount,
        solAmount: solAmount.sub(
          solAmount.mul(new import_bn6.default(Math.floor(slippage * 10))).div(new import_bn6.default(1e3))
        ),
        tokenProgram,
        cashback
      })
    );
    return instructions;
  }
  async extendAccountInstruction({
    account,
    user
  }) {
    return this.offlinePumpProgram.methods.extendAccount().accountsPartial({
      account,
      user
    }).instruction();
  }
  async migrateInstruction({
    withdrawAuthority,
    mint,
    user,
    tokenProgram = import_spl_token2.TOKEN_PROGRAM_ID
  }) {
    const bondingCurve = bondingCurvePda(mint);
    const associatedBondingCurve = (0, import_spl_token2.getAssociatedTokenAddressSync)(
      mint,
      bondingCurve,
      true,
      tokenProgram
    );
    const poolAuthority = pumpPoolAuthorityPda(mint);
    const poolAuthorityMintAccount = (0, import_spl_token2.getAssociatedTokenAddressSync)(
      mint,
      poolAuthority,
      true,
      tokenProgram
    );
    const pool = canonicalPumpPoolPda(mint);
    const poolBaseTokenAccount = (0, import_spl_token2.getAssociatedTokenAddressSync)(
      mint,
      pool,
      true,
      tokenProgram
    );
    return this.offlinePumpProgram.methods.migrate().accountsPartial({
      mint,
      user,
      withdrawAuthority,
      associatedBondingCurve,
      poolAuthorityMintAccount,
      poolBaseTokenAccount
    }).instruction();
  }
  async syncUserVolumeAccumulator(user) {
    return await this.offlinePumpProgram.methods.syncUserVolumeAccumulator().accountsPartial({ user }).instruction();
  }
  async setCreator({
    mint,
    setCreatorAuthority,
    creator
  }) {
    return await this.offlinePumpProgram.methods.setCreator(creator).accountsPartial({
      mint,
      setCreatorAuthority
    }).instruction();
  }
  async initUserVolumeAccumulator({
    payer,
    user
  }) {
    return await this.offlinePumpProgram.methods.initUserVolumeAccumulator().accountsPartial({ payer, user }).instruction();
  }
  async closeUserVolumeAccumulator(user) {
    return await this.offlinePumpProgram.methods.closeUserVolumeAccumulator().accountsPartial({ user }).instruction();
  }
  async getBuyInstructionRaw({
    user,
    mint,
    creator,
    amount,
    solAmount,
    feeRecipient = getStaticRandomFeeRecipient(),
    tokenProgram = import_spl_token2.TOKEN_PROGRAM_ID
  }) {
    return await this.getBuyInstructionInternal({
      user,
      associatedUser: (0, import_spl_token2.getAssociatedTokenAddressSync)(
        mint,
        user,
        true,
        tokenProgram
      ),
      mint,
      creator,
      feeRecipient,
      amount,
      solAmount
    });
  }
  async getBuyInstructionInternal({
    user,
    associatedUser,
    mint,
    creator,
    feeRecipient,
    amount,
    solAmount,
    tokenProgram = import_spl_token2.TOKEN_PROGRAM_ID
  }) {
    return await this.offlinePumpProgram.methods.buy(amount, solAmount, { 0: true }).accountsPartial({
      feeRecipient,
      mint,
      associatedUser,
      user,
      creatorVault: creatorVaultPda(creator),
      tokenProgram
    }).instruction();
  }
  async getSellInstructionRaw({
    user,
    mint,
    creator,
    amount,
    solAmount,
    feeRecipient = getStaticRandomFeeRecipient(),
    tokenProgram = import_spl_token2.TOKEN_PROGRAM_ID,
    cashback = false
  }) {
    return await this.getSellInstructionInternal({
      user,
      mint,
      creator,
      feeRecipient,
      amount,
      solAmount,
      tokenProgram,
      cashback
    });
  }
  async getSellInstructionInternal({
    user,
    mint,
    creator,
    feeRecipient,
    amount,
    solAmount,
    tokenProgram,
    cashback = false
  }) {
    const userVolumeAccumulator = userVolumeAccumulatorPda(user);
    return await this.offlinePumpProgram.methods.sell(amount, solAmount).accountsPartial({
      feeRecipient,
      mint,
      associatedUser: (0, import_spl_token2.getAssociatedTokenAddressSync)(
        mint,
        user,
        true,
        tokenProgram
      ),
      user,
      creatorVault: creatorVaultPda(creator),
      tokenProgram
    }).remainingAccounts(
      cashback ? [
        {
          pubkey: userVolumeAccumulator,
          isWritable: true,
          isSigner: false
        }
      ] : []
    ).instruction();
  }
  /**
   * Creates a fee sharing configuration for a token.
   *
   * @param params - Parameters for creating a fee sharing configuration
   * @param params.creator - The creator of the token
   * @param params.mint - The mint address of the token
   * @param params.pool - The pool address of the token (null for ungraduated coins)
   */
  async createFeeSharingConfig({
    creator,
    mint,
    pool
  }) {
    return await this.offlinePumpFeeProgram.methods.createFeeSharingConfig().accountsPartial({
      payer: creator,
      mint,
      pool
    }).instruction();
  }
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
  async updateFeeShares({
    authority,
    mint,
    currentShareholders,
    newShareholders
  }) {
    if (newShareholders.length === 0) {
      throw new NoShareholdersError();
    }
    if (newShareholders.length > MAX_SHAREHOLDERS) {
      throw new TooManyShareholdersError(
        newShareholders.length,
        MAX_SHAREHOLDERS
      );
    }
    let totalShares = 0;
    const addresses = /* @__PURE__ */ new Set();
    for (const shareholder of newShareholders) {
      if (shareholder.shareBps <= 0) {
        throw new ZeroShareError(shareholder.address.toString());
      }
      totalShares += shareholder.shareBps;
      addresses.add(shareholder.address.toString());
    }
    if (totalShares !== 1e4) {
      throw new InvalidShareTotalError(totalShares);
    }
    if (addresses.size !== newShareholders.length) {
      throw new DuplicateShareholderError();
    }
    const sharingConfigPda = feeSharingConfigPda(mint);
    const coinCreatorVaultAuthority = (0, import_pump_swap_sdk2.coinCreatorVaultAuthorityPda)(sharingConfigPda);
    return await this.offlinePumpFeeProgram.methods.updateFeeShares(
      newShareholders.map((sh) => ({
        address: sh.address,
        shareBps: sh.shareBps
      }))
    ).accountsPartial({
      authority,
      mint,
      coinCreatorVaultAta: (0, import_pump_swap_sdk2.coinCreatorVaultAtaPda)(
        coinCreatorVaultAuthority,
        import_spl_token2.NATIVE_MINT,
        import_spl_token2.TOKEN_PROGRAM_ID
      )
    }).remainingAccounts(
      currentShareholders.map((pubkey) => ({
        pubkey,
        isWritable: true,
        isSigner: false
      }))
    ).instruction();
  }
  decodeDistributeCreatorFeesEvent(data) {
    return this.offlinePumpProgram.coder.types.decode(
      "distributeCreatorFeesEvent",
      data
    );
  }
  async distributeCreatorFees({
    mint,
    sharingConfig,
    sharingConfigAddress
  }) {
    return await this.offlinePumpProgram.methods.distributeCreatorFees().accountsPartial({
      mint,
      creatorVault: creatorVaultPda(sharingConfigAddress)
    }).remainingAccounts(
      sharingConfig.shareholders.map((shareholder) => ({
        pubkey: shareholder.address,
        isWritable: true,
        isSigner: false
      }))
    ).instruction();
  }
  decodeMinimumDistributableFee(data) {
    return this.offlinePumpProgram.coder.types.decode(
      "minimumDistributableFeeEvent",
      data
    );
  }
  async getMinimumDistributableFee({
    mint,
    sharingConfig,
    sharingConfigAddress
  }) {
    return await this.offlinePumpProgram.methods.getMinimumDistributableFee().accountsPartial({
      mint,
      creatorVault: creatorVaultPda(sharingConfigAddress)
    }).remainingAccounts(
      sharingConfig.shareholders.map((shareholder) => ({
        pubkey: shareholder.address,
        isWritable: true,
        isSigner: false
      }))
    ).instruction();
  }
  async claimCashbackInstruction({
    user
  }) {
    return await this.offlinePumpProgram.methods.claimCashback().accountsPartial({
      user
    }).instruction();
  }
};
var PUMP_SDK = new PumpSdk();
function isCreatorUsingSharingConfig({
  mint,
  creator
}) {
  return feeSharingConfigPda(mint).equals(creator);
}

// src/pda.ts
var GLOBAL_PDA = (0, import_pump_swap_sdk3.pumpPda)([import_buffer.Buffer.from("global")]);
var AMM_GLOBAL_PDA = (0, import_pump_swap_sdk3.pumpAmmPda)([import_buffer.Buffer.from("amm_global")]);
var PUMP_FEE_CONFIG_PDA = (0, import_pump_swap_sdk3.pumpFeePda)([
  import_buffer.Buffer.from("fee_config"),
  PUMP_PROGRAM_ID.toBuffer()
]);
var GLOBAL_VOLUME_ACCUMULATOR_PDA = (0, import_pump_swap_sdk3.pumpPda)([
  import_buffer.Buffer.from("global_volume_accumulator")
]);
var AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA = (0, import_pump_swap_sdk3.pumpAmmPda)([
  import_buffer.Buffer.from("global_volume_accumulator")
]);
var PUMP_EVENT_AUTHORITY_PDA = getEventAuthorityPda(PUMP_PROGRAM_ID);
var PUMP_AMM_EVENT_AUTHORITY_PDA = getEventAuthorityPda(PUMP_AMM_PROGRAM_ID);
var PUMP_FEE_EVENT_AUTHORITY_PDA = getEventAuthorityPda(PUMP_FEE_PROGRAM_ID);
function getEventAuthorityPda(programId) {
  return import_web35.PublicKey.findProgramAddressSync(
    [import_buffer.Buffer.from("__event_authority")],
    programId
  )[0];
}
function bondingCurvePda(mint) {
  return (0, import_pump_swap_sdk3.pumpPda)([
    import_buffer.Buffer.from("bonding-curve"),
    new import_web35.PublicKey(mint).toBuffer()
  ]);
}
function creatorVaultPda(creator) {
  return (0, import_pump_swap_sdk3.pumpPda)([import_buffer.Buffer.from("creator-vault"), creator.toBuffer()]);
}
function pumpPoolAuthorityPda(mint) {
  return (0, import_pump_swap_sdk3.pumpPda)([import_buffer.Buffer.from("pool-authority"), mint.toBuffer()]);
}
var CANONICAL_POOL_INDEX = 0;
function canonicalPumpPoolPda(mint) {
  return (0, import_pump_swap_sdk3.poolPda)(
    CANONICAL_POOL_INDEX,
    pumpPoolAuthorityPda(mint),
    mint,
    import_spl_token3.NATIVE_MINT
  );
}
function userVolumeAccumulatorPda(user) {
  return (0, import_pump_swap_sdk3.pumpPda)([import_buffer.Buffer.from("user_volume_accumulator"), user.toBuffer()]);
}
var getGlobalParamsPda = () => {
  return import_web35.PublicKey.findProgramAddressSync(
    [import_buffer.Buffer.from("global-params")],
    MAYHEM_PROGRAM_ID
  )[0];
};
var getMayhemStatePda = (mint) => {
  return import_web35.PublicKey.findProgramAddressSync(
    [import_buffer.Buffer.from("mayhem-state"), mint.toBuffer()],
    MAYHEM_PROGRAM_ID
  )[0];
};
var getSolVaultPda = () => {
  return import_web35.PublicKey.findProgramAddressSync(
    [import_buffer.Buffer.from("sol-vault")],
    MAYHEM_PROGRAM_ID
  )[0];
};
var getTokenVaultPda = (mintPubkey) => {
  return (0, import_spl_token3.getAssociatedTokenAddressSync)(
    mintPubkey,
    getSolVaultPda(),
    true,
    import_spl_token3.TOKEN_2022_PROGRAM_ID
  );
};
var feeSharingConfigPda = (mint) => {
  return (0, import_pump_swap_sdk3.pumpFeePda)([import_buffer.Buffer.from("sharing-config"), mint.toBuffer()]);
};
var ammCreatorVaultPda = (creator) => {
  return import_web35.PublicKey.findProgramAddressSync(
    [import_buffer.Buffer.from("creator_vault"), creator.toBuffer()],
    PUMP_AMM_PROGRAM_ID
  )[0];
};

// src/index.ts
init_fees();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AMM_GLOBAL_PDA,
  AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA,
  BONDING_CURVE_NEW_SIZE,
  CANONICAL_POOL_INDEX,
  DuplicateShareholderError,
  GLOBAL_PDA,
  GLOBAL_VOLUME_ACCUMULATOR_PDA,
  InvalidShareTotalError,
  MAX_SHAREHOLDERS,
  MAYHEM_PROGRAM_ID,
  NoShareholdersError,
  OnlinePumpSdk,
  PUMP_AMM_EVENT_AUTHORITY_PDA,
  PUMP_AMM_PROGRAM_ID,
  PUMP_EVENT_AUTHORITY_PDA,
  PUMP_FEE_CONFIG_PDA,
  PUMP_FEE_EVENT_AUTHORITY_PDA,
  PUMP_FEE_PROGRAM_ID,
  PUMP_PROGRAM_ID,
  PUMP_SDK,
  PUMP_TOKEN_MINT,
  PoolRequiredForGraduatedError,
  PumpSdk,
  ShareCalculationOverflowError,
  TooManyShareholdersError,
  ZeroShareError,
  ammCreatorVaultPda,
  bondingCurveMarketCap,
  bondingCurvePda,
  calculateBuyPriceImpact,
  calculateFeeTier,
  calculateSellPriceImpact,
  canonicalPumpPoolPda,
  computeFeesBps,
  creatorVaultPda,
  currentDayTokens,
  feeSharingConfigPda,
  getBondingCurveSummary,
  getBuySolAmountFromTokenAmount,
  getBuyTokenAmountFromSolAmount,
  getEventAuthorityPda,
  getFee,
  getGlobalParamsPda,
  getGraduationProgress,
  getMayhemStatePda,
  getPumpAmmProgram,
  getPumpFeeProgram,
  getPumpProgram,
  getSellSolAmountFromTokenAmount,
  getSolVaultPda,
  getTokenPrice,
  getTokenVaultPda,
  isCreatorUsingSharingConfig,
  newBondingCurve,
  pumpIdl,
  pumpPoolAuthorityPda,
  totalUnclaimedTokens,
  userVolumeAccumulatorPda
});
//# sourceMappingURL=index.js.map