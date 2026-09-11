/**
 * Fixed page backdrop: soft accent glows, a ledger grid that fades down the viewport, and three
 * thin rings anchored off the top-right corner. Pure CSS, no motion, sits behind all content.
 */
export function Backdrop() {
  return (
    <div aria-hidden="true" className="backdrop">
      <div className="backdrop-glow" />
      <div className="backdrop-grid" />
      <div className="backdrop-rings">
        <span style={{ "--d": "72vmax" } as React.CSSProperties} />
        <span style={{ "--d": "104vmax" } as React.CSSProperties} />
        <span style={{ "--d": "140vmax" } as React.CSSProperties} />
      </div>
    </div>
  );
}
