import { BOOST_SPAN, MAX_LOCK_TIME } from "./config";

/** One vePENDLE expiry bucket: `slope` is the summed veBalance slope of every lock expiring at `expiry`. */
export type LockBucket = { expiry: bigint; slope: bigint };

export type LoyaltyState = {
  /** PENDLE still under an unexpired lock (wei). */
  locked: bigint;
  /** vePENDLE balance of those locks: Σ slope × (expiry − t) (wei). */
  veBalance: bigint;
  /** Virtual sPENDLE: locked × (1 + 3 × remaining / MAX_LOCK), summed over locks (wei). */
  virtual: bigint;
};

/**
 * Loyalty-bonus state at time `t` for a lock schedule.
 *
 * Each lock of `amount` PENDLE with remaining time `r` carries a multiplier
 * `1 + 3 × r / MAX_LOCK_TIME`, which is 4x at a full 2-year lock and 1x at unlock.
 * Because `slope = amount / MAX_LOCK_TIME`, the sum over locks collapses to
 * `locked + 3 × veBalance`, both of which fall out of the weekly slope buckets.
 */
export function loyaltyAt(schedule: readonly LockBucket[], t: bigint): LoyaltyState {
  let locked = 0n;
  let veBalance = 0n;
  for (const { expiry, slope } of schedule) {
    if (expiry <= t) continue;
    locked += slope * MAX_LOCK_TIME;
    veBalance += slope * (expiry - t);
  }
  return { locked, veBalance, virtual: locked + BOOST_SPAN * veBalance };
}

export function lastExpiry(schedule: readonly LockBucket[]): bigint {
  let max = 0n;
  for (const { expiry } of schedule) if (expiry > max) max = expiry;
  return max;
}

/** Multiplier of a single lock with `remaining` seconds to unlock. */
export function multiplierFor(remaining: bigint): number {
  if (remaining <= 0n) return 0;
  return 1 + (Number(BOOST_SPAN) * Number(remaining)) / Number(MAX_LOCK_TIME);
}

export function toTokens(wei: bigint): number {
  return Number(wei) / 1e18;
}
