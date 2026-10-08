/**
 * deduction-summary.ts
 * Modelo de datos del resumen exportable (voucher de impresión y .docx).
 * Ambos formatos leen de aquí para que las cifras nunca diverjan.
 */

import { formatUSD } from '../components/CurrencyInput';
import { estimateEmployeeFica } from './fica';
import { isCoveredByStandardDeduction } from './marginal-rate';
import { stateTipsOvertimeNote } from './state-page-content';
import { STATES_BY_CODE, type StateTaxEstimate } from './state-tax-data';
import {
  PARAMS_BY_YEAR,
  type CategoryResult,
  type FilingStatus,
  type IneligibilityReason,
  type ObbbaResult,
} from './obbba-params';

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  single: 'Single',
  hoh: 'Head of Household',
  mfj: 'Married Filing Jointly',
  mfs: 'Married Filing Separately',
};

export const SUMMARY_DISCLAIMER = 'For estimation purposes only. Not official IRS tax filing.';

export const SUMMARY_LEGAL_NOTICE =
  'NetWageTax is an independent calculation tool and is not affiliated with the IRS or any government agency. ' +
  'This summary is an educational estimate, not a tax return and not tax, legal, or financial advice. ' +
  'Savings assume the standard deduction and federal income tax brackets for the tax year and treat MAGI as equal to AGI. ' +
  'Confirm your figures with the official IRS Schedule 1-A instructions or a CPA or enrolled agent.';

export const STANDARD_DEDUCTION_COVERS_NOTICE =
  'Standard deduction already covers 100% of your federal tax liability ($0 tax owed).';

export const SAVINGS_LINE_LABEL = 'Estimated federal tax savings';

export const DOCX_FILENAME = 'NetWageTax_2026_Deduction_Summary.docx';

export interface SummaryInput {
  result: ObbbaResult;
  /** Box 12 Code TP amount the user entered (0 if the tips section is off). */
  tipsReported: number;
  /** Box 12 Code TT amount the user entered (0 if the overtime section is off). */
  overtimeReported: number;
  savings: number;
  /** Selected state's estimated income tax; omitted when no state is chosen. */
  stateTax?: StateTaxEstimate | null;
}

export interface SummaryLine {
  label: string;
  value: string;
  detail?: string;
  /** Marks the headline result row. */
  total?: boolean;
}

/** One row of the worksheet: reported amount → cap → phase-out → allowed deduction. */
export interface WorksheetRow {
  label: string;
  code: 'TP' | 'TT';
  reported: number;
  cap: number;
  /** Deduction after the cap, before the phase-out. */
  afterCap: number;
  phaseoutReduction: number;
  allowed: number;
  /** Why nothing is allowed, when applicable. */
  note?: string;
}

export interface DeductionSummary {
  /** Short reference for the user's records, e.g. NWT-2026-7K3F9Q. Not an official identifier. */
  referenceId: string;
  generatedAt: string;
  magi: number;
  worksheet: WorksheetRow[];
  /** Estimated employee FICA on the reported tips and overtime. */
  fica: number;
  stateTax?: StateTaxEstimate | null;
  /** What the state does with tips and overtime and what the estimate subtracted ("Includes your $X state deduction."). */
  stateTipsOvertimeNote?: string;
  taxYear: number;
  filingStatus: string;
  totalDeduction: number;
  /** Headline figure: estimated federal income tax saved. */
  savings: number;
  /** Set when savings is $0 because the standard deduction already zeroes the tax. */
  savingsNote?: string;
  lines: SummaryLine[];
  ficaNotice: string;
}

const INELIGIBLE_NOTE: Record<IneligibilityReason, string> = {
  NOT_CLAIMED: 'Not claimed or not confirmed',
  MARRIED_FILING_SEPARATELY: 'Married filing separately: not eligible',
  SELF_EMPLOYED_SSTB: 'Specified service business: not eligible',
  FLSA_EXEMPT_EMPLOYEE: 'FLSA non-exempt status not confirmed',
};

/** FNV-1a hash → 6 base-36 characters. Stable for the same inputs and minute. */
export function referenceFor(parts: (string | number)[]): string {
  let h = 0x811c9dc5;
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).toUpperCase().padStart(6, '0').slice(-6);
}

const negative = (n: number) => (n > 0 ? `−${formatUSD(n)}` : formatUSD(0));

export function formatGeneratedAt(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' }).format(date);
}

