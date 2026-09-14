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
  /** Receives the 5% instant-unstake fee (the PENDLE transfer paired with every `Unstaked` event with `fee > 0`). */
  treasury: "0x8270400d528c34e1596EF367eeDEc99080A1b592" as Address,
} as const;

/** First block scanned for vePENDLE lock events; the contract's first lock week was 21 Nov 2022 (block ~16.02M). */
export const VE_PENDLE_FROM_BLOCK = 15_900_000n;

export type WalletCategory = "pendle" | "investor" | "exchange" | "bridge" | "locker" | "contract";

/**
 * Labelled PENDLE wallets, read directly for the supply-distribution view. Labels are the public
 * Etherscan/Dune tags; only wallets that hold PENDLE on mainnet are listed. Liquid lockers hold
 * theirs inside the vePENDLE contract, so they are shown but not counted again in the split.
 */
export const KNOWN_WALLETS: { address: Address; label: string; category: WalletCategory }[] = [
  { address: "0x8119ec16f0573b7dac7c0cb94eb504fb32456ee1", label: "Pendle governance multisig", category: "pendle" },
  { address: "0x399be606db281a054e359eb709df9f21e922ec9a", label: "Pendle ecosystem fund", category: "pendle" },
  { address: "0x918cf6b16d1426b5aa0edf0492ced1aa89f9659a", label: "Pendle team tokens multisig", category: "pendle" },
  { address: "0x8270400d528c34e1596EF367eeDEc99080A1b592", label: "Pendle treasury", category: "pendle" },
  { address: "0x2081411ed407f2364e5162e641a2db7575ef6f7b", label: "Binance Labs", category: "investor" },
  { address: "0xf977814e90da44bfa03b6295a0616a897441acec", label: "Binance", category: "exchange" },
  { address: "0x5a52e96bacdabb82fd05763e25335261b270efcb", label: "Binance", category: "exchange" },
  { address: "0xcffad3200574698b78f32232aa9d63eabd290703", label: "Crypto.com", category: "exchange" },
  { address: "0x0d0707963952f2fba59dd06f2b425ace40b492fe", label: "Gate.io", category: "exchange" },
  { address: "0xa3a7b6f88361f48403514059f1f16c8e78d60eec", label: "Arbitrum bridge", category: "bridge" },
  { address: "0x3ee18b2214aff97000d974cf647e7c347e8fa585", label: "Wormhole Portal", category: "bridge" },
  { address: "0x3154cf16ccdb4c6d922629664174b904d80f2c35", label: "Base bridge", category: "bridge" },
  { address: "0x99c9fc46f92e8a1c0dec1b1747d010903e884be1", label: "Optimism bridge", category: "bridge" },
  { address: "0x6e799758cee75dae3d84e09d40dc416ecf713652", label: "Penpie", category: "locker" },
  { address: "0x64627901dadb46ed7f275fd4fc87d086cff1e6e3", label: "Equilibria", category: "locker" },
  { address: "0xd8fa8dc5adec503acc5e026a98f32ca5c1fa289a", label: "Stake DAO", category: "locker" },
  { address: "0x9e08C5499f953C6297A7755BcBcEd383b606896b", label: "Buyback contract", category: "contract" },
  { address: "0x47D74516B33eD5D70ddE7119A40839f6Fcc24e57", label: "Gauge controller", category: "contract" },
];

export const PENDLE_API = "https://api-v2.pendle.finance/core/v1/spendle";
export const PENDLE_PRICE_API = "https://api-v2.pendle.finance/core/v1/prices/assets";
export const PENDLE_EMISSION_API = "https://api-v2.pendle.finance/core/v1/pendle-emission";
export const LLAMA_FEES_API = "https://api.llama.fi/summary/fees/pendle";
/** Daily PENDLE/USD history (DefiLlama coins). */
export const LLAMA_PRICE_API = "https://coins.llama.fi/chart/ethereum:0x808507121B80c02388fAd14726482e061B8da827";

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
export const AUTHOR_X_URL = "https://x.com/Shaurya477";
export const AUTHOR_X_HANDLE = "@Shaurya477";
