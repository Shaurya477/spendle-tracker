import { Children, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "cn";
import { ETHERSCAN } from "@/lib/pendle/config";
import { shortHash } from "@/lib/format";

const TOKEN_CASE = /(sPENDLE|vePENDLE)/;

/** Inside `uppercase` text, keep the token names' own casing: sPENDLE and vePENDLE, never SPENDLE. */
export function keepTokenCase(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child !== "string" || !TOKEN_CASE.test(child)) return child;
    return child
      .split(TOKEN_CASE)
      .map((part, i) =>
        TOKEN_CASE.test(part) ? <span key={i} className="normal-case">{part}</span> : part,
      );
  });
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
    >
      {keepTokenCase(children)}
    </div>
  );
}

export function SectionHeading({
  index,
  title,
  lede,
  className,
}: {
  index: string;
  title: string;
  lede?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-xs text-muted-foreground">{index}</span>
        <h2 className="font-display text-3xl leading-none tracking-tight sm:text-4xl">{title}</h2>
      </div>
      {lede && <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{lede}</p>}
      <div className="rule" />
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  usd,
  sub,
  tone,
  className,
  size = "md",
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  usd?: ReactNode;
  sub?: ReactNode;
  tone?: "spendle" | "vependle" | "boost";
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Eyebrow>{label}</Eyebrow>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span
          className={cn(
            "tabular font-mono leading-none tracking-tight",
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
      {usd != null && <div className="tabular font-mono text-sm text-muted-foreground">{usd}</div>}
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
  tone: "spendle" | "vependle" | "boost";
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
