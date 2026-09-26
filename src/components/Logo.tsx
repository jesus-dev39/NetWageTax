import { useId } from 'react';

/**
 * NetWageTax monogram: an "N" folded from three angled ribbons. The diagonal
 * passes over the left ribbon and under the right one, which rises higher than
 * the left (growth). Keep in sync with public/favicon.svg.
 */

const LEFT = 'M4 28V10.5L10.5 6v17.5z';
const DIAGONAL = 'M4 10.5 10.5 6 28 23.5 21.5 28z';
const RIGHT = 'M21.5 28V8.5L28 3v20.5z';

export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  // Unique gradient ids: the mark can appear several times on one page (header, footer, print).
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-rise`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#10B981" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
        <linearGradient id={`${id}-fold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#059669" />
          <stop offset="1" stopColor="#0891B2" />
        </linearGradient>
      </defs>
      <path d={LEFT} fill={`url(#${id}-rise)`} />
      <path d={DIAGONAL} fill={`url(#${id}-fold)`} />
      <path d={RIGHT} fill={`url(#${id}-rise)`} />
    </svg>
  );
}

/**
 * `tone="dark"` forces the on-dark colors (white + emerald-400), e.g. on the voucher's
 * dark banner; the default follows the site theme.
 */
export default function Logo({ className = '', tone = 'auto' }: { className?: string; tone?: 'auto' | 'dark' }) {
  const onDark = tone === 'dark';
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className="text-lg tracking-tight">
        <span className={`font-extrabold ${onDark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>NetWage</span>
        <span className={`font-bold ${onDark ? 'text-emerald-400' : 'text-emerald-600 dark:text-emerald-400'}`}>Tax</span>
      </span>
    </span>
  );
}
