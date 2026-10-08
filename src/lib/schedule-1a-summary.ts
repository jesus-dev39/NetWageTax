/**
 * schedule-1a-summary.ts
 * Exportable worksheet (print voucher, Word, Excel) for the senior deduction and car loan interest
 * calculators. Both build the same shape, so one voucher, one Word builder, and one Excel builder
 * serve them, and the three formats never disagree.
 */

import { formatUSD } from '../components/CurrencyInput';
import { CAR_LOAN_INELIGIBLE_COPY, type CarLoanInterestResult } from './car-loan-interest';
import { FILING_STATUS_LABELS, referenceFor, STANDARD_DEDUCTION_COVERS_NOTICE, formatGeneratedAt } from './deduction-summary';
import type { FederalTaxComparison } from './marginal-rate';
import { CAR_LOAN_PARAMS_BY_YEAR, SENIOR_PARAMS_BY_YEAR, seniorBirthCutoffLabel } from './obbba-params';
import { seniorIneligibilityNote, type SeniorDeductionResult } from './senior-deduction';
import { SCHEDULE_1A_DRAFT_NOTICE } from './site';

/** One row of the step-by-step table. Numbers are dollars; negative numbers are reductions. */
export interface WorksheetRow {
  label: string;
  detail?: string;
  values: (number | string)[];
  total?: boolean;
}

export interface Schedule1aSummary {
  tool: 'senior' | 'car-loan';
  /** "2026 senior deduction worksheet" */
  title: string;
  /** Line under the title: what the deduction is, the Schedule 1-A part, and the filing status. */
  context: string;
  referenceId: string;
  generatedAt: string;
  taxYear: number;
  filingStatus: string;
  magi: number;
  deduction: number;
  /** Headline figure: estimated federal income tax saved. */
  savings: number;
  federal: FederalTaxComparison;
  deductionLabel: string;
  /** Set when savings is $0 because the standard deduction already zeroes the tax. */
  savingsNote?: string;
  /** Why the deduction is $0 (a requirement not met, or fully phased out). */
  zeroReason?: string;
  tableTitle: string;
  /** Column headings; the first is the row label. */
  columns: string[];
  rows: WorksheetRow[];
  tableNote?: string;
  /** Reminders the user confirms on their own (car loan), not checked by the worksheet. */
  checklist?: { title: string; intro: string; items: string[] };
  /** "Before you file" notices. */
  notices: string[];
  /** Legal basis line in the footer. */
  basis: string;
  /** File name without extension, e.g. NetWageTax_2026_Senior_Deduction. */
  fileBase: string;
}

/** A worksheet value as shown in the PDF and Word: dollars (negative = reduction, true minus sign) or text. */
export const worksheetValue = (v: number | string) => (typeof v === 'string' ? v : v < 0 ? `−${formatUSD(-v)}` : formatUSD(v));

export const ESTIMATE_NOTICE =
  'This is an estimate, not a tax return. Confirm the amount with the official Schedule 1-A instructions or a CPA or enrolled agent.';

/** A reduction as a negative number, without -0. */
const neg = (n: number) => (n > 0 ? -n : 0);
const pct = (r: number) => `${+(r * 100).toFixed(2)}%`;
const reference = (year: number, parts: (string | number)[], at: Date) =>
  `NWT-${year}-${referenceFor([Math.floor(at.getTime() / 60_000), ...parts])}`;

// ---------------------------------------------------------------------------
// Senior deduction (Schedule 1-A, Part V)
// ---------------------------------------------------------------------------

export interface SeniorSummaryInput {
  result: SeniorDeductionResult;
  /** Federal income tax with and without the deduction, as the calculator shows it. */
  federal: FederalTaxComparison;
  /** The standard deduction already zeroes the tax. */
  coveredByStandardDeduction: boolean;
  taxpayerIs65: boolean;
  spouseIs65: boolean;
}

