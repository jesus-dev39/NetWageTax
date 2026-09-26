/**
 * state-tax-data.ts
 * Estimaciones del impuesto estatal sobre la renta (salarios) para 2026:
 * 50 estados + DC.
 *
 * Modelo (deliberadamente simple, ver SPEC):
 *   impuesto ≈ max(0, ingreso − exemptAmount) × estimateRate
 * - 'none':       sin impuesto sobre salarios.
 * - 'flat':       estimateRate = tipo estatutario; exemptAmount ≈ deducción
 *                 estándar / exención personal de un contribuyente single.
 * - 'graduated':  estimateRate = tipo medio sobre la renta gravable de un
 *                 contribuyente single con ~$65,000 de salario; útil para
 *                 salarios típicos, menos preciso en rentas muy altas o bajas.
 *
 * No incluye impuestos locales (condados, ciudades, school districts) ni
 * créditos estatales. La mayoría de estados NO aplican la deducción federal
 * OBBBA de propinas/horas extra, así que se calcula sobre el MAGI completo.
 *
 * Fuentes: departamentos de hacienda estatales y legislación 2025 aprobada
 * con efecto para el año fiscal 2026. Revisar cada enero (DATA_AS_OF).
 */

export const STATE_TAX_DATA_AS_OF = '2026 tax year (laws enacted through mid-2026)';

/** Salario de referencia con el que se calibraron los tipos 'graduated'. */
export const GRADUATED_REFERENCE_WAGE = 65_000;

export type StateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'DC' | 'FL' | 'GA' | 'HI' | 'ID'
  | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME' | 'MD' | 'MA' | 'MI' | 'MN' | 'MS' | 'MO'
  | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ' | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA'
  | 'RI' | 'SC' | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY';

export type TaxStructure = 'none' | 'flat' | 'graduated';

export interface StateTaxInfo {
  code: StateCode;
  name: string;
  slug: string;
  structure: TaxStructure;
  /** Rate (0–1) applied to income above exemptAmount in the estimate. */
  estimateRate: number;
  /** Approximate single-filer income not subject to the rate (standard deduction, exemptions, 0% bracket). */
  exemptAmount: number;
  /** Graduated states: lowest and highest statutory marginal rates (0–1). */
  bracketRange?: [number, number];
  note: string;
  /** Local income taxes that the estimate does not include. */
  localTaxNote?: string;
}

type Row = Omit<StateTaxInfo, 'slug'>;

const NO_TAX = (code: StateCode, name: string, note: string): Row => ({
  code, name, structure: 'none', estimateRate: 0, exemptAmount: 0, note,
});

const FLAT = (code: StateCode, name: string, rate: number, exemptAmount: number, note: string, localTaxNote?: string): Row => ({
  code, name, structure: 'flat', estimateRate: rate, exemptAmount, note, localTaxNote,
});

const GRAD = (
  code: StateCode, name: string, estimateRate: number, exemptAmount: number,
  bracketRange: [number, number], note: string, localTaxNote?: string,
): Row => ({ code, name, structure: 'graduated', estimateRate, exemptAmount, bracketRange, note, localTaxNote });

