import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtCompact, fmtMult, fmtPct, fmtUsdCompact, fmtUsdPrice } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { BUYBACK_PRICE_SERIES } from "@/lib/chart-series";
import { BuybackPriceChart } from "./charts";
import { Eyebrow, SectionHeading, Stat } from "./primitives";
import { SeriesLegend, SeriesProvider } from "./series";

export function Valuation({ data }: { data: TrackerData }) {
  const v = data.valuation;
  const signedPct = (x: number) => `${x >= 0 ? "+" : "−"}${fmtPct(Math.abs(x), 2)}`;

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
              label="Price to TVL"
              value={fmtMult(v.mcapToTvl, 2)}
              size="lg"
              sub={`${fmtMult(v.fdvToTvl, 2)} on FDV; ${fmtUsdCompact(v.tvl)} deposited in Pendle V2 across all chains`}
              tip="Market cap ÷ TVL, where TVL is everything deposited in Pendle V2 markets on every chain, DefiLlama's headline figure: staked PENDLE, pool2 and Boros are excluded. It is what the market pays per dollar the protocol holds; a lower multiple is cheaper. Not a cash-flow measure, since fee take varies with market mix."
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
              tip={`Annualised gross fees ÷ market cap, the inverse of a price-to-fees multiple. Fees are the mean of the last ${v.epochsUsed} complete 14-day epochs × 26.09, DefiLlama's Pendle V2 figure across every chain, before the LP share. Not what a holder receives: only the buyback part reaches stakers (see buyback yield).`}
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
          <SeriesProvider series={BUYBACK_PRICE_SERIES}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1.5">
                <Eyebrow tip="For each distribution: USDT the buyback contract spent in the window (mint bars, left axis) and the PENDLE it received (gold bars, second left axis), so spent ÷ received is the price paid (white line, right axis). The hourly TWAP buys over about a week, so it is a weekly average, not a print. The market line is DefiLlama's daily PENDLE/USD close, ending at the live quote. The strip below is paid ÷ the market on the days the TWAP was buying − 1: above zero it paid more than the market, below zero less. Legend items switch their series on and off; the last one shown stays on.">
                  What the protocol paid per PENDLE
                </Eyebrow>
                <p className="max-w-[72ch] text-xs leading-relaxed text-muted-foreground">
                  Across {v.buybackPrices.length} distributions the buyback paid {fmtUsdPrice(v.bought.avgPaid)} on average;
                  PENDLE is {fmtUsdPrice(v.price)} today, so the {fmtCompact(v.bought.pendle)} PENDLE bought for{" "}
                  {fmtUsdCompact(v.bought.usd)} and paid to stakers is worth {fmtUsdCompact(v.bought.valueToday)} (
                  {signedPct(v.bought.gain)}).
                </p>
              </div>
              <SeriesLegend />
            </div>
            <BuybackPriceChart prices={v.buybackPrices} history={v.priceHistory} />
          </SeriesProvider>
        </CardContent>
      </Card>
    </section>
  );
}
