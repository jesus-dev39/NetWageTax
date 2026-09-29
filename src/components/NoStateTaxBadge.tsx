/** Status tag (docs/DESIGN.md §6): 14px semibold on green-tint, 2px radius, no icon. */
export default function NoStateTaxBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-block rounded-[2px] bg-green-tint px-2 py-0.5 text-sm font-semibold text-green ${className}`}>
      No state income tax
    </span>
  );
}
