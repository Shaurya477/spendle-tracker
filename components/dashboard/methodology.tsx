import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtInt } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { AddressLink, Eyebrow, SectionHeading } from "./primitives";

export function Methodology({ data }: { data: TrackerData }) {
  const a = data.addresses;
  return (
    <section className="flex flex-col gap-8">
      <SectionHeading index="08" title="How the numbers are made" />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="rise rise-1 border-0 bg-card/60">
          <CardContent className="flex flex-col gap-4">
            <Eyebrow>Contracts on Ethereum mainnet</Eyebrow>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
              <dt className="text-muted-foreground">PENDLE</dt>
              <dd className="min-w-0"><AddressLink address={a.pendle} label={a.pendle} /></dd>
              <dt className="text-muted-foreground">sPENDLE</dt>
              <dd className="min-w-0"><AddressLink address={a.sPendle} label={a.sPendle} /></dd>
              <dt className="text-muted-foreground">vePENDLE</dt>
              <dd className="min-w-0"><AddressLink address={a.vePendle} label={a.vePendle} /></dd>
              <dt className="text-muted-foreground">Buyback</dt>
              <dd className="min-w-0"><AddressLink address={a.buyback} label={a.buyback} /></dd>
              <dt className="text-muted-foreground">Merkle distributor</dt>
              <dd className="min-w-0"><AddressLink address={a.merkleDistributor} label={a.merkleDistributor} /></dd>
              <dt className="text-muted-foreground">Gauge controller</dt>
              <dd className="min-w-0"><AddressLink address={a.gaugeController} label={a.gaugeController} /></dd>
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
                sPENDLE staked is <code>totalSupply()</code> of the StakedPendle contract. Locked
                PENDLE is the PENDLE balance of the VotingEscrow contract. Active vs expired locks
                come from <code>slopeChanges(week)</code>: each bucket&apos;s slope × 104 weeks is the
                PENDLE unlocking that week.
              </Step>
              <Step title="Virtual sPENDLE">
                The same slope buckets are read at the snapshot block and replayed: every lock gets
                <code>1 + 3 × remaining / 2y</code>, which is 4× for a full two-year lock, 2.5× for one
                year, and 1× at unlock. Summed over the snapshot positions, that equals{" "}
                <code>locked + 3 × vePENDLE balance</code>. It matches Pendle&apos;s API figure to
                within its cache delay.
              </Step>
              <Step title="Rewards">
                Distribution events are the PENDLE <code>Transfer</code>s from the buyback contract
                into sPENDLE; in the same transaction the minted sPENDLE goes to the Merkle
                distributor. APR = amount ÷ (eligible sPENDLE + virtual sPENDLE the block before) ×
                26.09 epochs per year. Eligible sPENDLE excludes rewards still unclaimed inside the
                distributor.
              </Step>
              <Step title="USD">
                Live PENDLE/USD is Pendle&apos;s <code>/v1/prices/assets</code> quote for the PENDLE
                token. Held quantities (protocol sPENDLE and locked PENDLE; a wallet&apos;s sPENDLE,
                lock, cooldown, and wallet PENDLE) are multiplied by that price. Virtual sPENDLE is
                reward weight and APR is a token-for-token ratio, so neither is priced.
              </Step>
              <Step title="Fees">
                Daily USD is DefiLlama <code>summary/fees/pendle</code>, summing the Pendle V2
                label and dropping Boros, from the 29 Jan 2026 snapshot onward. DefiLlama books a fee
                on the day the tokens reach Pendle&apos;s treasury, so an epoch&apos;s USD is lumpy, is
                not Pendle&apos;s own epoch accounting, and its last day can arrive a day late. Gross
                swap = supply-side revenue ÷ 0.20; &ldquo;YT and other fees&rdquo; = DefiLlama&apos;s
                Revenue field − 0.80 × swap, which is everything booked at the treasury that is not
                AMM swap fee: YT yield and points fees, limit-order fees, post-maturity yield, and
                airdrop tokens forwarded to the distributor. Days are summed into the same Tuesday
                00:00 UTC 14-day epochs as sPENDLE. The 80/10/10 split of Revenue into buyback share,
                treasury, and operations is policy, not a flow; funded is every USDT{" "}
                <code>Transfer</code> into the buyback contract, attributed to the fee epoch whose
                end is nearest (Pendle funds it around the epoch boundary). PENDLE supply is
                unchanged; ETH gauge spend is Performance-stream PENDLE leaving the Ethereum gauge
                controller (start balance + top-ups − end balance, epoch boundaries approximated
                from block times); limit-order and co-incentive PENDLE is paid elsewhere and is not
                counted. The AIM card is Pendle&apos;s <code>/pendle-emission</code> assignment across
                every chain, PENDLE per week as reported.
              </Step>
              <Step title="Assumptions">
                Every holder is treated as &ldquo;active&rdquo; (no one forfeited an epoch by skipping a
                PPP vote), so APRs are a floor for active holders. Protocol-level APRs count PENDLE
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
