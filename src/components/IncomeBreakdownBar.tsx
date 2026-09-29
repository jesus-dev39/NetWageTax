import { estimateEmployeeFica, SOCIAL_SECURITY_WAGE_BASE_2026 } from '../lib/fica';
import { tipsOvertimeStatus } from '../lib/state-page-content';
import { STATES_BY_CODE, type StateTaxEstimate } from '../lib/state-tax-data';
import BreakdownBar from './BreakdownBar';
import { formatUSD } from './CurrencyInput';

interface Props {
  magi: number;
  /** Final combined OBBBA deduction (after the phase-out). */
  deduction: number;
  /** Estimated federal income tax saved by the deduction. */
  savings: number;
  /** Estimated state income tax; null when no state is selected. */
  stateTax?: StateTaxEstimate | null;
}

interface Segment {
  key: string;
  label: string;
  hint: string;
  value: number;
  color: string;
}

/**
 * What the state row says about tips and overtime. Only claim what a state does when
 * followsFederalTipsOvertime is known; otherwise describe what our estimate does.
 */
function stateTaxHint(stateTax: StateTaxEstimate): string {
  const lead = `${stateTax.name}, ${stateTax.rateLabel}.`;
  switch (tipsOvertimeStatus(STATES_BY_CODE[stateTax.code])) {
    case 'no-wage-tax':
      return `${stateTax.name}: no state income tax.`;
    case 'does-not-follow':
      return `${lead} ${stateTax.name} doesn’t follow the federal deduction, so it taxes tips and overtime.`;
    case 'follows':
      return `${lead} ${stateTax.name} follows the federal deduction, but our estimate still taxes tips and overtime at the state level.`;
    default:
      return `${lead} Our estimate taxes tips and overtime at the state level.`;
  }
}

export default function IncomeBreakdownBar({ magi, deduction, savings, stateTax = null }: Props) {
  const fica = estimateEmployeeFica(magi).total;
  const deductible = Math.min(deduction, magi);
  const state = stateTax?.tax ?? 0;
  const base = Math.max(0, magi - deductible - fica - state);
  const total = base + deductible + fica + state;
  const isEmpty = total <= 0;

  const segments: Segment[] = [
    {
      key: 'base',
      label: 'Base income',
      hint: stateTax ? 'Wages and other income, after FICA and state tax' : 'Wages and other income, after FICA',
      value: base,
      color: 'bg-ink-2',
    },
    {
      key: 'deduction',
      label: 'Tips and overtime deduction',
      hint: savings > 0 ? `Shielded from federal income tax, saves about ${formatUSD(savings)}` : 'Shielded from federal income tax',
      value: deductible,
      color: 'bg-data-net',
    },
    {
      key: 'fica',
      label: 'FICA taxes (7.65%)',
      hint: 'Social Security 6.2% + Medicare 1.45%, still owed',
      value: fica,
      color: 'bg-data-fica',
    },
    ...(stateTax
      ? [
          {
            key: 'state',
            label: 'State income tax (est.)',
            hint: stateTaxHint(stateTax),
            value: state,
            color: 'bg-data-state',
          },
        ]
      : []),
  ];

  const pct = (v: number) => (isEmpty ? 0 : (v / total) * 100);
  const summary = `Income breakdown: ${segments.map((s) => `${s.label} ${formatUSD(s.value)} (${pct(s.value).toFixed(1)}%)`).join(', ')}.`;

  return (
    <section aria-labelledby="income-breakdown-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h3 id="income-breakdown-heading" className="font-semibold text-ink">
          Where your income goes
        </h3>
        {!isEmpty && <span className="num text-[15px] text-ink-2">of {formatUSD(total)}</span>}
      </div>

      <BreakdownBar className="mt-3" segments={segments} label={isEmpty ? undefined : summary} />

      {isEmpty ? (
        <p className="mt-3 text-[15px] text-ink-2">Enter your MAGI to see how your income breaks down.</p>
      ) : (
        <dl className="num mt-3">
          {segments.map((s) => (
            <div key={s.key} className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
              <dt className="flex min-w-0 items-start gap-2.5">
                <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 ${s.color}`} />
                <span>
                  <span className="text-ink">{s.label}</span>
                  <span className="block text-sm text-ink-2">{s.hint}</span>
                </span>
              </dt>
              <dd className="shrink-0 text-right">
                <span className="font-semibold text-ink">{formatUSD(s.value)}</span>
                <span className="block text-sm text-ink-2">{pct(s.value).toFixed(1)}%</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      <p className="mt-3 text-sm text-ink-2">
        Assumes all MAGI is wages. Social Security applies only to the first {formatUSD(SOCIAL_SECURITY_WAGE_BASE_2026)} of 2026
        wages; the 0.9% Additional Medicare Tax is not included.
        {stateTax && stateTax.structure !== 'none' && ' State tax is a single-filer estimate and excludes local income taxes.'}
      </p>
    </section>
  );
}
