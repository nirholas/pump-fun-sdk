import BN from "bn.js";

import { GlobalVolumeAccumulator, UserVolumeAccumulator } from "./state";

/**
 * Calculate total unclaimed token incentive rewards for a user.
 * Aggregates rewards across all completed days plus the current day's partial allocation.
 *
 * @param globalVolumeAccumulator - Global volume tracking state
 * @param userVolumeAccumulator - User's volume tracking state
 * @param currentTimestamp - Unix timestamp in seconds (defaults to now)
 * @returns Total unclaimed tokens as BN
 */
export function totalUnclaimedTokens(
  globalVolumeAccumulator: GlobalVolumeAccumulator,
  userVolumeAccumulator: UserVolumeAccumulator,
  currentTimestamp: number = Date.now() / 1000,
): BN {
  const { startTime, endTime, secondsInADay, totalTokenSupply, solVolumes } =
    globalVolumeAccumulator;
  const { totalUnclaimedTokens, currentSolVolume, lastUpdateTimestamp } =
    userVolumeAccumulator;

  const result = totalUnclaimedTokens;

  if (startTime.eqn(0) || endTime.eqn(0) || secondsInADay.eqn(0)) {
    return result;
  }

  const currentTimestampBn = new BN(currentTimestamp);

  if (currentTimestampBn.lt(startTime)) {
    return result;
  }

  const currentDayIndex = currentTimestampBn
    .sub(startTime)
    .div(secondsInADay)
    .toNumber();

  if (lastUpdateTimestamp.lt(startTime)) {
    return result;
  }

  const lastUpdatedIndex = lastUpdateTimestamp
    .sub(startTime)
    .div(secondsInADay)
    .toNumber();

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
      currentSolVolume
        .mul(lastUpdatedDayTokenSupply)
        .div(lastUpdatedDaySolVolume),
    );
  }

  return result;
}

/**
 * Calculate token rewards earned for the current day based on trading volume.
 *
 * @param globalVolumeAccumulator - Global volume tracking state
 * @param userVolumeAccumulator - User's volume tracking state
 * @param currentTimestamp - Unix timestamp in seconds (defaults to now)
 * @returns Current day's token rewards as BN
 */
export function currentDayTokens(
  globalVolumeAccumulator: GlobalVolumeAccumulator,
  userVolumeAccumulator: UserVolumeAccumulator,
  currentTimestamp: number = Date.now() / 1000,
): BN {
  const { startTime, endTime, secondsInADay, totalTokenSupply, solVolumes } =
    globalVolumeAccumulator;
  const { currentSolVolume, lastUpdateTimestamp } = userVolumeAccumulator;

  if (startTime.eqn(0) || endTime.eqn(0) || secondsInADay.eqn(0)) {
    return new BN(0);
  }

  const currentTimestampBn = new BN(currentTimestamp);

  if (currentTimestampBn.lt(startTime) || currentTimestampBn.gt(endTime)) {
    return new BN(0);
  }

  const currentDayIndex = currentTimestampBn
    .sub(startTime)
    .div(secondsInADay)
    .toNumber();

  if (lastUpdateTimestamp.lt(startTime)) {
    return new BN(0);
  }

  const lastUpdatedIndex = lastUpdateTimestamp
    .sub(startTime)
    .div(secondsInADay)
    .toNumber();

  if (endTime.lt(startTime)) {
    return new BN(0);
  }

  if (currentDayIndex !== lastUpdatedIndex) {
    return new BN(0);
  }

  const currentDayTokenSupply = totalTokenSupply[currentDayIndex];
  const currentDaySolVolume = solVolumes[currentDayIndex];

  if (!currentDaySolVolume || !currentDayTokenSupply || currentDaySolVolume.eqn(0)) {
    return new BN(0);
  }

  return currentSolVolume.mul(currentDayTokenSupply).div(currentDaySolVolume);
}

