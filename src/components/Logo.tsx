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
 * so the mark follows the site theme. `onDark` pins the dark-theme greens for dark surfaces
 * that don't follow the theme (the export voucher's banner).
 */
export function LogoMark({ className = 'h-8 w-8', onDark = false }: { className?: string; onDark?: boolean }) {
  const ribbon = onDark ? 'fill-[#4cc38a]' : 'fill-green';
  const fold = onDark ? 'fill-[#6fd3a2]' : 'fill-green-hover';
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <path d={LEFT} className={ribbon} />
      <path d={DIAGONAL} className={fold} />
      <path d={RIGHT} className={ribbon} />
    </svg>
  );
}

/** `tone="dark"` forces on-dark colors (e.g. the voucher's dark banner); the default follows the site theme. */
export default function Logo({ className = '', tone = 'auto' }: { className?: string; tone?: 'auto' | 'dark' }) {
  const onDark = tone === 'dark';
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark onDark={onDark} className="h-7 w-7" />
      <span className={`text-lg font-bold tracking-tight ${onDark ? 'text-white' : 'text-ink'}`}>NetWageTax</span>
    </span>
  );
}
