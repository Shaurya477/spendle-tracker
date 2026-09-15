# Penconomics

**Live: [penconomics.vercel.app](https://penconomics.vercel.app)** · deployed from `main` on every push.

A dashboard for Pendle Protocol's transition from **vePENDLE** (locked PENDLE, deprecated Jan 2026) to **sPENDLE** (staked PENDLE). Everything is computed directly from Ethereum mainnet contracts and public APIs; there is no database and no fallback data. The finished dataset is kept in Next's data cache for five minutes and recomputed in the background once stale, so a page load is ~300 ms instead of the 20–30 s a cold read takes; the Refresh button drops the cache and reads the chain again. A GitHub Actions job (`.github/workflows/keep-warm.yml`) fetches the production page every five minutes so the cache stays fresh, including right after a deploy. A wallet lookup reuses the cached dataset and only reads the wallet's own state (one multicall, two transfer-log queries, Pendle's API), about 1.5–2 s; a wallet in the URL or remembered on the device is looked up from the browser after the page has painted, never on the server, and its RPC reads take priority over a dataset recompute running at the same time.

It answers seven questions Pendle's own staking hub does not, and then lets you point all of it at a single wallet:

1. **How much is sPENDLE, and how much is still vePENDLE?** The hub adds both into one "total staked" figure. This shows them separately, plus the loyalty-boost *virtual sPENDLE* the old lockers carry, and the weekly stake, cooldown and instant-unstake flows behind the sPENDLE number.
2. **Who holds PENDLE, and how much can actually trade?** The supply split across the staking contracts, Pendle's own wallets, labelled exchanges, bridge escrows and the open float, with the labelled wallets' 7- and 30-day changes.
3. **What does a plain sPENDLE staker earn versus a boosted vePENDLE locker?** Per-epoch APR for both, from the actual bi-weekly buyback distributions.
4. **How much do vePENDLE lockers dilute sPENDLE stakers, and how fast does that fade?** Current dilution plus a day-by-day projection of the boost decaying to zero on 20 Jan 2028, the live unlock calendar against the snapshot one, the largest lock positions, and the three liquid lockers' share.
5. **What does the market pay for it?** FDV, market cap, price to TVL, fee and buyback yields, buybacks net of AIM emissions, the share of revenue that reaches stakers, and what each buyback paid per PENDLE.
6. **Is the bullish case holding up?** Nine signals, each judged against a stated test, recomputed every epoch.
7. **What does this mean for one address?** Balances, lock and virtual sPENDLE, an epoch-by-epoch reward breakdown with in-kind airdrops folded in, personal APR, what the boost has cost or paid that wallet, and its APR path to the end of the boost.

## Run it

```bash
npm install
npm run dev          # http://localhost:4783
```

`npm run build && npm start` serves the production build on the same port.

Optional: `ETH_RPC_URL=<url>` overrides the RPC. The node must be **archive-capable** (state reads at block 24,336,785) and accept **wide `eth_getLogs` ranges** (~1.6M blocks in one call). The default, Tenderly's public gateway (`https://mainnet.gateway.tenderly.co`), does both; most other free public RPCs fail one or the other (checked 11 Sep 2026: PublicNode and 1rpc refuse archive reads without a key, dRPC's free plan caps `eth_getLogs` at 10K blocks, merkle.io and LlamaRPC were rejecting everything).

Tenderly's public gateway is rate-limited per client IP: 20 weighted units per ~1 s window, where `eth_call` and `eth_getLogs` cost 4 units and `eth_getBlockByNumber` costs 1 (response headers `x-tdly-limit` / `x-tdly-remaining`), answered with 429 `rate limit exceeded` beyond that. Payload size is not limited. `lib/pendle/client.ts` therefore paces every request through one process-wide budget of 14 units/s with at most two in flight instead of firing them in parallel, so a cold recompute of the dashboard dataset (~230 units) takes 20–30 s and a cold address lookup about 8 s; the immutable reads (snapshot schedule, per-distribution state, buyback windows) are memoised for the process lifetime, and the dataset itself is served from Next's data cache (`lib/pendle/tracker.ts`) so visitors do not wait on the recompute. A request the gateway still rejects fails the page immediately; nothing is retried or substituted.

Stack: Next.js 16 (App Router, server components), TypeScript, Tailwind v4, shadcn/ui, viem, Recharts.

## Mechanics, as confirmed from Pendle's sources and the contracts

