import { useMemo, useState } from 'react';
import { calculatePaycheck, type PayFrequency, type PaycheckFilingStatus, type PaycheckInput, type PayMode } from '../lib/paycheck';
import { toPaycheckSearchParams } from '../lib/paycheck-url';
import { STATES, STATES_BY_CODE, type StateCode } from '../lib/state-tax-data';
import BreakdownBar from './BreakdownBar';
import CurrencyInput, { formatUSD, formatUSDCents } from './CurrencyInput';
import { HoursInput, RadioGroup } from './form';
import NativeSelect from './NativeSelect';
import { FILING_OPTIONS, FREQUENCY_OPTIONS, PAY_MODE_OPTIONS } from './paycheck-options';

/**
 * Home page paycheck estimate (docs/DESIGN.md §8): a short form and its result, side by side from sm up.
 * Same engine as the full calculator; "See the full breakdown" opens it with these inputs in the URL.
 * Defaults show a result on first paint, including the build-time HTML shown without JavaScript.
 */

const minus = (n: number) => (n > 0 ? `−${formatUSDCents(n)}` : formatUSDCents(0));

export default function HomePaycheckEstimate() {
  const [mode, setMode] = useState<PayMode>('salary');
  const [annualSalary, setAnnualSalary] = useState<number | null>(65_000);
  const [hourlyRate, setHourlyRate] = useState<number | null>(25);
  const [hoursPerWeek, setHoursPerWeek] = useState('40');
  const [frequency, setFrequency] = useState<PayFrequency>('biweekly');
  const [filingStatus, setFilingStatus] = useState<PaycheckFilingStatus>('single');
  const [stateCode, setStateCode] = useState<StateCode | null>(null);

  const input: PaycheckInput = {
    mode,
    annualSalary: annualSalary ?? 0,
    hourlyRate: hourlyRate ?? 0,
    hoursPerWeek: Number(hoursPerWeek) || 0,
    overtimeHoursPerWeek: 0,
    frequency,
    filingStatus,
    stateCode,
  };
  const r = useMemo(() => calculatePaycheck(input), [mode, annualSalary, hourlyRate, hoursPerWeek, frequency, filingStatus, stateCode]);
  const state = stateCode ? STATES_BY_CODE[stateCode] : null;
  const hasPay = r.grossAnnual > 0;
  const per = (annual: number) => annual / r.periods;
  const fica = r.socialSecurity + r.medicare;
  const fullHref = `/tools/paycheck-calculator/?${toPaycheckSearchParams(input)}#calculator`;

  const segments = [
    { key: 'net', value: r.netAnnual, color: 'bg-data-net' },
    { key: 'federal', value: r.federalTax, color: 'bg-data-federal' },
    { key: 'fica', value: fica, color: 'bg-data-fica' },
    { key: 'state', value: r.stateTax, color: 'bg-data-state' },
  ];

  return (
    <div className="grid overflow-hidden rounded-panel border border-line sm:grid-cols-[5fr_6fr]">
      <form className="flex flex-col gap-5 p-4 sm:p-6" onSubmit={(e) => e.preventDefault()} noValidate aria-labelledby="estimate-heading">
        <h2 id="estimate-heading" className="text-xl/[1.3] font-bold text-ink">
          Paycheck estimate
        </h2>

        <RadioGroup legend="How are you paid?" name="home-pay-mode" options={PAY_MODE_OPTIONS} value={mode} onChange={setMode} inline />

        {mode === 'salary' ? (
          <div>
            <label htmlFor="home-salary" className="mb-1.5 block font-semibold text-ink">
              Annual salary
            </label>
            <CurrencyInput id="home-salary" value={annualSalary} onValueChange={setAnnualSalary} placeholder="65,000" />
          </div>
        ) : (
          <div className="grid grid-cols-[3fr_2fr] gap-3">
            <div>
              <label htmlFor="home-rate" className="mb-1.5 block font-semibold text-ink">
                Hourly rate
              </label>
              <CurrencyInput id="home-rate" value={hourlyRate} onValueChange={setHourlyRate} placeholder="25.00" />
            </div>
            <div>
              <label htmlFor="home-hours" className="mb-1.5 block font-semibold text-ink">
                Hours a week
              </label>
              <HoursInput id="home-hours" value={hoursPerWeek} onChange={setHoursPerWeek} unit="hrs" />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="home-frequency" className="mb-1.5 block font-semibold text-ink">
            Paid
          </label>
          <NativeSelect id="home-frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as PayFrequency)}>
            {FREQUENCY_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div>
          <label htmlFor="home-filing" className="mb-1.5 block font-semibold text-ink">
            Filing as
          </label>
          <NativeSelect id="home-filing" value={filingStatus} onChange={(e) => setFilingStatus(e.target.value as PaycheckFilingStatus)}>
            {FILING_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div>
          <label htmlFor="home-state" className="mb-1.5 block font-semibold text-ink">
            State
          </label>
          <NativeSelect id="home-state" value={stateCode ?? ''} onChange={(e) => setStateCode((e.target.value || null) as StateCode | null)}>
            <option value="">Choose a state</option>
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </form>

      <div className="flex flex-col border-t border-line bg-green-tint p-4 sm:border-t-0 sm:border-l sm:p-6">
        <p className="font-semibold text-ink">Take-home per paycheck</p>
        {hasPay ? (
          <>
            <p className="num mt-1 text-[2.5rem]/[1.05] font-bold tracking-[-0.02em] text-ink sm:text-5xl/[1.05]">
              {formatUSDCents(r.netPerPeriod)}
            </p>
            <p className="num mt-1 text-ink-2">
              {formatUSD(r.netAnnual)} a year, {r.periods} paychecks{state ? '' : ', before state tax'}
            </p>

            <BreakdownBar segments={segments} className="mt-5" />

            <dl className="num mt-3">
              <Row color="bg-data-federal" label="Federal income tax" value={minus(per(r.federalTax))} />
              <Row color="bg-data-fica" label="Social Security & Medicare" value={minus(per(fica))} />
              {state ? (
                <Row color="bg-data-state" label={`${state.name} income tax`} value={minus(per(r.stateTax))} />
              ) : (
                <Row color="bg-data-state" label="State income tax" value="Choose a state" muted />
              )}
              <Row color="bg-data-net" label="Take-home" value={formatUSDCents(r.netPerPeriod)} strong />
            </dl>
          </>
        ) : (
          <p className="mt-2 text-ink-2">Enter your pay to see what you take home.</p>
        )}

        <p className="sr-only" aria-live="polite">
          {hasPay
            ? `Take-home pay ${formatUSDCents(r.netPerPeriod)} per paycheck, ${formatUSD(r.netAnnual)} a year${state ? '' : ', before state tax'}.`
            : 'Enter your pay to see your take-home pay.'}
        </p>

        <a
          href={fullHref}
          className="btn-primary mt-5 inline-flex h-11 items-center justify-center rounded-control px-5 font-semibold sm:self-start"
        >
          See the full breakdown
        </a>
        <p className="mt-3 text-sm text-ink-2">Assumes the standard deduction and no 401(k) or health insurance deductions.</p>
      </div>
    </div>
  );
}

function Row({ color, label, value, strong = false, muted = false }: { color: string; label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="grid grid-cols-[0.625rem_1fr_auto] items-center gap-x-2.5 border-b border-ink/12 py-2 last:border-b-0">
      <span aria-hidden="true" className={`h-2.5 w-2.5 ${color}`} />
      <dt className={strong ? 'font-bold text-ink' : 'text-ink'}>{label}</dt>
      <dd className={`text-right ${strong ? 'font-bold text-ink' : muted ? 'text-ink-2' : 'text-ink'}`}>{value}</dd>
    </div>
  );
}
