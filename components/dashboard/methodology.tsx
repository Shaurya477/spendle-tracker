import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtInt } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { AddressLink, Eyebrow, SectionHeading } from "./primitives";

export function Methodology({ data }: { data: TrackerData }) {
  const a = data.addresses;
  return (
    <section className="flex flex-col gap-8">
      <SectionHeading index="06" title="How the numbers are made" />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="rise rise-1 border-0 bg-card/60">
          <CardContent className="flex flex-col gap-4">
            <Eyebrow>Contracts · Ethereum mainnet</Eyebrow>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
              <dt className="text-muted-foreground">PENDLE</dt>
              <dd><AddressLink address={a.pendle} label={a.pendle} /></dd>
              <dt className="text-muted-foreground">sPENDLE</dt>
              <dd><AddressLink address={a.sPendle} label={a.sPendle} /></dd>
              <dt className="text-muted-foreground">vePENDLE</dt>
              <dd><AddressLink address={a.vePendle} label={a.vePendle} /></dd>
              <dt className="text-muted-foreground">Buyback</dt>
              <dd><AddressLink address={a.buyback} label={a.buyback} /></dd>
              <dt className="text-muted-foreground">Merkle distributor</dt>
              <dd><AddressLink address={a.merkleDistributor} label={a.merkleDistributor} /></dd>
            </dl>
            <div className="rule" />
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <div>
                RPC <span className="font-mono text-foreground/80">{data.rpcUrl}</span>
              </div>
              <div>
                Snapshot block{" "}
                <span className="font-mono text-foreground/80">{fmtInt(data.loyalty.snapshot.block)}</span> ·
                last block before 29 Jan 2026 00:00 UTC
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
                year, and 1× at unlock. Summed, that is simply{" "}
                <code>locked + 3 × vePENDLE balance</code> of the snapshot positions. It matches
                Pendle&apos;s API figure to within its cache delay.
              </Step>
              <Step title="Rewards">
                Distribution events are the PENDLE <code>Transfer</code>s from the buyback contract
                into sPENDLE; in the same transaction the minted sPENDLE goes to the Merkle
                distributor. APR = amount ÷ (eligible sPENDLE + virtual sPENDLE the block before) ×
                26.09 epochs per year. Eligible sPENDLE excludes rewards still unclaimed inside the
                distributor.
              </Step>
              <Step title="Assumptions">
                Every holder is treated as &ldquo;active&rdquo; (no one forfeited an epoch by skipping a
                PPP vote), so APRs are a floor for active holders. Only PENDLE buybacks count; in-kind
                airdrops of other tokens are not priced. Projections hold sPENDLE supply and the latest
                payout flat. Locks changed after the snapshot are ignored for the boost, matching how the
                bonus was granted.
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