Sources: [Introducing sPENDLE](https://medium.com/pendle/introducing-spendle-8479744dfdf8) (Medium, 20 Jan 2026), [sPENDLE mechanism docs](https://docs.pendle.finance/pendle-v2/ProtocolMechanics/Mechanisms/sPENDLE), [sPENDLE contract docs](https://docs.pendle.finance/pendle-v2-dev/Contracts/sPENDLE), and the verified sources of the contracts below (`pendle-core-v2-public`).

- **sPENDLE** is minted 1:1 for staked PENDLE. Exit is a 14-day cooldown (`cooldownDuration() = 1209600`) or instant with a 5% fee (`instantUnstakeFeeRate() = 5e16`). On `cooldown()` the sPENDLE is **burned** immediately and the PENDLE leaves the contract only on `finalizeCooldown()`, so `PENDLE.balanceOf(sPENDLE) − sPENDLE.totalSupply()` is exactly the PENDLE sitting in the unstake queue.
- **Rewards.** Policy sends up to 80% of protocol revenue to a buyback contract that TWAPs USDT→PENDLE hourly via Pendle Router V4. That 80% is a policy figure, not an observed flow: USDT `Transfer`s into the buyback contract since the snapshot total $3.99M against a $5.54M 80% share of DefiLlama's Revenue (11 Sep 2026), and for the 7 Apr–11 Aug fee epochs 54.5% of the app's protocol take. The funding lands around each fee epoch's end and matches the hub's per-epoch "Fees Collected" in 9 of 10 closed epochs. The executed buyback is the PENDLE the contract received and the USDT it spent between consecutive distributions (2.68M PENDLE for ~$3.7M over 15 distributions); the rest of the gap to the 80% figure is in-kind airdrops that sit inside revenue but go to stakers as-is (~$0.7M over the 12 epochs Pendle's API covers), which the team has confirmed. Every ~14 days the same contract calls `stake()` on sPENDLE and transfers the minted sPENDLE to Pendle's Merkle distributor, from which holders claim. Rewards are split pro-rata over *active* sPENDLE **including virtual sPENDLE**.
- **Loyalty bonus.** vePENDLE locks were snapshotted at 00:00 UTC, 29 Jan 2026. Each locker received a non-transferable virtual sPENDLE balance of `locked × (1 + 3 × remaining / 2 years)`: 4× for a full two-year lock, 2.5× for one year, decaying linearly to 1× at their unlock date, then gone. New locks were "paused" in the UI only; the contract still accepts `increaseLockPosition`, and a few positions were changed after the snapshot (~31K PENDLE net, plus one 12.8M lock extended from Jan 2028 to Mar 2028). Those changes do **not** alter the boost, which is fixed by the snapshot.

## How each number is computed

| Figure | Source |
| --- | --- |
| sPENDLE staked | `sPENDLE.totalSupply()` |
| vePENDLE → sPENDLE | PENDLE `Transfer` logs out of the vePENDLE contract since the snapshot are withdrawals of expired locks (`withdraw()` is the only exit); sPENDLE `Transfer` logs from the zero address are stakes (the buyback contract's own stakes excluded). Each withdrawal is matched against the same wallet's stakes in the following 30 days, consumed in order, so a withdrawal counts as restaked up to that amount; the restake rate is quoted over withdrawals whose 30-day window has closed. Weekly PENDLE-in-vePENDLE and sPENDLE-supply series are walked back from today's balances through the same logs (plus PENDLE into vePENDLE and sPENDLE burns). Log timestamps are estimated from the average block time since the snapshot |
| Reward-eligible sPENDLE | `sPENDLE.totalSupply()`: every sPENDLE earns, including rewards distributed but not yet claimed, which sit in the distributor (`sPENDLE.balanceOf(merkleDistributor)`, shown as "Unclaimed rewards"). A wallet's eligible balance is its wallet sPENDLE plus rewards accrued and not yet claimed. The distributor holds ~0.3% of the eligible total (virtual sPENDLE included), so this choice moves every APR by under 0.3% relative; a check of five wallets against Pendle's per-address accruals could not separate it from the exclude-unclaimed model |
| PENDLE in unstake queue | `PENDLE.balanceOf(sPENDLE) − sPENDLE.totalSupply()` |
| PENDLE locked in vePENDLE | `PENDLE.balanceOf(vePENDLE)` — this is what the hub counts |
| Active vs expired locks | `vePENDLE.slopeChanges(week)` for the next 110 weeks. Each bucket's `slope × MAX_LOCK_TIME (104 weeks)` is the PENDLE unlocking that week; the sum is PENDLE under a live lock, the remainder of the contract balance is expired-but-unwithdrawn |
| vePENDLE balance (voting power) | `Σ slope × (expiry − now)` over the same buckets; equals `totalSupplyCurrent()` to the wei |
| Virtual sPENDLE | Same `slopeChanges` buckets read **at block 24,336,785** (the last block before the snapshot timestamp), replayed at time *t*: `Σ amount × (1 + 3 × (expiry − t) / 2y)` over unexpired buckets, which simplifies to `locked + 3 × veBalance` of the snapshot positions |
| Distributions | PENDLE `Transfer(from = buyback, to = sPENDLE)` logs since the snapshot block. In each such tx the buyback contract stakes and forwards the sPENDLE to the distributor |
| Plain APR per epoch | `distributed ÷ (eligible sPENDLE + virtual sPENDLE, both at the block before the distribution) × 26.09` (365.25 / 14 epochs a year) |
| Boosted APR | plain APR × multiplier. "Average locker" uses `virtual ÷ snapshot-eligible locked`; "longest lock" uses the multiplier of a lock expiring on the last snapshot unlock date |

### APR denomination

Every APR in the app is **token-denominated**: sPENDLE distributed divided by reward-eligible stake (sPENDLE + virtual sPENDLE), with no price feed involved. Rewards are paid in sPENDLE, which is 1:1 with the PENDLE that is staked or locked, so PENDLE's dollar price cancels out; a plain-staker APR of 1.14% means 1.14 sPENDLE earned per 100 sPENDLE held per year, whatever PENDLE trades at. The boosted APR is the same ratio per PENDLE locked. Pendle's hub reports the USD value of buybacks per epoch; this app does not convert to or from USD anywhere.

Annualisation is simple, not compounded: each epoch's ratio is multiplied by `365.25 / 14 = 26.09`. "Latest epoch" is the most recent distribution on its own. "Trailing 6 epochs" is the arithmetic mean of the last six per-epoch APRs, each computed against its own denominator at that block (so it is not `Σ distributed ÷ current stake`). In-kind airdrops of other tokens are excluded because pricing them would break the token-only denomination.
| Dilution | boost premium share = `(virtual − locked) ÷ (eligible sPENDLE + virtual)`. This is both the share of each epoch's rewards captured by the boost *above* a 1× count of the locked PENDLE, and the haircut on a plain staker's APR compared with a world where lockers counted 1× |
| Projection | The snapshot schedule replayed daily to 20 Jan 2028 (+1 week). Two scenarios for the sPENDLE side: supply held flat, or every unlocked PENDLE restaked as sPENDLE on its unlock day. The APR line holds the latest epoch's payout flat |
| Staking flows | The staking contract's `Staked`, `CooldownInitiated`, `CooldownCanceled` and `Unstaked(amountAfterFee, fee)` events since the snapshot, bucketed by vePENDLE week. `Staked` from the buyback contract (reward distributions) is excluded so the series is holder behaviour. `Unstaked` with `fee = 0` is a finalised cooldown, with `fee > 0` an instant unstake (gross = after-fee + fee). The cooldown queue is `PENDLE.balanceOf(sPENDLE) − totalSupply()` today, walked back through starts, cancellations and finalisations. The fee is the PENDLE transfer to the treasury (`0x8270…b592`) in the same transaction |
| Largest moves | The biggest single stakes, cooldown starts, instant unstakes and expired-lock withdrawals in the last 30 days, from the same logs |
| Live unlock calendar | `slopeChanges` at the latest block, against the same buckets at the snapshot block. Where a live week holds more than the snapshot week a lock was extended or added since; the boost of such a lock is unchanged |
| Lock positions | Every `NewLockPosition(user, amount, expiry)` the vePENDLE contract has emitted (from block 15.9M, 1M-block chunks, closed chunks memoised), latest per wallet, kept where `expiry > now`; the twelve largest are re-read with `positionData` at the latest block. Penpie, Equilibria and Stake DAO are the liquid lockers |
| Holders | A fixed list of labelled wallets (Pendle governance multisig, ecosystem fund, team tokens multisig, treasury; Binance Labs; the Binance, Crypto.com and Gate.io wallets that hold PENDLE; Arbitrum, Wormhole Portal, Base and Optimism bridge escrows; the three lockers; buyback contract and gauge controller) read with `balanceOf` at the latest block and at 50,400 and 216,000 blocks earlier (~7 and ~30 days). Labels are Etherscan's and Dune's public tags. The split is those balances plus the two staking contracts against `totalSupply()`; "everything else" is the remainder and includes unlabelled exchange wallets |
| Valuation | FDV = total supply × price; circulating = total − Pendle's four wallets − buyback contract − gauge controller (staked and locked PENDLE is holders' and counts). Price to TVL = market cap (and FDV) ÷ DefiLlama `tvl/pendle-v2`, the headline Pendle V2 TVL across every chain, which excludes staked PENDLE, pool2 and Boros. Annualised fees and revenue = mean of the last four complete fee epochs × 26.09; annualised buybacks = mean USDT spent over the last six distributions × 26.09; emissions cost = AIM weekly PENDLE × 52 × price. Revenue reaching stakers = USDT funded ÷ DefiLlama revenue over the last four closed funding windows. Price paid per PENDLE = each distribution's USDT spent ÷ PENDLE bought; benchmark = DefiLlama's daily PENDLE/USD close (`coins.llama.fi/chart/ethereum:<PENDLE>`, span requested a month wider than needed because an exact span returns a truncated series) nearest to each USDT outflow of the buyback contract, weighted by USDT; paid ÷ benchmark − 1 is shown on hover. Value today = all PENDLE bought × live quote |

### Fees, revenue, and incentives (section 05)

| Figure | Source |
| --- | --- |
| Daily fees | DefiLlama `summary/fees/pendle`, Pendle V2 label summed across chains, from 29 Jan 2026; Boros excluded. DefiLlama books a fee on the day the tokens reach Pendle's treasury, so an epoch's USD is lumpy and is not Pendle's own epoch accounting; the last day can arrive a day late |
| Swap vs "YT and other" | gross swap = `dailySupplySideRevenue ÷ 0.20`; "YT and other fees" = DefiLlama's `Revenue` field − 0.80 × swap, i.e. everything booked at the treasury that is not AMM swap fee (YT yield and points fees, limit-order fees, post-maturity yield, airdrop tokens forwarded to the distributor) |
| 80% share / treasury / ops | 0.8 / 0.1 / 0.1 × DefiLlama `Revenue`. A policy split, not a flow |
| Funded | USDT `Transfer(to = buyback)` logs since the snapshot block, timestamps read from each block. A transfer at *t* belongs to the fee epoch starting at *T* when `T + 7d ≤ t < T + 21d` (Pendle funds the contract around the epoch boundary, observed 0.3 days before to 3.3 days after it). An epoch's figure can grow until `T + 21d` |
| Emissions to LPs | PENDLE paid to Ethereum LPs from the gauge controller per fee epoch (existing inventory entering circulation; total supply is flat): start balance + top-ups − end balance, epoch boundaries approximated by linear block interpolation. Performance stream only; limit-order and co-incentive PENDLE is paid from other wallets |
| AIM assignment | `GET /v1/pendle-emission`, summed over every market: TVL + fee (Performance stream, to pools via the gauge controllers), limit order (to order makers), discretionary, co-incentives. PENDLE per week as reported |

## Your position (address lookup)

Section 07 takes a wallet (fixed `0x` prefix; paste a full address and the prefix is stripped) and shows that address's slice of everything above. A preset works too: `/?address=0x…` renders the result server-side. Bad input fails visibly; a failed read fails the lookup, nothing is substituted.

| Figure | Source |
| --- | --- |
| sPENDLE held, cooldown, wallet PENDLE | `sPENDLE.balanceOf`, `sPENDLE.userCooldown`, `PENDLE.balanceOf` at the latest block. The sPENDLE figure adds the wallet's unclaimed rewards (Pendle's accrued total minus `merkleDistributor.claimed`), since unclaimed sPENDLE keeps earning |
| vePENDLE lock | `vePENDLE.positionData(user)` now, and at the snapshot block for the boost terms. Virtual sPENDLE = `snapshotAmount × (1 + 3 × remaining / 2y)` |
| Reward weight / share | `(sPENDLE incl. unclaimed rewards + virtual) ÷ reward-eligible total`; "pending" applies that share to the PENDLE the buyback contract has bought since the last distribution |
| sPENDLE earned per epoch | `share_k × distributed_k`, with the user's sPENDLE at the block before each distribution and their cumulative claims at that block both walked back from today's values through the wallet's sPENDLE `Transfer` logs (claims are the transfers from the distributor), plus rewards accrued so far and not yet claimed (this estimate's own running total minus claims to date), and their virtual sPENDLE at that timestamp. A pro-rata estimate that assumes the address was active every epoch |
| Pendle's record | `GET /v1/spendle/:address` → `allTimeRewards["1-<sPENDLE>"]`; a 404 means the address has never been paid. Unclaimed = that minus `merkleDistributor.claimed(sPENDLE, user)` onchain |
| In-kind airdrops | `GET /v1/spendle/data` → `airdropInUSDs` and `airdropBreakdowns` per fee epoch. A distribution at time *t* belongs to the fee epoch starting at *T* when `T + 14d ≤ t < T + 28d` (fees are collected for two weeks, then bought back over the next two). The user's share of the epoch's airdrop USD is converted to PENDLE at that epoch's **realised buyback price**: USDT out of ÷ PENDLE into the buyback contract, from its `Transfer` logs in the window between distributions (every PENDLE inflow counts, not only swap output). The API covers 12 fee epochs, so distributions 1–5 (Feb–Apr 2026) have no airdrop data and are excluded from the airdrop-inclusive mean |
| Personal APR | `(sPENDLE earned [+ airdrop PENDLE]) ÷ (user sPENDLE + user locked PENDLE) × 26.09`, per epoch; "mean" is the arithmetic mean over epochs where the address had a position. Same token-terms denomination as the protocol APR; the airdrop leg is the only place a USD figure enters, and it is the USD value Pendle's API reports (it carries no valuation timestamp), not a live price |
| Boost effect | Dilution on the user's sPENDLE = `sPENDLE_k × D_k × (1/(S_k + L_k) − 1/(S_k + V_k))` summed over epochs (what a 1× world would have paid minus what they got). Premium on their lock = `(virtual_k − locked_k) ÷ eligibleTotal_k × D_k`. Both are projected forward daily to 20 Jan 2028 at the latest payout |
| Outlook | Daily personal APR with the position held as-is, protocol sPENDLE flat, latest payout flat; when the user's lock expires the PENDLE is assumed restaked at 1× |

