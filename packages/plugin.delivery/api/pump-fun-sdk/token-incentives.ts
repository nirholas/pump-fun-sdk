export const config = { runtime: 'edge' };

const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

/**
 * PUMP Token Incentives
 *
 * Daily allocation decays over 4 years:
 * - Year 1: ~4,109,589 PUMP/day
 * - Year 2: ~2,739,726 PUMP/day
 * - Year 3: ~1,369,863 PUMP/day
 * - Year 4: ~684,931 PUMP/day
 *
 * Users earn PUMP proportional to their SOL trading volume relative to global volume.
 */

// PUMP token has 6 decimals
const PUMP_DECIMALS = 6;

// Total PUMP allocation = 3.25B over 4 years
const TOTAL_PUMP_INCENTIVES = 3_250_000_000;

// Daily allocations by year (in whole PUMP tokens)
const DAILY_ALLOCATIONS = [
  { year: 1, dailyTokens: 4_109_589, totalTokens: 1_500_000_000 },
  { year: 2, dailyTokens: 2_739_726, totalTokens: 1_000_000_000 },
  { year: 3, dailyTokens: 1_369_863, totalTokens: 500_000_000 },
  { year: 4, dailyTokens: 684_931, totalTokens: 250_000_000 },
];

// Incentive program start date (approximate)
const PROGRAM_START = new Date('2025-04-16T00:00:00Z');

function getCurrentDayInfo() {
  const now = new Date();
  const daysSinceStart = Math.floor(
    (now.getTime() - PROGRAM_START.getTime()) / (1000 * 60 * 60 * 24),
  );

  let year = 1;
  let dayInYear = daysSinceStart;
  if (dayInYear >= 365 * 3) {
    year = 4;
    dayInYear -= 365 * 3;
  } else if (dayInYear >= 365 * 2) {
    year = 3;
    dayInYear -= 365 * 2;
  } else if (dayInYear >= 365) {
    year = 2;
    dayInYear -= 365;
  }

  const allocation = DAILY_ALLOCATIONS[year - 1] || DAILY_ALLOCATIONS[3];

  return {
    daysSinceStart,
    currentYear: year,
    dayInYear,
    dailyAllocationTokens: allocation.dailyTokens,
    dailyAllocationRaw: BigInt(allocation.dailyTokens) * BigInt(10 ** PUMP_DECIMALS),
    yearlyTotal: allocation.totalTokens,
    programActive: daysSinceStart >= 0 && daysSinceStart < 365 * 4,
  };
}

async function rpcCall(method: string, params: any[]) {
  const response = await fetch(SOLANA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await response.json() as any;
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { wallet } = body;

    const dayInfo = getCurrentDayInfo();

    const result: Record<string, any> = {
      programStartDate: PROGRAM_START.toISOString(),
      totalPumpIncentives: TOTAL_PUMP_INCENTIVES.toLocaleString(),
      currentDay: dayInfo.daysSinceStart,
      currentYear: dayInfo.currentYear,
      dayInYear: dayInfo.dayInYear,
      programActive: dayInfo.programActive,
      todayAllocation: {
        pumpTokens: dayInfo.dailyAllocationTokens.toLocaleString(),
        rawUnits: dayInfo.dailyAllocationRaw.toString(),
      },
      yearlyAllocation: {
        year: dayInfo.currentYear,
        totalPumpTokens: dayInfo.yearlyTotal.toLocaleString(),
      },
      allYears: DAILY_ALLOCATIONS.map((a) => ({
        year: a.year,
        dailyPumpTokens: a.dailyTokens.toLocaleString(),
        yearlyTotalPumpTokens: a.totalTokens.toLocaleString(),
      })),
    };

    // If wallet provided, try to fetch user volume accumulator
    if (wallet && typeof wallet === 'string') {
      try {
        // Fetch user volume accumulator account via getProgramAccounts
        // The UserVolumeAccumulator PDA seeds: ["user-volume-accumulator", user_pubkey]
        const userAccounts = await rpcCall('getProgramAccounts', [
          PUMP_PROGRAM_ID,
          {
            encoding: 'base64',
            filters: [
              { dataSize: 57 }, // UserVolumeAccumulator size: 8 discriminator + 8 + 8 + 8 + 8 + 8 + 1 + 8
              { memcmp: { offset: 8, bytes: wallet, encoding: 'base58' } },
            ],
          },
        ]);

        if (userAccounts && userAccounts.length > 0) {
          const rawData = Uint8Array.from(
            atob(userAccounts[0].account.data[0]),
            (c) => c.charCodeAt(0),
          );
          const view = new DataView(rawData.buffer, rawData.byteOffset);
          const readU64 = (offset: number): bigint => {
            const lo = BigInt(view.getUint32(offset, true));
            const hi = BigInt(view.getUint32(offset + 4, true));
            return (hi << 32n) | lo;
          };

          // Parse user volume accumulator fields
          const totalUnclaimedTokens = readU64(8);
          const totalClaimedTokens = readU64(16);
          const currentSolVolume = readU64(24);

          result.userStats = {
            wallet,
            totalUnclaimedPump: (Number(totalUnclaimedTokens) / 1e6).toFixed(6),
            totalUnclaimedRaw: totalUnclaimedTokens.toString(),
            totalClaimedPump: (Number(totalClaimedTokens) / 1e6).toFixed(6),
            totalClaimedRaw: totalClaimedTokens.toString(),
            currentSolVolumeLamports: currentSolVolume.toString(),
            currentSolVolumeSol: (Number(currentSolVolume) / 1e9).toFixed(9),
          };
        } else {
          result.userStats = {
            wallet,
            message: 'No volume accumulator found — user has not traded on Pump.fun or has no unclaimed rewards',
            totalUnclaimedPump: '0',
            totalClaimedPump: '0',
            currentSolVolumeSol: '0',
          };
        }
      } catch {
        result.userStats = {
          wallet,
          error: 'Failed to fetch user volume data from RPC',
        };
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch token incentives' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
