/**
 * paycheck.ts
 * Motor del calculador de nómina (hourly / salary → take-home pay) para 2026.
 *
 * Estima la obligación anual y la reparte por periodo de pago:
 * - Federal: deducción estándar 2026 + tramos 2026 (marginal-rate.ts).
 * - FICA: Social Security 6.2% hasta la base salarial 2026, Medicare 1.45%
 *   y Additional Medicare 0.9% sobre el umbral del estado civil (fica.ts).
 * - Estatal: state-tax-data.ts (tramos completos en los estados del motor,
 *   estimación simplificada en los demás).
 * - Descuentos estatales de nómina (SDI, PFML...): state-payroll-deductions.ts. Son
 *   post-tax: se restan del neto sin cambiar la base de ningún impuesto.
 *
 * No incluye deducciones pre-tax (401(k), seguro médico, HSA), ajustes del
 * W-4, impuestos locales ni la deducción OBBBA de horas extra.
 */

import { estimateAdditionalMedicare, MEDICARE_RATE, SOCIAL_SECURITY_RATE, SOCIAL_SECURITY_WAGE_BASE_2026 } from './fica';
import { computeFederalIncomeTax, getMarginalRate, STANDARD_DEDUCTION_2026 } from './marginal-rate';
import { statePayrollDeductions, type StatePayrollDeductions } from './state-payroll-deductions';
import { calculateStateIncomeTax, type StateCode } from './state-tax-data';

export type PayMode = 'hourly' | 'salary';
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
export type PaycheckFilingStatus = 'single' | 'mfj' | 'hoh';

export const WEEKS_PER_YEAR = 52;
export const OVERTIME_MULTIPLIER = 1.5;
/** Hours in a week: the most regular plus overtime hours can add up to. */
export const MAX_HOURS_PER_WEEK = 168;

export const PAY_FREQUENCIES: { value: PayFrequency; label: string; periods: number; short: string }[] = [
  { value: 'weekly', label: 'Weekly', periods: 52, short: 'weekly' },
  { value: 'biweekly', label: 'Biweekly', periods: 26, short: 'biweekly' },
  { value: 'semimonthly', label: 'Semimonthly', periods: 24, short: 'semimonthly' },
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
  /** State payroll deductions (SDI, PFML...), post-tax; null when the state has none. */
  statePayroll: StatePayrollDeductions | null;
  /** Everything withheld: income taxes, FICA, and state payroll deductions. */
  totalTax: number;
  netAnnual: number;
  netPerPeriod: number;
}

/** Error message for each invalid hourly field, as typed; an empty object means every field is valid. */
export interface HourlyFieldErrors {
  hourlyRate?: string;
  hoursPerWeek?: string;
  overtimeHours?: string;
}

const hoursValue = (raw: string): number | null => {
  const n = Number(raw.trim());
  return raw.trim() === '' || raw.trim() === '.' || !Number.isFinite(n) ? null : n;
};

/**
 * Hourly mode: the rate must be over $0, regular hours 0–168, and overtime 0 to 168 minus the regular hours.
 * A rate not entered yet (null) isn't an error: there's just nothing to calculate.
 */
export function validateHourlyFields(hourlyRate: number | null, hoursPerWeek: string, overtimeHours: string): HourlyFieldErrors {
  const errors: HourlyFieldErrors = {};
  if (hourlyRate !== null && !(hourlyRate > 0)) errors.hourlyRate = 'Enter an hourly rate greater than $0.';

  const regular = hoursValue(hoursPerWeek);
  const regularValid = regular !== null && regular >= 0 && regular <= MAX_HOURS_PER_WEEK;
  if (!regularValid) errors.hoursPerWeek = `Enter regular hours from 0 to ${MAX_HOURS_PER_WEEK} a week.`;

  const overtime = hoursValue(overtimeHours);
  const maxOvertime = MAX_HOURS_PER_WEEK - (regularValid ? regular : 0);
  if (overtime === null || overtime < 0 || overtime > maxOvertime) {
    errors.overtimeHours = regularValid
      ? `Enter overtime from 0 to ${+maxOvertime.toFixed(2)} hours a week (${MAX_HOURS_PER_WEEK} minus your regular hours).`
      : `Enter overtime from 0 to ${MAX_HOURS_PER_WEEK} hours a week.`;
  }
  return errors;
}

export const hasErrors = (errors: HourlyFieldErrors) => Object.keys(errors).length > 0;

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
    regularPay = rate * clamp(input.hoursPerWeek, MAX_HOURS_PER_WEEK) * WEEKS_PER_YEAR;
    overtimePay = rate * OVERTIME_MULTIPLIER * clamp(input.overtimeHoursPerWeek, MAX_HOURS_PER_WEEK) * WEEKS_PER_YEAR;
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

  const stateTax = input.stateCode ? calculateStateIncomeTax(grossAnnual, input.stateCode, input.filingStatus) : 0;

  const statePayroll = statePayrollDeductions(input.stateCode, grossAnnual);

  const totalTax = federalTax + socialSecurity + medicare + stateTax + (statePayroll?.total ?? 0);
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
    statePayroll,
    totalTax,
    netAnnual,
    netPerPeriod: netAnnual / periods,
  };
}
