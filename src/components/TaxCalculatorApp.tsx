import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { calculateObbbaDeduction } from '../lib/obbba-calculator';
import { PARAMS_BY_YEAR, type CategoryResult, type FilingStatus, type IneligibilityReason } from '../lib/obbba-params';
import { estimateFederalTaxSavings, isCoveredByStandardDeduction } from '../lib/marginal-rate';
import { STANDARD_DEDUCTION_COVERS_NOTICE } from '../lib/deduction-summary';
import { W2_PREFILL_EVENT, type W2PrefillDetail } from '../lib/w2-events';
import { estimateStateTax, findState, type StateCode } from '../lib/state-tax-data';
import CurrencyInput, { formatUSD } from './CurrencyInput';
import ExportSummaryActions from './ExportSummaryActions';
import IncomeBreakdownBar from './IncomeBreakdownBar';
import NoStateTaxBadge from './NoStateTaxBadge';
import StateSelect from './StateSelect';
import { useAnimatedNumber } from './useAnimatedNumber';

const TAX_YEAR = 2026;
const MFS_TOOLTIP = 'Married Filing Separately is ineligible under IRC §224/§225';

const FILING_STATUSES: { value: FilingStatus; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'hoh', label: 'Head of Household' },
  { value: 'mfj', label: 'Married Filing Jointly' },
  { value: 'mfs', label: 'Married Filing Separately' },
];

const INELIGIBLE_COPY: Record<IneligibilityReason, string> = {
  NOT_CLAIMED: 'Not included',
  MARRIED_FILING_SEPARATELY: MFS_TOOLTIP,
  SELF_EMPLOYED_SSTB: 'Self-employed individuals in a specified service trade or business do not qualify.',
  FLSA_EXEMPT_EMPLOYEE: 'Confirm you are FLSA non-exempt to include overtime.',
};

