import { estimateEmployeeFica, SOCIAL_SECURITY_WAGE_BASE_2026 } from '../lib/fica';
import { formatUSD } from './CurrencyInput';
import { useAnimatedNumber } from './useAnimatedNumber';

interface Props {
  magi: number;
  /** Final combined OBBBA deduction (after the phase-out). */
  deduction: number;
  /** Estimated federal income tax saved by the deduction. */
  savings: number;
}

interface Segment {
  key: string;
  label: string;
  hint: string;
  value: number;
  swatch: string;
}

export default function IncomeBreakdownBar({ magi, deduction, savings }: Props) {
  const fica = estimateEmployeeFica(magi).total;
  const deductible = Math.min(deduction, magi);
  const base = Math.max(0, magi - deductible - fica);
  const total = base + deductible + fica;
  const isEmpty = total <= 0;

  const segments: Segment[] = [
    {
      key: 'base',
      label: 'Base income',
      hint: 'Wages and other income, after FICA',
      value: base,
      swatch: 'bg-slate-700',
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
  ];

  const pct = (v: number) => (isEmpty ? 0 : (v / total) * 100);
  const summary = isEmpty
    ? 'Income breakdown: enter your MAGI to see it.'
    : `Income breakdown: ${segments
        .map((s) => `${s.label} ${formatUSD(s.value)} (${pct(s.value).toFixed(1)}%)`)
        .join(', ')}.`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors duration-300">
      <div className="flex items-baseline justify-between gap-4">
        <h4 className="font-medium text-slate-900">Where your income goes</h4>
        {!isEmpty && <span className="text-xs text-slate-500 tabular-nums">of {formatUSD(total)}</span>}
      </div>

      <div
        role="img"
        aria-label={summary}
        className="mt-3 flex h-4 w-full divide-x divide-white/70 overflow-hidden rounded-full bg-slate-100"
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
        <p className="mt-3 text-sm text-slate-500">Enter your MAGI to see how your income breaks down.</p>
      ) : (
        <dl className="mt-4 space-y-3 text-sm">
          {segments.map((s) => (
            <LegendRow key={s.key} segment={s} percent={pct(s.value)} highlight={s.key === 'deduction'} />
          ))}
        </dl>
      )}

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Assumes all MAGI is wages. Social Security applies only to the first{' '}
        {formatUSD(SOCIAL_SECURITY_WAGE_BASE_2026)} of 2026 wages; the 0.9% Additional Medicare Tax is not included.
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
          <span className={highlight ? 'font-medium text-emerald-700' : 'font-medium text-slate-800'}>
            {segment.label}
          </span>
          <span className="block text-xs text-slate-500">{segment.hint}</span>
        </span>
      </dt>
      <dd className="shrink-0 text-right tabular-nums">
        <span className={highlight ? 'font-semibold text-emerald-700' : 'font-semibold text-slate-900'}>
          {formatUSD(value)}
        </span>
        <span className="block text-xs text-slate-500">{shownPercent.toFixed(1)}%</span>
      </dd>
    </div>
  );
}
