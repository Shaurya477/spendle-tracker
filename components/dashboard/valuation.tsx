import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtCompact, fmtMult, fmtPct, fmtUsdCompact, fmtUsdPrice } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { BuybackPriceChart } from "./charts";
import { Eyebrow, LineSwatch, SectionHeading, Stat, Swatch } from "./primitives";

export function Valuation({ data }: { data: TrackerData }) {
  const v = data.valuation;
  const signedPct = (x: number) => `${x >= 0 ? "+" : "−"}${fmtPct(Math.abs(x), 2)}`;
  const avgPaid = v.buybackPrices.reduce((s, p) => s + p.usd, 0) / v.buybackPrices.reduce((s, p) => s + p.pendle, 0);

  return (
    <section id="valuation" className="scroll-mt-20 flex flex-col gap-8">
      <SectionHeading
        index="07"
        title="What the market pays for it"
        methodId="method-valuation"
        lede={
          <>
            PENDLE at <span className="tabular text-foreground">{fmtUsdPrice(v.price)}</span> is a{" "}
            <span className="tabular text-foreground">{fmtUsdCompact(v.fdv)}</span> network earning{" "}
            <span className="tabular text-foreground">{fmtUsdCompact(v.feesAnnual)}</span> a year in fees at the
            current run rate, of which <span className="tabular text-foreground">{fmtUsdCompact(v.buybackAnnual)}</span>{" "}
            is spent buying PENDLE for stakers.
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardContent>
            <Stat
              label="Fully diluted value"
              value={fmtUsdCompact(v.fdv)}
              size="lg"
              sub={`${fmtCompact(v.fdv / v.price)} PENDLE × ${fmtUsdPrice(v.price)}`}
              tip="Total supply × price. Supply is fixed; nothing has been minted since the snapshot."
            />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <Stat
              label="Market cap"
              value={fmtUsdCompact(v.marketCap)}
              size="lg"
              sub={`${fmtCompact(v.circulating)} circulating; ${fmtCompact(v.pendleHeld)} in Pendle's wallets and contracts left out`}
              tip="Circulating = total supply − Pendle's governance multisig, ecosystem fund, team tokens multisig, treasury, buyback contract and gauge controller. Staked and locked PENDLE counts as circulating: it is owned by holders."
            />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <Stat
              label="Price to fees"
              value={fmtMult(v.mcapToFees, 1)}
              size="lg"
              sub={`${fmtMult(v.fdvToFees, 1)} on FDV; ${fmtMult(v.mcapToRevenue, 1)} on revenue after the LP share`}
              tip={`Market cap ÷ annualised gross fees. Fees are the mean of the last ${v.epochsUsed} complete 14-day epochs × 26.09. A lower multiple is cheaper.`}
            />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <Stat
              label="Fee yield"
              value={fmtPct(v.feeYield)}
              tone="spendle"
              size="lg"
              sub="annualised fees ÷ market cap; the earnings-yield analogue"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardContent>
            <Stat
              label="Buyback yield"
              value={fmtPct(v.buybackYield)}
              tone="spendle"
              size="lg"
              sub={`${fmtUsdCompact(v.buybackAnnual)} a year at the last ${v.distributionsUsed} distributions' pace, on the market cap`}
              tip="USDT the buyback contract spent, averaged over the last six distributions and annualised, divided by market cap. This is what reaches stakers, expressed as a yield on every circulating PENDLE; stakers get it concentrated on their share."
            />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <Stat
              label="Net of emissions"
              value={signedPct(v.netBuybackYield)}
              tone={v.netBuybackYield >= 0 ? "spendle" : "boost"}
              size="lg"
              sub={`buybacks minus ${fmtUsdCompact(v.emissionsAnnualUsd)} a year of AIM incentives at today's price`}
              tip="AIM assigns a weekly PENDLE budget to LPs across chains and streams; × 52 × price gives the yearly cost in USD. Positive means the protocol buys more PENDLE than it pays out."
            />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <Stat
              label="Revenue reaching stakers"
              value={fmtPct(v.payoutRatio, 0)}
              tone={v.payoutRatio >= 0.7 ? "spendle" : "boost"}
              size="lg"
              sub={`USDT funded to the buyback contract ÷ DefiLlama revenue, last ${v.payoutEpochs} closed epochs; policy says up to 80%`}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <Eyebrow tip="For each distribution: USDT the buyback contract spent in the window and the PENDLE it received, so spent ÷ received is the price paid. The hourly TWAP buys over about a week, so it is a weekly average, not a print.">
                What the protocol paid per PENDLE
              </Eyebrow>
              <p className="max-w-[64ch] text-xs leading-relaxed text-muted-foreground">
                Across {v.buybackPrices.length} distributions the buyback paid {fmtUsdPrice(avgPaid)} on average against{" "}
                {fmtUsdPrice(v.price)} today.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Swatch tone="spendle" /> USDT spent
              </span>
              <span className="inline-flex items-center gap-1.5">
                <LineSwatch tone="foreground" /> paid per PENDLE
              </span>
              <span className="inline-flex items-center gap-1.5">
                <LineSwatch tone="boost" dashed /> price today
              </span>
            </div>
          </div>
          <BuybackPriceChart prices={v.buybackPrices} spot={v.price} />
        </CardContent>
      </Card>
    </section>
  );
}
