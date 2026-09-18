/**
 * The page-level loading state. A cold dataset takes about 30 seconds of contract reads, so the
 * heading says what is happening and the bar shows the page is alive. Everything that moves is CSS:
 * React does not hydrate a pending Suspense fallback, so client state here would never update.
 */
export function LoadingState() {
  return (
    <div className="flex flex-col gap-5" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-spendle/60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-spendle" />
        </span>
        Ethereum mainnet · latest block
      </div>
      <h1 className="font-display text-[2rem] leading-none tracking-tight sm:text-[2.6rem]">
        Reading Ethereum chain data
        <span className="loading-dots" aria-hidden="true">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </h1>
      <div className="h-1 w-full max-w-xl overflow-hidden rounded-full bg-muted">
        <div className="loading-sweep h-full w-1/3 rounded-full bg-spendle" />
      </div>
      <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
        Every figure is computed from contract reads and public feeds, then cached for five minutes. A
        fresh read takes about 30 seconds; a cached one is instant.
      </p>
    </div>
  );
}
