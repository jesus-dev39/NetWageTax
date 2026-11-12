/**
 * guide-2027-brackets.ts
 * Datos y textos de la guía /guides/2027-tax-brackets/. Todas las cifras salen de las
 * constantes _2026 y _2027 que usan (o usarán en enero) las calculadoras: la página no escribe
 * ningún importe a mano, y los tests comprueban que coinciden.
 */
import { formatUSD, formatUSDCents } from '../components/CurrencyInput';
import { SOCIAL_SECURITY_RATE, SOCIAL_SECURITY_WAGE_BASE_2026, SOCIAL_SECURITY_WAGE_BASE_2027 } from './fica';
import {
  ADDITIONAL_STANDARD_DEDUCTION_AGED_2026,
  ADDITIONAL_STANDARD_DEDUCTION_AGED_2027,
  STANDARD_DEDUCTION_2026,
  STANDARD_DEDUCTION_2027,
  TAX_BRACKETS_2026,
  TAX_BRACKETS_2027,
  taxFromBrackets,
  type Bracket,
} from './marginal-rate';
import { CAR_LOAN_PARAMS_BY_YEAR, PARAMS_BY_YEAR, SENIOR_PARAMS_BY_YEAR, type FilingStatus } from './obbba-params';
import { SITE_TAX_YEAR } from './site';

export const BRACKETS_2027_GUIDE_PATH = '/guides/2027-tax-brackets/';
export const BRACKETS_2027_GUIDE_TITLE = '2027 Tax Brackets and Standard Deduction (IRS Rev. Proc. 2026-35)';
export const BRACKETS_2027_PUBLISHED = '2026-11-12';
export const BRACKETS_2027_LAST_CHECKED = '2026-11-12';
/** Fecha en que el IRS publicó la Rev. Proc. 2026-35 y la nota IR-2026-133. */
export const REV_PROC_2026_35_RELEASED = '2026-11-05';

export const BRACKETS_2027_SOURCES = [
  { label: 'IRS: Revenue Procedure 2026-35 (PDF)', href: 'https://www.irs.gov/pub/irs-drop/rp-26-35.pdf' },
  {
    label: 'IRS: IR-2026-133, IRS releases tax inflation adjustments for tax year 2027 (November 5, 2026)',
    href: 'https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2027-taxpayers-continue-to-benefit-from-the-working-families-tax-cuts',
  },
  { label: 'Social Security Administration: contribution and benefit base', href: 'https://www.ssa.gov/oact/cola/cbb.html' },
] as const;

export const FILING_STATUS_ORDER: readonly FilingStatus[] = ['single', 'mfj', 'hoh', 'mfs'];

export const FILING_STATUS_NAME: Record<FilingStatus, string> = {
  single: 'Single',
  mfj: 'Married filing jointly',
  hoh: 'Head of household',
  mfs: 'Married filing separately',
};

/** Ids de las tablas de tramos, para el índice y los enlaces. */
export const BRACKET_TABLE_ID: Record<FilingStatus, string> = {
  single: 'brackets-single',
  mfj: 'brackets-mfj',
  hoh: 'brackets-hoh',
  mfs: 'brackets-mfs',
};

export const pct = (r: number) => `${+(r * 100).toFixed(2)}%`;

/** "+$500", "−$68" (signo menos real, U+2212) o "No change". */
export function signedUSD(d: number): string {
  const r = Math.round(d);
  if (r === 0) return 'No change';
  return `${r > 0 ? '+' : '−'}${formatUSD(Math.abs(r))}`;
}

/** Cifra "plus" de las tablas del IRS: con céntimos solo si los tiene ($199,237.75, $1,280). */
export const formatTaxBelow = (n: number) => (Number.isInteger(Math.round(n * 100) / 100) ? formatUSD(n) : formatUSDCents(n));

export interface BracketRow {
  rate: number;
  /** Límite inferior: la renta imponible por encima de esta cifra paga `rate`. */
  over: number;
  /** Límite superior, o null en el último tramo. */
  upTo: number | null;
  /** Impuesto de todos los tramos anteriores (la cifra "plus" de las tablas del IRS). */
  taxBelow: number;
}

export function bracketRows(brackets: readonly Bracket[]): BracketRow[] {
  return brackets.map((b, i) => {
    const over = i === 0 ? 0 : brackets[i - 1].upTo;
    return { rate: b.rate, over, upTo: Number.isFinite(b.upTo) ? b.upTo : null, taxBelow: taxFromBrackets(over, brackets) };
  });
}

export const BRACKET_TABLES_2027 = FILING_STATUS_ORDER.map((status) => ({
  status,
  id: BRACKET_TABLE_ID[status],
  name: FILING_STATUS_NAME[status],
  rows: bracketRows(TAX_BRACKETS_2027[status]),
}));