export function buildDeductionSummary(input: SummaryInput, generatedAt: Date): DeductionSummary {
  const { result, tipsReported, overtimeReported, savings, stateTax } = input;
  const params = PARAMS_BY_YEAR[result.taxYear];
  const isMfj = result.filingStatus === 'mfj';
  const tipsCap = isMfj ? params.tips.capMfj : params.tips.capSingleOrHoh;
  const overtimeCap = isMfj ? params.overtime.capMfj : params.overtime.capSingleOrHoh;

  const base = result.tips.deductionBeforePhaseout + result.overtime.deductionBeforePhaseout;
  const reduction =
    Math.min(result.tips.phaseoutReduction, result.tips.deductionBeforePhaseout) +
    Math.min(result.overtime.phaseoutReduction, result.overtime.deductionBeforePhaseout);

  // FICA attributable to tips and overtime: the difference with and without them,
  // so the Social Security wage base is respected.
  const reported = Math.min(tipsReported + overtimeReported, result.magi);
  const fica = estimateEmployeeFica(result.magi).total - estimateEmployeeFica(result.magi - reported).total;

  const capDetail = (reportedAmount: number, cap: number) =>
    reportedAmount > cap ? `Limited from ${formatUSD(reportedAmount)}` : undefined;

  const row = (label: string, code: 'TP' | 'TT', c: CategoryResult, reported: number, cap: number): WorksheetRow => ({
    label,
    code,
    reported,
    cap,
    afterCap: c.deductionBeforePhaseout,
    phaseoutReduction: Math.min(c.phaseoutReduction, c.deductionBeforePhaseout),
    allowed: c.deductionFinal,
    note: !c.isEligible && c.ineligibilityReason ? INELIGIBLE_NOTE[c.ineligibilityReason] : undefined,
  });

  const minute = Math.floor(generatedAt.getTime() / 60_000);
  const referenceId = `NWT-${result.taxYear}-${referenceFor([minute, result.filingStatus, result.magi, tipsReported, overtimeReported, stateTax?.code ?? ''])}`;

  const stateNote = stateTax ? stateTipsOvertimeNote(STATES_BY_CODE[stateTax.code], stateTax.stateDeduction) : undefined;

  return {
    referenceId,
    magi: result.magi,
    worksheet: [
      row('Qualified tips', 'TP', result.tips, tipsReported, tipsCap),
      row('Qualified overtime premium', 'TT', result.overtime, overtimeReported, overtimeCap),
    ],
    fica,
    stateTax,
    stateTipsOvertimeNote: stateNote,
    generatedAt: formatGeneratedAt(generatedAt),
    taxYear: result.taxYear,
    filingStatus: FILING_STATUS_LABELS[result.filingStatus],
    totalDeduction: result.totalCombinedDeduction,
    savings,
    savingsNote: isCoveredByStandardDeduction(result.magi, result.filingStatus)
      ? STANDARD_DEDUCTION_COVERS_NOTICE
      : undefined,
    lines: [
      { label: 'Filing status', value: FILING_STATUS_LABELS[result.filingStatus] },
      ...(stateTax ? [{ label: 'State of residence', value: stateTax.name }] : []),
      { label: 'Estimated MAGI', value: formatUSD(result.magi) },
      { label: 'W-2 Box 12, Code TP (qualified tips)', value: formatUSD(tipsReported) },
      { label: 'W-2 Box 12, Code TT (overtime premium)', value: formatUSD(overtimeReported) },
      {
        label: 'Tips cap applied',
        value: formatUSD(tipsCap),
        detail: capDetail(tipsReported, tipsCap),
      },
      {
        label: 'Overtime cap applied',
        value: formatUSD(overtimeCap),
        detail: capDetail(overtimeReported, overtimeCap),
      },
      { label: 'Base deduction (after caps)', value: formatUSD(base) },
      { label: 'MAGI phase-out reduction', value: negative(reduction) },
      { label: 'Net federal tax deduction', value: formatUSD(result.totalCombinedDeduction), total: true },
      { label: SAVINGS_LINE_LABEL, value: formatUSD(savings) },
      {
        label: 'Estimated FICA still owed on tips & overtime',
        value: formatUSD(fica),
        detail: 'Social Security & Medicare, employee share',
      },
      ...(stateTax
        ? [
            {
              label: `Estimated state income tax (${stateTax.code})`,
              value: formatUSD(stateTax.tax),
              detail:
                stateTax.structure === 'none'
                  ? 'No state income tax'
                  : `${stateTax.rateLabel} · simplified single-filer estimate, excludes local taxes${stateNote ? `. ${stateNote}` : ''}`,
            },
          ]
        : []),
    ],
    ficaNotice: result.ficaStillOwedNotice,
  };
}
