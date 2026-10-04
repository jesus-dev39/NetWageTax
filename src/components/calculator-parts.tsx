import type { ReactNode } from 'react';
import type { FederalTaxComparison } from '../lib/marginal-rate';
import { formatUSD } from './CurrencyInput';

/**
 * Result and checklist pieces shared by the Schedule 1-A calculators (tips and overtime, senior
 * deduction, car loan interest), so the three read the same (docs/DESIGN.md §6).
 */

/** Headline result: green-tint panel with the label, the 48px figure, and a context line. */
export function ResultPanel(props: { id: string; label: string; value: string; context: ReactNode; liveText: string; children?: ReactNode }) {
  const { id, label, value, context, liveText, children } = props;
  return (
    <div className="rounded-panel border border-line bg-green-tint p-5 sm:p-6">
      <h3 id={id} className="font-semibold text-ink">
        {label}
      </h3>
      <p className="num mt-1 text-[2.5rem]/[1.05] font-bold tracking-[-0.02em] text-ink sm:text-5xl/[1.05]">{value}</p>
      <p className="num mt-1 text-ink-2">{context}</p>
      {children}
      <p className="sr-only" aria-live="polite">
        {liveText}
      </p>
    </div>
  );
}

/** One label/amount row of a breakdown `dl`; `strong` is the total row with a 2px rule. */
export function Row({ label, hint, value, strong }: { label: string; hint?: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-2 ${strong ? 'border-t-2 border-ink font-bold' : 'border-t border-line'}`}>
      <dt className={strong ? 'text-ink' : 'text-ink-2'}>
        {label}
        {hint && <span className="block text-sm font-normal text-ink-2">{hint}</span>}
      </dt>
      <dd className="shrink-0 text-right text-ink">{value}</dd>
    </div>
  );
}

/** Amount to subtract, with a true minus sign; $0 stays unsigned. */
export function minusUSD(value: number): string {
  return value > 0 ? `−${formatUSD(value)}` : formatUSD(0);
}

/** Federal income tax without and with the deduction (no FICA: the income may not be wages). */
export function FederalTaxRows({ comparison, deductionLabel }: { comparison: FederalTaxComparison; deductionLabel: string }) {
  return (
    <section aria-labelledby="federal-tax-heading">
      <h3 id="federal-tax-heading" className="font-semibold text-ink">
        Federal income tax
      </h3>
      <dl className="num mt-2">
        <Row label={`Without the ${deductionLabel}`} value={formatUSD(comparison.before)} />
        <Row label={`With the ${deductionLabel}`} value={formatUSD(comparison.after)} />
        <Row label="Federal income tax saved" value={formatUSD(comparison.saved)} strong />
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Filing qualification checklist
// ---------------------------------------------------------------------------

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'pending' | 'na';

export interface CheckItem {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Optional control under the detail, e.g. an "I have a valid SSN" checkbox. */
  control?: ReactNode;
}

// Text status tags (docs/DESIGN.md §6) instead of colored icons; the words carry the meaning.
export const CHECK_TAGS: Record<CheckStatus, { text: string; className: string }> = {
  pass: { text: 'Met', className: 'bg-green-tint text-green' },
  fail: { text: 'Not met', className: 'bg-page text-error ring-1 ring-inset ring-error' },
  warn: { text: 'Partly met', className: 'bg-warning-tint text-ink ring-1 ring-inset ring-warning' },
  pending: { text: 'To confirm', className: 'bg-surface text-ink-2' },
  na: { text: 'Not needed', className: 'text-muted' },
};

export function QualificationChecklist({ title, items }: { title: string; items: CheckItem[] }) {
  const met = items.filter((i) => i.status === 'pass').length;
  const applicable = items.filter((i) => i.status !== 'na').length;
  return (
    <section aria-labelledby="checklist-heading" className="border-t border-line pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="checklist-heading" className="text-xl/[1.3] font-bold text-ink">
          {title}
        </h3>
        <span className="num text-[15px] text-ink-2">
          {met} of {applicable} met
        </span>
      </div>
      <ul className="mt-3">
        {items.map((item) => {
          const tag = CHECK_TAGS[item.status];
          return (
            <li key={item.key} className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-b-0">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{item.label}</p>
                <p className="text-[15px] text-ink-2">{item.detail}</p>
                {item.control && <div className="mt-2">{item.control}</div>}
              </div>
              <span className={`shrink-0 rounded-[2px] px-2 py-0.5 text-sm font-semibold ${tag.className}`}>{tag.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