Validation of the pro-rata estimate against Pendle's own accrual record (three real addresses, 11 Sep 2026): 462.78 vs 466.64, 689.50 vs 686.38, and 8,266 vs 8,705 sPENDLE. The first two are within 1%; the third address unlocked in April and restaked in May, and the gap is the timing difference between Pendle's balance snapshot and the block before the distribution.

**Why this differs from spendle.pages.dev.** That calculator (unofficial) was checked with the same `0x2526…e4f4` wallet on 11 Sep 2026. Its per-epoch sPENDLE figures run 5–15% above this app's (e.g. 54.51 vs 52.09, 42.02 vs 36.82) and its APR is USD-based: "(sPENDLE rewards + airdrops) ÷ sPENDLE stake value … all USD at distribution-time prices". Two reasons for the gap: it labels epochs by fee-epoch end and divides every epoch's share by *today's* pool size (its own footnote says so), whereas this app reads the eligible total at the block before each distribution, so early epochs here use the larger historical denominator and the totals reconcile with Pendle's accrual record; and it converts everything to USD, whereas this app stays in PENDLE terms and only prices airdrops, at the epoch's realised buyback price.

## Cross-check against Pendle's hub

Pendle's public API (`GET https://api-v2.pendle.finance/core/v1/spendle/data`) backs the staking hub. At the time of writing, block 25,952,337:

