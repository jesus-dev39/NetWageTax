/**
 * Shared pieces of the print-only vouchers (PDF export) for both calculators. They use the design
 * tokens; global.css pins the light values inside `.print-voucher`, so a printout from dark mode
 * is still light.
 */
import Logo from './Logo';

/** Logo on the left, reference and date on the right, over a 2px ink rule. */
export function VoucherHeader(props: { subtitle: string; referenceLabel: string; referenceId: string; generatedAt: string }) {
  return (
    <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-3">
      <div>
        <Logo />
        <p className="mt-1 text-xs text-ink-2">{props.subtitle}</p>
      </div>
      <div className="text-right text-xs text-ink-2">
        <p>{props.referenceLabel}</p>
        <p className="num text-sm font-semibold text-ink">{props.referenceId}</p>
        <p className="mt-1">{props.generatedAt}</p>
      </div>
    </header>
  );
}

/** Key figure. `accent` marks the result: a green-tint panel, as on the calculators (the figure stays in ink). */
export function VoucherFigure(props: { label: string; value: string; detail?: string; accent?: boolean }) {
  return (
    <div className={`rounded-panel border border-line px-4 py-3 ${props.accent ? 'bg-green-tint' : ''}`}>
      <p className="text-xs font-semibold leading-tight text-ink-2">{props.label}</p>
      <p className="num mt-1 text-2xl font-bold tracking-[-0.01em]">{props.value}</p>
      {props.detail && <p className="num text-[11px] text-ink-2">{props.detail}</p>}
    </div>
  );
}

/** Basis, timestamp, and disclaimer, pinned to the foot of the page. */
export function VoucherFooter(props: { basis: string; generatedAt: string; referenceId: string; headline: string; body: string }) {
  return (
    <footer className="mt-auto break-inside-avoid border-t border-line pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-ink-2">
        <span>{props.basis}</span>
        <span>
          Generated {props.generatedAt} · {props.referenceId}
        </span>
      </div>
      <p className="mt-3 text-xs font-semibold">{props.headline}</p>
      <p className="mt-1 text-[10.5px] leading-relaxed text-ink-2">{props.body}</p>
    </footer>
  );
}
