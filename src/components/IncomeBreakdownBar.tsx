import { SOCIAL_SECURITY_WAGE_BASE_2026 } from '../lib/fica';
import { buildIncomeBreakdown } from '../lib/income-breakdown';
import type { FilingStatus } from '../lib/obbba-params';
import { tipsOvertimeStatus } from '../lib/state-page-content';
import { STATES_BY_CODE, type StateTaxEstimate } from '../lib/state-tax-data';
import BreakdownBar from './BreakdownBar';
import { formatUSD } from './CurrencyInput';

interface Props {
  magi: number;
  /** Final combined OBBBA deduction (after the phase-out). */
  deduction: number;
  filingStatus: FilingStatus;
  /** Estimated state income tax; null when no state is selected. */
  stateTax?: StateTaxEstimate | null;
}

/**
 * What the state row says about tips and overtime. Only claim what a state does when it's
 * verified (followsFederalTipsOvertime / tipsOvertimeNote); otherwise describe what our estimate does.
 */
export function stateTaxHint(stateTax: StateTaxEstimate): string {
  const info = STATES_BY_CODE[stateTax.code];
  const lead = `${stateTax.name}, ${stateTax.rateLabel}.`;
  switch (tipsOvertimeStatus(info)) {
    case 'no-wage-tax':
      return `${stateTax.name}: no state income tax.`;
    case 'does-not-follow':
      return info.tipsOvertimeNote
        ? `${lead} ${info.tipsOvertimeNote} Our estimate doesn’t apply that exclusion: it taxes your full income.`
        : `${lead} ${stateTax.name} doesn’t follow the federal deduction, so it taxes tips and overtime.`;
    case 'follows':
      return info.tipsOvertimeNote
        ? `${lead} ${info.tipsOvertimeNote} Our estimate doesn’t apply those deductions: it taxes your full income.`
        : `${lead} ${stateTax.name} follows the federal deduction, but our estimate still taxes tips and overtime at the state level.`;
    default:
      return `${lead} Our estimate taxes tips and overtime at the state level.`;
  }
}

export default function IncomeBreakdownBar({ magi, deduction, filingStatus, stateTax = null }: Props) {
  const b = buildIncomeBreakdown(magi, deduction, filingStatus, stateTax?.tax ?? 0);
  const isEmpty = b.total <= 0;
  const pct = (v: number) => (isEmpty ? 0 : (v / b.total) * 100);

  const rows = [
    {
      key: 'federal',
      label: 'Federal income tax',
      hint: deduction > 0 ? `After your ${formatUSD(deduction)} tips and overtime deduction` : 'No tips or overtime deduction applied',
      value: b.federalWithDeduction,
      color: 'bg-data-federal',
    },
    { key: 'fica', label: 'Social Security & Medicare', hint: 'Still owed on tips and overtime', value: b.fica, color: 'bg-data-fica' },
    ...(stateTax
      ? [{ key: 'state', label: `${stateTax.name} income tax (est.)`, hint: stateTaxHint(stateTax), value: b.state, color: 'bg-data-state' }]
      : []),
  ];
  const bar = [{ key: 'net', value: b.takeHome, color: 'bg-data-net' }, ...rows];
  const summary = `Where your income goes: ${[...rows, { label: 'Take-home', value: b.takeHome }]
    .map((r) => `${r.label} ${formatUSD(r.value)} (${pct(r.value).toFixed(1)}%)`)
    .join(', ')}.`;

  return (
    <section aria-labelledby="income-breakdown-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h3 id="income-breakdown-heading" className="font-semibold text-ink">
          Where your income goes
        </h3>
        {!isEmpty && <span className="num text-[15px] text-ink-2">of {formatUSD(b.total)}</span>}
      </div>

      <BreakdownBar className="mt-3" segments={bar} label={isEmpty ? undefined : summary} />

      {isEmpty ? (
        <p className="mt-3 text-[15px] text-ink-2">Enter your MAGI to see how your income breaks down.</p>
      ) : (
        <>
          <dl className="num mt-3">
            {rows.map((r) => (
              <Row key={r.key} color={r.color} label={r.label} hint={r.hint} value={r.value} percent={pct(r.value)} />
            ))}
            <Row color="bg-data-net" label="Take-home" value={b.takeHome} percent={pct(b.takeHome)} total />
          </dl>
          {b.federalSaved > 0 && (
            <p className="num mt-3 flex items-baseline justify-between gap-4 border-l-4 border-green bg-green-tint px-4 py-3 text-ink">
              <span>
                The deduction lowers your federal income tax from {formatUSD(b.federalWithoutDeduction)} to{' '}
                {formatUSD(b.federalWithDeduction)}.
              </span>
              <strong className="shrink-0 font-bold">{formatUSD(b.federalSaved)} saved</strong>
            </p>
          )}
        </>
      )}

      <p className="mt-3 text-sm text-ink-2">
        Assumes all MAGI is wages. Social Security applies only to the first {formatUSD(SOCIAL_SECURITY_WAGE_BASE_2026)} of 2026
        wages; the 0.9% Additional Medicare Tax is not included.
        {stateTax && stateTax.structure !== 'none' && ' State tax is a single-filer estimate and excludes local income taxes.'}
      </p>
    </section>
  );
}

function Row(props: { color: string; label: string; hint?: string; value: number; percent: number; total?: boolean }) {
  const { color, label, hint, value, percent, total = false } = props;
  return (
    <div className={`flex items-start justify-between gap-4 py-2.5 ${total ? 'border-t-2 border-ink font-bold' : 'border-b border-line'}`}>
      <dt className="flex min-w-0 items-start gap-2.5">
        <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 ${color}`} />
        <span>
          <span className="text-ink">{label}</span>
          {hint && <span className="block text-sm font-normal text-ink-2">{hint}</span>}
        </span>
      </dt>
      <dd className="shrink-0 text-right">
        <span className={total ? 'text-ink' : 'font-semibold text-ink'}>{formatUSD(value)}</span>
        <span className="block text-sm font-normal text-ink-2">{percent.toFixed(1)}%</span>
      </dd>
    </div>
  );
}