const ROWS: Row[] = [
  GRAD('AL', 'Alabama', 0.044, 4_000, [0.02, 0.05], 'Three brackets (2%–5%). Alabama is one of the few states that lets you deduct federal income tax paid.', 'Some cities (e.g., Birmingham) levy a 1% occupational tax.'),
  NO_TAX('AK', 'Alaska', 'Alaska has no state income tax or statewide sales tax, and pays residents an annual Permanent Fund Dividend.'),
  FLAT('AZ', 'Arizona', 0.025, 16_100, 'Flat 2.5% since 2023, one of the lowest flat rates in the country. Uses the federal standard deduction.'),
  GRAD('AR', 'Arkansas', 0.032, 2_410, [0.02, 0.039], 'Top rate cut to 3.9% in 2024. Low-income filers pay reduced rates.'),
  GRAD('CA', 'California', 0.033, 5_700, [0.01, 0.133], 'Nine brackets from 1% to 12.3%, plus a 1% Mental Health Services Tax above $1 million. California does not follow the federal tips and overtime deduction.'),
  FLAT('CO', 'Colorado', 0.044, 16_100, 'Flat 4.4%, calculated from federal taxable income. TABOR refunds can temporarily lower the rate.', 'Denver and a few other cities charge a small monthly occupational privilege tax.'),
  GRAD('CT', 'Connecticut', 0.0435, 0, [0.02, 0.0699], 'Seven brackets (2%–6.99%). The personal exemption phases out by about $44,000 for single filers.'),
  GRAD('DE', 'Delaware', 0.048, 3_250, [0.022, 0.066], 'Brackets from 2.2% to 6.6% above $60,000. Delaware has no state sales tax.', 'Wilmington levies a 1.25% city wage tax.'),
  GRAD('DC', 'District of Columbia', 0.057, 16_100, [0.04, 0.1075], 'Seven brackets from 4% to 10.75%. Uses the federal standard deduction.'),
  NO_TAX('FL', 'Florida', 'Florida has no personal income tax. Article VII, Section 5 of the Florida Constitution prohibits one.'),
  FLAT('GA', 'Georgia', 0.0509, 12_000, 'Flat tax since 2024. The rate steps down 0.10 point a year toward 4.99% (5.09% scheduled for 2026).'),
  GRAD('HI', 'Hawaii', 0.064, 9_100, [0.014, 0.11], 'Twelve brackets up to 11%. Recent laws are doubling the standard deduction and widening brackets through 2031.'),
  FLAT('ID', 'Idaho', 0.053, 20_900, 'Flat 5.3% on income above a 0% band, after the federal standard deduction.'),
  FLAT('IL', 'Illinois', 0.0495, 2_850, 'Flat 4.95%, set by the Illinois Constitution, which requires a single rate.'),
  FLAT('IN', 'Indiana', 0.0295, 1_000, 'Flat rate cut to 2.95% for 2026.', 'All 92 counties add a local income tax, typically 1%–3%.'),
  FLAT('IA', 'Iowa', 0.038, 16_100, 'Flat 3.8% since 2025, calculated from federal taxable income. Retirement income is exempt.', 'Some school districts add a surtax as a percentage of state tax.'),
  GRAD('KS', 'Kansas', 0.054, 12_765, [0.052, 0.0558], 'Two brackets (5.2% and 5.58%) since 2024.', 'Some localities tax interest and dividends; wages are not locally taxed.'),
  FLAT('KY', 'Kentucky', 0.035, 3_300, 'Flat rate cut to 3.5% for 2026.', 'Most cities and counties charge occupational license taxes on wages (often 1%–2.5%).'),
  FLAT('LA', 'Louisiana', 0.03, 12_500, 'Flat 3% since 2025, with a $12,500 standard deduction.'),
  GRAD('ME', 'Maine', 0.062, 21_250, [0.058, 0.0715], 'Three brackets (5.8%–7.15%). Uses the federal standard deduction plus a personal exemption.'),
  GRAD('MD', 'Maryland', 0.047, 6_550, [0.02, 0.065], 'State brackets from 2% to 6.5%, with new top brackets added in 2025.', 'Every county adds a local income tax of 2.25%–3.3%, not included here.'),
  FLAT('MA', 'Massachusetts', 0.05, 4_400, 'Flat 5%, plus a 4% surtax on income above about $1.08 million (the "millionaires tax").'),
  FLAT('MI', 'Michigan', 0.0425, 5_800, 'Flat 4.25%.', 'Detroit (2.4%) and about 20 other cities levy their own income tax.'),
  GRAD('MN', 'Minnesota', 0.059, 15_300, [0.0535, 0.0985], 'Four brackets from 5.35% to 9.85%.'),
  FLAT('MS', 'Mississippi', 0.04, 18_300, 'The first $10,000 of taxable income is exempt, then 4% for 2026, stepping down to 3% by 2030.'),
  GRAD('MO', 'Missouri', 0.044, 16_100, [0.02, 0.047], 'Brackets up to 4.7%, reached at a low income. Uses the federal standard deduction.', 'Kansas City and St. Louis charge a 1% earnings tax.'),
  GRAD('MT', 'Montana', 0.052, 16_100, [0.047, 0.0565], 'Two brackets; the top rate drops to 5.65% for 2026. Starts from federal taxable income.'),
  GRAD('NE', 'Nebraska', 0.037, 8_600, [0.0246, 0.0455], 'The top rate drops to 4.55% for 2026 on the way to 3.99%.'),
  NO_TAX('NV', 'Nevada', 'Nevada has no personal income tax. The Nevada Constitution (Article 10, Section 1) prohibits one.'),
  NO_TAX('NH', 'New Hampshire', 'No tax on wages. The Interest and Dividends Tax was fully repealed starting in 2025.'),
  GRAD('NJ', 'New Jersey', 0.032, 1_000, [0.014, 0.1075], 'Seven brackets from 1.4% to 10.75%.', 'Newark charges employers a 1% payroll tax.'),
  GRAD('NM', 'New Mexico', 0.039, 16_100, [0.015, 0.059], 'Six brackets from 1.5% to 5.9%, restructured in 2025. Uses the federal standard deduction.'),
  GRAD('NY', 'New York', 0.051, 8_000, [0.039, 0.109], 'Nine brackets up to 10.9%. Rates for the lower brackets were trimmed starting in 2026.', 'New York City adds 3.078%–3.876%; Yonkers adds a resident surcharge.'),
  FLAT('NC', 'North Carolina', 0.0399, 12_750, 'Flat rate cut to 3.99% for 2026, with further cuts possible if revenue triggers are met.'),
  GRAD('ND', 'North Dakota', 0.0195, 64_575, [0, 0.025], 'Most workers owe nothing: the first ~$48,000 of taxable income is taxed at 0%, then 1.95% and 2.5%.'),
  FLAT('OH', 'Ohio', 0.0275, 26_050, 'New flat 2.75% for 2026 on income above $26,050.', 'Most cities and many school districts levy income taxes of 1%–2.5%.'),
  GRAD('OK', 'Oklahoma', 0.041, 7_350, [0.025, 0.045], 'Brackets consolidated and the top rate cut to 4.5% for 2026.'),
  GRAD('OR', 'Oregon', 0.069, 2_800, [0.0475, 0.099], 'Four brackets up to 9.9%, with a small standard deduction. Oregon has no sales tax.', 'Portland Metro and Multnomah County add taxes on higher incomes.'),
  FLAT('PA', 'Pennsylvania', 0.0307, 0, 'Flat 3.07% with no standard deduction or personal exemption.', 'Most municipalities levy an earned income tax (usually ~1%; Philadelphia 3.74%).'),
  GRAD('RI', 'Rhode Island', 0.0375, 16_000, [0.0375, 0.0599], 'Three brackets (3.75%–5.99%).'),
  GRAD('SC', 'South Carolina', 0.047, 16_100, [0, 0.06], 'Brackets of 0%, 3% and 6%, calculated from federal taxable income.'),
  NO_TAX('SD', 'South Dakota', 'South Dakota has no personal income tax.'),
  NO_TAX('TN', 'Tennessee', 'No tax on wages. The Hall tax on investment income was fully repealed in 2021, and the Tennessee Constitution bans a payroll tax.'),
  NO_TAX('TX', 'Texas', 'Texas has 0% state income tax. Article VIII, Section 24-a of the Texas Constitution prohibits a personal income tax.'),
  FLAT('UT', 'Utah', 0.045, 0, 'Flat 4.5%. A taxpayer credit (not included) lowers the tax for most low- and middle-income filers.'),
  GRAD('VT', 'Vermont', 0.036, 12_500, [0.0335, 0.0875], 'Four brackets from 3.35% to 8.75%.'),
  GRAD('VA', 'Virginia', 0.053, 9_430, [0.02, 0.0575], 'Four brackets; the 5.75% top rate starts at just $17,000 of taxable income.'),
  NO_TAX('WA', 'Washington', 'No tax on wages. Washington taxes only long-term capital gains above a large exemption.'),
  GRAD('WV', 'West Virginia', 0.035, 2_000, [0.0222, 0.0482], 'Five brackets, cut several times since 2023 (2025 schedule shown).'),
  GRAD('WI', 'Wisconsin', 0.046, 7_200, [0.035, 0.0765], 'Four brackets from 3.5% to 7.65%. The standard deduction phases down as income rises.'),
  NO_TAX('WY', 'Wyoming', 'Wyoming has no personal or corporate income tax.'),
];

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, '-');

