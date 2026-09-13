import { parseAbi, parseAbiItem } from "viem";

export const erc20Abi = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

export const stakedPendleAbi = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function cooldownDuration() view returns (uint24)",
  "function instantUnstakeFeeRate() view returns (uint64)",
  "function userCooldown(address user) view returns (uint104 cooldownStart, uint152 amount)",
]);

export const votingEscrowAbi = parseAbi([
  "function slopeChanges(uint128 wTime) view returns (uint128)",
  "function positionData(address user) view returns (uint128 amount, uint128 expiry)",
]);

export const merkleDistributorAbi = parseAbi([
  "function claimed(address token, address user) view returns (uint256)",
]);

export const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

/** sPENDLE (`PStakedPendle`) events. A cooldown burns the sPENDLE at once; `Unstaked` with `fee = 0` is a finalised cooldown, with `fee > 0` an instant unstake. */
export const stakedEvent = parseAbiItem("event Staked(address indexed user, uint256 amount)");
export const unstakedEvent = parseAbiItem("event Unstaked(address indexed user, uint256 amountAfterFee, uint256 fee)");
export const cooldownInitiatedEvent = parseAbiItem(
  "event CooldownInitiated(address indexed user, uint256 amount, uint256 cooldownStart)",
);
export const cooldownCanceledEvent = parseAbiItem("event CooldownCanceled(address indexed user, uint256 amount)");

/** vePENDLE: emitted on every lock creation, increase, or extension with the position's new totals. */
export const newLockPositionEvent = parseAbiItem(
  "event NewLockPosition(address indexed user, uint128 amount, uint128 expiry)",
);
