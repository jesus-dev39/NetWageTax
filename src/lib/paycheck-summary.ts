/**
 * paycheck-summary.ts
 * Modelo del resumen exportable del calculador de nómina (impresión y .docx).
 * Es una ESTIMACIÓN: nunca debe parecer un recibo de nómina real.
 */

import { formatUSD, formatUSDCents } from '../components/CurrencyInput';
import { referenceFor } from './deduction-summary';
import { ADDITIONAL_MEDICARE_THRESHOLD, SOCIAL_SECURITY_WAGE_BASE_2026 } from './fica';
import { PAY_FREQUENCIES, PAYCHECK_FILING_STATUSES, type PaycheckInput, type PaycheckResult } from './paycheck';
import { formatStateRate, STATES_BY_CODE } from './state-tax-data';

export const PAYCHECK_TAX_YEAR = 2026;
export const PAYCHECK_DOCX_FILENAME = 'NetWageTax_2026_Paycheck_Estimate.docx';

export const PAYCHECK_NOT_A_PAYSTUB = 'Estimate only. Not a pay stub, earnings statement, or proof of income.';

export const PAYCHECK_DISCLAIMER =
  'NetWageTax is an independent calculation tool and is not affiliated with the IRS, any employer, or any payroll provider. ' +
  'This estimate is generated from figures you entered and assumes 2026 federal brackets with the standard deduction, no pre-tax ' +
  'deductions (401(k), health insurance, HSA), no local income taxes, and standard Form W-4 withholding. Your actual paycheck ' +
  'will differ. It is educational information, not tax, legal, or financial advice.';

export type PaycheckRowKind = 'earning' | 'gross' | 'tax' | 'subtotal' | 'net';

export interface PaycheckSummaryRow {
  label: string;
  detail?: string;
  perPeriod: number;
  annual: number;
  kind: PaycheckRowKind;
}

export interface PaycheckSummary {
  referenceId: string;
  generatedAt: string;
  taxYear: number;
  frequencyLabel: string;
  frequencyShort: string;
  periods: number;
  filingStatus: string;
  stateName: string | null;
  earnings: string;
  gross: { perPeriod: number; annual: number };
  taxes: { perPeriod: number; annual: number };
  net: { perPeriod: number; annual: number };
  rows: PaycheckSummaryRow[];
}

const pct = (r: number) => `${+(r * 100).toFixed(2)}%`;

export function describeEarnings(input: PaycheckInput): string {
  if (input.mode === 'salary') return `${formatUSD(input.annualSalary || 0)} annual salary`;
  const ot = input.overtimeHoursPerWeek > 0 ? ` + ${input.overtimeHoursPerWeek} overtime hrs at 1.5×` : '';
  return `${formatUSDCents(input.hourlyRate || 0)}/hr × ${input.hoursPerWeek || 0} hrs/week${ot}`;
}

/** Line items shared by the on-screen table, the print estimate, and the Word file. */
export function buildPaycheckRows(input: PaycheckInput, r: PaycheckResult): PaycheckSummaryRow[] {
  const row = (label: string, annual: number, kind: PaycheckRowKind, detail?: string): PaycheckSummaryRow => ({
    label,
    detail,
    perPeriod: annual / r.periods,
    annual,
    kind,
  });
  const state = input.stateCode ? STATES_BY_CODE[input.stateCode] : null;
  const addlThreshold = ADDITIONAL_MEDICARE_THRESHOLD[input.filingStatus];

  return [
    ...(r.overtimePay > 0
      ? [
          row('Regular pay', r.regularPay, 'earning', `${input.hoursPerWeek} hrs/week × 52 weeks`),
          row('Overtime pay (1.5×)', r.overtimePay, 'earning', `${input.overtimeHoursPerWeek} hrs/week × 52 weeks`),
        ]
      : []),
    row('Gross pay', r.grossAnnual, 'gross', describeEarnings(input)),
    row(
      'Federal income tax',
      r.federalTax,
      'tax',
      `${PAYCHECK_TAX_YEAR} brackets · ${formatUSD(r.standardDeduction)} standard deduction · ${pct(r.marginalRate)} marginal rate`,
    ),
    row('Social Security', r.socialSecurity, 'tax', `6.2% of wages up to ${formatUSD(SOCIAL_SECURITY_WAGE_BASE_2026)}`),
    row(
      'Medicare',
      r.medicare,
      'tax',
      r.additionalMedicare > 0 ? `1.45% + 0.9% Additional Medicare above ${formatUSD(addlThreshold)}` : '1.45% of all wages',
    ),
    row(
      state ? `State income tax (${state.code})` : 'State income tax',
      r.stateTax,
      'tax',
      state ? `${state.name} · ${formatStateRate(state)} · excludes local taxes` : 'No state selected',
    ),
    row('Total taxes withheld (est.)', r.totalTax, 'subtotal'),
    row('Net take-home pay', r.netAnnual, 'net'),
  ];
}

export function buildPaycheckSummary(input: PaycheckInput, r: PaycheckResult, generatedAt: Date): PaycheckSummary {
  const freq = PAY_FREQUENCIES.find((f) => f.value === input.frequency)!;
  const per = (n: number) => n / r.periods;
  const state = input.stateCode ? STATES_BY_CODE[input.stateCode] : null;
  const rows = buildPaycheckRows(input, r);

  const minute = Math.floor(generatedAt.getTime() / 60_000);
  const referenceId = `NWT-${PAYCHECK_TAX_YEAR}-${referenceFor([
    'paycheck',
    minute,
    input.mode,
    r.grossAnnual,
    input.frequency,
    input.filingStatus,
    input.stateCode ?? '',
  ])}`;

  return {
    referenceId,
    generatedAt: new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' }).format(generatedAt),
    taxYear: PAYCHECK_TAX_YEAR,
    frequencyLabel: freq.label,
    frequencyShort: freq.short,
    periods: r.periods,
    filingStatus: PAYCHECK_FILING_STATUSES.find((f) => f.value === input.filingStatus)!.label,
    stateName: state?.name ?? null,
    earnings: describeEarnings(input),
    gross: { perPeriod: per(r.grossAnnual), annual: r.grossAnnual },
    taxes: { perPeriod: per(r.totalTax), annual: r.totalTax },
    net: { perPeriod: r.netPerPeriod, annual: r.netAnnual },
    rows,
  };
}
