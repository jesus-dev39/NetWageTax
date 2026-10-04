import { useEffect, useMemo, useRef, useState } from 'react';
import { calculateObbbaDeduction } from '../lib/obbba-calculator';
import { PARAMS_BY_YEAR, type CategoryResult, type FilingStatus, type IneligibilityReason } from '../lib/obbba-params';
import { estimateFederalTaxSavings, isCoveredByStandardDeduction } from '../lib/marginal-rate';
import { STANDARD_DEDUCTION_COVERS_NOTICE } from '../lib/deduction-summary';
import { W2_PREFILL_EVENT, type W2PrefillDetail } from '../lib/w2-events';
import { estimateStateTax, findState, STATES, type StateCode } from '../lib/state-tax-data';
import CurrencyInput, { formatUSD } from './CurrencyInput';
import ExportSummaryActions from './ExportSummaryActions';
import { Checkbox, Field, RadioGroup, Reveal, type RadioOption } from './form';
import IncomeBreakdownBar from './IncomeBreakdownBar';
import NativeSelect from './NativeSelect';
import NoStateTaxBadge from './NoStateTaxBadge';

const TAX_YEAR = 2026;
const MFS_NOTE = 'Married filing separately can’t claim either deduction under IRC §224/§225.';

const FILING_STATUSES: RadioOption<FilingStatus>[] = [
  { value: 'single', label: 'Single' },
  { value: 'hoh', label: 'Head of household' },
  { value: 'mfj', label: 'Married filing jointly' },
  { value: 'mfs', label: 'Married filing separately', hint: 'Can’t claim either deduction: married couples must file jointly.', disabled: true },
];