export const STATES: readonly StateTaxInfo[] = ROWS.map((r) => ({ ...r, slug: slugify(r.name) })).sort((a, b) =>
  a.name.localeCompare(b.name),
);

export const STATES_BY_CODE = Object.fromEntries(STATES.map((s) => [s.code, s])) as Record<StateCode, StateTaxInfo>;

/** Accepts a state code ("tx") or slug ("texas"). */
export function findState(value: string | null | undefined): StateTaxInfo | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  return STATES.find((s) => s.code.toLowerCase() === v || s.slug === v);
}

/** Estimated state income tax on wages (USD). See the model at the top of this file. */
export function calculateStateIncomeTax(taxableIncome: number, stateCode: StateCode): number {
  const s = STATES_BY_CODE[stateCode];
  return Math.max(0, taxableIncome - s.exemptAmount) * s.estimateRate;
}

const pct = (r: number) => `${+(r * 100).toFixed(2)}%`;

/** "0% State Tax" · "3.99% Flat Tax" · "1%–13.3% Progressive". */
export function formatStateRate(s: StateTaxInfo): string {
  if (s.structure === 'none') return '0% State Tax';
  if (s.structure === 'flat') return `${pct(s.estimateRate)} Flat Tax`;
  const [lo, hi] = s.bracketRange!;
  return `${pct(lo)}–${pct(hi)} Progressive`;
}

export const STRUCTURE_LABELS: Record<TaxStructure, string> = {
  none: 'No Income Tax States',
  flat: 'Flat Tax States',
  graduated: 'Progressive Tax States',
};

/** What the calculator, breakdown chart and exports need about the chosen state. */
export interface StateTaxEstimate {
  code: StateCode;
  name: string;
  structure: TaxStructure;
  rateLabel: string;
  tax: number;
}

export function estimateStateTax(income: number, stateCode: StateCode): StateTaxEstimate {
  const s = STATES_BY_CODE[stateCode];
  return {
    code: s.code,
    name: s.name,
    structure: s.structure,
    rateLabel: formatStateRate(s),
    tax: calculateStateIncomeTax(income, stateCode),
  };
}
