import type { SelectHTMLAttributes } from 'react';

/**
 * Native <select> styled as a design-system field (docs/DESIGN.md §6): 2px field border, 44px tall,
 * and a chevron drawn in currentColor so it follows the theme. Use it for four or more options.
 */
export default function NativeSelect({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative ${className}`}>
      <select
        {...props}
        className="h-11 w-full appearance-none truncate rounded-control border-2 border-field bg-page py-0 pl-3 pr-10 text-base text-ink"
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5 7.5 5 5 5-5" />
      </svg>
    </div>
  );
}
