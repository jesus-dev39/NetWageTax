/**
 * paycheck.ts
 * Motor del calculador de nómina (hourly / salary → take-home pay) para 2026.
 *
 * Estima la obligación anual y la reparte por periodo de pago:
 * - Federal: deducción estándar 2026 + tramos 2026 (marginal-rate.ts).
 * - FICA: Social Security 6.2% hasta la base salarial 2026, Medicare 1.45%
 *   y Additional Medicare 0.9% sobre el umbral del estado civil (fica.ts).
 * - Estatal: modelo simplificado de state-tax-data.ts.
 *
 * No incluye deducciones pre-tax (401(k), seguro médico, HSA), ajustes del
 * W-4, impuestos locales ni la deducción OBBBA de horas extra.
 */

import { estimateAdditionalMedicare, MEDICARE_RATE, SOCIAL_SECURITY_RATE, SOCIAL_SECURITY_WAGE_BASE_2026 } from './fica';
import { computeFederalIncomeTax, getMarginalRate, STANDARD_DEDUCTION_2026 } from './marginal-rate';
import { calculateStateIncomeTax, type StateCode } from './state-tax-data';

export type PayMode = 'hourly' | 'salary';
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
export type PaycheckFilingStatus = 'single' | 'mfj' | 'hoh';

export const WEEKS_PER_YEAR = 52;
export const OVERTIME_MULTIPLIER = 1.5;

export const PAY_FREQUENCIES: { value: PayFrequency; label: string; periods: number; short: string }[] = [
  { value: 'weekly', label: 'Weekly', periods: 52, short: 'weekly' },
  { value: 'biweekly', label: 'Bi-Weekly', periods: 26, short: 'bi-weekly' },
  { value: 'semimonthly', label: 'Semi-Monthly', periods: 24, short: 'semi-monthly' },
  { value: 'monthly', label: 'Monthly', periods: 12, short: 'monthly' },
];

export const PAYCHECK_FILING_STATUSES: { value: PaycheckFilingStatus; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'mfj', label: 'Married Filing Jointly' },
  { value: 'hoh', label: 'Head of Household' },
];

export interface PaycheckInput {
  mode: PayMode;
  hourlyRate: number;
  hoursPerWeek: number;
  overtimeHoursPerWeek: number;
  annualSalary: number;
  frequency: PayFrequency;
  filingStatus: PaycheckFilingStatus;
  stateCode: StateCode | null;
}

export interface PaycheckResult {
  periods: number;
  regularPay: number;
  overtimePay: number;
  grossAnnual: number;
  standardDeduction: number;
  taxableIncome: number;
  marginalRate: number;
  federalTax: number;
  socialSecurity: number;
  /** Medicare 1.45% plus the 0.9% Additional Medicare Tax when it applies. */
  medicare: number;
  additionalMedicare: number;
  stateTax: number;
  totalTax: number;
  netAnnual: number;
  netPerPeriod: number;
}

const clamp = (n: number, max = Infinity) => (Number.isFinite(n) ? Math.min(Math.max(0, n), max) : 0);

export function periodsFor(frequency: PayFrequency): number {
  return PAY_FREQUENCIES.find((f) => f.value === frequency)!.periods;
}

export function calculatePaycheck(input: PaycheckInput): PaycheckResult {
  const periods = periodsFor(input.frequency);

  let regularPay: number;
  let overtimePay = 0;
  if (input.mode === 'hourly') {
    const rate = clamp(input.hourlyRate);
    regularPay = rate * clamp(input.hoursPerWeek, 168) * WEEKS_PER_YEAR;
    overtimePay = rate * OVERTIME_MULTIPLIER * clamp(input.overtimeHoursPerWeek, 168) * WEEKS_PER_YEAR;
  } else {
    regularPay = clamp(input.annualSalary);
  }
  const grossAnnual = regularPay + overtimePay;

  const standardDeduction = STANDARD_DEDUCTION_2026[input.filingStatus];
  const taxableIncome = Math.max(0, grossAnnual - standardDeduction);
  const federalTax = computeFederalIncomeTax(taxableIncome, input.filingStatus);

  const socialSecurity = Math.min(grossAnnual, SOCIAL_SECURITY_WAGE_BASE_2026) * SOCIAL_SECURITY_RATE;
  const additionalMedicare = estimateAdditionalMedicare(grossAnnual, input.filingStatus);
  const medicare = grossAnnual * MEDICARE_RATE + additionalMedicare;

  const stateTax = input.stateCode ? calculateStateIncomeTax(grossAnnual, input.stateCode) : 0;

  const totalTax = federalTax + socialSecurity + medicare + stateTax;
  const netAnnual = grossAnnual - totalTax;

  return {
    periods,
    regularPay,
    overtimePay,
    grossAnnual,
    standardDeduction,
    taxableIncome,
    marginalRate: taxableIncome > 0 ? getMarginalRate(taxableIncome, input.filingStatus) : 0,
    federalTax,
    socialSecurity,
    medicare,
    additionalMedicare,
    stateTax,
    totalTax,
    netAnnual,
    netPerPeriod: netAnnual / periods,
  };
}
