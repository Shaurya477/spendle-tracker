"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshTracker } from "@/app/actions";

/** Drops the cached dataset and re-renders; `pending` is true while the chain is being read. */
export function useRefreshTracker() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const refresh = () =>
    start(async () => {
      await refreshTracker();
      router.refresh();
    });
  return [pending, refresh] as const;
}

export function RefreshButton() {
  const [pending, refresh] = useRefreshTracker();
  return (
    <Button variant="outline" size="sm" onClick={refresh} disabled={pending} className="font-mono text-xs">
      <RefreshCw className={pending ? "animate-spin" : ""} />
      {pending ? "Reading chain…" : "Refresh"}
    </Button>
  );
}
