import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { calculateObbbaDeduction } from '../lib/obbba-calculator';
import type { CategoryResult, FilingStatus, IneligibilityReason } from '../lib/obbba-params';
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
  // State tax is estimated on full MAGI: most states do not allow the federal tips & overtime deduction.
  const stateTax = useMemo(
    () => (stateCode ? estimateStateTax(magiValue, stateCode) : null),
    [stateCode, magiValue],
  );

  const tipsNote = tipsEnabled && !occupationConfirmed && !isMfs
    ? 'Confirm your occupation is on the Treasury list to include tips.'
    : null;

  return (
    <section
      ref={rootRef}
      id="calculator"
      aria-labelledby="calculator-heading"
      className="scroll-mt-24 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Step 2</p>
        <h2 id="calculator-heading" className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Estimate your {TAX_YEAR} tips &amp; overtime deduction
        </h2>
        <p className="text-slate-600 dark:text-slate-400">Results update automatically as you type. Nothing you enter leaves your browser.</p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        {/* ------------------------------ Inputs ------------------------------ */}
        <form className="flex flex-col gap-8" onSubmit={(e) => e.preventDefault()} noValidate>
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
                  <a href="/states" className="text-navy-700 underline underline-offset-2 dark:text-navy-300">
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
        </form>

        {/* ------------------------------ Results ----------------------------- */}
        <aside aria-labelledby="results-heading" className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">
            <span aria-hidden="true">✓</span>
            NetWageTax Verified Logic · Updated for {TAX_YEAR} Tax Rules
          </p>

          <div className="overflow-hidden rounded-2xl border border-ink bg-ink text-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="p-6">
              <h3 id="results-heading" className="text-sm font-medium text-slate-400">
                Estimated Money Saved (Tax Savings)
              </h3>
              <p
                className={`mt-1 text-5xl font-bold tracking-tight tabular-nums transition-colors duration-300 ${
                  savings > 0 ? 'text-emerald-400' : 'text-slate-300'
                }`}
                aria-hidden="true"
              >
                {savings > 0 ? '+' : ''}
                {formatUSD(shownSavings)}
              </p>
              <p className="mt-1 text-sm text-slate-400">Less federal income tax owed for {TAX_YEAR}</p>

              <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-white/10 pt-4">
                <p className="text-sm text-slate-400">Total Federal Deduction (Schedule 1-A)</p>
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
              <p className="sr-only" aria-live="polite">
                Estimated money saved {formatUSD(savings)}. Total federal deduction{' '}
                {formatUSD(result.totalCombinedDeduction)}.
              </p>
              {isMfs && <p className="mt-3 text-sm text-amber-200">{MFS_TOOLTIP}.</p>}
            </div>

            <div className="border-t border-white/10 bg-white/[0.03] px-6 py-5">
              <dl className="space-y-2 text-sm">
                <Row label="Base deduction" value={formatUSD(baseTotal)} />
                <Row
                  label="MAGI phase-out reduction"
                  value={reductionTotal > 0 ? `−${formatUSD(reductionTotal)}` : formatUSD(0)}
                />
                <div className="border-t border-white/10 pt-2">
                  <Row label="Total deduction" value={formatUSD(result.totalCombinedDeduction)} strong />
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-4">
            <IncomeBreakdownBar
              magi={magiValue}
              deduction={result.totalCombinedDeduction}
              savings={savings}
              stateTax={stateTax}
            />
          </div>

          <div className="mt-4 space-y-3">
            <CategoryCard title="Qualified tips" category={result.tips} enabled={tipsEnabled} note={tipsNote} />
            <CategoryCard title="Qualified overtime" category={result.overtime} enabled={overtimeEnabled} />
          </div>

          <div className="mt-4">
            <ExportSummaryActions
              result={result}
              tipsReported={tipsEnabled ? (tipsAmount ?? 0) : 0}
              overtimeReported={overtimeEnabled ? (overtimeAmount ?? 0) : 0}
              savings={savings}
              stateTax={stateTax}
            />
          </div>

          <p className="mt-4 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            <span className="font-semibold">Important: </span>
            {result.ficaStillOwedNotice}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Estimates only, not tax advice. Tax savings assume the {TAX_YEAR} standard deduction and federal income tax
            brackets, and treat MAGI as equal to AGI. Confirm your figures with the official Schedule 1-A instructions or
            a CPA or enrolled agent.
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
      <dt className={strong ? 'font-semibold text-white' : 'text-slate-400'}>{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-semibold text-white' : 'text-white'}`}>{value}</dd>
    </div>
  );
}

function CategoryCard(props: {
  title: string;
  category: CategoryResult;
  enabled: boolean;
  note?: string | null;
}) {
  const { title, category, enabled, note } = props;
  const reduction = Math.min(category.phaseoutReduction, category.deductionBeforePhaseout);

  let status: string | null = null;
  if (note) status = note;
  else if (!category.isEligible && category.ineligibilityReason) {
    status = category.ineligibilityReason === 'NOT_CLAIMED' && !enabled
      ? 'Not included'
      : INELIGIBLE_COPY[category.ineligibilityReason];
  } else if (category.isFullyPhasedOut) {
    status = 'Fully phased out at your MAGI.';
  } else if (reduction > 0 && category.distanceToNextPhaseoutStep !== null) {
    status = `Your deduction drops by another $100 with ${formatUSD(category.distanceToNextPhaseoutStep)} more MAGI.`;
  }

  return (
    <div
      className={`rounded-xl border bg-white dark:bg-slate-900 p-4 transition-colors duration-300 ${
        category.deductionFinal > 0 ? 'border-emerald-300 dark:border-emerald-500/40' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h4 className="font-medium text-slate-900 dark:text-slate-100">{title}</h4>
        <span
          className={`font-semibold tabular-nums transition-colors duration-300 ${
            category.deductionFinal > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'
          }`}
        >{formatUSD(category.deductionFinal)}</span>
      </div>
      {category.isEligible && (
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between gap-4 text-slate-600 dark:text-slate-400">
            <dt>Base deduction</dt>
            <dd className="tabular-nums">{formatUSD(category.deductionBeforePhaseout)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-slate-600 dark:text-slate-400">
            <dt>Phase-out reduction</dt>
            <dd className="tabular-nums">{reduction > 0 ? `−${formatUSD(reduction)}` : formatUSD(0)}</dd>
          </div>
        </dl>
      )}
      {status && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{status}</p>}
    </div>
  );
}