const INELIGIBLE_COPY: Record<IneligibilityReason, string> = {
  NOT_CLAIMED: 'Not included',
  MARRIED_FILING_SEPARATELY: MFS_NOTE,
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

  // Focus after the revealed block has rendered.
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
            ? `Claim ${formatUSD(result.totalCombinedDeduction)} on Schedule 1-A; the total carries to Form 1040.`
            : 'Confirm your SSN to complete eligibility.'
          : 'Complete the items above to see your Schedule 1-A amount.',
    },
  ];

  const tipsNote = tipsEnabled && !occupationConfirmed && !isMfs
    ? 'Confirm your occupation is on the Treasury list to include tips.'
    : null;

  return (
    <section ref={rootRef} id="calculator" aria-labelledby="calculator-heading" className="scroll-mt-24">
      <h2 id="calculator-heading" className="text-2xl/[1.2] font-bold tracking-[-0.01em] text-ink md:text-[1.75rem]">
        Estimate your {TAX_YEAR} tips and overtime deduction
      </h2>

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
        {/* ------------------------------ Inputs ------------------------------ */}
        <form className="flex flex-col gap-6 lg:col-span-7" onSubmit={(e) => e.preventDefault()} noValidate>
          <RadioGroup legend="Filing status" name="obbba-filing-status" options={FILING_STATUSES} value={filingStatus} onChange={setFilingStatus} />

          <Field id="state" label="State" hint="Optional. Adds state income tax to the breakdown." className="sm:max-w-xs">
            <NativeSelect
              id="state"
              value={stateCode ?? ''}
              onChange={(e) => setStateCode((e.target.value || null) as StateCode | null)}
              aria-describedby="state-hint state-help"
            >
              <option value="">Choose a state</option>
              {STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
            {stateTax && (
              <div id="state-help" className="num mt-2 text-[15px] text-ink-2">
                {stateTax.structure === 'none' ? <NoStateTaxBadge /> : `${stateTax.rateLabel}, est. ${formatUSD(stateTax.tax)}`}
              </div>
            )}
          </Field>

          <Field
            id="magi"
            label="Modified adjusted gross income (MAGI)"
            hint="Your adjusted gross income (AGI) from Form 1040. If you have foreign or U.S. territory income, your MAGI may be higher than your AGI."
          >
            <div className="sm:max-w-xs">
              <CurrencyInput id="magi" value={magi} onValueChange={setMagi} placeholder="65,000" describedBy="magi-hint" />
            </div>
          </Field>

          <div>
            <Checkbox id="tips-enabled" checked={tipsEnabled} onChange={setTipsEnabled} controls="tips-panel">
              <span className="font-semibold">I received qualified tips</span>
              <span className="block text-[15px] text-ink-2">Voluntary cash or card tips from customers</span>
            </Checkbox>
            <Reveal id="tips-panel" open={tipsEnabled}>
              <Field id="tips-amount" label="Qualified tips (W-2 Box 12, code TP)" hint="No W-2 yet? Enter your total qualified tips for the year.">
                <div className="sm:max-w-xs">
                  <CurrencyInput ref={tipsInputRef} id="tips-amount" value={tipsAmount} onValueChange={setTipsAmount} placeholder="0" describedBy="tips-amount-hint" />
                </div>
              </Field>
              <Checkbox id="tips-occupation" checked={occupationConfirmed} onChange={setOccupationConfirmed}>
                My occupation is on the Treasury Department’s list of occupations that customarily received tips on or
                before December 31, 2024.
              </Checkbox>
            </Reveal>
          </div>

          <div>
            <Checkbox id="overtime-enabled" checked={overtimeEnabled} onChange={setOvertimeEnabled} controls="overtime-panel">
              <span className="font-semibold">I earned qualified overtime</span>
              <span className="block text-[15px] text-ink-2">Overtime required by the Fair Labor Standards Act (FLSA)</span>
            </Checkbox>
            <Reveal id="overtime-panel" open={overtimeEnabled}>
              <Field
                id="overtime-amount"
                label="Overtime premium (W-2 Box 12, code TT)"
                hint="Enter only the premium portion (the extra “half” in time-and-a-half), not your total overtime pay."
              >
                <div className="sm:max-w-xs">
                  <CurrencyInput ref={overtimeInputRef} id="overtime-amount" value={overtimeAmount} onValueChange={setOvertimeAmount} placeholder="0" describedBy="overtime-amount-hint" />
                </div>
              </Field>
              <Checkbox id="overtime-flsa" checked={flsaNonExempt} onChange={setFlsaNonExempt}>
                I am a non-exempt employee under the FLSA (I am legally entitled to overtime pay).
              </Checkbox>
            </Reveal>
          </div>

          <QualificationChecklist items={checklist} hasSsn={hasSsn} onSsnChange={setHasSsn} />
        </form>

        {/* ------------------------------ Results ----------------------------- */}
        <aside aria-labelledby="results-heading" className="flex flex-col gap-6 lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
          <div className="rounded-panel border border-line bg-green-tint p-5 sm:p-6">
            <h3 id="results-heading" className="font-semibold text-ink">
              Federal income tax saved
            </h3>
            <p className="num mt-1 text-[2.5rem]/[1.05] font-bold tracking-[-0.02em] text-ink sm:text-5xl/[1.05]">{formatUSD(savings)}</p>
            <p className="num mt-1 text-ink-2">
              Schedule 1-A deduction: <span className="font-semibold text-ink">{formatUSD(result.totalCombinedDeduction)}</span>
            </p>
            {coveredByStandardDeduction && <p className="mt-3 text-[15px] text-ink">{STANDARD_DEDUCTION_COVERS_NOTICE}</p>}
            {isMfs && <p className="mt-3 text-[15px] font-semibold text-ink">{MFS_NOTE}</p>}
            <p className="sr-only" aria-live="polite">
              Estimated federal income tax saved {formatUSD(savings)}. Total federal deduction {formatUSD(result.totalCombinedDeduction)}.
            </p>
          </div>

          <IncomeBreakdownBar magi={magiValue} deduction={result.totalCombinedDeduction} filingStatus={filingStatus} stateTax={stateTax} />

          <section aria-labelledby="deduction-breakdown-heading">
            <h3 id="deduction-breakdown-heading" className="font-semibold text-ink">
              Deduction breakdown
            </h3>
            <ul className="mt-2 border-t border-line">
              <CategoryRow title="Qualified tips (TP)" category={result.tips} enabled={tipsEnabled} note={tipsNote} />
              <CategoryRow title="Qualified overtime (TT)" category={result.overtime} enabled={overtimeEnabled} />
            </ul>
            <dl className="num">
              <Row label="Base deduction (after caps)" value={formatUSD(baseTotal)} />
              <Row label="MAGI phase-out reduction" value={reductionTotal > 0 ? `−${formatUSD(reductionTotal)}` : formatUSD(0)} />
              <Row label="Total deduction" value={formatUSD(result.totalCombinedDeduction)} strong />
            </dl>
          </section>

          <ExportSummaryActions
            result={result}
            tipsReported={tipsEnabled ? (tipsAmount ?? 0) : 0}
            overtimeReported={overtimeEnabled ? (overtimeAmount ?? 0) : 0}
            savings={savings}
            stateTax={stateTax}
          />

          <p className="border-l-4 border-warning bg-warning-tint px-4 py-3 text-[15px] text-ink">
            <span className="font-semibold">{result.ficaStillOwedNotice}</span> Estimates only, not tax advice. Savings assume
            the {TAX_YEAR} standard deduction and federal brackets and treat MAGI as AGI.{' '}
            <a href="/methodology/" className="text-link underline underline-offset-[3px]">
              How we calculate
            </a>
          </p>
        </aside>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2 ${strong ? 'border-t-2 border-ink font-bold' : 'border-t border-line'}`}>
      <dt className={strong ? 'text-ink' : 'text-ink-2'}>{label}</dt>
      <dd className="text-ink">{value}</dd>
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
  return (
    <li className="flex items-start justify-between gap-4 border-b border-line py-2.5">
      <div className="min-w-0">
        <p className="text-ink">{title}</p>
        {status && <p className="text-sm text-ink-2">{status}</p>}
      </div>
      <span className={`num shrink-0 font-semibold ${category.deductionFinal > 0 ? 'text-ink' : 'text-ink-2'}`}>{formatUSD(category.deductionFinal)}</span>
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

// Text status tags (docs/DESIGN.md §6) instead of colored icons; the words carry the meaning.
const CHECK_TAGS: Record<CheckStatus, { text: string; className: string }> = {
  pass: { text: 'Met', className: 'bg-green-tint text-green' },
  fail: { text: 'Not met', className: 'bg-page text-error ring-1 ring-inset ring-error' },
  warn: { text: 'Partly met', className: 'bg-warning-tint text-ink ring-1 ring-inset ring-warning' },
  pending: { text: 'To confirm', className: 'bg-surface text-ink-2' },
  na: { text: 'Not needed', className: 'text-muted' },
};

function QualificationChecklist(props: { items: CheckItem[]; hasSsn: boolean; onSsnChange: (v: boolean) => void }) {
  const { items, hasSsn, onSsnChange } = props;
  const met = items.filter((i) => i.status === 'pass').length;
  const applicable = items.filter((i) => i.status !== 'na').length;
  return (
    <section aria-labelledby="checklist-heading" className="border-t border-line pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="checklist-heading" className="text-xl/[1.3] font-bold text-ink">
          {TAX_YEAR} filing checklist
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
                {item.key === 'ssn' && (
                  <div className="mt-2">
                    <Checkbox id="has-ssn" checked={hasSsn} onChange={onSsnChange}>
                      I have a valid SSN (we never ask for the number)
                    </Checkbox>
                  </div>
                )}
              </div>
              <span className={`shrink-0 rounded-[2px] px-2 py-0.5 text-sm font-semibold ${tag.className}`}>{tag.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