export function buildSeniorSummary(input: SeniorSummaryInput, generatedAt: Date): Schedule1aSummary {
  const { result: r, federal } = input;
  const params = SENIOR_PARAMS_BY_YEAR[r.taxYear];
  const rate = params.phaseout.kind === 'rate' ? params.phaseout.rate : 0;
  const cutoff = seniorBirthCutoffLabel(r.taxYear);
  const isMfs = r.filingStatus === 'mfs';

  const person = (label: string, is65: boolean): WorksheetRow => {
    const qualifies = !isMfs && is65;
    return {
      label,
      detail: isMfs ? 'Married filing separately: not eligible' : qualifies ? `Born before ${cutoff}` : `Not born before ${cutoff}: doesn’t qualify`,
      values: qualifies ? [r.amountPerPerson, neg(r.reductionPerPerson), r.deductionPerPerson] : [0, 0, 0],
    };
  };
  const rows = [person('You', input.taxpayerIs65)];
  if (r.filingStatus === 'mfj') rows.push(person('Your spouse', input.spouseIs65));
  rows.push({ label: 'Senior deduction', values: [r.maxDeduction, neg(r.reductionTotal), r.deductionFinal], total: true });

  const zeroReason =
    seniorIneligibilityNote(r) ??
    (r.deductionFinal === 0 ? `Fully phased out: the deduction reaches $0 at ${formatUSD(r.fullPhaseoutMagi)} of MAGI.` : undefined);

  return {
    tool: 'senior',
    title: `${r.taxYear} senior deduction worksheet`,
    context: `Deduction for people 65 and older · Schedule 1-A, Part V · ${FILING_STATUS_LABELS[r.filingStatus]}`,
    referenceId: reference(r.taxYear, ['senior', r.filingStatus, r.magi, Number(input.taxpayerIs65), Number(input.spouseIs65)], generatedAt),
    generatedAt: formatGeneratedAt(generatedAt),
    taxYear: r.taxYear,
    filingStatus: FILING_STATUS_LABELS[r.filingStatus],
    magi: r.magi,
    deduction: r.deductionFinal,
    savings: federal.saved,
    federal,
    deductionLabel: 'senior deduction',
    savingsNote: input.coveredByStandardDeduction && r.deductionFinal > 0 ? STANDARD_DEDUCTION_COVERS_NOTICE : undefined,
    zeroReason,
    tableTitle: 'Deduction for each person',
    columns: ['Person', 'Base amount', 'Phase-out reduction', 'Deduction'],
    rows,
    tableNote:
      r.excessMagi > 0
        ? `Phase-out: ${pct(rate)} of MAGI over ${formatUSD(r.threshold)} (${formatUSD(r.excessMagi)}) is ${formatUSD(r.excessMagi * rate)}, taken from each qualifying person’s ${formatUSD(r.amountPerPerson)}, down to $0.`
        : `MAGI is not over the ${formatUSD(r.threshold)} phase-out threshold: no reduction.`,
    notices: [
      'The senior deduction lowers your federal income tax. It doesn’t eliminate the tax on Social Security benefits: the taxable part of your benefits stays in your income.',
      'Each person who claims it needs a Social Security number valid for employment.',
      SCHEDULE_1A_DRAFT_NOTICE,
      ESTIMATE_NOTICE,
    ],
    basis: 'Calculated under IRC §151(d)(5)(C) and the 2026 draft Schedule 1-A, Part V.',
    fileBase: `NetWageTax_${r.taxYear}_Senior_Deduction`,
  };
}

// ---------------------------------------------------------------------------
// Car loan interest (Schedule 1-A, Part IV)
// ---------------------------------------------------------------------------

export interface CarLoanSummaryInput {
  result: CarLoanInterestResult;
  federal: FederalTaxComparison;
  coveredByStandardDeduction: boolean;
}

export const CAR_LOAN_REQUIREMENTS = [
  'The vehicle is new: its original use started with you.',
  'Its final assembly took place in the United States.',
  'You took out the loan after December 31, 2024, to buy the vehicle, and it’s secured by a first lien on it.',
  'It’s a car, minivan, van, SUV, pickup truck, or motorcycle with a gross vehicle weight rating under 14,000 pounds.',
  'You expect to use it for personal use more than 50% of the time.',
  'It isn’t a lease, and the lender isn’t a relative or a business related to you.',
];

