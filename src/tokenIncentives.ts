import BN from "bn.js";

import { GlobalVolumeAccumulator, UserVolumeAccumulator } from "./state";

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

    if (lastUpdatedDaySolVolume.eqn(0)) {
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

  if (currentDaySolVolume.eqn(0)) {
    return new BN(0);
  }

  return currentSolVolume.mul(currentDayTokenSupply).div(currentDaySolVolume);
}

