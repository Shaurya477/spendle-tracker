"use client";

import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "cn";
import { Popover, PopoverContent, PopoverDescription, PopoverTrigger } from "@/components/ui/popover";

/**
 * A small info button beside a label. Hover, keyboard focus, or a tap opens a short note; outside
 * press, Escape, or focus leaving closes it.
 */
export function InfoTip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={80}
        aria-label={`About ${label}`}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) setOpen(true);
        }}
        className={cn(
          "relative inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-[popup-open]:text-foreground after:absolute after:-inset-2 after:content-['']",
          className,
        )}
      >
        <Info className="size-3.5" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        collisionPadding={12}
        collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "none" }}
        className="w-max max-w-[min(18rem,calc(100vw-1.5rem))] rounded-md border border-border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-lg shadow-black/25 outline-none"
      >
        <PopoverDescription className="m-0 text-popover-foreground">{children}</PopoverDescription>
      </PopoverContent>
    </Popover>
  );
}