export function buildCarLoanSummary(input: CarLoanSummaryInput, generatedAt: Date): Schedule1aSummary {
  const { result: r, federal } = input;
  const params = CAR_LOAN_PARAMS_BY_YEAR[r.taxYear];
  const perStep = params.phaseout.kind === 'step' ? params.phaseout.perStep : 0;
  const stepSize = params.phaseout.kind === 'step' ? params.phaseout.stepSize : 0;
  const ineligible = r.ineligibilityReason ? CAR_LOAN_INELIGIBLE_COPY[r.ineligibilityReason] : undefined;

  const zeroReason =
    ineligible ??
    (r.deductionFinal === 0 && r.afterCap > 0
      ? `Fully phased out: the ${formatUSD(r.phaseoutReduction)} reduction at your MAGI is at least the ${formatUSD(r.afterCap)} of interest after the cap.`
      : undefined);

  const rows: WorksheetRow[] = [
    { label: 'Interest you entered', detail: 'Form 1098-VLI, box 1, for each qualifying loan', values: [r.interestPaid] },
    {
      label: `After the ${formatUSD(r.cap)} cap`,
      detail: ineligible
        ? 'Vehicle doesn’t qualify: nothing counts'
        : r.interestPaid > r.cap
          ? `Limited from ${formatUSD(r.interestPaid)}`
          : 'Under the cap',
      values: [r.afterCap],
    },
    {
      label: `MAGI over ${formatUSD(r.threshold)}`,
      detail:
        r.phaseoutSteps > 0
          ? `${r.phaseoutSteps} ${r.phaseoutSteps === 1 ? 'step' : 'steps'} of ${formatUSD(stepSize)}, part steps rounded up`
          : 'No phase-out',
      values: [r.excessMagi],
    },
    {
      label: 'Phase-out reduction',
      detail:
        r.afterCap === 0
          ? `${formatUSD(perStep)} per step; nothing left to reduce`
          : `${formatUSD(perStep)} per step${r.phaseoutReduction > r.reductionApplied ? `, limited to the ${formatUSD(r.afterCap)} after the cap` : ''}`,
      values: [neg(r.reductionApplied)],
    },
    { label: 'Car loan interest deduction', values: [r.deductionFinal], total: true },
  ];

  return {
    tool: 'car-loan',
    title: `${r.taxYear} car loan interest deduction worksheet`,
    context: `Interest on a loan for a new, U.S.-assembled vehicle · Schedule 1-A, Part IV · ${FILING_STATUS_LABELS[r.filingStatus]}`,
    referenceId: reference(r.taxYear, ['car-loan', r.filingStatus, r.magi, r.interestPaid, r.ineligibilityReason ?? ''], generatedAt),
    generatedAt: formatGeneratedAt(generatedAt),
    taxYear: r.taxYear,
    filingStatus: FILING_STATUS_LABELS[r.filingStatus],
    magi: r.magi,
    deduction: r.deductionFinal,
    savings: federal.saved,
    federal,
    deductionLabel: 'car loan interest deduction',
    savingsNote: input.coveredByStandardDeduction && r.deductionFinal > 0 ? STANDARD_DEDUCTION_COVERS_NOTICE : undefined,
    zeroReason,
    tableTitle: 'Step-by-step calculation',
    columns: ['Step', 'Amount'],
    rows,
    checklist: {
      title: 'Vehicle and loan requirements',
      intro: 'Reminders only: this worksheet doesn’t check them. Confirm each one before you claim it.',
      items: CAR_LOAN_REQUIREMENTS,
    },
    notices: [
      'Enter each vehicle’s VIN on Schedule 1-A: the deduction isn’t allowed without it.',
      'This is a federal deduction. Some states, such as Oregon, don’t allow it on the state return.',
      SCHEDULE_1A_DRAFT_NOTICE,
    ],
    basis: 'Calculated under IRC §163(h)(4), TD 10054, and the 2026 draft Schedule 1-A, Part IV.',
    fileBase: `NetWageTax_${r.taxYear}_Car_Loan_Interest_Deduction`,
  };
}