| | Onchain (this app) | Pendle API | Note |
| --- | --- | --- | --- |
| `totalStakedInSpendle` | 34,157,455.12 | 34,157,455.12 | exact match |
| `totalPendleStaked` | 97,869,428.23 | 97,869,428.23 | exact match; = sPENDLE supply + `PENDLE.balanceOf(vePENDLE)`, i.e. the hub's combined figure includes 1.57M PENDLE in expired-but-unwithdrawn locks |
| `virtualSpendleFromVependle` | 177,778,397.73 | 177,778,738.43 | −340 sPENDLE; the virtual balance decays ~2.96/s, so this is the API's ~2-minute cache. Using block 24,336,786 (the first block *after* 00:00 UTC) instead would be 56K off, which is how the snapshot block was pinned |
| Buyback amounts per epoch | 287,935 / 110,444 / 142,392 / 218,235 / 131,832 / 239,840 / 149,087 / 144,388 / 199,338 | same, listed under the API's epoch start dates | the API had not yet recorded the 28 Aug 2026 distribution (94,065) and reports `aprs` as 0 for every epoch, so APR could not be cross-checked against it |

The hub UI itself (`app.pendle.finance/spendle/stake/in`, read 11 Sep 2026 06:18 UTC) shows three headline figures and no APR:

