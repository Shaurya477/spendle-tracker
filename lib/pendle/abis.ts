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
]);

export const votingEscrowAbi = parseAbi([
  "function slopeChanges(uint128 wTime) view returns (uint128)",
]);

export const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);