export const STANDARD_DEDUCTION_ROWS = FILING_STATUS_ORDER.map((status) => ({
  status,
  name: FILING_STATUS_NAME[status],
  y2026: STANDARD_DEDUCTION_2026[status],
  y2027: STANDARD_DEDUCTION_2027[status],
  change: STANDARD_DEDUCTION_2027[status] - STANDARD_DEDUCTION_2026[status],
}));

export const AGED_ADDITION_ROWS = [
  {
    name: 'Unmarried (single or head of household)',
    y2026: ADDITIONAL_STANDARD_DEDUCTION_AGED_2026.unmarried,
    y2027: ADDITIONAL_STANDARD_DEDUCTION_AGED_2027.unmarried,
  },
  {
    name: 'Married, for each spouse',
    y2026: ADDITIONAL_STANDARD_DEDUCTION_AGED_2026.married,
    y2027: ADDITIONAL_STANDARD_DEDUCTION_AGED_2027.married,
  },
].map((r) => ({ ...r, change: r.y2027 - r.y2026 }));

/** Impuesto federal con solo la deducción estándar y sin créditos, en 2026 o 2027. */
export function federalTaxWithStandardDeduction(income: number, status: FilingStatus, year: 2026 | 2027): { taxable: number; tax: number } {
  const deduction = year === 2026 ? STANDARD_DEDUCTION_2026[status] : STANDARD_DEDUCTION_2027[status];
  const brackets = year === 2026 ? TAX_BRACKETS_2026[status] : TAX_BRACKETS_2027[status];
  const taxable = Math.max(0, income - deduction);
  return { taxable, tax: taxFromBrackets(taxable, brackets) };
}

export const EXAMPLE_INPUTS: readonly { status: FilingStatus; income: number }[] = [
  { status: 'single', income: 65_000 },
  { status: 'mfj', income: 120_000 },
  { status: 'hoh', income: 80_000 },
];

export const EXAMPLES = EXAMPLE_INPUTS.map(({ status, income }) => {
  const a = federalTaxWithStandardDeduction(income, status, 2026);
  const b = federalTaxWithStandardDeduction(income, status, 2027);
  return {
    status,
    income,
    label: `${FILING_STATUS_NAME[status]}, ${formatUSD(income)}`,
    taxable2026: a.taxable,
    taxable2027: b.taxable,
    tax2026: a.tax,
    tax2027: b.tax,
    change: b.tax - a.tax,
  };
});

/** Inicio del tramo del 37% (límite superior del 35%) por estado civil y año. */
const topStart = (brackets: readonly Bracket[]) => brackets[brackets.length - 2].upTo;
export const TOP_RATE = TAX_BRACKETS_2027.single[TAX_BRACKETS_2027.single.length - 1].rate;
export const HOH_TOP_NOTE = {
  hoh2027: topStart(TAX_BRACKETS_2027.hoh),
  single2027: topStart(TAX_BRACKETS_2027.single),
  /** True si en 2026 el 37% empezaba en la misma cifra para HoH y single. */
  equalIn2026: topStart(TAX_BRACKETS_2026.hoh) === topStart(TAX_BRACKETS_2026.single),
  start2026: topStart(TAX_BRACKETS_2026.single),
};

const obbba = PARAMS_BY_YEAR[2027];
const senior = SENIOR_PARAMS_BY_YEAR[2027];
const carLoan = CAR_LOAN_PARAMS_BY_YEAR[2027];

export const SOCIAL_SECURITY_ROW = {
  rate: SOCIAL_SECURITY_RATE,
  y2026: SOCIAL_SECURITY_WAGE_BASE_2026,
  y2027: SOCIAL_SECURITY_WAGE_BASE_2027,
  change: SOCIAL_SECURITY_WAGE_BASE_2027 - SOCIAL_SECURITY_WAGE_BASE_2026,
};

/** Importes del Schedule 1-A en 2027: fijados por la ley, sin ajuste por inflación. */
export const SCHEDULE_1A_2027 = [
  {
    label: 'Qualified tips',
    value: `Up to ${formatUSD(obbba.tips.capSingleOrHoh)}`,
    href: '/tools/obbba-tax-calculator/',
    linkLabel: 'Tips and overtime calculator',
  },
  {
    label: 'Qualified overtime premium',
    value: `Up to ${formatUSD(obbba.overtime.capSingleOrHoh)} (${formatUSD(obbba.overtime.capMfj)} joint)`,
    href: '/tools/obbba-tax-calculator/',
    linkLabel: 'Tips and overtime calculator',
  },
  {
    label: 'Enhanced deduction for seniors',
    value: `${formatUSD(senior.amountPerPerson)} per person 65 or older`,
    href: '/tools/senior-deduction-calculator/',
    linkLabel: 'Senior deduction calculator',
  },
  {
    label: 'Car loan interest',
    value: `Up to ${formatUSD(carLoan.capPerReturn)} per return`,
    href: '/tools/car-loan-interest-deduction-calculator/',
    linkLabel: 'Car loan interest calculator',
  },
] as const;

