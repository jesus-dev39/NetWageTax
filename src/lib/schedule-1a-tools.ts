/**
 * The Schedule 1-A calculators, for the home page tool list and the "Other Schedule 1-A
 * deductions" links on each calculator page. One list so the titles and blurbs stay the same.
 */

import { formatUSD } from '../components/CurrencyInput';
import { CAR_LOAN_PARAMS_BY_YEAR, SENIOR_PARAMS_BY_YEAR } from './obbba-params';
import { SITE_TAX_YEAR } from './site';

export interface ToolLink {
  href: string;
  title: string;
  body: string;
}

export const SCHEDULE_1A_TOOLS: ToolLink[] = [
  {
    href: '/tools/obbba-tax-calculator/',
    title: 'Tips and overtime deduction',
    body: `Estimate your ${SITE_TAX_YEAR} Schedule 1-A deduction and what it saves in federal tax.`,
  },
  {
    href: '/tools/senior-deduction-calculator/',
    title: 'Senior deduction',
    body: `The extra ${formatUSD(SENIOR_PARAMS_BY_YEAR[SITE_TAX_YEAR].amountPerPerson)} deduction for people 65 and older, after the income phase-out.`,
  },
  {
    href: '/tools/car-loan-interest-deduction-calculator/',
    title: 'Car loan interest deduction',
    body: `Up to ${formatUSD(CAR_LOAN_PARAMS_BY_YEAR[SITE_TAX_YEAR].capPerReturn)} of interest on a loan taken out after 2024 for a new vehicle assembled in the United States.`,
  },
];