export default function TaxCalculatorApp() {
  const [filingStatus, setFilingStatus] = useState<FilingStatus>('single');
  const [stateCode, setStateCode] = useState<StateCode | null>(null);
  const [hasSsn, setHasSsn] = useState(false);
  const [magi, setMagi] = useState<number | null>(null);

  const [tipsEnabled, setTipsEnabled] = useState(true);
  const [tipsAmount, setTipsAmount] = useState<number | null>(null);
  const [occupationConfirmed, setOccupationConfirmed] = useState(false);

  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [overtimeAmount, setOvertimeAmount] = useState<number | null>(null);
  const [flsaNonExempt, setFlsaNonExempt] = useState(false);

  const rootRef = useRef<HTMLElement>(null);
  const tipsInputRef = useRef<HTMLInputElement>(null);
  const overtimeInputRef = useRef<HTMLInputElement>(null);
  const [pendingFocus, setPendingFocus] = useState<'TP' | 'TT' | null>(null);

  // Prefill requests from the W-2 Box 12 decoder (separate Astro island).
  useEffect(() => {
    function onPrefill(e: Event) {
      const { code, amount } = (e as CustomEvent<W2PrefillDetail>).detail;
      if (code === 'TP') {
        setTipsEnabled(true);
        if (amount !== undefined) setTipsAmount(amount);
      } else {
        setOvertimeEnabled(true);
        if (amount !== undefined) setOvertimeAmount(amount);
      }
      setPendingFocus(code);
    }
    window.addEventListener(W2_PREFILL_EVENT, onPrefill);
    return () => window.removeEventListener(W2_PREFILL_EVENT, onPrefill);
  }, []);

  // Preselect the state from the State Directory link (?state=texas or ?state=TX).
  useEffect(() => {
    const s = findState(new URLSearchParams(window.location.search).get('state'));
    if (s) setStateCode(s.code);
  }, []);

  // Focus after the toggled block has rendered.
  useEffect(() => {
    if (!pendingFocus) return;
    const target = pendingFocus === 'TP' ? tipsInputRef.current : overtimeInputRef.current;
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target?.focus({ preventScroll: true });
    setPendingFocus(null);
  }, [pendingFocus]);

  const isMfs = filingStatus === 'mfs';
  const magiValue = magi ?? 0;

  const result = useMemo(
    () =>
      calculateObbbaDeduction({
        filingStatus,
        magi: magiValue,
        taxYear: TAX_YEAR,
        // Tips only count once the user confirms a qualifying occupation.
        hasQualifyingTips: tipsEnabled && occupationConfirmed,
        tipsAmount: tipsAmount ?? 0,
        tipsOccupationConfirmed: occupationConfirmed,
        hasQualifyingOvertime: overtimeEnabled,
        overtimePremiumAmount: overtimeAmount ?? 0,
        isFLSANonExempt: flsaNonExempt,
      }),
    [filingStatus, magiValue, tipsEnabled, tipsAmount, occupationConfirmed, overtimeEnabled, overtimeAmount, flsaNonExempt],
  );

  const baseTotal = result.tips.deductionBeforePhaseout + result.overtime.deductionBeforePhaseout;
  const reductionTotal =
    Math.min(result.tips.phaseoutReduction, result.tips.deductionBeforePhaseout) +
    Math.min(result.overtime.phaseoutReduction, result.overtime.deductionBeforePhaseout);
  const savings = estimateFederalTaxSavings(magiValue, result.totalCombinedDeduction, filingStatus);
  const shownTotal = useAnimatedNumber(result.totalCombinedDeduction);
  const shownSavings = useAnimatedNumber(savings);
  const coveredByStandardDeduction = isCoveredByStandardDeduction(magiValue, filingStatus);
  // State tax is estimated on full MAGI: whether a state follows the federal tips & overtime deduction varies and isn't in our data.
  const stateTax = useMemo(
    () => (stateCode ? estimateStateTax(magiValue, stateCode) : null),
    [stateCode, magiValue],
  );

  const phaseoutStart =
    filingStatus === 'mfj'
      ? PARAMS_BY_YEAR[TAX_YEAR].tips.phaseoutThresholdMfj
      : PARAMS_BY_YEAR[TAX_YEAR].tips.phaseoutThresholdSingleOrHoh;

  // Live status for the qualification checklist (informational; it doesn't change the math).
  const checklist: CheckItem[] = [
    {
      key: 'ssn',
      label: 'Valid Social Security number',
      status: hasSsn ? 'pass' : 'pending',
      detail: 'Required for both deductions. An SSN valid for employment; ITINs don’t qualify.',
    },
    {
      key: 'filing',
      label: 'Eligible filing status',
      status: isMfs ? 'fail' : 'pass',
      detail: isMfs ? 'Married couples must file jointly to claim either deduction.' : `${FILING_STATUSES.find((f) => f.value === filingStatus)!.label} can claim both deductions.`,
    },
    {
      key: 'treasury',
      label: 'Treasury tipped occupation list',
      status: !tipsEnabled ? 'na' : occupationConfirmed ? 'pass' : 'pending',
      detail: !tipsEnabled
        ? 'Only needed if you claim tips.'
        : occupationConfirmed
          ? 'Your occupation customarily received tips on or before Dec 31, 2024.'
          : 'Confirm your occupation is on the Treasury list (checkbox above).',
    },
    {
      key: 'flsa',
      label: 'FLSA non-exempt employee',
      status: !overtimeEnabled ? 'na' : flsaNonExempt ? 'pass' : 'pending',
      detail: !overtimeEnabled
        ? 'Only needed if you claim overtime.'
        : flsaNonExempt
          ? 'Your overtime premium is required by FLSA §7.'
          : 'Confirm you are entitled to FLSA overtime (checkbox above).',
    },
    {
      key: 'magi',
      label: 'Income phase-out',
      status: magiValue <= 0 ? 'pending' : magiValue <= phaseoutStart ? 'pass' : result.totalCombinedDeduction > 0 ? 'warn' : baseTotal > 0 ? 'fail' : 'warn',
      detail:
        magiValue <= 0
          ? 'Enter your MAGI above.'
          : magiValue <= phaseoutStart
            ? `Below the ${formatUSD(phaseoutStart)} phase-out threshold.`
            : `Above ${formatUSD(phaseoutStart)}: reduced $100 per $1,000 of MAGI.`,
    },
    {
      key: 'schedule',
      label: 'Form 1040 Schedule 1-A',
      status: result.totalCombinedDeduction > 0 ? (hasSsn ? 'pass' : 'pending') : 'pending',
      detail:
        result.totalCombinedDeduction > 0
          ? hasSsn
            ? `Claim ${formatUSD(result.totalCombinedDeduction)} on Schedule 1-A; it flows to Form 1040, line 13b.`
            : 'Confirm your SSN to complete eligibility.'
          : 'Complete the items above to see your Schedule 1-A amount.',
    },
  ];

  const tipsNote = tipsEnabled && !occupationConfirmed && !isMfs
    ? 'Confirm your occupation is on the Treasury list to include tips.'
    : null;

  return (
    <section
      ref={rootRef}
      id="calculator"
      aria-labelledby="calculator-heading"
      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-xl"
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Step 2</p>
        <h2 id="calculator-heading" className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Estimate your {TAX_YEAR} tips &amp; overtime deduction
        </h2>
        <p className="text-slate-600 dark:text-slate-400">Results update automatically as you type. Nothing you enter leaves your browser.</p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* ------------------------------ Inputs ------------------------------ */}
        <form className="flex flex-col gap-8 lg:col-span-7" onSubmit={(e) => e.preventDefault()} noValidate>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_15rem]">
          <fieldset>
            <legend className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filing status</legend>
            <div role="radiogroup" aria-label="Filing status" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
              {FILING_STATUSES.map(({ value, label }) => {
                const disabled = value === 'mfs';
                const active = filingStatus === value;
                return (
                  <div key={value} className="group relative">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-disabled={disabled || undefined}
                      aria-describedby={disabled ? 'mfs-tooltip' : undefined}
                      onClick={() => !disabled && setFilingStatus(value)}
                      className={`h-full w-full rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${
                        disabled
                          ? 'cursor-not-allowed border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-400'
                          : active
                            ? 'border-ink bg-ink text-white shadow-sm dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                    {disabled && (
                      <span
                        id="mfs-tooltip"
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 w-60 rounded-md bg-slate-900 px-3 py-2 text-xs leading-snug text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100"
                      >
                        {MFS_TOOLTIP}. Married couples must file jointly to claim it.
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="state" className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
              State
            </label>
            <div className="mt-2">
              <StateSelect id="state" value={stateCode} onChange={setStateCode} placeholder="Select State" describedBy="state-help" />
            </div>
            <div id="state-help" className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {!stateTax ? (
                <>
                  Optional. Adds state income tax to the breakdown.{' '}
                  <a href="/state-taxes/" className="text-navy-700 underline underline-offset-2 dark:text-navy-300">
                    Browse the map
                  </a>
                </>
              ) : stateTax.structure === 'none' ? (
                <NoStateTaxBadge />
              ) : (
                <>
                  {stateTax.rateLabel} · est. <span className="tabular-nums">{formatUSD(stateTax.tax)}</span>
                </>
              )}
            </div>
          </div>
          </div>

          <div>
            <label htmlFor="magi" className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
              Estimated MAGI / AGI
            </label>
            <p id="magi-help" className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Your adjusted gross income from Form 1040, line 11. If you have foreign or U.S. territory income, your
              MAGI may be higher than your AGI.
            </p>
            <div className="mt-2 sm:max-w-xs">
              <CurrencyInput id="magi" value={magi} onValueChange={setMagi} placeholder="65,000" describedBy="magi-help" />
            </div>
          </div>

          <ToggleBlock
            id="tips"
            title="I received qualified tips"
            subtitle="Voluntary cash or card tips from customers"
            enabled={tipsEnabled}
            onToggle={setTipsEnabled}
          >
            <label htmlFor="tips-amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Qualified tips (W-2 Box 12, Code TP)
            </label>
            <p id="tips-help" className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              No W-2 yet? Enter your total qualified tips for the year.
            </p>
            <div className="mt-2 sm:max-w-xs">
              <CurrencyInput
                ref={tipsInputRef}
                id="tips-amount"
                value={tipsAmount}
                onValueChange={setTipsAmount}
                placeholder="0"
                describedBy="tips-help"
              />
            </div>
            <Checkbox id="tips-occupation" checked={occupationConfirmed} onChange={setOccupationConfirmed}>
              My occupation is on the Treasury Department’s list of occupations that customarily received tips on or
              before December 31, 2024.
            </Checkbox>
          </ToggleBlock>

          <ToggleBlock
            id="overtime"
            title="I earned qualified overtime"
            subtitle="Overtime required by the Fair Labor Standards Act (FLSA)"
            enabled={overtimeEnabled}
            onToggle={setOvertimeEnabled}
          >
            <label htmlFor="overtime-amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Overtime premium (W-2 Box 12, Code TT)
            </label>
            <p id="overtime-help" className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Enter only the premium portion (the extra “half” in time-and-a-half), not your total overtime pay.
            </p>
            <div className="mt-2 sm:max-w-xs">
              <CurrencyInput
                ref={overtimeInputRef}
                id="overtime-amount"
                value={overtimeAmount}
                onValueChange={setOvertimeAmount}
                placeholder="0"
                describedBy="overtime-help"
              />
            </div>
            <Checkbox id="overtime-flsa" checked={flsaNonExempt} onChange={setFlsaNonExempt}>
              I am a non-exempt employee under the FLSA (I am legally entitled to overtime pay).
            </Checkbox>
          </ToggleBlock>

          <QualificationChecklist items={checklist} hasSsn={hasSsn} onSsnChange={setHasSsn} />
        </form>

        {/* ------------------------------ Results ----------------------------- */}
        <aside aria-labelledby="results-heading" className="flex flex-col gap-4 lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
          {/* 1. Hero: tax savings */}
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-950 via-slate-900 to-slate-950 p-6 text-white shadow-xl ring-1 ring-emerald-500/30">
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <h3 id="results-heading" className="text-sm font-medium text-emerald-100/80">
                  Estimated Money Saved (Tax Savings)
                </h3>
                <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-emerald-100 ring-1 ring-white/15">
                  {TAX_YEAR} rules
                </span>
              </div>
              <p
                className={`mt-2 text-5xl font-bold tracking-tight tabular-nums transition-colors duration-300 ${
                  savings > 0 ? 'text-emerald-400' : 'text-slate-300'
                }`}
                aria-hidden="true"
              >
                {savings > 0 ? '+' : ''}
                {formatUSD(shownSavings)}
              </p>
              <p className="mt-1 text-sm text-slate-400">Less federal income tax owed for {TAX_YEAR}</p>

              <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-white/10 pt-4">
                <p className="text-sm text-slate-300">Total Federal Deduction (Schedule 1-A)</p>
                <p className="text-lg font-semibold tabular-nums text-white" aria-hidden="true">
                  {formatUSD(shownTotal)}
                </p>
              </div>

              {coveredByStandardDeduction && (
                <p className="mt-4 flex gap-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-400/40">
                  <span aria-hidden="true">✓</span>
                  <span>{STANDARD_DEDUCTION_COVERS_NOTICE}</span>
                </p>
              )}
              {isMfs && <p className="mt-3 text-sm text-amber-200">{MFS_TOOLTIP}.</p>}
              <p className="sr-only" aria-live="polite">
                Estimated money saved {formatUSD(savings)}. Total federal deduction{' '}
                {formatUSD(result.totalCombinedDeduction)}.
              </p>
            </div>
          </div>

          {/* 2. Where your income goes */}
          <IncomeBreakdownBar magi={magiValue} deduction={result.totalCombinedDeduction} savings={savings} stateTax={stateTax} />

          {/* 3. Compact line-item breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-xl">
            <h4 className="font-medium text-slate-900 dark:text-slate-100">Deduction breakdown</h4>
            <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
              <CategoryRow title="Qualified tips (TP)" category={result.tips} enabled={tipsEnabled} note={tipsNote} />
              <CategoryRow title="Qualified overtime (TT)" category={result.overtime} enabled={overtimeEnabled} />
            </ul>
            <dl className="mt-3 space-y-1.5 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
              <Row label="Base deduction (after caps)" value={formatUSD(baseTotal)} />
              <Row label="MAGI phase-out reduction" value={reductionTotal > 0 ? `−${formatUSD(reductionTotal)}` : formatUSD(0)} />
              <Row label="Total deduction" value={formatUSD(result.totalCombinedDeduction)} strong />
            </dl>
          </div>

          {/* 4. Export */}
          <ExportSummaryActions
            result={result}
            tipsReported={tipsEnabled ? (tipsAmount ?? 0) : 0}
            overtimeReported={overtimeEnabled ? (overtimeAmount ?? 0) : 0}
            savings={savings}
            stateTax={stateTax}
          />

          {/* 5. FICA note */}
          <p className="flex gap-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            <span aria-hidden="true" className="mt-px text-amber-500">●</span>
            <span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{result.ficaStillOwedNotice}</span>{' '}
              Estimates only, not tax advice. Savings assume the {TAX_YEAR} standard deduction and federal brackets and
              treat MAGI as AGI.
            </span>
          </p>
        </aside>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

function ToggleBlock(props: {
  id: string;
  title: string;
  subtitle: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: ReactNode;
}) {
  const { id, title, subtitle, enabled, onToggle, children } = props;
  return (
    <div
      className={`rounded-xl border transition-colors duration-300 ${
        enabled ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-500/5 shadow-sm' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <div className="flex items-center justify-between gap-4 p-4">
        <div>
          <p id={`${id}-toggle-label`} className="font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby={`${id}-toggle-label`}
          aria-controls={`${id}-panel`}
          onClick={() => onToggle(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
            enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white dark:bg-slate-900 shadow transition-transform duration-200 ${enabled ? 'translate-x-5.5' : 'translate-x-0.5'}`}
          />
        </button>
      </div>
      {/* Kept mounted so it can animate open; `inert` removes it from focus and the a11y tree when collapsed. */}
      <div
        id={`${id}-panel`}
        inert={!enabled}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
          enabled ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-slate-200 dark:border-slate-800 p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Checkbox(props: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-3">
      <input
        id={props.id}
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-slate-700 accent-emerald-600"
      />
      <label htmlFor={props.id} className="text-sm text-slate-700 dark:text-slate-300">
        {props.children}
      </label>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={strong ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}>{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
        {value}
      </dd>
    </div>
  );
}

function categoryStatus(category: CategoryResult, enabled: boolean, note?: string | null): string | null {
  const reduction = Math.min(category.phaseoutReduction, category.deductionBeforePhaseout);
  if (note) return note;
  if (!category.isEligible && category.ineligibilityReason) {
    return category.ineligibilityReason === 'NOT_CLAIMED' && !enabled ? 'Not included' : INELIGIBLE_COPY[category.ineligibilityReason];
  }
  if (category.isFullyPhasedOut) return 'Fully phased out at your MAGI.';
  if (reduction > 0 && category.distanceToNextPhaseoutStep !== null) {
    return `Drops by another $100 with ${formatUSD(category.distanceToNextPhaseoutStep)} more MAGI.`;
  }
  if (category.deductionFinal > 0) return `Base ${formatUSD(category.deductionBeforePhaseout)} after the cap.`;
  return null;
}

function CategoryRow(props: { title: string; category: CategoryResult; enabled: boolean; note?: string | null }) {
  const { title, category, enabled, note } = props;
  const status = categoryStatus(category, enabled, note);
  const active = category.deductionFinal > 0;
  return (
    <li className="flex items-start justify-between gap-4 py-2.5 first:pt-0">
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          aria-hidden="true"
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
        />
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-slate-100">{title}</p>
          {status && <p className="text-xs text-slate-500 dark:text-slate-400">{status}</p>}
        </div>
      </div>
      <span
        className={`shrink-0 font-semibold tabular-nums ${active ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}
      >
        {formatUSD(category.deductionFinal)}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// 2026 filing qualification checklist
// ---------------------------------------------------------------------------

type CheckStatus = 'pass' | 'fail' | 'warn' | 'pending' | 'na';

interface CheckItem {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

const CHECK_STYLES: Record<CheckStatus, { icon: string; badge: string; sr: string }> = {
  pass: { icon: '✓', badge: 'bg-emerald-500 text-white', sr: 'Met' },
  fail: { icon: '✕', badge: 'bg-rose-500 text-white', sr: 'Not met' },
  warn: { icon: '!', badge: 'bg-amber-400 text-amber-950', sr: 'Partly met' },
  pending: { icon: '', badge: 'border-2 border-slate-300 dark:border-slate-600', sr: 'To confirm' },
  na: { icon: '–', badge: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500', sr: 'Not applicable' },
};

function QualificationChecklist(props: { items: CheckItem[]; hasSsn: boolean; onSsnChange: (v: boolean) => void }) {
  const { items, hasSsn, onSsnChange } = props;
  const met = items.filter((i) => i.status === 'pass').length;
  const applicable = items.filter((i) => i.status !== 'na').length;
  return (
    <section
      aria-labelledby="checklist-heading"
      className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-xl"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h3 id="checklist-heading" className="font-semibold text-slate-900 dark:text-slate-100">
          {TAX_YEAR} Filing Qualification Checklist
        </h3>
        <span className="text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
          {met}/{applicable} met
        </span>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((item) => {
          const style = CHECK_STYLES[item.status];
          return (
            <li key={item.key} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors duration-200 ${style.badge}`}
              >
                {style.icon}
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {item.label}
                  <span className="sr-only">: {style.sr}.</span>
                </p>
                <p className="text-slate-500 dark:text-slate-400">{item.detail}</p>
                {item.key === 'ssn' && (
                  <label className="mt-1.5 inline-flex cursor-pointer items-center gap-2 text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={hasSsn}
                      onChange={(e) => onSsnChange(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                    />
                    I have a valid SSN (we never ask for the number)
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