const single = STANDARD_DEDUCTION_ROWS.find((r) => r.status === 'single')!;
const mfj = STANDARD_DEDUCTION_ROWS.find((r) => r.status === 'mfj')!;
const hoh = STANDARD_DEDUCTION_ROWS.find((r) => r.status === 'hoh')!;
const firstSingle = TAX_BRACKETS_2027.single[0].upTo;
const firstMfj = TAX_BRACKETS_2027.mfj[0].upTo;
const ex1 = EXAMPLES[0];

export const BRACKETS_2027_DESCRIPTION =
  `2027 federal tax brackets and standard deduction from IRS Rev. Proc. 2026-35: ${formatUSD(single.y2027)} single, ` +
  `${formatUSD(mfj.y2027)} joint, ${formatUSD(hoh.y2027)} head of household, compared with 2026.`;

// Respuestas en texto plano: se reutilizan tal cual en los datos estructurados FAQPage.
export const BRACKETS_2027_FAQS = [
  {
    question: 'When do the 2027 tax brackets apply?',
    answer: [
      'They apply to income you earn from January 1 to December 31, 2027, which you report on the tax return you file in 2028 (normally due in April 2028).',
      `The return you file in early 2027 covers 2026 income, so it still uses the 2026 brackets and standard deduction.${SITE_TAX_YEAR < 2027 ? ' That is also why this site keeps calculating 2026 until January.' : ''}`,
    ],
  },
  {
    question: 'How much is the standard deduction for 2027?',
    answer: [
      `${formatUSD(single.y2027)} for single filers and married people filing separately, ${formatUSD(mfj.y2027)} for married couples filing jointly, and ${formatUSD(hoh.y2027)} for heads of household. That is ${formatUSD(single.change)}, ${formatUSD(mfj.change)}, and ${formatUSD(hoh.change)} more than in 2026.`,
      `If you are 65 or older, you add ${formatUSD(ADDITIONAL_STANDARD_DEDUCTION_AGED_2027.unmarried)} if you are unmarried, or ${formatUSD(ADDITIONAL_STANDARD_DEDUCTION_AGED_2027.married)} for each spouse 65 or older on a married return. The same additional amounts apply for blindness.`,
    ],
  },
  {
    question: 'Will I pay less federal income tax in 2027?',
    answer: [
      `If your income stays the same, usually a little less, because the brackets and the standard deduction rise with inflation. A single filer earning ${formatUSD(ex1.income)} would owe about ${formatUSD(Math.abs(Math.round(ex1.change)))} less in 2027 than in 2026, using only the standard deduction and no credits.`,
      'If your pay rises by about the rate of inflation, your tax stays about the same share of your income. Your employer’s withholding switches to the 2027 tables in January.',
    ],
  },
  {
    question: 'Does moving into a higher bracket mean all my income is taxed at that rate?',
    answer: [
      `No. Each rate applies only to the part of your taxable income inside its bracket. In 2027 a single filer pays ${pct(TAX_BRACKETS_2027.single[0].rate)} on the first ${formatUSD(firstSingle)} of taxable income (${formatUSD(firstMfj)} on a joint return), ${pct(TAX_BRACKETS_2027.single[1].rate)} on the next part, and so on. A raise that crosses into a higher bracket is taxed at the higher rate only above the threshold.`,
    ],
  },
  {
    question: 'Do the tips, overtime, senior, and car loan deductions change in 2027?',
    answer: [
      `No. The One Big Beautiful Bill Act set them in dollars with no inflation adjustment, and Rev. Proc. 2026-35 doesn’t change them: up to ${formatUSD(obbba.tips.capSingleOrHoh)} of qualified tips, up to ${formatUSD(obbba.overtime.capSingleOrHoh)} of qualified overtime premium (${formatUSD(obbba.overtime.capMfj)} on a joint return), ${formatUSD(senior.amountPerPerson)} for each person 65 or older, and up to ${formatUSD(carLoan.capPerReturn)} of car loan interest. All four run through 2028, with the same income phase-outs.`,
    ],
  },
];

/** Año que calculan las herramientas hoy (la guía lo dice para que nadie espere cifras de 2027). */
export const CALCULATORS_TAX_YEAR = SITE_TAX_YEAR;
