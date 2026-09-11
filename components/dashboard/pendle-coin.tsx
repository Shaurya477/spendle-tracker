/** The PENDLE token icon: the Pendle mark set inside its coin, in the brand colours. */
export function PendleCoin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" aria-hidden="true" className={className}>
      <circle cx="128" cy="128" r="128" fill="#DEDEDE" />
      <g transform="translate(51.2 32) scale(0.0549)">
        <path
          fill="#152E51"
          d="M683.5 1964.9V198.5l-0.7-1.1c56.2-33.6 114.7-63.2 175-88.5l0.7 1.6v1854.6c355.5 41.1 635.9 321.8 676.5 677.4c5.8 50.1 6.6 100.6 2.5 150.8c-45.2 4.4-91.1 6.6-137.5 6.7c-486 0-914.2-247.6-1165.2-623.6c121.7-118 279.2-192.4 447.7-211.4H683.5z"
        />
        <path
          fill="#1E4480"
          d="M1537.6 2793.3c-29.2 359-308.6 659.2-680 701.7c-422.5 48.3-804.2-255-852.5-677.5c-28.3-247.2 63.8-480.5 229.8-641.1c251 376 679.2 623.6 1165.2 623.6C1446.5 2799.9 1492.3 2797.7 1537.6 2793.3z"
        />
      </g>
    </svg>
  );
}
