/**
 * state-payroll-deductions.ts
 * Descuentos estatales de nómina al trabajador en 2026: seguros de incapacidad y de baja
 * (SDI, TDI, PFML...), el WA Cares de Washington, la parte del trabajador del seguro de
 * desempleo (NJ, AK, PA) y el Statewide Transit Tax de Oregon.
 *
 * - Se aplica la parte MÁXIMA que la empresa puede descontar al trabajador.
 * - Los topes son por empresa y por año: se aplican sobre el salario anual del cálculo.
 * - Son post-tax: se restan del neto, pero no cambian la base de los impuestos sobre la renta.
 * - Los impuestos locales siguen fuera.
 *
 * Casi todos los tipos y topes cambian cada enero (docs/MAINTENANCE.md, calendario).
 */

import { SOCIAL_SECURITY_WAGE_BASE_2026 } from './fica';
import type { StateCode } from './state-tax-data';
import type { TipsOvertimeSource } from './state-tips-overtime';

/** One deduction: `rate` of wages up to `wageCap`, limited per week or per year when the state sets a maximum. */
export interface PayrollProgram {
  /** Short name used in the row detail, e.g. "SDI", "PFL", "WA Cares". */
  name: string;
  /** Employee rate (0–1), the most the employer may withhold. */
  rate: number;
  /** Wages above this amount (per employer, per year) aren't charged. Omitted = no cap. */
  wageCap?: number;
  /** Most that can be withheld in a week (worked out on annual wages ÷ 52). */
  weeklyMax?: number;
  /** Most that can be withheld in a year. */
  annualMax?: number;
}

export interface StatePayrollRule {
  /** Row label in the paycheck breakdown, e.g. "California SDI". Empty when there's no deduction. */
  label: string;
  programs: PayrollProgram[];
  /** Extra assumption shown with the deduction (Delaware) or instead of it (Maryland, Vermont). */
  note?: string;
  sources: TipsOvertimeSource[];
  /** Date we last checked the figures (YYYY-MM-DD). */
  checked: string;
}

/** Shown with every state payroll deduction. */
export const PAYROLL_MAX_SHARE_NOTE = 'Assumes the maximum employee share; some employers pay part of it or have a private plan.';

const C1029 = '2026-10-29';
const SS_CAP = SOCIAL_SECURITY_WAGE_BASE_2026;

