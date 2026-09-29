import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { SOCIAL_SECURITY_WAGE_BASE_2026 } from '../lib/fica';
import {
  calculatePaycheck,
  PAY_FREQUENCIES,
  PAYCHECK_FILING_STATUSES,
  type PayFrequency,
  type PaycheckFilingStatus,
  type PaycheckInput,
  type PayMode,
} from '../lib/paycheck';
import { buildPaycheckRows, PAYCHECK_TAX_YEAR } from '../lib/paycheck-summary';
import { findState, formatStateRate, STATES_BY_CODE, type StateCode } from '../lib/state-tax-data';
import CurrencyInput, { formatUSD, formatUSDCents } from './CurrencyInput';
import NoStateTaxBadge from './NoStateTaxBadge';
import PaycheckExportActions from './PaycheckExportActions';
import StateSelect from './StateSelect';
import { useAnimatedNumber } from './useAnimatedNumber';

const MODES: { value: PayMode; label: string }[] = [
  { value: 'hourly', label: 'Hourly Wage' },
  { value: 'salary', label: 'Annual Salary' },
];

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export default function PaycheckCalculatorApp() {
  const [mode, setMode] = useState<PayMode>('hourly');
  const [hourlyRate, setHourlyRate] = useState<number | null>(null);
  const [hoursPerWeek, setHoursPerWeek] = useState('40');
  const [overtimeHours, setOvertimeHours] = useState('0');
  const [annualSalary, setAnnualSalary] = useState<number | null>(null);
  const [frequency, setFrequency] = useState<PayFrequency>('biweekly');
  const [filingStatus, setFilingStatus] = useState<PaycheckFilingStatus>('single');
  const [stateCode, setStateCode] = useState<StateCode | null>(null);

  // Deep link from the State Directory: ?state=texas or ?state=TX.
  useEffect(() => {
    const s = findState(new URLSearchParams(window.location.search).get('state'));
    if (s) setStateCode(s.code);
  }, []);

  const input: PaycheckInput = useMemo(
    () => ({
      mode,
      hourlyRate: hourlyRate ?? 0,
      hoursPerWeek: Number(hoursPerWeek) || 0,
      overtimeHoursPerWeek: Number(overtimeHours) || 0,
      annualSalary: annualSalary ?? 0,
      frequency,
      filingStatus,
      stateCode,
    }),
    [mode, hourlyRate, hoursPerWeek, overtimeHours, annualSalary, frequency, filingStatus, stateCode],
  );
  const result = useMemo(() => calculatePaycheck(input), [input]);
  const rows = useMemo(() => buildPaycheckRows(input, result), [input, result]);

  const freq = PAY_FREQUENCIES.find((f) => f.value === frequency)!;
  const state = stateCode ? STATES_BY_CODE[stateCode] : null;
  const shownNet = useAnimatedNumber(result.netPerPeriod);
  const fica = result.socialSecurity + result.medicare;
  const hasPay = result.grossAnnual > 0;

  const segments = [
    { key: 'net', label: 'Net pay', value: result.netAnnual, swatch: 'bg-emerald-500' },
    { key: 'federal', label: 'Federal tax', value: result.federalTax, swatch: 'bg-slate-500 dark:bg-slate-400' },
    { key: 'fica', label: 'FICA', value: fica, swatch: 'bg-amber-400' },
    { key: 'state', label: 'State tax', value: result.stateTax, swatch: 'bg-violet-500 dark:bg-violet-400' },
  ];

  return (
    <section
      id="calculator"
      aria-labelledby="paycheck-heading"
      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-xl"
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          {PAYCHECK_TAX_YEAR} tax rules
        </p>
        <h2 id="paycheck-heading" className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Estimate your take-home pay
        </h2>
        <p className="text-slate-600 dark:text-slate-400">Results update as you type. Nothing you enter leaves your browser.</p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* ------------------------------ Inputs ------------------------------ */}
        <form className="flex flex-col gap-7 lg:col-span-7" onSubmit={(e) => e.preventDefault()} noValidate>
          <Segmented legend="How are you paid?" name="pay-mode" options={MODES} value={mode} onChange={setMode} />

          {mode === 'hourly' ? (
            <div className="grid gap-5 sm:grid-cols-3">
              <Field id="hourly-rate" label="Hourly rate" hint="$ per hour">
                <CurrencyInput id="hourly-rate" value={hourlyRate} onValueChange={setHourlyRate} placeholder="25.00" describedBy="hourly-rate-hint" />
              </Field>
              <Field id="hours-per-week" label="Hours per week" hint="Regular hours">
                <HoursInput id="hours-per-week" value={hoursPerWeek} onChange={setHoursPerWeek} describedBy="hours-per-week-hint" />
              </Field>
              <Field id="overtime-hours" label="Overtime hours / week" hint="Paid at 1.5×">
                <HoursInput id="overtime-hours" value={overtimeHours} onChange={setOvertimeHours} describedBy="overtime-hours-hint" />
              </Field>
            </div>
          ) : (
            <Field id="annual-salary" label="Gross annual salary" hint="Before taxes and deductions">
              <div className="sm:max-w-xs">
                <CurrencyInput id="annual-salary" value={annualSalary} onValueChange={setAnnualSalary} placeholder="65,000" describedBy="annual-salary-hint" />
              </div>
            </Field>
          )}

          <Segmented legend="Pay frequency" name="pay-frequency" options={PAY_FREQUENCIES} value={frequency} onChange={setFrequency} columns="grid-cols-2 sm:grid-cols-4" />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_15rem]">
            <Segmented legend="Filing status" name="filing-status" options={PAYCHECK_FILING_STATUSES} value={filingStatus} onChange={setFilingStatus} columns="grid-cols-1 sm:grid-cols-3 xl:grid-cols-1" />
            <div>
              <label htmlFor="paycheck-state" className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                State
              </label>
              <div className="mt-2">
                <StateSelect id="paycheck-state" value={stateCode} onChange={setStateCode} placeholder="Select State" describedBy="paycheck-state-help" />
              </div>
              <div id="paycheck-state-help" className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {!state ? 'Adds state income tax to your estimate.' : state.structure === 'none' ? <NoStateTaxBadge /> : formatStateRate(state)}
              </div>
            </div>
          </div>

          <WithholdingExplanation
            gross={result.grossAnnual}
            standardDeduction={result.standardDeduction}
            taxable={result.taxableIncome}
            marginalRate={result.marginalRate}
            federalTax={result.federalTax}
            additionalMedicare={result.additionalMedicare}
            stateName={state?.name ?? null}
            stateRate={state ? formatStateRate(state) : null}
            stateIsNoTax={state?.structure === 'none'}
            overtimePay={result.overtimePay}
          />
        </form>

        {/* ------------------------------ Results ----------------------------- */}
        <aside aria-labelledby="take-home-heading" className="flex flex-col gap-4 lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-950 via-slate-900 to-slate-950 p-6 text-white shadow-xl ring-1 ring-emerald-500/30">
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="relative">
              <h3 id="take-home-heading" className="text-sm font-medium text-emerald-100/80">
                Take-Home Pay per paycheck
              </h3>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-2" aria-hidden="true">
                <span className={`text-5xl font-bold tracking-tight tabular-nums ${hasPay ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {formatUSDCents(shownNet)}
                </span>
                <span className="text-sm font-medium text-slate-400">/ {freq.short}</span>
              </p>
              <p className="mt-1 text-sm text-slate-400">
                <span className="tabular-nums text-slate-200">{formatUSD(result.netAnnual)}</span> take-home per year ·{' '}
                {freq.periods} paychecks
              </p>
              <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-white/10 pt-4 text-sm">
                <span className="text-slate-300">Gross pay per paycheck</span>
                <span className="font-semibold tabular-nums">{formatUSDCents(result.grossAnnual / result.periods)}</span>
              </div>
              <p className="sr-only" aria-live="polite">
                Take-home pay {formatUSDCents(result.netPerPeriod)} per {freq.short} paycheck, {formatUSD(result.netAnnual)} per year.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-xl">
            <h4 className="font-medium text-slate-900 dark:text-slate-100">Where your paycheck goes</h4>
            <div
              role="img"
              aria-label={
                hasPay
                  ? `Paycheck breakdown: ${segments.map((s) => `${s.label} ${pct(s.value, result.grossAnnual).toFixed(1)}%`).join(', ')}.`
                  : 'Paycheck breakdown: enter your pay to see it.'
              }
              className="mt-3 flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
            >
              {segments.map((s) => (
                <div
                  key={s.key}
                  className={`${s.swatch} h-full transition-[width] duration-500 ease-out motion-reduce:transition-none`}
                  style={{ width: `${pct(s.value, result.grossAnnual)}%` }}
                />
              ))}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {segments.map((s) => (
                <div key={s.key} className="flex items-start gap-2">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-sm ${s.swatch}`} aria-hidden="true" />
                  <div>
                    <dt className="text-slate-600 dark:text-slate-400">{s.label}</dt>
                    <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {pct(s.value, result.grossAnnual).toFixed(1)}%
                      <span className="ml-1.5 font-normal text-slate-500 dark:text-slate-400">{formatUSDCents(s.value / result.periods)}</span>
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-xl">
            <table className="w-full text-sm">
              <caption className="sr-only">Paycheck breakdown per paycheck and per year</caption>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Item</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Per paycheck</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Annual</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows
                  .filter((r) => r.kind !== 'earning')
                  .map((r) => {
                    const strong = r.kind !== 'tax';
                    const net = r.kind === 'net';
                    return (
                      <tr
                        key={r.label}
                        className={`border-t border-slate-100 dark:border-slate-800 ${net ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''}`}
                      >
                        <th
                          scope="row"
                          className={`px-4 py-2 text-left ${strong ? 'font-semibold' : 'font-normal'} ${
                            net ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {r.label}
                        </th>
                        <td className={`px-4 py-2 text-right ${net ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {r.kind === 'tax' && r.annual > 0 ? '−' : ''}
                          {formatUSDCents(r.perPeriod)}
                        </td>
                        <td className={`px-4 py-2 text-right ${net ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {r.kind === 'tax' && r.annual > 0 ? '−' : ''}
                          {formatUSD(r.annual)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <PaycheckExportActions input={input} result={result} />

          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Estimates only. Assumes the {PAYCHECK_TAX_YEAR} standard deduction, no pre-tax deductions (401(k), health
            insurance), and standard W-4 withholding. Local income taxes aren’t included.
          </p>
        </aside>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

function Segmented<T extends string>(props: {
  legend: string;
  name: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  columns?: string;
}) {
  const { legend, name, options, value, onChange, columns = 'grid-cols-2' } = props;
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-900 dark:text-slate-100">{legend}</legend>
      <div className={`mt-2 grid gap-2 ${columns}`}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <label
              key={o.value}
              className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-600/40 ${
                active
                  ? 'border-ink bg-ink text-white shadow-sm dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <input type="radio" name={name} value={o.value} checked={active} onChange={() => onChange(o.value)} className="sr-only" />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
        {label}
      </label>
      <p id={`${id}-hint`} className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        {hint}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function HoursInput({ id, value, onChange, describedBy }: { id: string; value: string; onChange: (v: string) => void; describedBy: string }) {
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        aria-describedby={describedBy}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
          onChange(Number(cleaned) > 168 ? '168' : cleaned);
        }}
        className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-3.5 pr-12 text-base text-slate-900 tabular-nums shadow-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-sm text-slate-500">hrs</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Explanation card (balances the input column)
// ---------------------------------------------------------------------------

function WithholdingExplanation(props: {
  gross: number;
  standardDeduction: number;
  taxable: number;
  marginalRate: number;
  federalTax: number;
  additionalMedicare: number;
  stateName: string | null;
  stateRate: string | null;
  stateIsNoTax: boolean;
  overtimePay: number;
}) {
  const { gross, standardDeduction, taxable, marginalRate, federalTax, additionalMedicare, stateName, stateRate, stateIsNoTax, overtimePay } = props;
  const capWeek = gross > SOCIAL_SECURITY_WAGE_BASE_2026 ? Math.ceil(SOCIAL_SECURITY_WAGE_BASE_2026 / (gross / 52)) : null;

  const items: { title: string; body: ReactNode }[] = [
    {
      title: 'Federal income tax',
      body:
        gross > 0 ? (
          <>
            {formatUSD(gross)} gross − {formatUSD(standardDeduction)} standard deduction = {formatUSD(taxable)} taxable income,
            taxed through the {PAYCHECK_TAX_YEAR} brackets. Your top bracket is {Math.round(marginalRate * 100)}%, but your
            effective federal rate is {pct(federalTax, gross).toFixed(1)}%.
          </>
        ) : (
          `Your pay minus the ${PAYCHECK_TAX_YEAR} standard deduction, taxed through the 10%–37% brackets.`
        ),
    },
    {
      title: 'Social Security (6.2%)',
      body: capWeek
        ? `Applies to the first ${formatUSD(SOCIAL_SECURITY_WAGE_BASE_2026)} of wages. You reach that cap around week ${capWeek}, after which it stops.`
        : `Applies to the first ${formatUSD(SOCIAL_SECURITY_WAGE_BASE_2026)} of ${PAYCHECK_TAX_YEAR} wages.`,
    },
    {
      title: 'Medicare (1.45%)',
      body:
        additionalMedicare > 0
          ? `No wage cap, plus 0.9% Additional Medicare Tax on wages above your filing-status threshold (${formatUSD(additionalMedicare)}/yr). Employers start withholding it at $200,000 regardless of filing status.`
          : 'No wage cap. An extra 0.9% applies above $200,000 ($250,000 married filing jointly).',
    },
    {
      title: 'State income tax',
      body: stateName
        ? stateIsNoTax
          ? `${stateName} doesn’t tax wages.`
          : `${stateName}: ${stateRate}. Single-filer estimate; local taxes (city, county, school district) aren’t included.`
        : 'Pick your state to include it. Nine states don’t tax wages at all.',
    },
  ];

  return (
    <section
      aria-labelledby="withholding-heading"
      className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-xl"
    >
      <h3 id="withholding-heading" className="font-semibold text-slate-900 dark:text-slate-100">
        Tax withholding explained
      </h3>
      <dl className="mt-4 space-y-4 text-sm">
        {items.map((i) => (
          <div key={i.title}>
            <dt className="font-medium text-slate-800 dark:text-slate-200">{i.title}</dt>
            <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-400">{i.body}</dd>
          </div>
        ))}
      </dl>
      {overtimePay > 0 && (
        <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <span className="font-semibold">Good to know: </span>
          the half-time premium in your overtime (about {formatUSD(overtimePay / 3)} a year here) may be deductible under
          the new “no tax on overtime” rules, up to $12,500. This paycheck estimate doesn’t include it.{' '}
          <a href="/tools/obbba-tax-calculator/" className="font-medium underline underline-offset-2">
            Estimate your overtime deduction →
          </a>
        </p>
      )}
    </section>
  );
}
