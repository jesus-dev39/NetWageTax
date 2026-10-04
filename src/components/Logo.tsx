/**
 * NetWageTax monogram: an "N" folded from three angled ribbons. The diagonal
 * passes over the left ribbon and under the right one, which rises higher than
 * the left (growth). Keep in sync with public/favicon.svg and scripts/export-logo.mjs.
 */

const LEFT = 'M4 28V10.5L10.5 6v17.5z';
const DIAGONAL = 'M4 10.5 10.5 6 28 23.5 21.5 28z';
const RIGHT = 'M21.5 28V8.5L28 3v20.5z';

/**
 * Flat green (docs/DESIGN.md §6): the ribbons use the `green` token and the fold `green-hover`,
 * so the mark follows the site theme (and stays light inside the print vouchers).
 */
export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <path d={LEFT} className="fill-green" />
      <path d={DIAGONAL} className="fill-green-hover" />
      <path d={RIGHT} className="fill-green" />
    </svg>
  );
}

export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-7 w-7" />
      <span className="text-lg font-bold tracking-tight text-ink">NetWageTax</span>
    </span>
  );
}
