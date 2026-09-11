import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtInt } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { AddressLink, Eyebrow, SectionHeading } from "./primitives";
import { CopyButton } from "./copy-button";

export function Methodology({ data }: { data: TrackerData }) {
  const a = data.addresses;
  return (
    <section id="methodology" className="scroll-mt-20 flex flex-col gap-8">
      <SectionHeading index="08" title="How the numbers are made" />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="rise rise-1 border-0 bg-card/60">
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

        <Card className="rise rise-2 border-0 bg-card/60">
          <CardContent>
            <ol className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground [counter-reset:step]">
              <Step title="Balances">
                sPENDLE staked is all sPENDLE in existence (<code>totalSupply()</code> on the staking
                contract). Locked PENDLE is what the vePENDLE contract holds. Active and expired locks
                come from the contract&apos;s weekly unlock schedule (<code>slopeChanges</code>): each
                week&apos;s slope × 104 weeks is the PENDLE unlocking that week.
              </Step>
              <Step title="Virtual sPENDLE">
                The same unlock schedule is read as it stood at the snapshot block and replayed: every lock gets
                <code>1 + 3 × remaining / 2y</code>, which is 4× for a full two-year lock, 2.5× for one
                year, and 1× at unlock. Summed over the snapshot positions, that equals{" "}
                <code>locked + 3 × vePENDLE balance</code>. It matches Pendle&apos;s API figure to
                within its cache delay.
              </Step>
              <Step title="Rewards">
                Each distribution is a PENDLE transfer from the buyback contract into the staking
                contract; in the same transaction the new sPENDLE goes to the rewards distributor that
                stakers claim from. APR = amount ÷ (eligible sPENDLE + virtual sPENDLE just before the
                payout) × 26.09 epochs per year. Eligible sPENDLE is every sPENDLE in existence: rewards not
                yet claimed sit in the distributor and keep earning for their owners, so the total
                supply is the denominator and a wallet&apos;s eligible balance is what it holds plus what
                it has accrued and not claimed.
              </Step>
              <Step title="USD">
                Live PENDLE/USD is the PENDLE quote from Pendle&apos;s price API (<code>/v1/prices/assets</code>). Held quantities (protocol sPENDLE and locked PENDLE; a wallet&apos;s sPENDLE,
                lock, cooldown, and wallet PENDLE) are multiplied by that price. Virtual sPENDLE is
                reward weight and APR is a token-for-token ratio, so neither is priced.
              </Step>
              <Step title="Fees">
                Daily USD is DefiLlama&apos;s Pendle fees feed (<code>summary/fees/pendle</code>), Pendle V2
                only, Boros dropped, from the 29 Jan 2026 snapshot onward. DefiLlama books a fee
                on the day the tokens reach Pendle&apos;s treasury, so an epoch&apos;s USD is lumpy, is
                not Pendle&apos;s own epoch accounting, and its last day can arrive a day late. Gross
                swap = supply-side revenue ÷ 0.20; &ldquo;YT and other fees&rdquo; = DefiLlama&apos;s
                Revenue field − 0.80 × swap, which is everything booked at the treasury that is not
                AMM swap fee: YT yield and points fees, limit-order fees, post-maturity yield, and
                airdrop tokens forwarded to the distributor. Days are summed into the same Tuesday
                00:00 UTC 14-day epochs as sPENDLE. The 80/10/10 split of Revenue into buyback share,
                treasury, and operations is policy, not a flow; funded is every USDT transfer into the
                buyback contract, attributed to the fee epoch whose
                end is nearest (Pendle funds it around the epoch boundary). Bought is the buyback
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
              <Step title="Assumptions">
                Every holder is treated as &ldquo;active&rdquo; (no one forfeited an epoch by skipping a
                governance vote, which Pendle requires for rewards), so APRs are a floor for active holders. Protocol-level APRs count PENDLE
                buybacks only; in-kind airdrops are priced only in the position section, in USD as
                Pendle&apos;s API reports them, converted at each epoch&apos;s buyback price. Projections hold sPENDLE supply and the latest distribution
                flat. Locks changed after the snapshot are ignored for the boost, matching how it was
                granted.
              </Step>
            </ol>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="grid gap-1 [counter-increment:step] before:font-mono before:text-[11px] before:text-muted-foreground before:content-[counter(step,decimal-leading-zero)]">
      <div className="font-medium text-foreground">{title}</div>
      <div className="[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[11px] [&_code]:text-foreground/90">
        {children}
      </div>
    </li>
  );
}
