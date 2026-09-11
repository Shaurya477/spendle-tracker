"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshTracker } from "@/app/actions";

export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() =>
        start(async () => {
          await refreshTracker();
          router.refresh();
        })
      }
      disabled={pending}
      className="font-mono text-xs"
    >
      <RefreshCw className={pending ? "animate-spin" : ""} />
      {pending ? "Reading chain…" : "Refresh"}
    </Button>
  );
}
