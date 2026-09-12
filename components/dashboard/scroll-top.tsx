"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "cn";

/** Fixed bottom-right button back to the top of the page; appears once the hero has scrolled away. */
export function ScrollTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setShow(window.scrollY > 600));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0 })}
      className={cn(
        "fixed bottom-4 right-4 z-30 flex size-10 items-center justify-center rounded-full border border-border bg-background/85 text-muted-foreground shadow-lg shadow-black/10 backdrop-blur transition-[opacity,translate,color,border-color] duration-200 hover:border-foreground/40 hover:text-foreground sm:bottom-6 sm:right-6",
        show ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <ArrowUp className="size-4" />
    </button>
  );
}