export const STATE_PAYROLL_RULES: Partial<Record<StateCode, StatePayrollRule>> = {
  CA: {
    label: 'California SDI',
    programs: [{ name: 'SDI', rate: 0.013 }],
    sources: [{ label: 'EDD: 2026 Federal and State Payroll Taxes (DE 202) (PDF)', url: 'https://edd.ca.gov/siteassets/files/pdf_pub_ctr/de202.pdf', date: '2026' }],
    checked: C1029,
  },
  NY: {
    label: 'New York SDI & PFL',
    programs: [
      // WCL §209: one-half of one percent of wages, no more than 60 cents a week.
      { name: 'SDI', rate: 0.005, weeklyMax: 0.6 },
      // 0.432% up to the state average weekly wage ($1,833.63) × 52: at most $411.91 a year.
      { name: 'PFL', rate: 0.00432, annualMax: 411.91 },
    ],
    sources: [
      { label: 'Workers’ Compensation Board: Disability Benefits and Paid Family Leave Insurance', url: 'https://www.wcb.ny.gov/content/main/DisabilityBenefits/employer-disability-benefits.jsp' },
      { label: 'New York Paid Family Leave: Updates for 2026', url: 'https://paidfamilyleave.ny.gov/2026', date: '2026' },
    ],
    checked: C1029,
  },
  NJ: {
    label: 'New Jersey TDI, FLI, UI & WF/SWF',
    programs: [
      { name: 'TDI', rate: 0.0019, wageCap: 171_100 },
      { name: 'FLI', rate: 0.0023, wageCap: 171_100 },
      // Worker UI 0.3825% + Workforce Development/Supplemental Workforce Fund 0.0425%.
      { name: 'UI + WF/SWF', rate: 0.00425, wageCap: 44_800 },
    ],
    sources: [{ label: 'NJ Department of Labor: Rate information (worker rates, January 1 to December 31, 2026)', url: 'https://www.nj.gov/labor/ea/employer-services/rate-info/', date: '2026' }],
    checked: C1029,
  },
  WA: {
    label: 'Washington PFML & WA Cares',
    programs: [
      // 1.13% premium, up to 71.43% of it paid by the employee.
      { name: 'PFML', rate: 0.0113 * 0.7143, wageCap: SS_CAP },
      { name: 'WA Cares', rate: 0.0058 },
    ],
    sources: [
      { label: 'Paid Leave: Your role and responsibilities (2026 premium)', url: 'https://paidleave.wa.gov/employer-roles-responsibilities/', date: '2026' },
      { label: 'WA Cares Fund: Employer information', url: 'https://wacaresfund.wa.gov/employers' },
    ],
    checked: C1029,
  },
  MA: {
    label: 'Massachusetts PFML',
    // 0.28% medical leave (40% of the 0.70% medical contribution) + 0.18% family leave (100% of it).
    programs: [{ name: 'PFML', rate: 0.0046, wageCap: SS_CAP }],
    sources: [{ label: 'Mass.gov: Paid Family and Medical Leave employer contribution rates and calculator', url: 'https://www.mass.gov/info-details/paid-family-and-medical-leave-employer-contribution-rates-and-calculator', date: '2026' }],
    checked: C1029,
  },
  OR: {
    label: 'Oregon Paid Leave & Statewide Transit Tax',
    programs: [
      // 60% of the 1% contribution.
      { name: 'Paid Leave Oregon', rate: 0.006, wageCap: SS_CAP },
      { name: 'Statewide Transit Tax', rate: 0.001 },
    ],
    sources: [
      { label: 'Paid Leave Oregon: Contributions calculator', url: 'https://paidleave.oregon.gov/employers/contributions-calculator.html' },
      { label: 'Oregon Department of Revenue: 2026 Combined Payroll Tax Report instructions (PDF)', url: 'https://www.oregon.gov/dor/forms/FormsPubs/combined-payroll_211-155-2_2026.pdf', date: '2026' },
      { label: 'Oregon Employment Department: Employer News (transit tax stays at 0.1%) (PDF)', url: 'https://www.oregon.gov/employ/Businesses/Documents/Employer%20News%20Archived%20issues/Employer%20News%2002.12.2026.pdf', date: 'February 12, 2026' },
    ],
    checked: C1029,
  },
  RI: {
    label: 'Rhode Island TDI',
    programs: [{ name: 'TDI', rate: 0.011, wageCap: 100_000 }],
    sources: [{ label: 'RI Department of Labor and Training: 2026 Tax Rates for Unemployment Insurance and Temporary Disability Insurance', url: 'https://dlt.ri.gov/press-releases/2026-tax-rates-unemployment-insurance-and-temporary-disability-insurance' }],
    checked: C1029,
  },
  HI: {
    label: 'Hawaii TDI',
    // HRS §392-43: up to 0.5% of weekly wages; 2026 maximum weekly wage base $1,500.21, so at most $7.50 a week.
    programs: [{ name: 'TDI', rate: 0.005, weeklyMax: 7.5 }],
    sources: [{ label: 'DLIR Disability Compensation Division: 2026 Maximum Weekly Wage Base (PDF)', url: 'https://labor.hawaii.gov/dcd/files/2025/12/2026-Maximum-Weekly-Wage-Base.pdf', date: 'December 10, 2025' }],
    checked: C1029,
  },
  CO: {
    label: 'Colorado FAMLI',
    programs: [{ name: 'FAMLI', rate: 0.0044, wageCap: SS_CAP }],
    sources: [{ label: 'FAMLI Division: Employer FAQs', url: 'https://famli.colorado.gov/employers/employer-faqs' }],
    checked: C1029,
  },
  CT: {
    label: 'Connecticut Paid Leave',
    programs: [{ name: 'CT Paid Leave', rate: 0.005, wageCap: SS_CAP }],
    sources: [{ label: 'CT Paid Leave Authority: Contributions', url: 'https://www.ctpaidleave.org/how-ct-paid-leave-works/contributions', date: '2026' }],
    checked: C1029,
  },
  MN: {
    label: 'Minnesota Paid Leave',
    // Cap: the Social Security wage base rounded to the nearest thousand.
    programs: [{ name: 'Paid Leave', rate: 0.0044, wageCap: 185_000 }],
    sources: [{ label: 'DEED: Small employer premium rate designation (PDF)', url: 'https://mn.gov/deed/assets/paid-leave-small-employer-premium-rate-designation-acc_tcm1045-716947.pdf', date: '2026' }],
    checked: C1029,
  },
  DE: {
    label: 'Delaware Paid Leave',
    programs: [{ name: 'Paid Leave', rate: 0.004, wageCap: SS_CAP }],
    note: 'Assumes an employer with 25 or more employees. Employers with 10 to 24 employees cover parental leave only (up to 0.16% from your pay), and smaller ones aren’t covered.',
    sources: [{ label: 'Delaware Department of Labor: Notice of the start of contributions (PDF)', url: 'https://laborfiles.delaware.gov/main/pfl/Notice_of_the_Start_of_Contributions.pdf' }],
    checked: C1029,
  },
  ME: {
    label: 'Maine PFML',
    programs: [{ name: 'PFML', rate: 0.005, wageCap: SS_CAP }],
    sources: [{ label: 'Maine Department of Labor: Paid Family and Medical Leave employer FAQ (PDF)', url: 'https://www.maine.gov/paidleave/docs/2026/employers/faq/employerFAQenglish.pdf', date: 'June 2026' }],
    checked: C1029,
  },
  AK: {
    label: 'Alaska UI',
    programs: [{ name: 'UI', rate: 0.005, wageCap: 54_200 }],
    sources: [{ label: 'Alaska Department of Labor: 2026 Unemployment Insurance Tax Rates', url: 'https://labor.alaska.gov/estax/2026-experience-rates.html', date: '2026' }],
    checked: C1029,
  },
  PA: {
    label: 'Pennsylvania UC',
    programs: [{ name: 'UC', rate: 0.0007 }],
    sources: [{ label: 'Pennsylvania Department of Labor & Industry: Employee Withholding', url: 'https://www.pa.gov/agencies/dli/resources/for-employers-and-educators/how-to-file/uc-tax/employee-withholding' }],
    checked: C1029,
  },
  MD: {
    label: '',
    programs: [],
    note: 'Maryland’s paid family and medical leave (FAMLI) contributions don’t start until January 1, 2027, so nothing is withheld in 2026.',
    sources: [{ label: 'Maryland FAMLI: About the program', url: 'https://paidleave.maryland.gov/about-the-program/' }],
    checked: C1029,
  },
  VT: {
    label: '',
    programs: [],
    note: 'Vermont’s 0.44% Child Care Contribution is an employer tax. Employers may withhold up to 0.11% of your wages for it, or nothing; we don’t include it.',
    sources: [{ label: 'Vermont Department of Taxes: Child Care Contribution', url: 'https://tax.vermont.gov/business/child-care-contribution' }],
    checked: C1029,
  },
};

