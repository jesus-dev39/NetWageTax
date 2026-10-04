import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { SOCIAL_SECURITY_WAGE_BASE_2026 } from '../lib/fica';
import { calculatePaycheck, type PayFrequency, type PaycheckFilingStatus, type PaycheckInput, type PayMode } from '../lib/paycheck';
import { buildPaycheckRows, PAYCHECK_TAX_YEAR } from '../lib/paycheck-summary';
import { parsePaycheckSearchParams } from '../lib/paycheck-url';
import { formatStateRate, STATES, STATES_BY_CODE, type StateCode } from '../lib/state-tax-data';
import BreakdownBar from './BreakdownBar';
import CurrencyInput, { formatUSD, formatUSDCents } from './CurrencyInput';
import { Field, HoursInput, RadioGroup } from './form';
import NativeSelect from './NativeSelect';
import NoStateTaxBadge from './NoStateTaxBadge';
import PaycheckExportActions from './PaycheckExportActions';
import { FILING_OPTIONS, FREQUENCY_OPTIONS, PAY_MODE_OPTIONS } from './paycheck-options';

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

  // Deep links: ?state=texas from the state pages, and every input from the home page estimate.
  useEffect(() => {
    const p = parsePaycheckSearchParams(window.location.search);
    if (p.mode) setMode(p.mode);
    if (p.annualSalary !== undefined) setAnnualSalary(p.annualSalary);
    if (p.hourlyRate !== undefined) setHourlyRate(p.hourlyRate);
    if (p.hoursPerWeek !== undefined) setHoursPerWeek(String(p.hoursPerWeek));
    if (p.overtimeHoursPerWeek !== undefined) setOvertimeHours(String(p.overtimeHoursPerWeek));
    if (p.frequency) setFrequency(p.frequency);
    if (p.filingStatus) setFilingStatus(p.filingStatus);
    if (p.stateCode) setStateCode(p.stateCode);
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

  const state = stateCode ? STATES_BY_CODE[stateCode] : null;
  const fica = result.socialSecurity + result.medicare;
  const hasPay = result.grossAnnual > 0;
  const beforeState = state ? '' : ', before state tax';

  const segments = [
    { key: 'net', label: 'Take-home', value: result.netAnnual, color: 'bg-data-net' },
    { key: 'federal', label: 'Federal income tax', value: result.federalTax, color: 'bg-data-federal' },
    { key: 'fica', label: 'Social Security & Medicare', value: fica, color: 'bg-data-fica' },
    ...(state ? [{ key: 'state', label: `${state.name} income tax`, value: result.stateTax, color: 'bg-data-state' }] : []),
  ];

  return (
    <section id="calculator" aria-labelledby="paycheck-heading" className="scroll-mt-24">
      <h2 id="paycheck-heading" className="text-2xl/[1.2] font-bold tracking-[-0.01em] text-ink md:text-[1.75rem]">
        Estimate your take-home pay
      </h2>

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
        {/* ------------------------------ Inputs ------------------------------ */}
        <form className="flex flex-col gap-6 lg:col-span-7" onSubmit={(e) => e.preventDefault()} noValidate>
          <RadioGroup legend="How are you paid?" name="pay-mode" options={PAY_MODE_OPTIONS} value={mode} onChange={setMode} inline />

          {mode === 'hourly' ? (
            <div className="grid gap-5 sm:grid-cols-3 sm:gap-4">
              <Field id="hourly-rate" label="Hourly rate" hint="Before taxes">
                <CurrencyInput id="hourly-rate" value={hourlyRate} onValueChange={setHourlyRate} placeholder="25.00" describedBy="hourly-rate-hint" />
              </Field>
              <Field id="hours-per-week" label="Hours a week" hint="Regular hours">
                <HoursInput id="hours-per-week" value={hoursPerWeek} onChange={setHoursPerWeek} describedBy="hours-per-week-hint" unit="hrs" />
              </Field>
              <Field id="overtime-hours" label="Overtime a week" hint="Paid at 1.5×">
                <HoursInput id="overtime-hours" value={overtimeHours} onChange={setOvertimeHours} describedBy="overtime-hours-hint" unit="hrs" />
              </Field>
            </div>
          ) : (
            <Field id="annual-salary" label="Gross annual salary" hint="Before taxes and deductions" className="sm:max-w-xs">
              <CurrencyInput id="annual-salary" value={annualSalary} onValueChange={setAnnualSalary} placeholder="65,000" describedBy="annual-salary-hint" />
            </Field>
          )}

          <Field id="pay-frequency" label="How often are you paid?" className="sm:max-w-xs">
            <NativeSelect id="pay-frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as PayFrequency)}>
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <RadioGroup legend="Filing status" name="filing-status" options={FILING_OPTIONS} value={filingStatus} onChange={setFilingStatus} />

          <Field id="paycheck-state" label="State" className="sm:max-w-xs">
            <NativeSelect
              id="paycheck-state"
              value={stateCode ?? ''}
              onChange={(e) => setStateCode((e.target.value || null) as StateCode | null)}
              aria-describedby="paycheck-state-help"
            >
              <option value="">Choose a state</option>
              {STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
            <div id="paycheck-state-help" className="mt-2 text-[15px] text-ink-2">
              {!state ? 'Adds state income tax to your estimate.' : state.structure === 'none' ? <NoStateTaxBadge /> : formatStateRate(state)}
            </div>
          </Field>

        </form>

        {/* ------------------------------ Results ----------------------------- */}
        <aside aria-labelledby="take-home-heading" className="flex flex-col gap-6 lg:sticky lg:top-24 lg:col-span-5 lg:row-span-2 lg:self-start">
          <div className="rounded-panel border border-line bg-green-tint p-5 sm:p-6">
            <h3 id="take-home-heading" className="font-semibold text-ink">
              Take-home per paycheck
            </h3>
            {hasPay ? (
              <>
                <p className="num mt-1 text-[2.5rem]/[1.05] font-bold tracking-[-0.02em] text-ink sm:text-5xl/[1.05]">
                  {formatUSDCents(result.netPerPeriod)}
                </p>
                <p className="num mt-1 text-ink-2">
                  {formatUSD(result.netAnnual)} a year, {result.periods} paychecks{beforeState}
                </p>
                <BreakdownBar
                  className="mt-5"
                  segments={segments}
                  label={`Where your pay goes: ${segments.map((s) => `${s.label} ${pct(s.value, result.grossAnnual).toFixed(1)}%`).join(', ')}.`}
                />
                <ul className="num mt-3 flex flex-col gap-1.5 text-[15px]">
                  {segments.map((s) => (
                    <li key={s.key} className="flex items-center gap-2 text-ink">
                      <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 ${s.color}`} />
                      <span className="min-w-0 flex-1">{s.label}</span>
                      <span className="text-ink-2">{pct(s.value, result.grossAnnual).toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-ink-2">Enter your pay to see what you take home.</p>
            )}
            <p className="sr-only" aria-live="polite">
              {hasPay
                ? `Take-home pay ${formatUSDCents(result.netPerPeriod)} per paycheck, ${formatUSD(result.netAnnual)} a year${beforeState}.`
                : 'Enter your pay to see your take-home pay.'}
            </p>
          </div>

          {hasPay && (
            <table className="w-full text-[15px]">
              <caption className="mb-2 text-left text-base font-semibold text-ink">Paycheck breakdown</caption>
              <thead className="bg-surface text-ink">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">
                    Item
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                    Per paycheck
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Annual
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => r.kind !== 'earning')
                  .map((r) => {
                    const net = r.kind === 'net';
                    const noState = r.kind === 'tax' && r.label === 'State income tax' && !state;
                    const sign = r.kind === 'tax' && r.annual > 0 ? '−' : '';
                    return (
                      <tr key={r.label} className={net ? 'border-t-2 border-ink font-bold' : 'border-t border-line'}>
                        <th scope="row" className={`px-3 py-2 text-left ${r.kind === 'tax' ? 'font-normal' : net ? 'font-bold' : 'font-semibold'} text-ink`}>
                          {r.label}
                        </th>
                        {noState ? (
                          <td colSpan={2} className="px-3 py-2 text-right text-ink-2">
                            Not included
                          </td>
                        ) : (
                          <>
                            <td className="px-3 py-2 text-right text-ink">
                              {sign}
                              {formatUSDCents(r.perPeriod)}
                            </td>
                            <td className="px-3 py-2 text-right text-ink-2">
                              {sign}
                              {formatUSD(r.annual)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}

          <PaycheckExportActions input={input} result={result} />

          <p className="text-sm text-ink-2">
            Estimates only. Assumes the {PAYCHECK_TAX_YEAR} standard deduction, no pre-tax deductions (401(k), health
            insurance), and standard W-4 withholding. Local income taxes aren’t included.{' '}
            <a href="/methodology/" className="text-link underline underline-offset-[3px]">
              How we calculate
            </a>
          </p>
        </aside>

        {/* After the results on phones; under the form on desktop, where the results column spans both rows. */}
        <div className="lg:col-span-7">
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
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// How the estimate is calculated (balances the input column)
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
          `Your pay minus the ${PAYCHECK_TAX_YEAR} standard deduction, taxed through the 10% to 37% brackets.`
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
          ? `No wage cap, plus 0.9% Additional Medicare Tax on wages above your filing-status threshold (${formatUSD(additionalMedicare)} a year). Employers start withholding it at $200,000 regardless of filing status.`
          : 'No wage cap. An extra 0.9% applies above $200,000 ($250,000 married filing jointly).',
    },
    {
      title: 'State income tax',
      body: stateName
        ? stateIsNoTax
          ? `${stateName} doesn’t tax wages.`
          : `${stateName}: ${stateRate}. Single-filer estimate; local taxes (city, county, school district) aren’t included.`
        : 'Choose your state to include it. Nine states don’t tax wages at all.',
    },
  ];

  return (
    <section aria-labelledby="withholding-heading" className="border-t border-line pt-6">
      <h3 id="withholding-heading" className="text-xl/[1.3] font-bold text-ink">
        How this estimate works
      </h3>
      <dl className="mt-3">
        {items.map((i) => (
          <div key={i.title} className="border-b border-line py-3 last:border-b-0">
            <dt className="font-semibold text-ink">{i.title}</dt>
            <dd className="num mt-0.5 text-ink-2">{i.body}</dd>
          </div>
        ))}
      </dl>
      {overtimePay > 0 && (
        <p className="mt-4 border-l-4 border-line bg-surface px-4 py-3 text-ink">
          <span className="font-semibold">Good to know: </span>
          the half-time premium in your overtime (about {formatUSD(overtimePay / 3)} a year here) may be deductible under the
          new “no tax on overtime” rules, up to $12,500. This paycheck estimate doesn’t include it.{' '}
          <a href="/tools/obbba-tax-calculator/" className="text-link underline underline-offset-[3px]">
            Estimate your overtime deduction
          </a>
          .
        </p>
      )}
    </section>
  );
}