| Hub label | Hub value | This app |
| --- | --- | --- |
| Total PENDLE Staked | 97,869,428 | 97,869,428 (sPENDLE supply + PENDLE in vePENDLE) |
| Last Epoch Distribution | 199,338 | epoch 14, 14 Aug 2026: 199,338. Onchain there is a later distribution of 94,065 sPENDLE on 28 Aug 2026 that the hub and API had not yet surfaced |
| Fees Collected Since 08 Sep 2026 | $42,130 | equals the API's `fees` for that epoch. For closed epochs that figure is the USDT Pendle sent to the buyback contract, which is the "Funded" column in section 05 (matches in 9 of 10 closed epochs); the open epoch has no funding yet |

The hub's "Yield Distributed Every 2 Saturdays" corresponds to the Friday-UTC transactions in the ledger (Saturday in UTC+8). Because the hub publishes no APR, the APR figures here are derived from the onchain distributions alone.

## Assumptions

- **Scope is Ethereum mainnet for every contract read, global for supply and fees.** sPENDLE, vePENDLE, the buyback contract and the rewards distributor exist only on mainnet; PENDLE on Arbitrum, Base, Monad and the other chains must be bridged back to stake. Bridged PENDLE stays locked in mainnet bridge escrows (canonical bridges, Wormhole Portal, LayerZero OFT adapter), so `PENDLE.totalSupply()` on mainnet is the global supply and the staked-or-locked share is a share of all PENDLE; tokens on other chains or on exchanges are simply the unstaked remainder. Fees and AIM figures (DefiLlama, Pendle API) cover every chain; the LP-emissions series is the Ethereum gauge only, as labelled.
- **Everyone is active.** Holders who skip a vote while a PPP is open forfeit 14 days of rewards. That set is offchain, so the APRs here are a floor for an active holder and slightly understate the payout each active holder actually received.
- **Only PENDLE buybacks are counted.** Pendle also passes through in-kind airdrops (other tokens) received on points-bearing assets. They are not priced or included.
- **Eligible balance timing.** Pendle snapshots active balances every 14 days on its own schedule. The app uses balances at the block before each distribution landed; eligible sPENDLE has moved between 0% and 6% per epoch since March 2026, so the timing choice shifts an epoch's APR by at most a few percent relative.
- **Unclaimed rewards keep earning.** sPENDLE paid out but not yet claimed sits in the Merkle distributor and still counts toward its owner's balance, so eligible sPENDLE is the full supply and a wallet's eligible balance includes its unclaimed rewards. Excluding them instead would raise every APR by ~0.3% relative (604K out of a 212M denominator).
- **Projections** hold sPENDLE supply (or restake unlocks 1:1) and hold the latest payout flat. They are a schedule of the boost, not a forecast of fees.
- **Locks changed after the snapshot** keep their snapshot boost terms. This matches the API's virtual-sPENDLE figure; a live-schedule computation would be ~2.3M higher.

## Contracts (Ethereum mainnet)

| | Address |
| --- | --- |
| PENDLE | `0x808507121B80c02388fAd14726482e061B8da827` |
| sPENDLE (StakedPendle, proxy) | `0x999999999991E178D52Cd95AFd4b00d066664144` |
| vePENDLE (VotingEscrowPendleMainchain) | `0x4f30A9D41B80ecC5B94306AB4364951AE3170210` |
| Buyback | `0x9e08C5499f953C6297A7755BcBcEd383b606896b` |
| Merkle distributor (sPENDLE rewards) | `0x3942f7b55094250644cffda7160226caa349a38e` |

## Layout

```
app/                 page (server component), loading and error states, theme
app/api/position     GET ?address= → PositionData JSON (used by the lookup form)
components/dashboard sections: header, balances, yield, dilution (+charts), revenue, ledger, position, methodology, disclaimer
lib/pendle/          config, ABIs, viem client, chain reads, loyalty math, tracker and position assembly, revenue (DefiLlama, buyback funding, AIM), Pendle API client
lib/format.ts        number and date formatting
```
