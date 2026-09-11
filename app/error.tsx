"use client";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/dashboard/primitives";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-24 sm:px-8">
      <Eyebrow className="text-destructive">Chain read failed</Eyebrow>
      <h1 className="font-display text-4xl tracking-tight">The RPC did not give us a clean answer.</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Nothing is cached or substituted; the page only renders from a complete set of onchain
        reads. Retry, or point <code className="font-mono">ETH_RPC_URL</code> at an archive-capable
        node that supports wide <code className="font-mono">eth_getLogs</code> ranges.
      </p>
      <pre className="overflow-x-auto rounded-md border border-border bg-card p-4 font-mono text-xs text-destructive/90">
        {error.message}
      </pre>
      <div>
        <Button onClick={reset} variant="outline" className="font-mono text-xs">
          Retry
        </Button>
      </div>
    </main>
  );
}
