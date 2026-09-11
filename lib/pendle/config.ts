import type { Address } from "viem";

export const RPC_URL =
  process.env.ETH_RPC_URL ?? "https://mainnet.gateway.tenderly.co";

export const ADDRESSES = {
  pendle: "0x808507121B80c02388fAd14726482e061B8da827" as Address,
  sPendle: "0x999999999991E178D52Cd95AFd4b00d066664144" as Address,
  vePendle: "0x4f30A9D41B80ecC5B94306AB4364951AE3170210" as Address,
  buyback: "0x9e08C5499f953C6297A7755BcBcEd383b606896b" as Address,
  merkleDistributor: "0x3942f7b55094250644cffda7160226caa349a38e" as Address,
  gaugeController: "0x47D74516B33eD5D70ddE7119A40839f6Fcc24e57" as Address,
  usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address,
} as const;

export const PENDLE_API = "https://api-v2.pendle.finance/core/v1/spendle";
export const PENDLE_PRICE_API = "https://api-v2.pendle.finance/core/v1/prices/assets";
export const PENDLE_EMISSION_API = "https://api-v2.pendle.finance/core/v1/pendle-emission";
export const LLAMA_FEES_API = "https://api.llama.fi/summary/fees/pendle";

export const WEEK = 604_800n;
/** VotingEscrowTokenBase.MAX_LOCK_TIME = 104 weeks */
export const MAX_LOCK_TIME = 62_899_200n;

/** Loyalty-bonus snapshot: 2026-01-29T00:00:00Z. */
export const SNAPSHOT_TS = 1_769_644_800n;
/** Last block mined before the snapshot timestamp (block ts 2026-01-28T23:59:59Z). */
export const SNAPSHOT_BLOCK = 24_336_785n;
/** Weeks after the snapshot that can still hold a snapshot lock expiry (max lock is 104 weeks). */
export const SNAPSHOT_WEEKS = 105;

/** Live lock expiries can sit up to 104 weeks out; scan a little further. */
export const LIVE_WEEKS = 110;

export const EPOCH_SECONDS = 14 * 86_400;
export const YEAR_SECONDS = 365.25 * 86_400;
export const EPOCHS_PER_YEAR = YEAR_SECONDS / EPOCH_SECONDS;

/** Known Tuesday epoch start (2026-04-07) used to align 14-day windows. */
export const FEE_EPOCH_ORIGIN = 1_775_520_000;

/** Multiplier is 4x with a full 2-year lock remaining and 1x at unlock. */
export const BOOST_SPAN = 3n;

export const ETHERSCAN = "https://etherscan.io";

export const REPO_URL = "https://github.com/Shaurya477/spendle-tracker";
