"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const KEY = "spendle-tos";

export function Disclaimer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(localStorage.getItem(KEY) !== "1");
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function accept() {
    localStorage.setItem(KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tos-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-xl bg-card p-6 ring-1 ring-border sm:p-7">
        <div className="text-xs font-medium text-muted-foreground">
          Terms
        </div>
        <h2 id="tos-title" className="font-display mt-2 text-3xl leading-none tracking-tight">
          Before you continue
        </h2>
        <ul className="mt-5 flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <li>This dashboard is independent. It is not built, operated, or endorsed by Pendle.</li>
          <li>Nothing here is financial advice. Do your own research.</li>
          <li>
            Figures are computed from public contract state, Pendle&apos;s public API, and
            DefiLlama. They can be wrong, delayed, or incomplete. Verify before acting.
          </li>
          <li>You use this site at your own risk.</li>
        </ul>
        <Button type="button" size="lg" className="mt-6 w-full" onClick={accept}>
          I understand
        </Button>
      </div>
    </div>
  );
}
