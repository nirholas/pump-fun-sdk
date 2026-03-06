# Token Incentives — Volume-Based PUMP Token Rewards

## Skill Description

Implement and maintain the token incentive system that rewards traders with PUMP governance tokens based on their SOL trading volume, using a day-based epoch system with pro-rata distribution.

## Context

The Pump protocol incentivizes trading activity by distributing PUMP tokens to users proportional to their SOL trading volume. The system tracks volume in day-long epochs, with each day having a pre-configured token supply pool. Users must sync their volume accumulators and claim rewards explicitly.

## Key Files

- `src/tokenIncentives.ts` — pure math for reward calculations
- `src/onlineSdk.ts` — online fetch/claim methods (`fetchGlobalVolumeAccumulator`, `claimTokenIncentives`, etc.)
- `src/sdk.ts` — instruction builders (`syncUserVolumeAccumulator`, `initUserVolumeAccumulator`, `closeUserVolumeAccumulator`)
- `src/state.ts` — `GlobalVolumeAccumulator`, `UserVolumeAccumulator`, `UserVolumeAccumulatorTotalStats`
- `src/pda.ts` — `GLOBAL_VOLUME_ACCUMULATOR_PDA`, `userVolumeAccumulatorPda`

## Key Concepts

### Day-Based Epoch System

Volume tracking operates in fixed-length epochs defined by the `GlobalVolumeAccumulator`:
- `startTime` — epoch system start timestamp
- `secondsInADay` — epoch length (typically 86,400 seconds)
- `solVolumes[]` — array of total SOL volume per day
- `totalTokenSupply[]` — array of PUMP tokens available per day

Day index calculation:
```typescript
dayIndex = Math.floor((currentTimestamp - startTime) / secondsInADay)
```

### Pro-Rata Reward Formula

A user's reward for a given day:

$$\text{tokens} = \frac{\text{userSolVolume} \times \text{dayTokenSupply}}{\text{globalSolVolume}}$$

### Reward Calculation Functions

**`totalUnclaimedTokens(globalVA, userVA, timestamp?)`:**
1. Start with `userVA.totalUnclaimedTokens` (previously computed rewards)
2. If user was last updated on a previous day, add their pending reward for that day
3. Does NOT include the current day (rewards finalize after the day ends)

**`currentDayTokens(globalVA, userVA, timestamp?)`:**
1. Returns 0 if user was last updated on a different day
2. Otherwise returns the pro-rata token share for the current day
3. This is a preview — actual claiming happens after the day ends

### Account Lifecycle

1. **Init** (`initUserVolumeAccumulator`) — creates the user's volume accumulator PDA
2. **Sync** (`syncUserVolumeAccumulator`) — updates the accumulator with latest volume data
3. **Claim** (`claimTokenIncentives`) — claims accumulated PUMP token rewards
4. **Close** (`closeUserVolumeAccumulator`) — closes the account, reclaims rent

### BothPrograms Aggregation

Since users trade on both the bonding curve (Pump) and AMM (PumpAMM), volume tracking exists on both programs:

- `fetchUserVolumeAccumulatorTotalStats(user)` — sums `totalUnclaimedTokens`, `totalClaimedTokens`, `currentSolVolume` across both programs
- `getTotalUnclaimedTokensBothPrograms(user)` — combined unclaimed rewards
- `getCurrentDayTokensBothPrograms(user)` — combined current day preview
- `claimTokenIncentivesBothPrograms(user, payer)` — claims from both
- `syncUserVolumeAccumulatorBothPrograms(user)` — syncs both

### Edge Cases

| Case | Behavior |
|------|----------|
| Zero global volume for a day | No tokens distributed (division by zero guarded) |
| User never synced | Only `totalUnclaimedTokens` from account state returned |
| Timestamp before `startTime` | Day index would be negative — returns existing state |
| Day index beyond arrays | No additional rewards computed |
| `secondsInADay` is zero | Guard against division by zero |
| User updated same day | `currentDayTokens` returns preview, `totalUnclaimedTokens` excludes it |

## Patterns to Follow

- Pure functions in `tokenIncentives.ts` — no side effects, no RPC calls
- Accept optional `currentTimestamp` parameter for testability (defaults to `Date.now() / 1000`)
- Always use `BN` arithmetic — never convert to JavaScript `number`
- Aggregate across both programs when presenting total rewards to users
- Sync before claiming to ensure the latest volume is reflected
- The `needsClaim` flag on `UserVolumeAccumulator` indicates pending rewards

## Common Pitfalls

- `totalUnclaimedTokens` does NOT include the current day's rewards — only finalized (previous) days
- `currentDayTokens` returns 0 if the user's last update was on a different day (they need to sync first)
- Day indices are zero-based and computed from `startTime`, not from epoch 0
- The `solVolumes` and `totalTokenSupply` arrays may have different lengths — only compute for indices within both arrays
- Volume accumulator PDAs are different between Pump and PumpAMM programs despite using the same seed structure

