---
name: pump-token-incentives
description: "Volume-based PUMP token reward system with day-indexed epochs, pro-rata distribution, accumulator tracking, and cross-program claiming on Solana."
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
    requires:
      env:
        - SOLANA_RPC_URL
---

# Token Incentives — Volume-Based PUMP Token Rewards

Implement and maintain the token incentive system that rewards traders with PUMP governance tokens based on their SOL trading volume, using a day-based epoch system with pro-rata distribution.

## Context

The Pump protocol incentivizes trading activity by distributing PUMP tokens to users proportional to their SOL trading volume. The system tracks volume in day-long epochs, with each day having a pre-configured token supply pool.

## Day-Based Epoch System

Volume tracking operates in fixed-length epochs defined by the `GlobalVolumeAccumulator`:
- `startTime` — epoch system start timestamp
- `secondsInADay` — epoch length (typically 86,400 seconds)
- `solVolumes[]` — array of total SOL volume per day
- `totalTokenSupply[]` — array of PUMP tokens available per day

```typescript
dayIndex = Math.floor((currentTimestamp - startTime) / secondsInADay)
```

## Pro-Rata Reward Formula

$$\text{tokens} = \frac{\text{userSolVolume} \times \text{dayTokenSupply}}{\text{globalSolVolume}}$$

## Account Lifecycle

1. **Init** (`initUserVolumeAccumulator`) — creates the user's volume accumulator PDA
2. **Sync** (`syncUserVolumeAccumulator`) — updates the accumulator with latest volume data
3. **Claim** (`claimTokenIncentives`) — claims accumulated PUMP token rewards
4. **Close** (`closeUserVolumeAccumulator`) — closes the account, reclaims rent

## BothPrograms Aggregation

Since users trade on both the bonding curve (Pump) and AMM (PumpAMM):

- `fetchUserVolumeAccumulatorTotalStats(user)` — sums across both programs
- `getTotalUnclaimedTokensBothPrograms(user)` — combined unclaimed rewards
- `claimTokenIncentivesBothPrograms(user, payer)` — claims from both
- `syncUserVolumeAccumulatorBothPrograms(user)` — syncs both

## Edge Cases

| Case | Behavior |
|------|----------|
| Zero global volume for a day | No tokens distributed (division by zero guarded) |
| User never synced | Only `totalUnclaimedTokens` from account state returned |
| Day index beyond arrays | No additional rewards computed |
| User updated same day | `currentDayTokens` returns preview, `totalUnclaimedTokens` excludes it |

## Patterns to Follow

- Pure functions in `tokenIncentives.ts` — no side effects, no RPC calls
- Accept optional `currentTimestamp` parameter for testability
- Always use `BN` arithmetic — never convert to JavaScript `number`
- Sync before claiming to ensure the latest volume is reflected

## Common Pitfalls

- `totalUnclaimedTokens` does NOT include the current day's rewards — only finalized days
- `currentDayTokens` returns 0 if the user's last update was on a different day (sync first)
- Day indices are zero-based from `startTime`, not from epoch 0
- Volume accumulator PDAs differ between Pump and PumpAMM programs

