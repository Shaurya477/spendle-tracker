"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "cn";

/** Copies `value` (a string, or a function evaluated at click time) to the clipboard and shows a check for a moment. */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string | (() => string);
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(typeof value === "function" ? value() : value);
          setCopied(true);
        } catch {
          // Clipboard access denied (insecure context or permission); leave the icon unchanged.
        }
      }}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        copied && "text-spendle hover:text-spendle",
        className,
      )}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </button>
  );
}
