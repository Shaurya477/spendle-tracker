import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "cn";
import { ETHERSCAN } from "@/lib/pendle/config";
import { shortHash } from "@/lib/format";
import { InfoTip } from "./info-tip";

/** Small sentence-case label that names the figure or block under it. */
export function Eyebrow({
  children,
  className,
  tip,
  tipLabel,
}: {
  children: ReactNode;
  className?: string;
  tip?: ReactNode;
  tipLabel?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-1 text-xs font-medium text-muted-foreground", className)}>
      <span>{children}</span>
      {tip && <InfoTip label={tipLabel ?? (typeof children === "string" ? children : "this figure")}>{tip}</InfoTip>}
    </div>
  );
}

export function SectionHeading({
  index,
  title,
  lede,
  methodId,
  className,
}: {
  index: string;
  title: ReactNode;
  lede?: ReactNode;
  methodId?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-baseline gap-3">
        <span className="tabular text-sm text-muted-foreground">{index}</span>
        <h2 className="font-display text-[2rem] leading-none sm:text-[2.6rem]">{title}</h2>
      </div>
      {lede && <p className="max-w-[68ch] text-[15px] leading-relaxed text-muted-foreground">{lede}</p>}
      {methodId && (
        <a
          href={`#${methodId}`}
          className="self-start text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
        >
          How these numbers are made
        </a>
      )}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  usd,
  sub,
  tip,
  tipLabel,
  tone,
  className,
  size = "md",
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  usd?: ReactNode;
  sub?: ReactNode;
  tip?: ReactNode;
  /** Accessible name for the info button when `label` is not a plain string. */
  tipLabel?: string;
  tone?: "spendle" | "vependle" | "boost";
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Eyebrow tip={tip} tipLabel={tipLabel ?? (typeof label === "string" ? label : undefined)}>
        {label}
      </Eyebrow>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span
          className={cn(
            "font-figure leading-none",
            size === "lg" ? "text-3xl sm:text-4xl" : "text-2xl",
            tone === "spendle" && "text-spendle",
            tone === "vependle" && "text-vependle",
            tone === "boost" && "text-boost",
          )}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {usd != null && <div className="tabular text-sm text-muted-foreground">{usd}</div>}
      {sub && <div className="text-xs leading-relaxed text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function AddressLink({ address, label }: { address: string; label?: string }) {
  return (
    <a
      href={`${ETHERSCAN}/address/${address}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-mono text-xs text-foreground/80 underline decoration-border underline-offset-4 hover:text-spendle"
    >
      <span className="min-w-0 break-all">{label ?? shortHash(address)}</span>
      <ArrowUpRight className="size-3 shrink-0" />
    </a>
  );
}

export function TxLink({ hash }: { hash: string }) {
  return (
    <a
      href={`${ETHERSCAN}/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-mono text-xs text-foreground/80 underline decoration-border underline-offset-4 hover:text-spendle"
    >
      {shortHash(hash)}
      <ArrowUpRight className="size-3" />
    </a>
  );
}

/** Legend key for a chart line: a short solid or dashed rule in the line's colour. */
export function LineSwatch({
  tone,
  dashed = false,
}: {
  tone: "spendle" | "vependle" | "boost" | "foreground";
  dashed?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block w-4 border-t-2 align-middle",
        dashed && "border-dashed",
        tone === "spendle" && "border-spendle",
        tone === "vependle" && "border-vependle",
        tone === "boost" && "border-boost",
        tone === "foreground" && "border-foreground",
      )}
    />
  );
}

export function Swatch({ tone }: { tone: "spendle" | "vependle" | "boost" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-block size-2.5 rounded-sm",
        tone === "spendle" && "bg-spendle",
        tone === "vependle" && "bg-vependle",
        tone === "boost" && "bg-boost",
        tone === "muted" && "bg-muted-foreground/50",
      )}
    />
  );
}
