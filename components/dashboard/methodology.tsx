import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtInt } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { AddressLink, Eyebrow, SectionHeading } from "./primitives";
import { CopyButton } from "./copy-button";

export function Methodology({ data }: { data: TrackerData }) {
  const a = data.addresses;
  return (
    <section id="methodology" className="scroll-mt-20 flex flex-col gap-8">
      <SectionHeading index="10" title="How the numbers are made" />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="">
          <CardContent className="flex flex-col gap-4">
            <Eyebrow>Contracts on Ethereum mainnet</Eyebrow>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
              <dt className="text-muted-foreground">PENDLE</dt>
              <dd className="flex min-w-0 items-center gap-1">
                <AddressLink address={a.pendle} label={a.pendle} />
                <CopyButton value={a.pendle} label="Copy address" />
              </dd>
              <dt className="text-muted-foreground">sPENDLE</dt>
              <dd className="flex min-w-0 items-center gap-1">
                <AddressLink address={a.sPendle} label={a.sPendle} />
                <CopyButton value={a.sPendle} label="Copy address" />
              </dd>
              <dt className="text-muted-foreground">vePENDLE</dt>
              <dd className="flex min-w-0 items-center gap-1">
                <AddressLink address={a.vePendle} label={a.vePendle} />
                <CopyButton value={a.vePendle} label="Copy address" />
              </dd>
              <dt className="text-muted-foreground">Buyback</dt>
              <dd className="flex min-w-0 items-center gap-1">
                <AddressLink address={a.buyback} label={a.buyback} />
                <CopyButton value={a.buyback} label="Copy address" />
              </dd>
              <dt className="text-muted-foreground">Rewards distributor</dt>
              <dd className="flex min-w-0 items-center gap-1">
                <AddressLink address={a.merkleDistributor} label={a.merkleDistributor} />
                <CopyButton value={a.merkleDistributor} label="Copy address" />
              </dd>
              <dt className="text-muted-foreground">Gauge controller</dt>
              <dd className="flex min-w-0 items-center gap-1">
                <AddressLink address={a.gaugeController} label={a.gaugeController} />
                <CopyButton value={a.gaugeController} label="Copy address" />
              </dd>
              <dt className="text-muted-foreground">Treasury</dt>
              <dd className="flex min-w-0 items-center gap-1">
                <AddressLink address={a.treasury} label={a.treasury} />
                <CopyButton value={a.treasury} label="Copy address" />
              </dd>
            </dl>
            <div className="rule" />
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <div>
                RPC <span className="font-mono text-foreground/80">{data.rpcUrl}</span>
              </div>
              <div>
                Snapshot block{" "}
                <span className="font-mono text-foreground/80">{fmtInt(data.loyalty.snapshot.block)}</span>,
                the last block before 29 Jan 2026 00:00 UTC
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="">
          <CardContent>
            <ol className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground [counter-reset:step]">
              <Step id="method-balances" title="Balances">
                Every contract read is on Ethereum mainnet: sPENDLE, vePENDLE, the buyback contract and
                the rewards distributor exist only there, and PENDLE on other chains has to be bridged
                back to stake. PENDLE supply is also read on mainnet, where bridged PENDLE stays locked
                in bridge escrows, so it is the global supply; PENDLE on other chains or on exchanges is
                part of the unstaked remainder. sPENDLE staked is all sPENDLE in existence (
                <code>totalSupply()</code> on the staking contract). Unstaking burns sPENDLE at once; the
                PENDLE is withdrawable after a {data.sPendle.cooldownDays}-day cooldown, or immediately for
                a {data.sPendle.instantFeePct}% fee. Locked PENDLE is what the vePENDLE contract holds. Active and expired locks
                come from the contract&apos;s weekly unlock schedule (<code>slopeChanges</code>): each
                week&apos;s slope × 104 weeks is the PENDLE unlocking that week. The vePENDLE → sPENDLE
                chart reads PENDLE leaving the vePENDLE contract (the only exit is <code>withdraw()</code>{" "}
                on an expired lock) and sPENDLE minted to wallets (stakes), matched per wallet: a
                withdrawal counts as restaked up to what the same wallet staked within 30 days after it.
                Week-end balances are walked back from today&apos;s through the same transfer logs.
                Staking flows come from the staking contract&apos;s own events: <code>Staked</code> (the
                buyback contract&apos;s stakes, which are reward distributions, are excluded),{" "}
                <code>CooldownInitiated</code>, <code>CooldownCanceled</code>, and <code>Unstaked</code>, whose{" "}
                <code>fee</code> is zero for a finalised cooldown and 5% for an instant unstake. The cooldown
                queue is PENDLE held minus sPENDLE supply, walked back through those events. The
                instant-unstake fee is the PENDLE transfer to the treasury in the same transaction.
              </Step>
              <Step id="method-holders" title="Holders">
                A fixed list of labelled wallets (Pendle&apos;s multisigs and treasury, Binance Labs,
                the Binance, Crypto.com and Gate.io wallets that hold PENDLE, the Arbitrum, Wormhole,
                Base and Optimism bridge escrows, the Penpie, Equilibria and Stake DAO lockers, the
                buyback contract and gauge controller) is read with <code>balanceOf</code> at the
                latest block and at 50,400 and 216,000 blocks earlier, about 7 and 30 days. Labels are
                Etherscan&apos;s and Dune&apos;s public tags. The split is those balances plus PENDLE in
                the two staking contracts against total supply; &ldquo;everything else&rdquo; is the
                remainder, which includes unlabelled exchange wallets. Lock positions are every{" "}
                <code>NewLockPosition</code> event the vePENDLE contract has emitted, latest per wallet,
                kept where the expiry is ahead; the largest are re-read with <code>positionData</code>.
                The live unlock schedule is <code>slopeChanges</code> at the latest block, the snapshot
                one at the snapshot block.
              </Step>
              <Step id="method-virtual" title="Virtual sPENDLE">
                The same unlock schedule is read as it stood at the snapshot block and replayed: every lock gets
                <code>1 + 3 × remaining / 2y</code>, which is 4× for a full two-year lock, 2.5× for one
                year, and 1× at unlock. Summed over the snapshot positions, that equals{" "}
                <code>locked + 3 × vePENDLE balance</code>. It matches Pendle&apos;s API figure to
                within its cache delay.
              </Step>
              <Step id="method-rewards" title="Rewards">
                Each distribution is a PENDLE transfer from the buyback contract into the staking
                contract; in the same transaction the new sPENDLE goes to the rewards distributor that
                stakers claim from. APR = amount ÷ (eligible sPENDLE + virtual sPENDLE just before the
                payout) × 26.09 epochs per year. Eligible sPENDLE is every sPENDLE in existence: rewards not
                yet claimed sit in the distributor and keep earning for their owners, so the total
                supply is the denominator and a wallet&apos;s eligible balance is what it holds plus what
                it has accrued and not claimed. Trailing APR is the arithmetic mean of the last{" "}
                {data.yield.trailing.epochs} per-epoch APRs, each with its own eligible total.
              </Step>
              <Step id="method-usd" title="USD">
                Live PENDLE/USD is the PENDLE quote from Pendle&apos;s price API (<code>/v1/prices/assets</code>). Held quantities (protocol sPENDLE and locked PENDLE; a wallet&apos;s sPENDLE,
                lock, cooldown, and wallet PENDLE) are multiplied by that price. Virtual sPENDLE is
                reward weight and APR is a token-for-token ratio, so neither is priced.
              </Step>
              <Step id="method-fees" title="Fees">
                Daily USD is DefiLlama&apos;s Pendle fees feed (<code>summary/fees/pendle</code>), Pendle V2
                only, Boros dropped, from the 29 Jan 2026 snapshot onward. DefiLlama books a fee
                on the day the tokens reach Pendle&apos;s treasury, so an epoch&apos;s USD is lumpy, is
                not Pendle&apos;s own epoch accounting, and its last day can arrive a day late. The first
                row, 27 Jan 2026, starts at the 29 Jan snapshot. Gross
                swap = supply-side revenue ÷ 0.20; &ldquo;YT and other fees&rdquo; = DefiLlama&apos;s
                Revenue field − 0.80 × swap, which is everything booked at the treasury that is not
                AMM swap fee: YT yield and points fees, limit-order fees, post-maturity yield, and
                airdrop tokens forwarded to the distributor. Days are summed into the same Tuesday
                00:00 UTC 14-day epochs as sPENDLE. The 80/10/10 split of Revenue into buyback share,
                treasury, and operations is policy, not a flow; funded is every USDT transfer into the
                buyback contract, attributed to the fee epoch whose
                end is nearest, within seven days either side (Pendle funds it around the epoch boundary). Bought is the buyback
                that funding executed: the PENDLE the contract received and the USDT it spent between
                consecutive distributions, from its transfer history, credited to the fee
                epoch whose distribution landed 14 to 28 days after the epoch start. In-kind airdrops
                are the per-epoch airdrop USD from Pendle&apos;s staking API (<code>/spendle/data</code>); they sit inside
                Revenue but are passed to stakers as-is, never bought back. PENDLE supply is
                unchanged; emissions are Performance-stream PENDLE paid to LPs from the Ethereum gauge
                controller (start balance + top-ups − end balance, epoch boundaries approximated
                from block times); limit-order and co-incentive PENDLE is paid elsewhere and is not
                counted. The AIM card is the assignment from Pendle&apos;s incentives API (<code>/pendle-emission</code>)
                across every chain, PENDLE per week as reported.
              </Step>
              <Step id="method-valuation" title="Valuation">
                FDV is total supply × price. Circulating supply is total minus PENDLE in Pendle&apos;s
                governance multisig, ecosystem fund, team tokens multisig and treasury, and in the
                buyback contract and gauge controller; staked and locked PENDLE is holders&apos; and
                counts. Annualised fees and revenue are the mean of the last four complete fee epochs
                × 26.09; annualised buybacks are the mean USDT spent over the last six distributions ×
                26.09. Emissions cost is AIM&apos;s weekly PENDLE assignment × 52 × today&apos;s price.
                Revenue reaching stakers is USDT funded to the buyback contract ÷ DefiLlama revenue
                over the last four closed funding windows. Price paid per PENDLE: each distribution&apos;s price paid
                is USDT spent ÷ PENDLE bought; its benchmark is DefiLlama&apos;s daily PENDLE/USD close
                (<code>coins.llama.fi</code>) nearest to each USDT outflow from the buyback contract (timed by
                interpolating blocks between distributions), weighted by USDT spent; paid ÷ benchmark − 1 is
                the difference shown on hover. Value today is all PENDLE bought × the live quote. The market
                line is the same daily series, ending at the live quote.
              </Step>
              <Step id="method-assumptions" title="Assumptions">
                Every holder is treated as &ldquo;active&rdquo; (no one forfeited an epoch by skipping a
                governance vote, which Pendle requires for rewards), so APRs are a floor for active holders. Protocol-level APRs count PENDLE
                buybacks only; in-kind airdrops are priced only in the position section, in USD as
                Pendle&apos;s API reports them, converted at each epoch&apos;s buyback price. Projections hold sPENDLE supply and the latest distribution
                flat. Locks changed after the snapshot are ignored for the boost, matching how it was
                granted. Pendle&apos;s API covers airdrop data for the last 12 epochs; earlier epochs are
                left out of a wallet&apos;s airdrop-inclusive mean.
              </Step>
            </ol>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Step({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <li
      id={id}
      className="scroll-mt-24 grid gap-1 [counter-increment:step] before:text-xs before:text-muted-foreground before:content-[counter(step,decimal-leading-zero)]"
    >
      <div className="font-medium text-foreground">{title}</div>
      <div className="[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[11px] [&_code]:text-foreground/90">
        {children}
      </div>
    </li>
  );
}
