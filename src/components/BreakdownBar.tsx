/**
 * Flat stacked bar for a result breakdown (docs/DESIGN.md §6): 10px tall, no radius, 2px gaps,
 * data colors only. Always pair it with a text legend or rows; the bar itself is hidden from
 * assistive tech unless `label` is given.
 */
export interface BarSegment {
  key: string;
  value: number;
  /** A `bg-data-*` (or `bg-ink-2`) class. */
  color: string;
}

export default function BreakdownBar({ segments, label, className = '' }: { segments: BarSegment[]; label?: string; className?: string }) {
  const total = segments.reduce((t, s) => t + Math.max(0, s.value), 0);
  return (
    <div
      className={`flex h-2.5 gap-0.5 ${total > 0 ? '' : 'bg-line'} ${className}`}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {total > 0 &&
        segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <span
              key={s.key}
              className={`${s.color} h-full min-w-0.5 transition-[width] duration-150 motion-reduce:transition-none`}
              style={{ width: `${(s.value / total) * 100}%` }}
            />
          ))}
    </div>
  );
}
