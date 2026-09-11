"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHeader } from "@/components/ui/table";

/**
 * A table that shows its first `initial` rows and expands to all of them on request. Rows are
 * rendered by the caller (server side) and passed in, so this only owns the open/closed state.
 */
export function ExpandableTable({
  head,
  rows,
  initial = 3,
  noun,
}: {
  head: ReactNode;
  rows: ReactNode[];
  initial?: number;
  /** Plural noun for the toggle label, e.g. "epochs" or "distributions". */
  noun: string;
}) {
  const [open, setOpen] = useState(false);
  const collapsible = rows.length > initial;
  const visible = open || !collapsible ? rows : rows.slice(0, initial);
  return (
    <>
      <Table>
        <TableHeader>{head}</TableHeader>
        <TableBody>{visible}</TableBody>
      </Table>
      {collapsible && (
        <div className="flex justify-center border-t border-border px-4 pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <ChevronDown className={cn("transition-transform duration-200", open && "rotate-180")} />
            {open ? `Show latest ${initial}` : `Show all ${rows.length} ${noun}`}
          </Button>
        </div>
      )}
    </>
  );
}