export interface PayrollDeductionLine {
  name: string;
  amount: number;
  /** "1.3% of all wages", "0.19% of wages up to $171,100"... */
  detail: string;
}

export interface StatePayrollDeductions {
  label: string;
  total: number;
  lines: PayrollDeductionLine[];
  /** PAYROLL_MAX_SHARE_NOTE plus the state's own note. */
  note: string;
}

const pct = (r: number) => `${+(r * 100).toFixed(4)}%`;
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

export function programAmount(p: PayrollProgram, annualWages: number): number {
  const wages = Math.max(0, annualWages);
  if (p.weeklyMax !== undefined) return Math.min(p.rate * (wages / 52), p.weeklyMax) * 52;
  const amount = p.rate * Math.min(wages, p.wageCap ?? Infinity);
  return Math.min(amount, p.annualMax ?? Infinity);
}

function programDetail(p: PayrollProgram): string {
  const base = `${p.name} ${pct(p.rate)}`;
  if (p.weeklyMax !== undefined) return `${base}, up to ${usd(p.weeklyMax)} a week`;
  if (p.annualMax !== undefined) return `${base}, up to ${usd(p.annualMax)} a year`;
  return p.wageCap ? `${base} of wages up to ${usd(p.wageCap)}` : `${base} of all wages`;
}

/** The state's employee payroll deductions on `annualWages`; null when the state has none. */
export function statePayrollDeductions(stateCode: StateCode | null, annualWages: number): StatePayrollDeductions | null {
  const rule = stateCode ? STATE_PAYROLL_RULES[stateCode] : undefined;
  if (!rule || rule.programs.length === 0) return null;
  const lines = rule.programs.map((p) => ({ name: p.name, amount: programAmount(p, annualWages), detail: programDetail(p) }));
  return {
    label: rule.label,
    total: lines.reduce((t, l) => t + l.amount, 0),
    lines,
    note: rule.note ? `${PAYROLL_MAX_SHARE_NOTE} ${rule.note}` : PAYROLL_MAX_SHARE_NOTE,
  };
}

/** Note for states with no deduction to apply (Maryland, Vermont); undefined otherwise. */
export function statePayrollNoteOnly(stateCode: StateCode | null): string | undefined {
  const rule = stateCode ? STATE_PAYROLL_RULES[stateCode] : undefined;
  return rule && rule.programs.length === 0 ? rule.note : undefined;
}
