import { estimateEmployeeFica, SOCIAL_SECURITY_WAGE_BASE_2026 } from '../lib/fica';
import type { StateTaxEstimate } from '../lib/state-tax-data';
import { formatUSD } from './CurrencyInput';
import { useAnimatedNumber } from './useAnimatedNumber';

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
  swatch: string;
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
      swatch: 'bg-slate-700 dark:bg-slate-500',
    },
    {
      key: 'deduction',
      label: 'Tips & overtime deduction',
      hint: savings > 0 ? `Shielded from federal income tax · saves ~${formatUSD(savings)}` : 'Shielded from federal income tax',
      value: deductible,
      swatch: 'bg-emerald-500',
    },
    {
      key: 'fica',
      label: 'FICA taxes (7.65%)',
      hint: 'Social Security 6.2% + Medicare 1.45%, still owed',
      value: fica,
      swatch: 'bg-amber-400',
    },
    ...(stateTax
      ? [
          {
            key: 'state',
            label: `State income tax (Est.)`,
            hint:
              stateTax.structure === 'none'
                ? `${stateTax.name} · No state income tax`
                : `${stateTax.name} · ${stateTax.rateLabel} · applies to tips & overtime too`,
            value: state,
            swatch: 'bg-violet-500 dark:bg-violet-400',
          },
        ]
      : []),
  ];

  const pct = (v: number) => (isEmpty ? 0 : (v / total) * 100);
  const summary = isEmpty
    ? 'Income breakdown: enter your MAGI to see it.'
    : `Income breakdown: ${segments
        .map((s) => `${s.label} ${formatUSD(s.value)} (${pct(s.value).toFixed(1)}%)`)
        .join(', ')}.`;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-colors duration-300">
      <div className="flex items-baseline justify-between gap-4">
        <h4 className="font-medium text-slate-900 dark:text-slate-100">Where your income goes</h4>
        {!isEmpty && <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">of {formatUSD(total)}</span>}
      </div>

      <div
        role="img"
        aria-label={summary}
        className="mt-3 flex h-4 w-full divide-x divide-white/70 dark:divide-slate-900 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        {segments.map((s) => (
          <div
            key={s.key}
            className={`${s.swatch} h-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${
              s.value > 0 ? 'min-w-1' : ''
            }`}
            style={{ width: `${pct(s.value)}%` }}
          />
        ))}
      </div>

      {isEmpty ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Enter your MAGI to see how your income breaks down.</p>
      ) : (
        <dl className="mt-4 space-y-3 text-sm">
          {segments.map((s) => (
            <LegendRow key={s.key} segment={s} percent={pct(s.value)} highlight={s.key === 'deduction'} />
          ))}
        </dl>
      )}

      <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Assumes all MAGI is wages. Social Security applies only to the first{' '}
        {formatUSD(SOCIAL_SECURITY_WAGE_BASE_2026)} of 2026 wages; the 0.9% Additional Medicare Tax is not included.
        {stateTax && stateTax.structure !== 'none' && ' State tax is a single-filer estimate and excludes local income taxes.'}
      </p>
    </div>
  );
}

function LegendRow({ segment, percent, highlight }: { segment: Segment; percent: number; highlight: boolean }) {
  const value = useAnimatedNumber(segment.value);
  const shownPercent = useAnimatedNumber(percent);
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="flex min-w-0 items-start gap-2.5">
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-sm ${segment.swatch}`} aria-hidden="true" />
        <span>
          <span className={highlight ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'font-medium text-slate-800 dark:text-slate-200'}>
            {segment.label}
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{segment.hint}</span>
        </span>
      </dt>
      <dd className="shrink-0 text-right tabular-nums">
        <span className={highlight ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'font-semibold text-slate-900 dark:text-slate-100'}>
          {formatUSD(value)}
        </span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{shownPercent.toFixed(1)}%</span>
      </dd>
    </div>
  );
}
